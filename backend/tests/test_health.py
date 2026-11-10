"""Health endpoint tests for the Apex Minigolf 3D FastAPI service."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    """Verify GET /health returns 200 and expected payload."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "minigolf-3d-api"}

