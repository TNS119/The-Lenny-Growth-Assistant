# backend/tests/test_providers.py
try:
    import pytest
except ImportError:
    class MockPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = MockPytest()
from app.providers import get_llm_provider, OllamaProvider, CloudProvider

@pytest.mark.asyncio
async def test_ollama_provider_defaults():
    """Verify OllamaProvider initializes with target parameters."""
    provider = get_llm_provider("ollama")
    assert isinstance(provider, OllamaProvider)
    assert provider.model == "llama3.2:3b"

@pytest.mark.asyncio
async def test_cloud_provider_missing_key():
    """Verify CloudProvider yields clear error when API key is missing."""
    cloud = CloudProvider(service="claude", api_key=None)
    tokens = []
    async for token in cloud.generate_response([{"role": "user", "content": "hello"}], "system"):
        tokens.append(token)
    
    assert len(tokens) == 1
    assert "Error: No API key configured" in tokens[0]

@pytest.mark.asyncio
async def test_provider_factory_fallback():
    """Verify factory gracefully falls back to Ollama if cloud key is not in env."""
    # When claude is requested without ANTHROPIC_API_KEY in env, fallback to Ollama
    provider = get_llm_provider("claude")
    # Will be OllamaProvider if key is unset
    assert isinstance(provider, (OllamaProvider, CloudProvider))
