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

## 4. Ingestion Workflow for The Lenny Growth Assistant

The ingestion script (`backend/scripts/download_transcripts.py` and `backend/scripts/ingest.py`):
1. **Download:** Clones or downloads the transcript markdown files directly from GitHub using sparse checkout or the raw GitHub API.
2. **Metadata Extraction:** Parses the YAML frontmatter (`guest`, `title`, `publish_date`, `youtube_url`).
3. **Recursive Chunking:** Chunks transcript bodies into 500–800 tokens with 100-token overlap, preserving speaker transitions.
4. **Vector Embeddings:** Computes 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2`.
5. **HNSW Upsert:** Inserts chunks and vectors into the PostgreSQL `transcript_chunks` table.
