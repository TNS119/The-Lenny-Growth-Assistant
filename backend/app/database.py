# backend/app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

try:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
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
