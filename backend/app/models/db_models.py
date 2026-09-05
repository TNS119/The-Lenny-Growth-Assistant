# backend/app/models/db_models.py
from sqlalchemy import Column, String, Text, DateTime, Date, Integer, BigInteger, ForeignKey, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy.types import UserDefinedType
    class Vector(UserDefinedType):
        def __init__(self, dim=384):
            self.dim = dim
        def get_col_spec(self, **kw):
            return f"vector({self.dim})"

import uuid

from app.database import Base

class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, default="New Conversation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    messages = relationship("MessageModel", back_populates="session", cascade="all, delete-orphan", order_by="MessageModel.created_at")

class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    sources = Column(JSONB, default=list)  # Stored chunk citations [{episode, guest, timestamp, text, score}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("SessionModel", back_populates="messages")
    artifacts = relationship("ArtifactModel", back_populates="message", cascade="all, delete-orphan")

class ArtifactModel(Base):
    __tablename__ = "artifacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_type = Column(String(50), nullable=False)  # 'markdown' | 'html'
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    message = relationship("MessageModel", back_populates="artifacts")

class TranscriptChunkModel(Base):
    __tablename__ = "transcript_chunks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    episode_title = Column(String(255), nullable=False, index=True)
    guest_name = Column(String(255), nullable=False, index=True)
    publication_date = Column(Date, nullable=True)
    timestamp_ref = Column(String(100), nullable=False)
    chunk_text = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False)
    embedding = Column(Vector(384), nullable=False)  # 384 dimensions for all-MiniLM-L6-v2
