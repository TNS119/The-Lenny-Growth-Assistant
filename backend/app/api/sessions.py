import os
import json
import logging
from pathlib import Path
from datetime import datetime
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.db_models import SessionModel, MessageModel, ArtifactModel
from app.models.schemas import SessionCreate, SessionResponse, SessionDetail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SESSIONS_STORE_PATH = DATA_DIR / "sessions_store.json"

def _load_sessions_from_disk() -> Dict[str, Dict[str, Any]]:
    if SESSIONS_STORE_PATH.exists():
        try:
            with open(SESSIONS_STORE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning(f"Could not load sessions from disk: {e}")
    return {}

MAX_IN_MEMORY_SESSIONS = 50

def _trim_in_memory_sessions():
    """Keeps only the most recent MAX_IN_MEMORY_SESSIONS in RAM to prevent unbounded memory growth."""
    if len(IN_MEMORY_SESSIONS) > MAX_IN_MEMORY_SESSIONS:
        sorted_keys = sorted(
            IN_MEMORY_SESSIONS.keys(),
            key=lambda k: str(IN_MEMORY_SESSIONS[k].get("updated_at", "")),
            reverse=True
        )
        for old_k in sorted_keys[MAX_IN_MEMORY_SESSIONS:]:
            del IN_MEMORY_SESSIONS[old_k]

def save_in_memory_sessions():
    try:
        _trim_in_memory_sessions()
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        serializable = {}
        for sid, sdata in IN_MEMORY_SESSIONS.items():
            s_copy = dict(sdata)
            s_copy["id"] = str(s_copy["id"])
            if isinstance(s_copy.get("created_at"), datetime):
                s_copy["created_at"] = s_copy["created_at"].isoformat()
            if isinstance(s_copy.get("updated_at"), datetime):
                s_copy["updated_at"] = s_copy["updated_at"].isoformat()
            serializable[sid] = s_copy
            
        with open(SESSIONS_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not save sessions to disk: {e}")

# In-memory fallback session store backed by disk persistence
IN_MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = _load_sessions_from_disk()
_trim_in_memory_sessions()

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate = None, db: AsyncSession = Depends(get_db)):
    """Create a new conversational session with optional client UUID and resilient fallback."""
    title = (payload.title.strip() if payload and payload.title and payload.title.strip() else "New Conversation")
    
    # Support client-generated UUID for optimistic local UI sync
    session_id = None
    if payload and payload.id:
        try:
            session_id = uuid.UUID(str(payload.id).strip())
        except (ValueError, TypeError):
            session_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(payload.id).strip())
    if not session_id:
        session_id = uuid.uuid4()

    now = datetime.utcnow()

    if db is not None:
        try:
            # Idempotent check: if already exists in DB, return existing
            existing = await db.execute(select(SessionModel).where(SessionModel.id == session_id))
            session_obj = existing.scalar_one_or_none()
            if not session_obj:
                session_obj = SessionModel(id=session_id, title=title)
                db.add(session_obj)
                await db.commit()
                await db.refresh(session_obj)
            return session_obj
        except Exception as e:
            try:
                await db.rollback()
            except Exception:
                pass
            logger.warning(f"Could not persist session to DB (fallback to in-memory): {e}")

    session_dict = {
        "id": str(session_id),
        "title": title,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "messages": []
    }
    IN_MEMORY_SESSIONS[str(session_id)] = session_dict
    save_in_memory_sessions()
    return SessionResponse(**session_dict)

@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_sessions(db: AsyncSession = Depends(get_db)):
    """Reset all sessions to a single clean conversation."""
    IN_MEMORY_SESSIONS.clear()
    clean_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    clean_sess = {
        "id": clean_id,
        "title": "New Growth Conversation",
        "created_at": now,
        "updated_at": now,
        "messages": []
    }
    IN_MEMORY_SESSIONS[clean_id] = clean_sess
    save_in_memory_sessions()
    return {"status": "reset", "session": clean_sess}

@router.post("/clear", status_code=status.HTTP_200_OK)
@router.delete("", status_code=status.HTTP_200_OK)
async def clear_all_sessions(db: AsyncSession = Depends(get_db)):
    """Clear all sessions completely."""
    if db is not None:
        try:
            from sqlalchemy import delete
            await db.execute(delete(SessionModel))
            await db.commit()
        except Exception:
            pass
    IN_MEMORY_SESSIONS.clear()
    save_in_memory_sessions()
    return {"status": "cleared", "count": 0}

@router.get("", response_model=List[SessionResponse])
@router.get("/", response_model=List[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List recent sessions sorted by updated_at descending."""
    unique_sessions: Dict[str, Dict[str, Any]] = {}
    for s in IN_MEMORY_SESSIONS.values():
        if isinstance(s, dict) and "id" in s:
            unique_sessions[str(s["id"])] = s

    if db is not None:
        try:
            result = await db.execute(select(SessionModel).order_by(desc(SessionModel.updated_at)))
            db_sessions = result.scalars().all()
            if db_sessions:
                # Merge DB sessions over memory sessions
                for dbs in db_sessions:
                    unique_sessions[str(dbs.id)] = {
                        "id": str(dbs.id),
                        "title": dbs.title,
                        "created_at": dbs.created_at.isoformat() if hasattr(dbs.created_at, "isoformat") else str(dbs.created_at),
                        "updated_at": dbs.updated_at.isoformat() if hasattr(dbs.updated_at, "isoformat") else str(dbs.updated_at),
                    }
        except Exception as e:
            logger.warning(f"Could not load sessions from DB: {e}")

    sorted_sess = sorted(unique_sessions.values(), key=lambda s: str(s.get("updated_at", "")), reverse=True)
    return [SessionResponse(**s) for s in sorted_sess]

@router.get("/{session_id}", response_model=SessionDetail)
@router.get("/{session_id}/", response_model=SessionDetail)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch complete session history, messages, and associated artifacts."""
    clean_sid = str(session_id).strip()
    if db is not None:
        try:
            session_uuid = uuid.UUID(clean_sid)
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

    sess = IN_MEMORY_SESSIONS.get(clean_sid)
    if not sess:
        # Fallback: scan by string ID matching
        for k, v in IN_MEMORY_SESSIONS.items():
            if str(v.get("id")) == clean_sid or str(k) == clean_sid:
                sess = v
                break

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

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, 
        detail=f"Session '{session_id}' not found"
    )

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/{session_id}/", status_code=status.HTTP_204_NO_CONTENT)
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

    deleted = False
    if str(session_id) in IN_MEMORY_SESSIONS:
        del IN_MEMORY_SESSIONS[str(session_id)]
        deleted = True
    for k, v in list(IN_MEMORY_SESSIONS.items()):
        if str(v.get("id")) == str(session_id):
            del IN_MEMORY_SESSIONS[k]
            deleted = True
    if deleted:
        save_in_memory_sessions()
