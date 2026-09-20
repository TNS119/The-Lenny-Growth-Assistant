# backend/tests/test_discovery.py
import unittest
from app.rag.discovery import EpisodeDiscoveryService

class TestEpisodeDiscovery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.discovery = EpisodeDiscoveryService()

    def test_manifest_loaded(self):
        self.assertGreaterEqual(len(self.discovery.episodes), 200, "Manifest should have at least 200 episodes")

    def test_guest_exact_match(self):
        ep = self.discovery.find_matching_episode("What did Casey Winters say about growth loops?")
        self.assertIsNotNone(ep)
        self.assertEqual(ep["slug"], "casey-winters")
        self.assertIn("Casey Winters", ep["guest"])

    def test_guest_tokens_match(self):
        ep = self.discovery.find_matching_episode("Tell me Andy Johns advice on career and burnout")
        self.assertIsNotNone(ep)
        self.assertEqual(ep["slug"], "andy-johns")
        self.assertIn("Andy Johns", ep["guest"])

    def test_topic_keyword_match(self):
        ep = self.discovery.find_matching_episode("How should a product team set quarterly OKRs?")
        self.assertIsNotNone(ep)
        all_text = " ".join(ep.get("keywords", [])).lower() + " " + ep.get("summary", "").lower()
        self.assertIn("okr", all_text)

    def test_offtopic_rejection_cooking(self):
        ep = self.discovery.find_matching_episode("How to cook delicious chicken biryani?")
        self.assertIsNone(ep, "Cooking queries must return None")

    def test_offtopic_rejection_recipe(self):
        ep = self.discovery.find_matching_episode("What is the recipe for homemade pasta dough?")
        self.assertIsNone(ep, "Recipe queries must return None")

    def test_offtopic_rejection_sports(self):
        ep = self.discovery.find_matching_episode("Who won the 2022 FIFA World Cup in Qatar?")
        self.assertIsNone(ep, "Sports queries must return None")

    def test_offtopic_rejection_coding_syntax(self):
        ep = self.discovery.find_matching_episode("How to write a quicksort algorithm in C++?")
        self.assertIsNone(ep, "Generic programming syntax queries must return None")

if __name__ == "__main__":
    unittest.main()
