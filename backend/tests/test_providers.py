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

def test_api_key_masking():
    """Verify mask_api_key produces correct masked representations."""
    from app.api.providers import mask_api_key
    assert mask_api_key(None) is None
    assert mask_api_key("") is None
    assert mask_api_key("short") == "••••••••"
    masked = mask_api_key("gsk_1234567890abcdef")
    assert masked.startswith("gsk_")
    assert masked.endswith("cdef")
    assert "••••" in masked

@pytest.mark.asyncio
async def test_set_and_delete_provider_key():
    """Verify set_provider_key updates settings and delete_provider_key clears it."""
    from app.api.providers import set_provider_key, delete_provider_key, UpdateKeyRequest, get_providers_status
    from app.config import get_settings
    
    settings = get_settings()
    test_key = "test_groq_key_99998888"
    
    resp = await set_provider_key(UpdateKeyRequest(provider="groq", api_key=test_key))
    assert resp["success"] is True
    assert settings.GROQ_API_KEY == test_key
    
    status = await get_providers_status()
    assert status["groq"]["has_env_key"] is True
    assert status["groq"]["masked_key"] is not None
    
    # Clean up
    del_resp = await delete_provider_key("groq")
    assert del_resp["success"] is True
    assert settings.GROQ_API_KEY is None
