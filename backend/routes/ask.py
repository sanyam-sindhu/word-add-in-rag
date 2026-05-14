from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openai_client import embed_text, chat_with_context
from vector_store import get_store

router = APIRouter()


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    source_chunks: list[str]


@router.post("/api/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    store = get_store()
    if store.count() == 0:
        raise HTTPException(status_code=400, detail="No content indexed yet. Use 'Index Content' first.")

    query_embedding = embed_text(req.question)
    top_chunks = store.search(query_embedding, top_k=5)

    text_parts: list[str] = []
    image_chunks: list[dict] = []

    for chunk in top_chunks:
        text_parts.append(chunk.text)
        if chunk.image_base64:
            image_chunks.append({"base64": chunk.image_base64, "format": "jpeg"})

    text_context = "\n\n---\n\n".join(text_parts)
    answer = chat_with_context(req.question, text_context, image_chunks)

    return AskResponse(
        answer=answer,
        source_chunks=[c.text[:120] + ("…" if len(c.text) > 120 else "") for c in top_chunks],
    )
