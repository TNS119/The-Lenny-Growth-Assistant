# backend/app/rag/retriever.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any, Callable
import logging

logger = logging.getLogger(__name__)

class TranscriptRetriever:
    """
    Executes cosine similarity retrieval against transcript_chunks in PostgreSQL 
    using the pgvector HNSW index with strict grounded local transcript fallback.
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
            return self._retrieve_from_local_transcripts(query, top_k, similarity_threshold)

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
                    1 - (embedding <=> CAST(:vector AS vector)) AS similarity_score
                FROM transcript_chunks
                WHERE 1 - (embedding <=> CAST(:vector AS vector)) >= :threshold
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
            # If database search ran cleanly, return the results (empty list if ungrounded)
            logger.info(f"Retrieved {len(chunks)} pgvector chunks for query: '{query[:40]}...' (Threshold: {similarity_threshold})")
            return chunks
        except Exception as e:
            logger.warning(f"Vector search fallback triggered (DB offline or uninitialized): {e}")

        # Fallback: In-memory retrieval directly from local downloaded transcript repository
        return self._retrieve_from_local_transcripts(query, top_k, similarity_threshold)

    def _retrieve_from_local_transcripts(
        self, 
        query: str, 
        top_k: int = 5,
        similarity_threshold: float = 0.65
    ) -> List[Dict[str, Any]]:
        import os
        import glob
        import re

        base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "transcripts")
        transcript_files = glob.glob(os.path.join(base_dir, "*", "*.md"))

        if not transcript_files:
            logger.warning("No local transcript files found in backend/data/transcripts")
            return []

        query_lower = query.lower()
        query_words = re.findall(r'\b[a-z0-9_]+\b', query_lower)
        
        # Comprehensive stopwords set to prevent accidental matches on non-domain words
        stop_words = {
            "a", "an", "the", "on", "in", "of", "and", "or", "is", "are", "was", "were", "be", "been", "being",
            "what", "how", "why", "who", "which", "where", "when", "tell", "me", "can", "could", "would", "should",
            "you", "your", "yours", "write", "say", "said", "did", "do", "does", "done", "word", "essay", "about", 
            "for", "to", "with", "at", "by", "from", "up", "into", "over", "after", "it", "its", "they", "them", 
            "their", "there", "this", "that", "these", "those", "have", "has", "had", "having", "make", "makes", 
            "making", "made", "get", "gets", "getting", "got", "take", "takes", "taking", "took", "know", "knows", 
            "knowing", "knew", "give", "gives", "giving", "gave", "look", "looks", "looking", "looked", "use", "uses", 
            "using", "used", "find", "finds", "finding", "found", "ask", "asks", "asking", "asked", "seem", "seems", 
            "seeming", "seemed", "feel", "feels", "feeling", "felt", "try", "tries", "trying", "tried", "leave", 
            "leaves", "leaving", "left", "call", "calls", "calling", "called", "need", "needs", "needed", "help", 
            "helps", "helping", "helped", "like", "likes", "liked", "good", "best", "better", "bad", "worse", "worst", 
            "way", "ways", "thing", "things", "year", "years", "day", "days", "people", "person", 
            "world", "part", "place", "point", "talk", "talks", "talking", "talked", "something", 
            "anything", "nothing", "everything", "someone", "anyone", "everyone", "won", "one", "two", "three", 
            "first", "second", "last", "new", "old", "also", "just", "very", "really", "much", "many", "more", 
            "most", "some", "any", "all", "both", "each", "few", "other", "such", "only", "own", "same", "so", 
            "than", "too", "s", "t", "d", "ll", "m", "o", "re", "ve", "y"
        }
        
        keywords = [w for w in query_words if w not in stop_words and len(w) > 1]
        
        # If user query has zero substantive domain keywords, refuse immediately
        if not keywords:
            logger.info(f"Query '{query[:40]}' contains zero domain keywords -> 0 chunks.")
            return []

        def get_stems(w: str) -> list:
            stems = [w]
            if w.endswith("ing"): stems.extend([w[:-3], w[:-3] + "e"])
            if w.endswith("ed"): stems.extend([w[:-2], w[:-1]])
            if w.endswith("s") and len(w) > 3: stems.append(w[:-1])
            if w.endswith("ment"): stems.append(w[:-4])
            return list(set(stems))

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

                guest_parts = [p for p in guest.lower().split() if len(p) > 2]
                guest_in_query = guest.lower() in query_lower or (len(guest_parts) > 0 and any(part in query_lower for part in guest_parts))
                title_lower = title.lower()
                title_in_query = any(w in title_lower for w in keywords)

                # Segment transcript and merge small sub-turns into coherent conversational passages (600-1400 chars)
                raw_sections = re.split(r'\n(?=[A-Za-z0-9\s]+\(\d{2}:\d{2}:\d{2}\):|\(\d{2}:\d{2}:\d{2}\):)', body)
                merged_sections = []
                curr_text = ""
                curr_ts = "00:00:00"

                for s in raw_sections:
                    s_clean = s.strip()
                    if not s_clean:
                        continue
                    tm = re.search(r'\((\d{2}:\d{2}:\d{2})\)', s_clean)
                    if tm and not curr_text:
                        curr_ts = tm.group(1)
                    if len(curr_text) + len(s_clean) < 1300:
                        curr_text = (curr_text + "\n\n" + s_clean).strip()
                    else:
                        if curr_text:
                            merged_sections.append((curr_ts, curr_text))
                        curr_text = s_clean
                        if tm:
                            curr_ts = tm.group(1)
                if curr_text:
                    merged_sections.append((curr_ts, curr_text))

                # Separate guest identifier keywords from topical domain keywords
                guest_kws = set(guest_parts)
                topical_keywords = [kw for kw in keywords if kw not in guest_kws]
                if not topical_keywords:
                    topical_keywords = keywords

                topical_stems = {kw: get_stems(kw) for kw in topical_keywords}

                for current_time, sec_clean in merged_sections:
                    if len(sec_clean) < 100:
                        continue
                    # Skip YAML frontmatter residue and initial podcast host intro banter
                    if sec_clean.startswith("---") or "publish_date:" in sec_clean or (current_time < "00:01:30" and "youtube_url" in sec_clean):
                        continue

                    text_lower = sec_clean.lower()

                    matched_topical = set()
                    term_freq = 0
                    for kw, stems in topical_stems.items():
                        freq = sum(text_lower.count(st) for st in stems)
                        if freq > 0:
                            matched_topical.add(kw)
                            term_freq += freq

                    matches = len(matched_topical)

                    # Strict Grounding Criteria
                    is_relevant = False
                    if guest_in_query:
                        if matches >= 1 or len(topical_keywords) == 0:
                            is_relevant = True
                    elif title_in_query and matches >= 1:
                        is_relevant = True
                    elif len(topical_keywords) >= 2:
                        match_ratio = matches / len(topical_keywords)
                        if match_ratio >= 0.65:
                            is_relevant = True
                    elif len(topical_keywords) == 1 and matches == 1:
                        kw = topical_keywords[0]
                        if text_lower.count(kw) >= 2 or len(kw) >= 5:
                            is_relevant = True

                    if is_relevant:
                        coverage = matches / max(1, len(topical_keywords))
                        base_score = 0.62 + (coverage * 0.22) + min(0.08, term_freq * 0.015)
                        if guest_in_query:
                            base_score += 0.05
                        if title_in_query:
                            base_score += 0.03
                        
                        # Topical bonus for key PM frameworks (e.g. LNO, finite time, Delta 4)
                        if "lno" in text_lower or "delta 4" in text_lower or "finite time" in text_lower or "growth loop" in text_lower:
                            base_score += 0.06

                        final_score = round(min(0.96, base_score), 4)
                        if final_score >= similarity_threshold:
                            scored_chunks.append({
                                "episode": title,
                                "guest": guest,
                                "text": sec_clean[:1400],
                                "timestamp": current_time,
                                "score": final_score
                            })
            except Exception as ex:
                logger.error(f"Error reading transcript file {tf}: {ex}")

        # Deduplicate and sort by relevance score
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        
        # Deduplicate overlapping moments and cap per episode to ensure variety
        unique_chunks = []
        seen_keys = set()
        episode_counts: Dict[str, int] = {}
        
        for c in scored_chunks:
            key = (c["episode"], c["timestamp"][:5])
            ep = c["episode"]
            if key not in seen_keys and episode_counts.get(ep, 0) < 2:
                seen_keys.add(key)
                episode_counts[ep] = episode_counts.get(ep, 0) + 1
                unique_chunks.append(c)

        if not unique_chunks:
            return []

        best_score = unique_chunks[0]["score"]
        if best_score < similarity_threshold:
            return []

        # Dynamically scale chunk count: tighter threshold for specific queries, wider for broad queries
        if len(keywords) <= 2 and not guest_in_query:
            # Highly specific single-topic query -> target 1-3 focal moments
            dynamic_threshold = max(similarity_threshold, best_score - 0.04)
            dynamic_limit = min(3, top_k)
        elif len(keywords) <= 3:
            # Medium query -> target 2-4 moments
            dynamic_threshold = max(similarity_threshold, best_score - 0.07)
            dynamic_limit = min(4, top_k)
        else:
            # Multi-concept / broad query -> up to top_k
            dynamic_threshold = max(similarity_threshold, best_score - 0.10)
            dynamic_limit = top_k

        top_chunks = [c for c in unique_chunks if c["score"] >= dynamic_threshold][:dynamic_limit]
        
        logger.info(f"Retrieved {len(top_chunks)} dynamic verified moments (best score: {best_score}) for query: '{query[:40]}'")
        return top_chunks
