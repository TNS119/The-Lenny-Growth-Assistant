# backend/app/api/__init__.py
from app.api.sessions import router as sessions_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router

__all__ = ["sessions_router", "chat_router", "health_router"]
