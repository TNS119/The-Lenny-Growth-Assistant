# backend/app/rag/retriever.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Callable
import logging

logger = logging.getLogger(__name__)

class TranscriptRetriever:
    """
    Executes cosine similarity retrieval against transcript_chunks in PostgreSQL 
    using the pgvector HNSW index.
    """

    def __init__(self, session: AsyncSession, embedding_fn: Callable):
        self.session = session
        self.embedding_fn = embedding_fn

    async def retrieve_relevant_chunks(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.65
    ) -> List[Dict[str, Any]]:
        """
        Compute query embedding and retrieve top K chunks with cosine similarity >= threshold.
        Falls back directly to local transcript search if database session is None.
        """
        if self.session is None:
            logger.info("Database session is None; routing directly to local transcript retriever.")
            return self._retrieve_from_local_transcripts(query, top_k)

        try:
            # 1. Compute query vector embedding (384-dim)
            query_vector = await self.embedding_fn(query)
            vector_str = f"[{','.join(map(str, query_vector))}]"

            # 2. Execute pgvector cosine similarity search: 1 - (embedding <=> vector)
            query_stmt = text("""
                SELECT
                    episode_title,
                    guest_name,
                    chunk_text,
                    timestamp_ref,
                    1 - (embedding <=> :vector::vector) AS similarity_score
                FROM transcript_chunks
                WHERE 1 - (embedding <=> :vector::vector) >= :threshold
                ORDER BY similarity_score DESC
                LIMIT :limit;
            """)

            result = await self.session.execute(
                query_stmt,
                {
                    "vector": vector_str,
                    "threshold": similarity_threshold,
                    "limit": top_k
                }
            )
            rows = result.fetchall() if result else []
            
            chunks = [
                {
                    "episode": r.episode_title,
                    "guest": r.guest_name,
                    "text": r.chunk_text,
                    "timestamp": r.timestamp_ref,
                    "score": round(float(r.similarity_score), 4)
                }
                for r in rows
            ]
            if chunks:
                logger.info(f"Retrieved {len(chunks)} pgvector chunks for query: '{query[:40]}...' (Top score: {chunks[0]['score']})")
                return chunks
        except Exception as e:
            logger.warning(f"Vector search fallback triggered (DB offline or empty): {e}")

        # Fallback: In-memory retrieval directly from local downloaded transcript repository
        return self._retrieve_from_local_transcripts(query, top_k)

    def _retrieve_from_local_transcripts(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        import os
        import glob
        import re

        base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "transcripts")
        transcript_files = glob.glob(os.path.join(base_dir, "*", "*.md"))

        if not transcript_files:
            logger.warning("No local transcript files found in backend/data/transcripts")
            return []

        query_lower = query.lower()
        query_words = set(re.findall(r'\w+', query_lower))
        stop_words = {"a", "an", "the", "on", "in", "of", "and", "or", "is", "are", "what", "how", "why", "write", "say", "did", "word", "essay", "about", "for", "to"}
        keywords = query_words - stop_words

        scored_chunks = []

        for tf in transcript_files:
            try:
                with open(tf, "r", encoding="utf-8") as f:
                    content = f.read()

                # Extract metadata
                guest = "Lenny's Guest"
                title = os.path.basename(os.path.dirname(tf)).replace("-", " ").title()
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    if len(parts) >= 3:
                        for line in parts[1].splitlines():
                            if line.startswith("guest:"):
                                guest = line.split(":", 1)[1].strip().strip('"\'')
                            elif line.startswith("title:"):
                                title = line.split(":", 1)[1].strip().strip('"\'')
                        body = parts[2]
                    else:
                        body = content
                else:
                    body = content

                # Segment transcript by timestamps or paragraphs
                sections = re.split(r'\n(?=[A-Za-z0-9\s]+\(\d{2}:\d{2}:\d{2}\):|\(\d{2}:\d{2}:\d{2}\):)', body)
                current_time = "00:00:00"

                for sec in sections:
                    sec_clean = sec.strip()
                    if len(sec_clean) < 100:
                        continue
                    
                    time_match = re.search(r'\((\d{2}:\d{2}:\d{2})\)', sec_clean)
                    if time_match:
                        current_time = time_match.group(1)

                    text_lower = sec_clean.lower()
                    
                    # Compute relevance score
                    matches = sum(1 for kw in keywords if kw in text_lower)
                    guest_in_query = guest.lower() in query_lower or any(part in query_lower for part in guest.lower().split())
                    
                    if matches > 0 or guest_in_query:
                        base_score = 0.68 + min(0.24, (matches * 0.05))
                        if guest_in_query:
                            base_score += 0.06
                        
                        scored_chunks.append({
                            "episode": title,
                            "guest": guest,
                            "text": sec_clean[:1200],
                            "timestamp": current_time,
                            "score": round(min(0.96, base_score), 4)
                        })
            except Exception as ex:
                logger.error(f"Error reading transcript file {tf}: {ex}")

        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        top_chunks = scored_chunks[:top_k]
        logger.info(f"Retrieved {len(top_chunks)} chunks via local transcript fallback for query: '{query[:40]}'")
        return top_chunks
