# backend/app/providers/ollama_provider.py
import httpx
import json
import logging
from typing import AsyncGenerator, Dict, Any, List
from app.providers.base import BaseLLMProvider
 
logger = logging.getLogger(__name__)

class OllamaProvider(BaseLLMProvider):
    """
    Concrete provider connecting to local Ollama daemon.
    Enables 100% free, offline inference with zero API keys.
    """

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2:3b"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float = 0.3
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "stream": True,
            "options": {"temperature": temperature}
        }

        url = f"{self.base_url}/api/chat"
        logger.info(f"Dispatching stream to local Ollama: {url} with model: {self.model}")

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code == 404:
                        yield f"Error: Model '{self.model}' is not pulled in Ollama. Please run: 'ollama pull {self.model}' in your terminal."
                        return
                    elif response.status_code != 200:
                        yield f"Error: Ollama service returned HTTP {response.status_code}."
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except (httpx.ConnectError, httpx.ConnectTimeout):
            logger.error(f"Cannot connect to Ollama at {self.base_url}")
            yield (
                f"Error: Unable to connect to local Ollama daemon at {self.base_url}. "
                "Ensure Ollama is running ('ollama serve') and accessible."
            )
        except Exception as e:
            logger.error(f"Ollama streaming exception: {e}")
            yield f"Error generating response from local Ollama: {str(e)}"
