"""
backend/app/rag/ingest.py
──────────────────────────────────────────────────────────────────────────
Transcript ingestion pipeline for The Lenny Growth Assistant.

Reads all Markdown transcripts from backend/data/transcripts/<guest>/transcript.md,
chunks them into ~400-token speaker-aware segments, computes 384-dim embeddings
with all-MiniLM-L6-v2, and bulk-upserts into the Supabase transcript_chunks
pgvector table.

Usage (from project root  /backend):
    python -m app.rag.ingest
"""

import os, sys, re, logging, asyncio, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# ── Path bootstrap ────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # .../backend
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ── Env loading ───────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv(dotenv_path=_BACKEND_DIR.parent / ".env", override=False)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("lenny.ingest")

import asyncpg
from app.config import get_settings
from app.rag.embeddings import compute_embeddings_batch

# ── Config ────────────────────────────────────────────────────────────────────
TRANSCRIPTS_DIR    = _BACKEND_DIR / "data" / "transcripts"
CHUNK_TARGET_TOKENS = 400
CHUNK_OVERLAP_TOKENS = 50
WORDS_PER_TOKEN    = 0.75
BATCH_SIZE         = 16
UPSERT_BATCH_SIZE  = 50

# ── Frontmatter ───────────────────────────────────────────────────────────────
FRONTMATTER_RE  = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
TIMESTAMP_RE    = re.compile(r"^\(?\d{2}:\d{2}:\d{2}\)?:?\s*$")
SPEAKER_LINE_RE = re.compile(r"^[A-Za-z][A-Za-z\s\-''\.]+\s*\(\d{2}:\d{2}:\d{2}\)\s*:")


def _parse_frontmatter(raw: str):
    meta: Dict[str, Any] = {}
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return meta, raw
    for line in match.group(1).splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().lstrip("-").strip()
            val = val.strip().strip("'\"")
            if key:
                meta[key] = val
    return meta, raw[match.end():]


def _estimate_tokens(text: str) -> int:
    return max(1, int(len(text.split()) / WORDS_PER_TOKEN))


def _extract_transcript_body(body: str) -> str:
    lines, in_t = [], False
    for line in body.splitlines():
        s = line.strip()
        if s.lower().startswith("## transcript"):
            in_t = True; continue
        if in_t:
            if TIMESTAMP_RE.match(s): continue
            lines.append(line)
    return "\n".join(lines).strip() if in_t else body.strip()


def _chunk_transcript(body: str) -> List[Dict[str, str]]:
    chunks: List[Dict[str, str]] = []
    paragraphs: List[tuple] = []
    current_ts, current_lines = "00:00:00", []

    for line in body.splitlines():
        s = line.strip()
        ts_match = re.search(r"\((\d{2}:\d{2}:\d{2})\)", s)
        if ts_match and (s.endswith(":") or SPEAKER_LINE_RE.match(s)):
            if current_lines:
                paragraphs.append((current_ts, " ".join(current_lines).strip()))
                current_lines = []
            current_ts = ts_match.group(1)
            after = s.split(":", 1)[-1].strip()
            if after: current_lines.append(after)
        elif s:
            current_lines.append(s)

    if current_lines:
        paragraphs.append((current_ts, " ".join(current_lines).strip()))

    target_words  = int(CHUNK_TARGET_TOKENS * WORDS_PER_TOKEN)
    overlap_words = int(CHUNK_OVERLAP_TOKENS * WORDS_PER_TOKEN)

    def flush(text: str, ts: str):
        text = text.strip()
        if not text: return
        words = text.split()
        start = 0
        while start < len(words):
            end = start + target_words
            chunks.append({"timestamp_ref": ts, "text": " ".join(words[start:end])})
            start = end - overlap_words if end < len(words) else end

    buf_text, buf_ts = "", "00:00:00"
    for ts, para in paragraphs:
        candidate = (buf_text + " " + para).strip() if buf_text else para
        if _estimate_tokens(candidate) >= CHUNK_TARGET_TOKENS:
            flush(buf_text, buf_ts)
            buf_text, buf_ts = para, ts
        else:
            buf_text = candidate
            if buf_ts == "00:00:00": buf_ts = ts
    flush(buf_text, buf_ts)
    return chunks


def load_all_transcripts() -> List[Dict[str, Any]]:
    all_chunks: List[Dict[str, Any]] = []
    if not TRANSCRIPTS_DIR.exists():
        logger.error(f"Transcripts directory not found: {TRANSCRIPTS_DIR}")
        return all_chunks

    guest_dirs = sorted([d for d in TRANSCRIPTS_DIR.iterdir() if d.is_dir()])
    logger.info(f"Found {len(guest_dirs)} guest transcript directories.")

def process_single_transcript_file(transcript_path: Path) -> List[Dict[str, Any]]:
    if not transcript_path.exists():
        logger.warning(f"File not found: {transcript_path}")
        return []

    raw = transcript_path.read_text(encoding="utf-8", errors="replace")
    meta, body = _parse_frontmatter(raw)

    guest_name    = meta.get("guest", transcript_path.parent.name.replace("-", " ").title())
    episode_title = meta.get("title", guest_name)
    pub_date_raw  = meta.get("publish_date", "")
    pub_date: Optional[datetime.date] = None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            pub_date = datetime.datetime.strptime(pub_date_raw, fmt).date(); break
        except (ValueError, TypeError): continue

    body_clean = _extract_transcript_body(body)
    chunks = _chunk_transcript(body_clean)
    logger.info(f"Chunked {guest_name}: {len(chunks)} chunks")

    result = []
    for c in chunks:
        result.append({
            "guest_name":       guest_name,
            "episode_title":    episode_title,
            "publication_date": pub_date,
            "timestamp_ref":    c["timestamp_ref"],
            "chunk_text":       c["text"],
            "token_count":      _estimate_tokens(c["text"]),
        })
    return result


