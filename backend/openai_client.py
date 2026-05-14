import hashlib
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

_MOCK = os.getenv("MOCK_AI", "false").lower() == "true"
_KEY = os.getenv("OPENAI_API_KEY", "")
_GPT_MODEL = os.getenv("GPT_MODEL", "gpt-4o")
_EMB_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002")

_client: OpenAI | None = None
EMBEDDING_DIM = 1536


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=_KEY)
    return _client


def embed_text(text: str) -> list[float]:
    if _MOCK:
        return _mock_embedding(text)
    response = _get_client().embeddings.create(model=_EMB_MODEL, input=text[:8000])
    return response.data[0].embedding


def embed_texts_batch(texts: list[str]) -> list[list[float]]:
    if _MOCK:
        return [_mock_embedding(t) for t in texts]
    results: list[list[float]] = []
    for i in range(0, len(texts), 10):
        batch = [t[:8000] for t in texts[i: i + 10]]
        response = _get_client().embeddings.create(model=_EMB_MODEL, input=batch)
        ordered = sorted(response.data, key=lambda x: x.index)
        results.extend([item.embedding for item in ordered])
    return results


def describe_image(base64_image: str, image_format: str, alt_text: str) -> str:
    if _MOCK:
        return f"[MOCK] Image ({image_format}): {alt_text or 'no alt text'}."
    messages = [{"role": "user", "content": [
        {"type": "text", "text": "Describe this image in detail, including any text, charts, diagrams, or visual elements."},
        {"type": "image_url", "image_url": {"url": f"data:image/{image_format};base64,{base64_image}"}},
    ]}]
    response = _get_client().chat.completions.create(model=_GPT_MODEL, messages=messages, max_tokens=512)
    return response.choices[0].message.content or ""


def chat_with_context(question: str, text_context: str, image_chunks: list[dict]) -> str:
    if _MOCK:
        return f"**[MOCK MODE]**\n\nYou asked: _{question}_\n\nContext: {text_context[:300]}…"

    content: list[dict] = [{"type": "text", "text": (
        "You are a document assistant. Answer the user's question based ONLY on the provided "
        "document context. If the answer is not in the context, say so.\n\n"
        f"DOCUMENT CONTEXT:\n{text_context}"
    )}]
    for img in image_chunks[:3]:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/{img['format']};base64,{img['base64']}"}})
    content.append({"type": "text", "text": f"USER QUESTION: {question}"})

    response = _get_client().chat.completions.create(
        model=_GPT_MODEL,
        messages=[{"role": "user", "content": content}],
        max_tokens=1024,
    )
    return response.choices[0].message.content or ""


def _mock_embedding(text: str) -> list[float]:
    h = hashlib.sha256(text.encode()).digest()
    raw = []
    while len(raw) < EMBEDDING_DIM:
        raw.extend([(b - 128) / 128.0 for b in h])
    vec = raw[:EMBEDDING_DIM]
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]
