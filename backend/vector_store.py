import json
import os
from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime

import numpy as np

STORE_FILE = os.path.join(os.path.dirname(__file__), "store.json")
META_FILE  = os.path.join(os.path.dirname(__file__), "store_meta.json")


@dataclass
class Chunk:
    id: str
    text: str
    embedding: list[float]
    image_base64: Optional[str] = None
    source: str = "default"
    indexed_at: str = ""


class InMemoryVectorStore:
    def __init__(self):
        self._store: dict[str, Chunk] = {}
        self._meta: dict = {}
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if os.path.exists(STORE_FILE):
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    for r in json.load(f):
                        c = Chunk(**r)
                        self._store[c.id] = c
                print(f"[VectorStore] Loaded {len(self._store)} chunk(s) from disk.")
            except Exception as e:
                print(f"[VectorStore] Could not load store.json: {e}")

        if os.path.exists(META_FILE):
            try:
                with open(META_FILE, "r", encoding="utf-8") as f:
                    self._meta = json.load(f)
            except Exception:
                self._meta = {}

    def _save_to_disk(self) -> None:
        try:
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump([asdict(c) for c in self._store.values()], f)
            with open(META_FILE, "w", encoding="utf-8") as f:
                json.dump(self._meta, f, indent=2)
        except Exception as e:
            print(f"[VectorStore] Could not save: {e}")

    def add(self, chunk: Chunk) -> None:
        self._store[chunk.id] = chunk
        self._save_to_disk()

    def add_batch(self, chunks: list[Chunk]) -> None:
        for c in chunks:
            self._store[c.id] = c
        self._save_to_disk()

    def clear_source(self, source: str) -> int:
        before = len(self._store)
        self._store = {k: v for k, v in self._store.items() if v.source != source}
        removed = before - len(self._store)
        if source in self._meta.get("sources", {}):
            del self._meta["sources"][source]
        self._save_to_disk()
        return removed

    def clear_all(self) -> None:
        self._store.clear()
        self._meta = {"sources": {}}
        for f in [STORE_FILE, META_FILE]:
            if os.path.exists(f):
                os.remove(f)

    def register_source(self, source: str, chunks: int, images: int) -> None:
        if "sources" not in self._meta:
            self._meta["sources"] = {}
        self._meta["sources"][source] = {
            "chunks": chunks,
            "images": images,
            "indexed_at": datetime.utcnow().isoformat(),
        }

    def get_sources(self) -> dict:
        return self._meta.get("sources", {})

    def count(self) -> int:
        return len(self._store)

    def count_by_source(self, source: str) -> int:
        return sum(1 for c in self._store.values() if c.source == source)

    def search(self, query_embedding: list[float], top_k: int = 5) -> list[Chunk]:
        if not self._store:
            return []
        q = np.array(query_embedding, dtype=np.float32)
        results = []
        for chunk in self._store.values():
            c = np.array(chunk.embedding, dtype=np.float32)
            score = float(np.dot(q, c) / (np.linalg.norm(q) * np.linalg.norm(c) + 1e-10))
            results.append((score, chunk))
        results.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in results[:top_k]]


_store = InMemoryVectorStore()


def get_store() -> InMemoryVectorStore:
    return _store
