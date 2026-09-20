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

class UpdateKeyRequest(BaseModel):
    provider: str
    api_key: str

PROVIDER_KEY_MAP = {
    "groq": "GROQ_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
}

def mask_api_key(key: Optional[str]) -> Optional[str]:
    if not key or not key.strip():
        return None
    k = key.strip()
    if len(k) > 12:
        return f"{k[:4]}••••••••••••{k[-4:]}"
    elif len(k) > 6:
        return f"{k[:2]}••••••••{k[-2:]}"
    return "••••••••"

def _update_env_file(key_name: str, new_value: str):
    import os
    from pathlib import Path
    # Look for .env in root or backend dir
    possible_paths = [
        Path(__file__).resolve().parent.parent.parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for env_path in possible_paths:
        try:
            if env_path.exists():
                lines = env_path.read_text(encoding="utf-8").splitlines()
                updated = False
                new_lines = []
                for line in lines:
                    if line.strip().startswith(f"{key_name}="):
                        new_lines.append(f"{key_name}={new_value}")
                        updated = True
                    else:
                        new_lines.append(line)
                if not updated:
                    new_lines.append(f"{key_name}={new_value}")
                env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
                break
        except Exception as e:
            logger.warning(f"Could not update .env at {env_path}: {e}")

def _remove_env_key(key_name: str):
    import os
    from pathlib import Path
    possible_paths = [
        Path(__file__).resolve().parent.parent.parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for env_path in possible_paths:
        try:
            if env_path.exists():
                lines = env_path.read_text(encoding="utf-8").splitlines()
                new_lines = []
                for line in lines:
                    if line.strip().startswith(f"{key_name}="):
                        new_lines.append(f"{key_name}=")
                    else:
                        new_lines.append(line)
                env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
                break
        except Exception as e:
            logger.warning(f"Could not clear .env key at {env_path}: {e}")

@router.get("/status")
async def get_providers_status() -> Dict[str, Any]:
    """Return live connection / configuration status for all 5 supported reasoning engines."""
    settings = get_settings()
    
    # 1. Probe local Ollama with tight timeout and IPv4
    ollama_ok = False
    try:
        ollama_url = settings.OLLAMA_BASE_URL.replace("localhost", "127.0.0.1")
        async with httpx.AsyncClient(timeout=0.8) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
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
            "masked_key": None,
        },
        "groq": {
            "id": "groq",
            "name": "Groq Qwen 3.8 27B",
            "type": "cloud",
            "connected": bool(settings.GROQ_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.GROQ_API_KEY),
            "masked_key": mask_api_key(settings.GROQ_API_KEY),
        },
        "gemini": {
            "id": "gemini",
            "name": "Gemini 2.0 Flash",
            "type": "cloud",
            "connected": bool(settings.GEMINI_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.GEMINI_API_KEY),
            "masked_key": mask_api_key(settings.GEMINI_API_KEY),
        },
        "claude": {
            "id": "claude",
            "name": "Claude 3.5 Sonnet",
            "type": "paid",
            "connected": bool(settings.ANTHROPIC_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.ANTHROPIC_API_KEY),
            "masked_key": mask_api_key(settings.ANTHROPIC_API_KEY),
        },
        "openai": {
            "id": "openai",
            "name": "ChatGPT-4o",
            "type": "paid",
            "connected": bool(settings.OPENAI_API_KEY),
            "requires_key": True,
            "has_env_key": bool(settings.OPENAI_API_KEY),
            "masked_key": mask_api_key(settings.OPENAI_API_KEY),
        }
    }

@router.post("/key")
async def set_provider_key(req: UpdateKeyRequest) -> Dict[str, Any]:
    """Dynamically set and persist an API key for a specified cloud provider."""
    import os
    settings = get_settings()
    provider = req.provider.lower().strip()
    key = req.api_key.strip()
    
    if provider not in PROVIDER_KEY_MAP:
        return {"success": False, "message": f"Cannot set API key for provider '{provider}'. Supported: {list(PROVIDER_KEY_MAP.keys())}"}

    env_var_name = PROVIDER_KEY_MAP[provider]
    setattr(settings, env_var_name, key)
    os.environ[env_var_name] = key
    _update_env_file(env_var_name, key)

    logger.info(f"Updated API key for provider '{provider}' ({env_var_name})")
    return {
        "success": True,
        "provider": provider,
        "masked_key": mask_api_key(key),
        "message": f"API key for {provider.capitalize()} configured and saved successfully."
    }

@router.delete("/key/{provider}")
async def delete_provider_key(provider: str) -> Dict[str, Any]:
    """Dynamically clear an API key for a specified cloud provider."""
    import os
    settings = get_settings()
    p = provider.lower().strip()
    
    if p not in PROVIDER_KEY_MAP:
        return {"success": False, "message": f"Cannot clear key for provider '{p}'."}

    env_var_name = PROVIDER_KEY_MAP[p]
    setattr(settings, env_var_name, None)
    os.environ.pop(env_var_name, None)
    _remove_env_key(env_var_name)

    logger.info(f"Cleared API key for provider '{p}' ({env_var_name})")
    return {
        "success": True,
        "provider": p,
        "message": f"API key for {p.capitalize()} removed."
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

    # If key is omitted from verify request, fallback to configured settings key
    if not key and provider in PROVIDER_KEY_MAP:
        key = getattr(settings, PROVIDER_KEY_MAP[provider], None) or ""

    if not key:
        return {"success": False, "message": "Please enter a valid non-empty API key to verify.", "provider": provider}

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

