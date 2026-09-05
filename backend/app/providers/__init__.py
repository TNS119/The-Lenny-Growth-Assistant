# backend/app/providers/__init__.py
from app.providers.base import BaseLLMProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.cloud_provider import CloudProvider
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

def get_llm_provider(provider_name: str = None) -> BaseLLMProvider:
    """
    Dynamic factory routing inference between local Ollama and cloud options.
    If cloud keys are missing, gracefully defaults to local Ollama.
    """
    settings = get_settings()
    name = (provider_name or settings.DEFAULT_PROVIDER).lower()

    if name == "claude":
        if settings.ANTHROPIC_API_KEY:
            return CloudProvider(
                service="claude",
                api_key=settings.ANTHROPIC_API_KEY,
                model=settings.ANTHROPIC_MODEL
            )
        logger.warning("Anthropic API key not found. Falling back to local Ollama.")
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

    elif name == "openai":
        if settings.OPENAI_API_KEY:
            return CloudProvider(
                service="openai",
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_MODEL
            )
        logger.warning("OpenAI API key not found. Falling back to local Ollama.")
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

    elif name == "groq":
        if settings.GROQ_API_KEY:
            return CloudProvider(
                service="groq",
                api_key=settings.GROQ_API_KEY,
                model=settings.GROQ_MODEL
            )
        logger.warning("Groq API key not found. Falling back to local Ollama.")
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

    elif name == "gemini":
        if settings.GEMINI_API_KEY:
            return CloudProvider(
                service="gemini",
                api_key=settings.GEMINI_API_KEY,
                model=settings.GEMINI_MODEL
            )
        logger.warning("Gemini API key not found. Falling back to local Ollama.")
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

    else:
        # Default is local Ollama
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

__all__ = ["BaseLLMProvider", "OllamaProvider", "CloudProvider", "get_llm_provider"]