def load_all_transcripts() -> List[Dict[str, Any]]:
    all_chunks: List[Dict[str, Any]] = []
    if not TRANSCRIPTS_DIR.exists():
        logger.error(f"Transcripts directory not found: {TRANSCRIPTS_DIR}")
        return all_chunks

    guest_dirs = sorted([d for d in TRANSCRIPTS_DIR.iterdir() if d.is_dir()])
    logger.info(f"Found {len(guest_dirs)} guest transcript directories.")

    for guest_dir in guest_dirs:
        tf = guest_dir / "transcript.md"
        if not tf.exists():
            continue
        chunks = process_single_transcript_file(tf)
        all_chunks.extend(chunks)

    return all_chunks


async def ingest_single_episode(transcript_path: Path) -> int:
    """
    Ingests a single episode into Supabase pgvector without wiping existing data.
    """
    chunks = process_single_transcript_file(transcript_path)
    if not chunks:
        logger.warning(f"No chunks extracted from {transcript_path}")
        return 0

    guest_name = chunks[0]["guest_name"]
    logger.info(f"Computing embeddings for {len(chunks)} chunks of {guest_name}...")
    embeddings = compute_embeddings_batch(
        [c["chunk_text"] for c in chunks], batch_size=BATCH_SIZE
    )

    settings = get_settings()
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        # Non-destructive: delete only records for this guest/episode if any existed previously
        del_res = await conn.execute(
            "DELETE FROM transcript_chunks WHERE guest_name = $1 OR episode_title = $2",
            guest_name, chunks[0]["episode_title"]
        )
        logger.info(f"Additive update: cleared previous records for {guest_name} ({del_res}).")

        sql = """
            INSERT INTO transcript_chunks
                (guest_name, episode_title, publication_date, timestamp_ref,
                 chunk_text, token_count, embedding)
            VALUES ($1,$2,$3,$4,$5,$6,$7::vector)
        """
        records = [
            (c["guest_name"], c["episode_title"], c["publication_date"],
             c["timestamp_ref"], c["chunk_text"], c["token_count"], str(e))
            for c, e in zip(chunks, embeddings)
        ]
        for i in range(0, len(records), UPSERT_BATCH_SIZE):
            batch = records[i:i+UPSERT_BATCH_SIZE]
            await conn.executemany(sql, batch)
        logger.info(f"Additive upsert complete: {len(records)} chunks saved for {guest_name}.")
        return len(records)
    finally:
        await conn.close()


async def upsert_chunks(chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
    settings = get_settings()
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        deleted = await conn.fetchval("SELECT count(*) FROM transcript_chunks")
        await conn.execute("DELETE FROM transcript_chunks")
        logger.info(f"  Cleared {deleted or 0} existing chunks.")

        sql = """
            INSERT INTO transcript_chunks
                (guest_name, episode_title, publication_date, timestamp_ref,
                 chunk_text, token_count, embedding)
            VALUES ($1,$2,$3,$4,$5,$6,$7::vector)
        """
        inserted = 0
        for i in range(0, len(chunks), UPSERT_BATCH_SIZE):
            bc, be = chunks[i:i+UPSERT_BATCH_SIZE], embeddings[i:i+UPSERT_BATCH_SIZE]
            records = [
                (c["guest_name"], c["episode_title"], c["publication_date"],
                 c["timestamp_ref"], c["chunk_text"], c["token_count"], str(e))
                for c, e in zip(bc, be)
            ]
            await conn.executemany(sql, records)
            inserted += len(records)
            logger.info(f"    Inserted {inserted}/{len(chunks)} chunks...")
        logger.info(f"Upsert complete — {inserted} chunks in Supabase pgvector.")
    finally:
        await conn.close()


async def main():
    logger.info("=" * 60)
    logger.info("  Lenny Growth Assistant — Transcript Ingestion")
    logger.info("=" * 60)

    logger.info("\n[1/3] Loading and chunking transcripts...")
    all_chunks = load_all_transcripts()
    if not all_chunks:
        logger.error("No chunks produced. Exiting.")
        sys.exit(1)
    logger.info(f"Total chunks: {len(all_chunks)}")

    logger.info(f"\n[2/3] Computing embeddings (batch={BATCH_SIZE})...")
    embeddings = compute_embeddings_batch(
        [c["chunk_text"] for c in all_chunks], batch_size=BATCH_SIZE
    )
    logger.info(f"Embeddings: {len(embeddings)} x 384-dim.")

    logger.info("\n[3/3] Upserting to Supabase...")
    await upsert_chunks(all_chunks, embeddings)
    logger.info("\nIngestion complete! Health check should now show pgvector_chunks_indexed > 0.")


if __name__ == "__main__":
    asyncio.run(main())
