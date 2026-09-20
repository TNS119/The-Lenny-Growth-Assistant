# backend/app/providers/cloud_provider.py
import httpx
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)

class CloudProvider(BaseLLMProvider):
    """
    Unified cloud LLM provider supporting Anthropic Claude, OpenAI,
    and zero-cost cloud endpoints (Groq and Google Gemini).
    """

    def __init__(
        self,
        service: str = "claude",
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.service = service.lower()
        self.api_key = api_key
        self.model = model

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float = 0.3
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield f"Error: No API key configured for cloud provider '{self.service}'. Please configure the key in .env or switch to Local Ollama."
            return

        if self.service == "claude":
            async for token in self._stream_anthropic(messages, system_prompt, temperature):
                yield token
        elif self.service == "openai":
            async for token in self._stream_openai_compatible(
                base_url="https://api.openai.com/v1",
                model=self.model or "gpt-4o",
                messages=messages,
                system_prompt=system_prompt,
                temperature=temperature
            ):
                yield token
        elif self.service == "groq":
            groq_model = self.model or "qwen/qwen3.8-27b"
            if "llama-3.3" in groq_model or "qwq" in groq_model:
                groq_model = "qwen/qwen3.8-27b"
            async for token in self._stream_openai_compatible(
                base_url="https://api.groq.com/openai/v1",
                model=groq_model,
                messages=messages,
                system_prompt=system_prompt,
                temperature=temperature
            ):
                yield token
        elif self.service == "gemini":
            async for token in self._stream_gemini(messages, system_prompt, temperature):
                yield token
        else:
            yield f"Error: Unsupported cloud service '{self.service}'."

    async def _stream_anthropic(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model or "claude-3-5-sonnet-20241022",
            "system": system_prompt,
            "messages": messages,
            "max_tokens": 4096,
            "temperature": temperature,
            "stream": True
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        yield f"Anthropic API Error (HTTP {resp.status_code}): {error_body.decode('utf-8')}"
                        return

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            event = json.loads(data_str)
                            if event.get("type") == "content_block_delta":
                                delta = event.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    yield delta.get("text", "")
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Anthropic streaming exception: {e}")
            yield f"Error connecting to Anthropic API: {str(e)}"

    async def _stream_openai_compatible(
        self,
        base_url: str,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        formatted_messages = [{"role": "system", "content": system_prompt}] + messages
        payload = {
            "model": model,
            "messages": formatted_messages,
            "temperature": temperature,
            "stream": True
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if resp.status_code != 200:
                        err_body = await resp.aread()
                        yield f"{self.service.upper()} API Error (HTTP {resp.status_code}): {err_body.decode('utf-8')}"
                        return

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"{self.service} streaming exception: {e}")
            yield f"Error connecting to {self.service.upper()} API: {str(e)}"

    async def _stream_gemini(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        model = self.model or "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={self.api_key}&alt=sse"
        
        contents = []
        for m in messages:
            contents.append({
                "role": "user" if m["role"] == "user" else "model",
                "parts": [{"text": m["content"]}]
            })

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": temperature}
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload) as resp:
                    if resp.status_code != 200:
                        err_body = await resp.aread()
                        yield f"Google Gemini API Error (HTTP {resp.status_code}): {err_body.decode('utf-8')}"
                        return

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        try:
                            chunk = json.loads(data_str)
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    text_val = p.get("text", "")
                                    if text_val:
                                        yield text_val
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Gemini streaming exception: {e}")
            yield f"Error connecting to Google Gemini API: {str(e)}"
