try:
    import pytest
except ImportError:
    pytest = None
from scripts.ingest import recursive_character_chunking, parse_frontmatter
from app.skills.ship30_writer import build_ship30_prompt
from app.skills.artifact_generator import extract_artifacts_from_text

def test_parse_frontmatter():
    """Verify extraction of YAML frontmatter and markdown body."""
    raw = """---
guest: Brian Chesky
title: Brian Chesky on Airbnb
publish_date: 2023-05-18
---
00:00:00 - Introduction
Hello everyone.
"""
    fm, body = parse_frontmatter(raw)
    assert fm["guest"] == "Brian Chesky"
    assert fm["title"] == "Brian Chesky on Airbnb"
    assert "00:00:00 - Introduction" in body

def test_recursive_character_chunking():
    """Verify chunking respects target size and retains timestamps."""
    sample_text = """00:00:00 - Introduction
This is paragraph one about growth and product leadership.

00:05:00 - Growth Loops
This is paragraph two detailing how product-led loops compound over time.

00:10:00 - Metrics
This is paragraph three discussing Goodhart's law and retention curves.
"""
    chunks = recursive_character_chunking(sample_text, target_tokens=20, overlap_tokens=5)
    assert len(chunks) >= 1
    for c in chunks:
        assert "text" in c
        assert "timestamp_ref" in c

def test_artifact_extraction():
    """Verify parser extracts XML artifact blocks cleanly."""
    text_with_artifacts = """
Here is your requested tool:

<artifact type="html" title="Viral K-Factor Calculator">
<!DOCTYPE html>
<html>
<body><h1>Calculator</h1></body>
</html>
</artifact>

Hope this helps!
"""
    artifacts = extract_artifacts_from_text(text_with_artifacts)
    assert len(artifacts) == 1
    assert artifacts[0]["artifact_type"] == "html"
    assert artifacts[0]["title"] == "Viral K-Factor Calculator"
    assert "<h1>Calculator</h1>" in artifacts[0]["content"]

def test_ship30_prompt_builder():
    """Verify Ship 30 for 30 prompt compiler enforces framework constraints."""
    mock_chunks = [
        {
            "episode": "Brian Chesky on Airbnb",
            "guest": "Brian Chesky",
            "timestamp": "00:14:20",
            "text": "Do things that don't scale in the early days."
        }
    ]
    prompt = build_ship30_prompt("How to scale unscalably?", mock_chunks)
    assert "Ship 30 for 30" in prompt
    assert "Approximately 1,250 words" in prompt
    assert "Bold Anchors" in prompt
    assert "Brian Chesky" in prompt
    assert "Do things that don't scale" in prompt
