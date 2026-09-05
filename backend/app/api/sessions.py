# backend/app/api/sessions.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any
from datetime import datetime
import uuid

from app.database import get_db
from app.models.db_models import SessionModel, MessageModel, ArtifactModel
from app.models.schemas import SessionCreate, SessionResponse, SessionDetail

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

# In-memory fallback session store when database is uninitialized or disconnected
IN_MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = {}

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new conversational session."""
    session_id = uuid.uuid4()
    title = payload.title or "New Conversation"
    now = datetime.utcnow()

    if db is not None:
        try:
            session_obj = SessionModel(id=session_id, title=title)
            db.add(session_obj)
            await db.commit()
            await db.refresh(session_obj)
            return session_obj
        except Exception:
            pass

    session_dict = {
        "id": session_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "messages": []
    }
    IN_MEMORY_SESSIONS[str(session_id)] = session_dict
    return SessionResponse(**session_dict)

@router.get("", response_model=List[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List recent sessions sorted by updated_at descending."""
    if db is not None:
        try:
            result = await db.execute(select(SessionModel).order_by(desc(SessionModel.updated_at)))
            return result.scalars().all()
        except Exception:
            pass

    sorted_sess = sorted(IN_MEMORY_SESSIONS.values(), key=lambda s: s["updated_at"], reverse=True)
    return [SessionResponse(**s) for s in sorted_sess]

@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch complete session history, messages, and associated artifacts."""
    if db is not None:
        try:
            session_uuid = uuid.UUID(session_id)
            stmt = (
                select(SessionModel)
                .options(
                    selectinload(SessionModel.messages).selectinload(MessageModel.artifacts)
                )
                .where(SessionModel.id == session_uuid)
            )
            result = await db.execute(stmt)
            session_obj = result.scalar_one_or_none()
            if session_obj:
                return session_obj
        except Exception:
            pass

    sess = IN_MEMORY_SESSIONS.get(str(session_id))
    if sess:
        sanitized_messages = []
        for m in sess.get("messages", []):
            formatted_arts = []
            for art in m.get("artifacts", []):
                formatted_arts.append({
                    "id": str(art.get("id") or uuid.uuid4()),
                    "message_id": str(art.get("message_id") or m.get("id") or uuid.uuid4()),
                    "artifact_type": art.get("artifact_type", "markdown"),
                    "title": art.get("title", "Artifact"),
                    "content": art.get("content", ""),
                    "created_at": str(art.get("created_at") or datetime.utcnow().isoformat())
                })
            sanitized_messages.append({
                "id": str(m.get("id") or uuid.uuid4()),
                "session_id": str(session_id),
                "role": m.get("role", "user"),
                "content": m.get("content", ""),
                "sources": m.get("sources", []),
                "artifacts": formatted_arts,
                "created_at": str(m.get("created_at") or datetime.utcnow().isoformat())
            })
        return SessionDetail(
            id=sess["id"],
            title=sess["title"],
            created_at=sess["created_at"],
            updated_at=sess["updated_at"],
            messages=sanitized_messages
        )

    # Resilient auto-provisioning for any string ID
    now = datetime.utcnow()
    try:
        su = uuid.UUID(session_id)
    except Exception:
        su = uuid.uuid5(uuid.NAMESPACE_DNS, session_id)
    new_sess = {
        "id": su,
        "title": "New Conversation",
        "created_at": now,
        "updated_at": now,
        "messages": []
    }
    IN_MEMORY_SESSIONS[str(session_id)] = new_sess
    IN_MEMORY_SESSIONS[str(su)] = new_sess
    return SessionDetail(**new_sess)

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a session and all its messages/artifacts."""
    if db is not None:
        try:
            session_uuid = uuid.UUID(session_id)
            result = await db.execute(select(SessionModel).where(SessionModel.id == session_uuid))
            session_obj = result.scalar_one_or_none()
            if session_obj:
                await db.delete(session_obj)
                await db.commit()
                return
        except Exception:
            pass

    if str(session_id) in IN_MEMORY_SESSIONS:
        del IN_MEMORY_SESSIONS[str(session_id)]
