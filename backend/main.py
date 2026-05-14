import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.index import router as index_router
from routes.ask import router as ask_router

load_dotenv()

app = FastAPI(title="Word RAG Assistant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://localhost:3000",
        "http://localhost:3000",
        "https://*.officeapps.live.com",
        "https://*.microsoft.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(index_router)
app.include_router(ask_router)


@app.get("/")
def health():
    mock = os.getenv("MOCK_AI", "false").lower() == "true"
    return {
        "status": "ok",
        "mock_mode": mock,
        "message": "Word RAG Assistant API is running." + (" [MOCK MODE]" if mock else ""),
    }
