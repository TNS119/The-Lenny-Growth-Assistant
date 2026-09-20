# RESOURCE: LENNY'S PODCAST TRANSCRIPTS ARCHIVE

**Source Repository:** [`ChatPRD/lennys-podcast-transcripts`](https://github.com/ChatPRD/lennys-podcast-transcripts)  
**Maintained By:** ChatPRD (Claire Vo)  
**License:** Public Open Access Archive  

---

## 1. Archive Overview

The `ChatPRD/lennys-podcast-transcripts` repository is an organized, comprehensive archive containing over **269 full-length episode transcripts** from *Lenny’s Podcast* (hosted by Lenny Rachitsky), the premier product and growth podcast featuring in-depth tactical interviews with world-class product leaders, growth executives, and founders.

## 2. Directory & File Organization

The upstream repository is structured as follows:

```
lennys-podcast-transcripts/
├── episodes/
│   ├── {guest-name}/
│   │   └── transcript.md        # Full episode text with YAML frontmatter
│   ├── brian-chesky/
│   ├── shreyas-doshi/
│   ├── elena-verna/
│   └── ...                      # 269 episode folders
├── index/
│   ├── README.md                # Topic index overview
│   ├── product-management.md    # Curated episodes by topic
│   ├── growth-strategy.md
│   ├── pricing.md
│   └── ...                      # 50+ topic categorization files
└── scripts/
    └── build-index.sh
```

## 3. Metadata & YAML Frontmatter Schema

Each episode `transcript.md` contains standardized YAML frontmatter that our ingestion pipeline extracts and indexes into PostgreSQL:

```yaml
---
guest: "Brian Chesky"
title: "Brian Chesky on Scaling Airbnb, Leadership, and Product Management"
youtube_url: "https://www.youtube.com/watch?v=..."
video_id: "abcdef12345"
publish_date: "2023-05-18"
description: "Brian Chesky shares tactical insights on founder-led mode..."
duration_seconds: 5420
duration: "1h 30m"
view_count: 350000
channel: "Lenny's Podcast"
---
```

## 4. Ingestion Workflows for The Lenny Growth Assistant

### 4.1 Master Catalog Synchronization (`sync_manifest.py`)
To enable instantaneous lookup across all 269 episodes without hitting GitHub REST API rate limits, the system compiles `backend/data/episodes_manifest.json` by parsing `index/episodes.md` from the upstream repository:
- Extracts guest names, slugs, summaries, and domain keywords.
- Maps raw markdown download links directly to Fastly CDN (`https://raw.githubusercontent.com/...`).
- Run sync via:
  ```powershell
  cd backend
  python scripts/sync_manifest.py
  ```

### 4.2 Initial Seed Ingestion (`ingest.py`)
- Reads baseline curated transcripts in `backend/data/transcripts/`.
- Speaker-aware chunking (~400 tokens, 50-token overlap).
- Embeddings: 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2`.
- Upsert: Inserts into the Supabase `transcript_chunks` table with pgvector HNSW indexing.

### 4.3 Just-In-Time (JIT) Dynamic Ingestion (`discovery.py`)
When a user asks about an episode or guest not currently in the database:
1. `EpisodeDiscoveryService` scans `episodes_manifest.json` in $<2\text{ms}$.
2. If matched, streams status to the chat UI (*"Found episode for [Guest]... Ingesting transcript..."*).
3. Downloads the raw markdown directly from GitHub CDN.
4. Chunks, embeds, and executes an **additive upsert** (`ingest_single_episode`) into Supabase pgvector without wiping existing data.
5. Re-runs retrieval and delivers the grounded response. Subsequent queries on that episode execute at sub-second cached speed.
