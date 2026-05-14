from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from chunker import chunk_sections, chunk_text
from openai_client import embed_texts_batch, describe_image, embed_text
from vector_store import Chunk, get_store

import uuid

router = APIRouter()


class SectionPayload(BaseModel):
    heading: str = ""
    headingLevel: int = 0
    body: str = ""
    type: str = "text"


class ImagePayload(BaseModel):
    base64: str
    format: str
    altText: str = ""


class IndexRequest(BaseModel):
    text: str = ""
    sections: list[SectionPayload] = []
    images: list[ImagePayload] = []
    source: str = "default"
    mode: str = "replace"  # "replace" | "append"


class IndexResponse(BaseModel):
    chunks_indexed: int
    images_indexed: int
    tables_found: int
    total_chunks: int
    chunking_strategy: str
    mode: str
    sources: dict
    message: str


@router.post("/api/index", response_model=IndexResponse)
async def index_document(req: IndexRequest):
    store = get_store()

    if req.mode == "replace":
        store.clear_source(req.source)

    text_sections  = [s for s in req.sections if s.type != "table"]
    table_sections = [s for s in req.sections if s.type == "table"]
    has_headings   = any(s.headingLevel > 0 or s.heading for s in text_sections)

    if table_sections:
        strategy = "structure-aware + tables"
    elif has_headings:
        strategy = "structure-aware (heading boundaries)"
    elif req.sections:
        strategy = "semantic overlap (no headings detected)"
    else:
        strategy = "overlap (plain text fallback)"

    if req.sections:
        raw_chunks = chunk_sections(
            [{"heading": s.heading, "headingLevel": s.headingLevel,
              "body": s.body, "type": s.type}
             for s in req.sections]
        )
    elif req.text.strip():
        raw_chunks = chunk_text(req.text)
    else:
        raw_chunks = []

    chunks_indexed = 0
    images_indexed = 0
    indexed_at = datetime.utcnow().isoformat()

    if raw_chunks:
        texts = [c["text"] for c in raw_chunks]
        embeddings = embed_texts_batch(texts)
        store.add_batch([
            Chunk(
                id=raw_chunks[i]["id"],
                text=texts[i],
                embedding=embeddings[i],
                source=req.source,
                indexed_at=indexed_at,
            )
            for i in range(len(raw_chunks))
        ])
        chunks_indexed = len(raw_chunks)

    for img in req.images:
        description = describe_image(img.base64, img.format, img.altText)
        emb = embed_text(description)
        store.add(Chunk(
            id=str(uuid.uuid4()),
            text=description,
            embedding=emb,
            image_base64=img.base64,
            source=req.source,
            indexed_at=indexed_at,
        ))
        images_indexed += 1

    store.register_source(req.source, chunks_indexed, images_indexed)

    return IndexResponse(
        chunks_indexed=chunks_indexed,
        images_indexed=images_indexed,
        tables_found=len(table_sections),
        total_chunks=store.count(),
        chunking_strategy=strategy,
        mode=req.mode,
        sources=store.get_sources(),
        message=(
            f"[{req.mode}][{strategy}] "
            f"{chunks_indexed} chunk(s), {len(table_sections)} table(s), "
            f"{images_indexed} image(s). Total in store: {store.count()}"
        ),
    )


@router.get("/api/sources")
async def get_sources():
    return get_store().get_sources()


@router.delete("/api/sources/{source}")
async def delete_source(source: str):
    removed = get_store().clear_source(source)
    return {"removed": removed, "remaining": get_store().count()}


@router.delete("/api/index/clear")
async def clear_all_index():
    get_store().clear_all()
    return {"message": "All index data cleared."}
