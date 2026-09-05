# backend/app/api/providers.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/providers", tags=["Providers"])

class VerifyKeyRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None

@router.get("/status")
async def get_providers_status() -> Dict[str, Any]:
    """Return live connection / configuration status for all 5 supported reasoning engines."""
    settings = get_settings()
    
    # 1. Probe local Ollama
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                ollama_ok = True
    except Exception:
        ollama_ok = False

    return {
        "ollama": {
            "id": "ollama",
            "name": "Llama 3.2 3B",
            "type": "local",
            "connected": ollama_ok,
            "requires_key": False,
            "has_env_key": True,
        },
        "groq": {
            "id": "groq",
            "name": "Groq Llama 3.3 70B",
            "type": "cloud",
            "connected": bool(settings.GROQ_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.GROQ_API_KEY),
        },
        "gemini": {
            "id": "gemini",
            "name": "Gemini 2.0 Flash",
            "type": "cloud",
            "connected": bool(settings.GEMINI_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.GEMINI_API_KEY),
        },
        "claude": {
            "id": "claude",
            "name": "Claude 3.5 Sonnet",
            "type": "paid",
            "connected": bool(settings.ANTHROPIC_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.ANTHROPIC_API_KEY),
        },
        "openai": {
            "id": "openai",
            "name": "ChatGPT-4o",
            "type": "paid",
            "connected": bool(settings.OPENAI_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.OPENAI_API_KEY),
        }
    }

@router.post("/verify")
async def verify_provider_key(req: VerifyKeyRequest) -> Dict[str, Any]:
    """Live-test an API key or local connection against the respective provider endpoint."""
    settings = get_settings()
    provider = req.provider.lower().strip()
    key = (req.api_key or "").strip()

    if provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                if resp.status_code == 200:
                    return {"success": True, "message": "Local Ollama daemon is active and running!", "provider": "ollama"}
                return {"success": False, "message": f"Ollama returned HTTP {resp.status_code}", "provider": "ollama"}
        except Exception as e:
            return {"success": False, "message": f"Could not connect to Ollama at {settings.OLLAMA_BASE_URL}. Ensure Ollama is running.", "provider": "ollama"}

    if not key:
        return {"success": False, "message": "Please provide a valid non-empty API key.", "provider": provider}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider == "claude":
                headers = {
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                }
                payload = {
                    "model": settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022",
                    "max_tokens": 5,
                    "messages": [{"role": "user", "content": "ping"}]
                }
                resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                if resp.status_code in [200, 201]:
                    return {"success": True, "message": "Anthropic API Key verified successfully!", "provider": "claude"}
                return {"success": False, "message": f"Anthropic error (HTTP {resp.status_code}): {resp.text[:120]}", "provider": "claude"}

            elif provider == "openai":
                headers = {"Authorization": f"Bearer {key}"}
                resp = await client.get("https://api.openai.com/v1/models", headers=headers)
                if resp.status_code == 200:
                    return {"success": True, "message": "OpenAI API Key verified successfully!", "provider": "openai"}
                return {"success": False, "message": f"OpenAI error (HTTP {resp.status_code}): {resp.text[:120]}", "provider": "openai"}

            elif provider == "groq":
                headers = {"Authorization": f"Bearer {key}"}
                resp = await client.get("https://api.groq.com/openai/v1/models", headers=headers)
                if resp.status_code == 200:
                    return {"success": True, "message": "Groq API Key verified successfully!", "provider": "groq"}
                return {"success": False, "message": f"Groq error (HTTP {resp.status_code}): {resp.text[:120]}", "provider": "groq"}

            elif provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                resp = await client.get(url)
                if resp.status_code == 200:
                    return {"success": True, "message": "Google Gemini API Key verified successfully!", "provider": "gemini"}
                return {"success": False, "message": f"Gemini error (HTTP {resp.status_code}): {resp.text[:120]}", "provider": "gemini"}

            else:
                return {"success": False, "message": f"Unsupported provider '{provider}'.", "provider": provider}

    except Exception as e:
        logger.error(f"Key verification failed for {provider}: {e}")
        return {"success": False, "message": f"Connection error: {str(e)}", "provider": provider}
