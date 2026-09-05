# backend/scripts/ingest.py
import os
import sys
import re
import yaml
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.database import engine, init_db, AsyncSessionLocal
from app.models.db_models import TranscriptChunkModel
from app.rag.embeddings import compute_embeddings_batch
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = backend_dir / "data" / "transcripts"

def parse_frontmatter(file_content: str) -> tuple[Dict[str, Any], str]:
    """Extract YAML frontmatter and transcript body."""
    frontmatter = {}
    body = file_content
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", file_content, re.DOTALL)
    if match:
        try:
            frontmatter = yaml.safe_load(match.group(1)) or {}
            body = match.group(2).strip()
        except Exception as e:
            logger.warning(f"Error parsing frontmatter: {e}")
    return frontmatter, body

def recursive_character_chunking(
    text: str,
    target_tokens: int = 600,
    overlap_tokens: int = 100
) -> List[Dict[str, str]]:
    """
    Split transcript into 500-800 token chunks (~2,000-3,200 chars) 
    with ~100 token overlap (~400 chars), preserving timestamp references.
    """
    # Rough approximation: 1 token ~= 4 characters in English
    target_chars = target_tokens * 4
    overlap_chars = overlap_tokens * 4

    # Timestamp regex pattern e.g., "00:14:20 - Heading"
    timestamp_pattern = re.compile(r"(\d{2}:\d{2}:\d{2})\s*-\s*([^\n]+)")

    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_len = 0
    current_timestamp = "00:00:00 - Introduction"

    for para in paragraphs:
        para_clean = para.strip()
        if not para_clean:
            continue

        # Check if paragraph contains a timestamp header
        ts_match = timestamp_pattern.search(para_clean)
        if ts_match:
            current_timestamp = f"{ts_match.group(1)} - {ts_match.group(2)}"

        para_len = len(para_clean)

        if current_len + para_len > target_chars and current_chunk:
            chunk_text = "\n\n".join(current_chunk)
            chunks.append({
                "text": chunk_text,
                "timestamp_ref": current_timestamp,
                "char_count": len(chunk_text),
                "approx_tokens": len(chunk_text) // 4
            })
            # Overlap management: retain last paragraph if it fits within overlap_chars
            if current_chunk and len(current_chunk[-1]) <= overlap_chars:
                current_chunk = [current_chunk[-1], para_clean]
                current_len = len(current_chunk[0]) + para_len
            else:
                current_chunk = [para_clean]
                current_len = para_len
        else:
            current_chunk.append(para_clean)
            current_len += para_len

    if current_chunk:
        chunk_text = "\n\n".join(current_chunk)
        chunks.append({
            "text": chunk_text,
            "timestamp_ref": current_timestamp,
            "char_count": len(chunk_text),
            "approx_tokens": len(chunk_text) // 4
        })

    return chunks

async def ingest_transcripts():
    """Main ingestion routine: parses transcripts, computes embeddings, and builds HNSW index."""
    logger.info("Initializing database schema and pgvector extension...")
    try:
        await init_db()
    except Exception as e:
        logger.warning(f"Could not initialize live database (PostgreSQL might be offline or starting up): {e}")

    # Ensure transcripts exist
    if not DATA_DIR.exists() or not any(DATA_DIR.rglob("*.md")):
        logger.info("Transcripts directory empty. Running downloader first...")
        from scripts.download_transcripts import download_transcripts
        download_transcripts()

    transcript_files = list(DATA_DIR.rglob("transcript.md"))
    logger.info(f"Found {len(transcript_files)} transcript files to ingest.")

    all_chunk_records = []
    chunk_texts_for_embedding = []

    for file_path in transcript_files:
        content = file_path.read_text(encoding="utf-8")
        frontmatter, body = parse_frontmatter(content)

        guest = frontmatter.get("guest", file_path.parent.name.replace("-", " ").title())
        title = frontmatter.get("title", f"Lenny's Podcast Interview with {guest}")
        pub_date_raw = frontmatter.get("publish_date")
        pub_date = None
        if pub_date_raw:
            try:
                pub_date = datetime.strptime(str(pub_date_raw)[:10], "%Y-%m-%d").date()
            except Exception:
                pub_date = None

        chunks = recursive_character_chunking(body, target_tokens=600, overlap_tokens=100)
        logger.info(f"Parsed '{title}' ({guest}) -> {len(chunks)} chunks.")

        for chunk in chunks:
            record = {
                "episode_title": title,
                "guest_name": guest,
                "publication_date": pub_date,
                "timestamp_ref": chunk["timestamp_ref"],
                "chunk_text": chunk["text"],
                "token_count": chunk["approx_tokens"]
            }
            all_chunk_records.append(record)
            chunk_texts_for_embedding.append(chunk["text"])

    logger.info(f"Total chunks prepared across all episodes: {len(all_chunk_records)}")

    # Compute dense embeddings in batches using all-MiniLM-L6-v2
    logger.info("Computing dense vector embeddings using SentenceTransformers...")
    embeddings = compute_embeddings_batch(chunk_texts_for_embedding, batch_size=64)

    for i, emb in enumerate(embeddings):
        all_chunk_records[i]["embedding"] = emb

    # Insert into PostgreSQL
    logger.info("Connecting to PostgreSQL to insert chunks...")
    try:
        async with AsyncSessionLocal() as session:
            # Clear existing chunks to prevent duplicates during re-ingestion
            await session.execute(text("TRUNCATE TABLE transcript_chunks RESTART IDENTITY;"))
            
            for item in all_chunk_records:
                chunk_obj = TranscriptChunkModel(
                    episode_title=item["episode_title"],
                    guest_name=item["guest_name"],
                    publication_date=item["publication_date"],
                    timestamp_ref=item["timestamp_ref"],
                    chunk_text=item["chunk_text"],
                    token_count=item["token_count"],
                    embedding=item["embedding"]
                )
                session.add(chunk_obj)

            await session.commit()
            logger.info(f"Successfully committed {len(all_chunk_records)} chunks to PostgreSQL!")

            # Verify count
            count_res = await session.execute(text("SELECT COUNT(*) FROM transcript_chunks;"))
            count = count_res.scalar()
            logger.info(f"Verified total chunks in PostgreSQL: {count}")
    except Exception as e:
        logger.error(f"PostgreSQL insertion error: {e}. (Ensure PostgreSQL container is running on port 5432).")

if __name__ == "__main__":
    asyncio.run(ingest_transcripts())
