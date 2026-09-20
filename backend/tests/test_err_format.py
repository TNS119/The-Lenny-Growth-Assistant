import json
import unittest
from app.providers.cloud_provider import format_cloud_api_error

class TestCloudErrorFormatting(unittest.TestCase):
    def test_groq_429_rate_limit(self):
        raw = json.dumps({
            "error": {
                "message": "Rate limit reached for model `qwen/qwen3.8-27b` in organization `org_01` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Used 810, Requested 610. Please try again in 25.2s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing",
                "type": "tokens",
                "code": "rate_limit_exceeded"
            }
        })
        res = format_cloud_api_error("groq", 429, raw, "qwen/qwen3.8-27b")
        self.assertIn("Groq Free Rate Limit Reached (HTTP 429)", res)
        self.assertIn("25.2s", res)
        self.assertIn("qwen/qwen3.8-27b", res)
        self.assertIn("Output tokens per minute (OTPM)", res)
        self.assertIn("Google Gemini", res)

    def test_groq_prefixed_raw_string(self):
        raw = 'GROQ API Error (HTTP 429): {"error":{"message":"Rate limit reached for model `qwen/qwen3.8-27b`. Please try again in 14.5s.","type":"tokens","code":"rate_limit_exceeded"}}'
        res = format_cloud_api_error("groq", 429, raw, "qwen/qwen3.8-27b")
        self.assertIn("Groq Free Rate Limit Reached (HTTP 429)", res)
        self.assertIn("14.5s", res)

    def test_auth_error_401(self):
        raw = json.dumps({"error": {"message": "Invalid API Key", "code": "invalid_api_key"}})
        res = format_cloud_api_error("groq", 401, raw)
        self.assertIn("Authentication Error (HTTP 401)", res)
        self.assertIn("API key configured for **Groq** is invalid", res)

    def test_quota_error_403(self):
        raw = json.dumps({"error": {"message": "You exceeded your current quota.", "code": "insufficient_quota"}})
        res = format_cloud_api_error("openai", 403, raw)
        self.assertIn("Quota / Billing Notice", res)

    def test_overload_error_503(self):
        raw = json.dumps({"error": {"message": "The model is overloaded. Please try again later."}})
        res = format_cloud_api_error("gemini", 503, raw)
        self.assertIn("Service Temporarily Unavailable", res)

if __name__ == "__main__":
    unittest.main()
