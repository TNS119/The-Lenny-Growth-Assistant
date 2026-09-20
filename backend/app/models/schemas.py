# backend/app/models/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
import uuid

class SourceCitation(BaseModel):
    episode: str
    guest: str
    timestamp: str
    text: str
    score: float

class ArtifactResponse(BaseModel):
    id: uuid.UUID
    message_id: uuid.UUID
    artifact_type: Literal["markdown", "html"]
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: Literal["user", "assistant", "system"]
    content: str
    sources: Optional[List[Dict[str, Any]]] = []
    created_at: datetime
    artifacts: Optional[List[ArtifactResponse]] = []

    class Config:
        from_attributes = True

class SessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    id: Optional[str] = None

class SessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SessionDetail(SessionResponse):
    messages: List[MessageResponse] = []

class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(..., min_length=1, max_length=10000)
    mode: Optional[Literal["default", "ship", "ship30"]] = "default"
    provider: Optional[Literal["ollama", "claude", "openai", "groq", "gemini"]] = "ollama"
    api_key: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    database: str
    pgvector_chunks_indexed: int
    ollama_connected: bool
    active_model: str
    timestamp: datetime
