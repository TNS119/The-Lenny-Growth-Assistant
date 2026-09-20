# backend/app/rag/discovery.py
import os
import re
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import httpx

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MANIFEST_PATH = DATA_DIR / "episodes_manifest.json"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
RAW_BASE_URL = "https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/{slug}/transcript.md"

STOPWORDS = {
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
    "than", "too", "s", "t", "d", "ll", "m", "o", "re", "ve", "y", "podcast", "lenny", "episode"
}

class EpisodeDiscoveryService:
    """
    In-memory discovery engine for Lenny's podcast transcript archive.
    Matches queries against the 269-episode catalog via guest names and topic keywords.
    """

    def __init__(self, manifest_path: Path = MANIFEST_PATH):
        self.manifest_path = manifest_path
        self.episodes: List[Dict[str, Any]] = []
        self._load_manifest()

    def _load_manifest(self):
        if not self.manifest_path.exists():
            logger.warning(f"Manifest not found at {self.manifest_path}. Discovery service will be empty.")
            return

        try:
            raw_data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            self.episodes = raw_data
            logger.info(f"Loaded {len(self.episodes)} episodes into EpisodeDiscoveryService catalog.")
        except Exception as e:
            logger.error(f"Failed to load episodes manifest: {e}")

    def find_matching_episode(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Find best matching episode based on:
        1. Guest name match (full name or distinctive first/last name)
        2. High-relevance topic keyword match
        Returns None if query is off-topic or no confident match exists.
        """
        if not self.episodes:
            return None

        clean_query = query.lower().strip()
        query_words = set(re.findall(r"\b[a-z0-9_]+\b", clean_query))
        query_keywords = [w for w in query_words if w not in STOPWORDS and len(w) > 1]

        # 1. Guest Name Matching (High Precision with Word Boundaries)
        for ep in self.episodes:
            guest = ep.get("guest", "")
            slug = ep.get("slug", "")
            guest_lower = guest.lower()
            
            # Exact guest name with word boundary (e.g. "casey winters")
            if guest_lower and re.search(r"\b" + re.escape(guest_lower) + r"\b", clean_query):
                logger.info(f"Guest name match found: '{guest}' for query: '{query[:40]}'")
                return ep
            
            # Slug-based match (e.g. "casey-winters" -> "casey winters")
            slug_clean = slug.replace("-", " ")
            if slug_clean and re.search(r"\b" + re.escape(slug_clean) + r"\b", clean_query):
                logger.info(f"Guest slug match found: '{guest}' ({slug}) for query: '{query[:40]}'")
                return ep
            
            # First + Last name tokens both present in query as distinct words
            guest_parts = [p for p in guest_lower.split() if len(p) > 2 and p not in STOPWORDS]
            if len(guest_parts) >= 2 and all(part in query_words for part in guest_parts):
                logger.info(f"Guest tokens match found: '{guest}' for query: '{query[:40]}'")
                return ep

        # 2. Topic Keyword Matching (Domain-Specific)
        if not query_keywords:
            return None

        # Generic words that are too broad on their own to identify a podcast episode
        GENERIC_DISCARD_WORDS = {
            "algorithm", "code", "coding", "software", "world", "write", "writing", 
            "data", "system", "systems", "team", "teams", "work", "job", "jobs", 
            "future", "people", "person", "culture", "change", "tool", "tools"
        }

        best_match = None
        highest_score = 0.0

        for ep in self.episodes:
            score = 0.0
            keywords = [k.lower().strip() for k in ep.get("keywords", []) if k.strip()]
            summary = ep.get("summary", "").lower()

            # A. Match whole keyword phrases with word boundary
            for kw in keywords:
                # Discard purely generic single words unless in a compound phrase
                if kw in GENERIC_DISCARD_WORDS:
                    continue

                kw_words = kw.split()
                # Use regex word boundaries
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, clean_query):
                    if len(kw_words) >= 2:
                        # Multi-word domain phrase (e.g. "growth loops", "product management", "user retention")
                        score += 5.0 * len(kw_words)
                    else:
                        # Distinctive single-word domain keyword (e.g. "okrs", "freemium", "onboarding")
                        score += 3.5

            # B. Check non-generic query keywords that exactly match a domain keyword
            for qw in query_keywords:
                if qw in GENERIC_DISCARD_WORDS:
                    continue
                for kw in keywords:
                    if kw not in GENERIC_DISCARD_WORDS and qw == kw:
                        score += 2.0

            if score > highest_score:
                highest_score = score
                best_match = ep

        # Confidence threshold for topic matching:
        # Requires at least one multi-word domain phrase or multiple distinct domain keywords
        if best_match and highest_score >= 5.0:
            logger.info(f"Topic match found: '{best_match['guest']}' (Score: {highest_score:.1f}) for query: '{query[:40]}'")
            return best_match

        logger.info(f"No catalog match for query: '{query[:40]}' (Highest score: {highest_score:.1f})")
        return None

    def fetch_and_cache_transcript(self, slug: str) -> Path:
        """
        Download raw markdown transcript from GitHub CDN if not already on disk.
        Returns the local Path.
        """
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        ep_dir = TRANSCRIPTS_DIR / slug
        ep_dir.mkdir(parents=True, exist_ok=True)
        transcript_file = ep_dir / "transcript.md"

        if transcript_file.exists() and transcript_file.stat().st_size > 500:
            logger.info(f"Transcript already cached locally: {transcript_file}")
            return transcript_file

        raw_url = RAW_BASE_URL.format(slug=slug)
        logger.info(f"Downloading transcript from GitHub CDN: {raw_url}...")

        with httpx.Client(timeout=30.0) as client:
            resp = client.get(raw_url)
            if resp.status_code != 200 or len(resp.text) < 500:
                raise RuntimeError(f"Failed to download transcript for {slug}: HTTP {resp.status_code}")
            
            transcript_file.write_text(resp.text, encoding="utf-8")
            logger.info(f"Saved {slug} transcript ({len(resp.text)} chars) to {transcript_file}")

        return transcript_file

# Global singleton
discovery_service = EpisodeDiscoveryService()
