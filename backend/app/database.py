# backend/app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

import re

def normalize_database_url(url: str) -> str:
    """
    Supabase direct connection hosts (db.<ref>.supabase.co) only resolve to IPv6,
    which triggers '[Errno 101] Network is unreachable' on IPv4-only cloud hosts (Render, Docker).
    Automatically normalizes direct hostnames to the IPv4-enabled Supavisor Pooler (ap-southeast-2).
    """
    if "supabase.co:5432" in url and "db." in url:
        match = re.search(r"@db\.([a-z0-9]+)\.supabase\.co:5432", url)
        if match:
            project_ref = match.group(1)
            normalized = url.replace(f"@db.{project_ref}.supabase.co:5432", f"@aws-0-ap-southeast-2.pooler.supabase.com:5432")
            if "://postgres:" in normalized:
                normalized = normalized.replace("://postgres:", f"://postgres.{project_ref}:")
            return normalized
    return url

db_url = normalize_database_url(settings.DATABASE_URL)

try:
    engine = create_async_engine(
        db_url,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_timeout=10,
        pool_recycle=300,
        pool_pre_ping=True
    )

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )
except Exception as e:
    logger.warning(f"Could not initialize async database engine (missing asyncpg or driver): {e}")
    engine = None
    AsyncSessionLocal = None

Base = declarative_base()

async def get_db():
    if AsyncSessionLocal is None:
        yield None
        return
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    """Ensure pgvector extension is enabled and all tables are created."""
    async with engine.begin() as conn:
        logger.info("Verifying PostgreSQL extensions and table schemas...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
        # Verify HNSW index on transcript_chunks
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_transcript_chunks_hnsw_cosine
            ON transcript_chunks 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        """))
        logger.info("Database schema and HNSW vector index verified.")
