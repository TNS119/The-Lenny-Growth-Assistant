# backend/app/api/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
import httpx
import logging

from app.database import get_db
from app.config import get_settings
from app.models.schemas import HealthResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint probing PostgreSQL, pgvector index, and Ollama status."""
    settings = get_settings()
    db_status = "healthy"
    chunks_count = 0

    # 1. Probe PostgreSQL & pgvector count
    if db is None:
        db_status = "unavailable (driver not initialized)"
    else:
        try:
            result = await db.execute(text("SELECT COUNT(*) FROM transcript_chunks;"))
            chunks_count = result.scalar() or 0
        except Exception as e:
            logger.warning(f"Database health probe warning: {e}")
            db_status = f"degraded: {str(e)}"

    # 2. Probe Local Ollama daemon
    ollama_connected = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                ollama_connected = True
    except Exception:
        ollama_connected = False

    overall_status = "ok" if (db_status == "healthy") else "degraded"

    return HealthResponse(
        status=overall_status,
        database=db_status,
        pgvector_chunks_indexed=chunks_count,
        ollama_connected=ollama_connected,
        active_model=settings.OLLAMA_MODEL,
        timestamp=datetime.utcnow()
    )
