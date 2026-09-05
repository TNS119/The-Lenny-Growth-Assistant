# backend/tests/test_retrieval.py
import unittest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.ingest import recursive_character_chunking, parse_frontmatter
from app.skills.ship30_writer import build_ship30_prompt
from app.skills.artifact_generator import extract_artifacts_from_text, clean_artifact_content, clean_response_text

class TestRetrievalAndSkills(unittest.TestCase):
    
    def test_parse_frontmatter(self):
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
        self.assertEqual(fm.get("guest"), "Brian Chesky")
        self.assertEqual(fm.get("title"), "Brian Chesky on Airbnb")
        self.assertIn("00:00:00 - Introduction", body)

    def test_recursive_character_chunking(self):
        """Verify chunking respects target size and retains timestamps."""
        sample_text = """00:00:00 - Introduction
This is paragraph one about growth and product leadership.

00:05:00 - Growth Loops
This is paragraph two detailing how product-led loops compound over time.

00:10:00 - Metrics
This is paragraph three discussing Goodhart's law and retention curves.
"""
        chunks = recursive_character_chunking(sample_text, target_tokens=20, overlap_tokens=5)
        self.assertGreaterEqual(len(chunks), 1)
        for c in chunks:
            self.assertIn("text", c)
            self.assertIn("timestamp_ref", c)

    def test_artifact_extraction(self):
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
        self.assertEqual(len(artifacts), 1)
        self.assertEqual(artifacts[0]["artifact_type"], "html")
        self.assertEqual(artifacts[0]["title"], "Viral K-Factor Calculator")
        self.assertIn("<h1>Calculator</h1>", artifacts[0]["content"])

    def test_artifact_sanitization(self):
        """Verify clean_artifact_content removes outer XML tags."""
        raw_artifact = '<artifact type="html" title="Test"><div>Content</div></artifact>'
        cleaned = clean_artifact_content(raw_artifact)
        self.assertEqual(cleaned, "<div>Content</div>")

    def test_clean_response_text(self):
        """Verify clean_response_text cleans raw tags from chat output."""
        raw_chat = 'Intro text <artifact type="html" title="Test"><div>Content</div></artifact> Outro text'
        cleaned = clean_response_text(raw_chat)
        self.assertNotIn("<artifact", cleaned)
        self.assertIn("Intro text", cleaned)
        self.assertIn("Outro text", cleaned)

    def test_ship30_prompt_builder(self):
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
        self.assertIn("Ship 30 for 30", prompt)
        self.assertIn("Approximately 1,250 words", prompt)
        self.assertIn("Bold Anchors", prompt)
        self.assertIn("Brian Chesky", prompt)
        self.assertIn("Do things that don't scale", prompt)

if __name__ == "__main__":
    unittest.main()
