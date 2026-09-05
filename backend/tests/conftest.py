# backend/tests/conftest.py
import pytest
import asyncio
import os
import sys
from pathlib import Path

# Put backend root on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Configure mock settings for testing
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:password123@localhost:5432/lenny_assistant"
os.environ["DEFAULT_LLM_PROVIDER"] = "ollama"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
