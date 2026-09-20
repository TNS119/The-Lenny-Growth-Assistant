# backend/app/providers/cloud_provider.py
import httpx
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.providers.base import BaseLLMProvider

import re

logger = logging.getLogger(__name__)

def format_cloud_api_error(service: str, status_code: int, raw_body: str, model: Optional[str] = None) -> str:
    """
    Parses raw provider API error JSON payloads into structured, user-friendly markdown warnings.
    """
    clean_message = ""
    error_code = ""
    error_type = ""

    # Extract JSON object substring if raw_body has a prefix like "API Error (HTTP 429): "
    json_candidate = raw_body.strip()
    prefix_match = re.search(r'\{.*\}', raw_body, re.DOTALL)
    if prefix_match:
        json_candidate = prefix_match.group(0)

    try:
        data = json.loads(json_candidate)
        if isinstance(data, dict):
            err = data.get("error", {})
            if isinstance(err, dict):
                clean_message = str(err.get("message", ""))
                error_code = str(err.get("code", ""))
                error_type = str(err.get("type", ""))
            elif isinstance(err, str):
                clean_message = err
            elif "message" in data:
                clean_message = str(data["message"])
    except Exception:
        clean_message = raw_body.strip()

    srv_lower = service.lower()
    if srv_lower == "groq":
        service_name = "Groq"
    elif srv_lower == "openai":
        service_name = "OpenAI"
    elif srv_lower == "gemini":
        service_name = "Google Gemini"
    elif srv_lower == "claude":
        service_name = "Anthropic Claude"
    else:
        service_name = service.capitalize()

    # 1. HTTP 429: Rate Limit Exceeded
    if status_code == 429 or "rate_limit" in error_code or "rate_limit" in error_type or "tokens" in error_type:
        cooldown_msg = "Please wait a moment before sending another prompt."
        wait_match = re.search(r"try again in ([\d\.]+\s*(?:s|seconds?|m|minutes?))", clean_message, re.IGNORECASE)
        if wait_match:
            cooldown_msg = f"Please wait **{wait_match.group(1)}** before sending another prompt."

        limit_info = ""
        if "OTPM" in clean_message or "output tokens" in clean_message:
            limit_info = "Output tokens per minute (OTPM) rate limit reached."
        elif "TPM" in clean_message or "tokens per minute" in clean_message:
            limit_info = "Total tokens per minute (TPM) quota reached."
        elif "RPM" in clean_message or "requests per minute" in clean_message:
            limit_info = "Requests per minute (RPM) rate limit reached."

        model_tag = f" on model `{model}`" if model else ""
        return (
            f"> ⚠️ **{service_name} Free Rate Limit Reached (HTTP 429)**\n"
            f">\n"
            f"> The free tier rate limit{model_tag} has been momentarily exceeded. {limit_info}\n"
            f">\n"
            f"> ⏳ **Cooldown**: {cooldown_msg}\n"
            f">\n"
            f"> 💡 **What you can do right now**:\n"
            f"> - **Switch to Google Gemini 2.0 Flash**: Click the model selector at the bottom left and choose **Gemini** (generous free tier limits).\n"
            f"> - **Switch to Local Ollama**: Choose **Local Ollama** for 100% free, private inference with zero rate limits.\n"
            f"> - **Add Custom Key**: You can provide your own personal API key with higher limits in the model switcher."
        )

    # 2. HTTP 401: Invalid API Key / Unauthorized
    if status_code == 401 or "invalid_api_key" in error_code or "unauthorized" in clean_message.lower():
        return (
            f"> ⚠️ **{service_name} Authentication Error (HTTP 401)**\n"
            f">\n"
            f"> The API key configured for **{service_name}** is invalid, revoked, or has expired.\n"
            f">\n"
            f"> 💡 **Solution**:\n"
            f"> - Click the model selector in the chat bar to update your {service_name} API key.\n"
            f"> - Or select **Local Ollama** or **Google Gemini** to continue chatting immediately."
        )

    # 3. HTTP 402 / 403: Quota / Billing / Insufficient Balance
    if status_code in (402, 403) or "insufficient_quota" in error_code or "billing" in clean_message.lower():
        return (
            f"> ⚠️ **{service_name} Quota / Billing Notice (HTTP {status_code})**\n"
            f">\n"
            f"> Your **{service_name}** account has exhausted its available credits or requires active billing.\n"
            f">\n"
            f"> 💡 **Solution**:\n"
            f"> - Check billing and balance in your {service_name} Console.\n"
            f"> - Alternatively, switch to **Google Gemini 2.0 Flash** or **Local Ollama**."
        )

    # 4. HTTP 500, 502, 503, 504: Service Overloaded / Downtime
    if status_code in (500, 502, 503, 504):
        return (
            f"> ⚠️ **{service_name} Service Temporarily Unavailable (HTTP {status_code})**\n"
            f">\n"
            f"> Upstream {service_name} servers are currently experiencing high traffic or temporary downtime.\n"
            f">\n"
            f"> 💡 **Solution**: Please retry in a few moments, or select an alternative provider in the model switcher."
        )

    detail = clean_message or f"HTTP {status_code}"
    return f"> ⚠️ **{service_name} API Notice (HTTP {status_code})**: {detail}"


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
                        err_str = error_body.decode('utf-8', errors='replace')
                        logger.warning(f"Anthropic API error ({resp.status_code}): {err_str}")
                        yield format_cloud_api_error("claude", resp.status_code, err_str, model=self.model)
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
            yield format_cloud_api_error("claude", 500, str(e), model=self.model)

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
                        err_str = err_body.decode('utf-8', errors='replace')
                        logger.warning(f"{self.service.upper()} API error ({resp.status_code}): {err_str}")

                        # If Groq hits 429 on primary model, attempt seamless fallback to openai/gpt-oss-20b
                        if self.service == "groq" and resp.status_code == 429 and model != "openai/gpt-oss-20b":
                            logger.info(f"Groq 429 rate limit hit on {model}. Attempting backup model openai/gpt-oss-20b...")
                            try:
                                streamed_any = False
                                async for token in self._stream_openai_compatible(
                                    base_url=base_url,
                                    model="openai/gpt-oss-20b",
                                    messages=messages,
                                    system_prompt=system_prompt,
                                    temperature=temperature
                                ):
                                    if not streamed_any:
                                        streamed_any = True
                                    yield token
                                if streamed_any:
                                    return
                            except Exception as fb_err:
                                logger.warning(f"Groq fallback to gpt-oss-20b failed: {fb_err}")

                        yield format_cloud_api_error(self.service, resp.status_code, err_str, model=model)
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
            yield format_cloud_api_error(self.service, 500, str(e), model=model)

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
                        err_str = err_body.decode('utf-8', errors='replace')
                        logger.warning(f"Google Gemini API error ({resp.status_code}): {err_str}")
                        yield format_cloud_api_error("gemini", resp.status_code, err_str, model=model)
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
            yield format_cloud_api_error("gemini", 500, str(e), model=model)
