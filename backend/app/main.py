"""FastAPI application entry point for Apex Minigolf 3D."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Apex Minigolf 3D API",
    version="0.1.0",
    description="Backend API and WebSocket service for Apex Minigolf 3D.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return service health status for local and deployment probes."""
    return {"status": "ok", "service": "minigolf-3d-api"}

