import re
import uuid


def chunk_sections(sections: list[dict], max_chunk_size: int = 800) -> list[dict]:
    if not sections:
        return []

    has_headings = any(s.get("headingLevel", 0) > 0 or s.get("heading", "") for s in sections)
    chunks: list[dict] = []

    for section in sections:
        heading: str = section.get("heading", "").strip()
        level: int   = section.get("headingLevel", 0)
        body: str    = section.get("body", "").strip()
        stype: str   = section.get("type", "text")

        if not heading and not body:
            continue

        prefix = f"{heading}\n" if heading else ""

        if stype == "table":
            chunks.append(_make_chunk(prefix + body, heading, level, "table"))
        elif has_headings:
            chunks.extend(_structure_split(prefix, body, heading, level, max_chunk_size))
        else:
            chunks.extend(_semantic_overlap_split(body, heading, level, max_chunk_size))

    return chunks


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[dict]:
    if not text or not text.strip():
        return []

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[dict] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 1 <= chunk_size:
            current = (current + " " + para).strip()
        else:
            if current:
                chunks.append(_make_chunk(current))
            if len(para) > chunk_size:
                chunks.extend(_overlap_sentences(para, chunk_size, overlap))
                current = ""
            else:
                overlap_text = current[-overlap:] if current else ""
                current = (overlap_text + " " + para).strip() if overlap_text else para

    if current:
        chunks.append(_make_chunk(current))

    return chunks


def _structure_split(prefix: str, body: str, heading: str, level: int, max_size: int) -> list[dict]:
    full = (prefix + body).strip()
    if len(full) <= max_size:
        return [_make_chunk(full, heading, level, "text")]

    sentences = re.split(r"(?<=[.!?;])\s+", body)
    chunks: list[dict] = []
    current_body = ""

    for sent in sentences:
        candidate = (current_body + " " + sent).strip()
        if len(prefix + candidate) <= max_size:
            current_body = candidate
        else:
            if current_body:
                chunks.append(_make_chunk((prefix + current_body).strip(), heading, level, "text"))
            current_body = sent

    if current_body:
        chunks.append(_make_chunk((prefix + current_body).strip(), heading, level, "text"))

    return chunks


def _semantic_overlap_split(body: str, heading: str, level: int, max_size: int, overlap: int = 150) -> list[dict]:
    if not body.strip():
        return []

    sentences = re.split(r"(?<=[.!?;])\s+", body.strip())
    chunks: list[dict] = []
    current = ""

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(current) + len(sent) + 1 <= max_size:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(_make_chunk(current, heading, level, "text"))
            tail = current[-overlap:] if len(current) > overlap else current
            current = (tail + " " + sent).strip()

    if current:
        chunks.append(_make_chunk(current, heading, level, "text"))

    return chunks if chunks else [_make_chunk(body[:max_size], heading, level, "text")]


def _overlap_sentences(text: str, chunk_size: int, overlap: int) -> list[dict]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[dict] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(_make_chunk(current))
            current = (current[-overlap:] + " " + sent).strip() if current else sent
    if current:
        chunks.append(_make_chunk(current))
    return chunks


def _make_chunk(text: str, heading: str = "", level: int = 0, chunk_type: str = "text") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "text": text.strip(),
        "heading": heading,
        "level": level,
        "type": chunk_type,
    }
