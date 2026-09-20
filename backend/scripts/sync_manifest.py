# backend/scripts/sync_manifest.py
import re
import json
import logging
import httpx
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_manifest")

EPISODES_INDEX_URL = "https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/index/episodes.md"
BASE_RAW_URL = "https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/{slug}/transcript.md"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MANIFEST_PATH = DATA_DIR / "episodes_manifest.json"

def fetch_and_parse_manifest():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Fetching episodes index from {EPISODES_INDEX_URL}...")
    
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(EPISODES_INDEX_URL)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch episodes index: HTTP {resp.status_code}")
        markdown_text = resp.text

    # Parse the markdown table
    # Format: | [Guest Name](../episodes/slug/transcript.md) | Summary | Keywords |
    episodes = []
    row_regex = re.compile(
        r"\|\s*\[([^\]]+)\]\(\.\./episodes/([^/]+)/transcript\.md\)\s*\|\s*([^\|]*)\|\s*([^\|]*)\|"
    )

    for line in markdown_text.splitlines():
        match = row_regex.search(line)
        if match:
            guest = match.group(1).strip()
            slug = match.group(2).strip()
            summary = match.group(3).strip()
            keywords_raw = match.group(4).strip()
            keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()]

            episodes.append({
                "slug": slug,
                "guest": guest,
                "summary": summary,
                "keywords": keywords,
                "raw_url": BASE_RAW_URL.format(slug=slug)
            })

    logger.info(f"Successfully parsed {len(episodes)} episodes from index/episodes.md.")
    
    MANIFEST_PATH.write_text(json.dumps(episodes, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Manifest written to: {MANIFEST_PATH} ({len(episodes)} entries)")
    return episodes

if __name__ == "__main__":
    fetch_and_parse_manifest()
