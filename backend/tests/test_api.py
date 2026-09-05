# backend/tests/test_api.py
try:
    import pytest
except ImportError:
    class MockPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = MockPytest()
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    """Verify application root endpoint returns metadata and status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "app" in data
        assert data["app"] == "The Lenny Growth Assistant"
        assert data["health"] == "/api/health"

@pytest.mark.asyncio
async def test_health_check_structure():
    """Verify health endpoint structure reporting DB and Ollama state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code in [200, 503]
        data = resp.json()
        assert "status" in data
        assert "database" in data
        assert "pgvector_chunks_indexed" in data
        assert "ollama_connected" in data
        assert "active_model" in data

@pytest.mark.asyncio
async def test_chat_validation():
    """Verify chat endpoint rejects empty or invalid message payloads."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing required session_id and message
        resp = await client.post("/api/chat", json={})
        assert resp.status_code == 422  # Unprocessable Entity
