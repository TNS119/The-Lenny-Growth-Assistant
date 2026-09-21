# backend/app/api/chat.py
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import uuid
import logging
from typing import Optional
from datetime import datetime
 
from app.database import get_db, AsyncSessionLocal
from app.config import get_settings
from app.models.db_models import SessionModel, MessageModel, ArtifactModel
from app.models.schemas import ChatRequest
from app.rag.retriever import TranscriptRetriever
from app.rag.embeddings import get_embedding
from app.providers import get_llm_provider
from app.skills.ship30_writer import build_ship30_prompt
from app.skills.artifact_generator import extract_artifacts_from_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Chat"])

REFUSAL_MESSAGE = "I do not have sufficient information in Lenny's podcast archive to answer this."

GROUNDED_SYSTEM_PROMPT = """You are "The Lenny Growth Assistant", an elite product and growth executive advisor.
Your mission is to synthesize insights from Lenny's Podcast into clear, structured, context-aware answers.

### STRICT OPERATIONAL RULES:
1. Context-Aware Synthesis: Directly answer the user's specific question in your own professional words. DO NOT copy or output raw transcript text, verbatim dialogues, or speaker interview transcripts.
2. Structured & Clear Formatting:
   - Begin with a direct 2-3 sentence executive answer addressing the user's question directly.
   - Use clear markdown sections with bullet points featuring **bold anchor keywords** to explain key mechanisms, contrasting concepts, or frameworks.
   - Conclude with an actionable takeaway for product leaders.
3. Natural Attribution:
   - Attribute insights naturally at the end of key points (e.g. *Source: Brian Chesky on "Brian Chesky's New Playbook"*).
   - DO NOT begin your response with raw bracketed headers.
4. Strict Grounding:
   - Base all reasoning on the provided podcast insights. If the provided excerpts do not contain enough information to answer the question, state:
     "I do not have sufficient information in Lenny's podcast archive to answer this."
5. Artifact Invariants:
   - DO NOT generate or output <artifact> tags unless the user EXPLICITLY requested a standalone artifact, interactive tool, calculator, simulator, or downloadable document file.
   - For standard conversational questions, provide your complete, detailed answer directly in the conversational markdown response and NEVER output an artifact tag or container.
   - ONLY when explicitly asked for an interactive tool, simulator, or calculator, wrap in:
     <artifact type="html" title="...">...</artifact>
   - ONLY when explicitly asked to export/save as a dedicated document or memo file, wrap in:
     <artifact type="markdown" title="...">...</artifact>
"""

@router.post("")
@router.post("/")
async def chat_stream(
    req: ChatRequest,
    x_llm_provider: Optional[str] = Header(None, alias="X-LLM-Provider"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
):
    """
    Stream conversational responses, source citations, and dynamic artifacts 
    over Server-Sent Events (SSE).
    """
    settings = get_settings()

    # 1. Validate / retrieve session
    try:
        session_uuid = uuid.UUID(req.session_id)
    except Exception:
        session_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(req.session_id))

    # Ensure session exists in memory store immediately (0ms latency)
    from app.api.sessions import IN_MEMORY_SESSIONS
    str_session_id = str(session_uuid)
    if str_session_id not in IN_MEMORY_SESSIONS:
        IN_MEMORY_SESSIONS[str_session_id] = {
            "id": str_session_id,
            "title": req.message[:50] + "...",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "messages": []
        }

    # 2. Select Provider (request body > header > default)
    selected_provider = req.provider or x_llm_provider or settings.DEFAULT_PROVIDER
    custom_key = req.api_key or x_api_key
    llm = get_llm_provider(selected_provider, custom_api_key=custom_key)

    # Detect /ship or /ship30 skill command in prompt or mode
    is_ship = (req.mode in ["ship", "ship30"])
    clean_message = req.message.strip()
    if clean_message.lower().startswith("/ship30"):
        is_ship = True
        remainder = clean_message[7:].strip()
        if remainder:
            clean_message = remainder
    elif clean_message.lower().startswith("/ship"):
        is_ship = True
        remainder = clean_message[5:].strip()
        if remainder:
            clean_message = remainder

    lower_msg = clean_message.lower()

    # Dynamic Scenario-Aware Status Notification
    if is_ship or "ship30" in lower_msg or "ship " in lower_msg:
        status_msg = "Drafting Ship 30 for 30 essay in Artifacts..."
    elif any(k in lower_msg for k in ["md file", "markdown file", "artifact", "save as file", "make a file", "create a file", "export"]):
        status_msg = "Compiling document artifact..."
    elif any(k in lower_msg for k in ["calculator", "spreadsheet", "interactive", "tool", "simulator"]):
        status_msg = "Building interactive tool artifact..."
    elif any(k in lower_msg for k in ["summarize", "explain", "compare", "difference", "vs", "versus"]):
        status_msg = "Synthesizing podcast insights..."
    else:
        status_msg = "Searching Lenny's podcast archive..."

    # Retrieve past session history for multi-turn conversational context
    from app.api.sessions import IN_MEMORY_SESSIONS
    past_messages = []
    sess = IN_MEMORY_SESSIONS.get(str(session_uuid))
    if sess and "messages" in sess:
        past_messages = sess["messages"]
    elif db is not None:
        try:
            res = await db.execute(
                select(MessageModel)
                .where(MessageModel.session_id == session_uuid)
                .order_by(MessageModel.created_at)
            )
            all_msgs = res.scalars().all()
            past_messages = [{"role": m.role, "content": m.content} for m in all_msgs]
        except Exception as e:
            logger.warning(f"Could not load past DB messages: {e}")

    # Check if user is asking to create an artifact or file from previous discussion
    is_artifact_request = any(
        k in lower_msg for k in ["md file", "markdown file", "artifact", "save as file", "make a file", "create a file", "export to md", "export as file"]
    )
    last_assistant_msg = None
    if past_messages:
        for m in reversed(past_messages):
            if m.get("role") == "assistant" and len(m.get("content", "").strip()) > 30:
                last_assistant_msg = m.get("content", "").strip()
                break

    # 4. SSE Stream Generator
    async def event_generator():
        # Step A: Dynamic Status notification - yielded immediately for zero perceived latency
        yield f"data: {json.dumps({'type': 'status', 'content': status_msg})}\n\n"

        # Step B: Retrieve relevant chunks from pgvector / local archive
        retriever_sess = AsyncSessionLocal() if AsyncSessionLocal is not None else None
        effective_threshold = min(settings.SIMILARITY_THRESHOLD, 0.30)
        try:
            retriever = TranscriptRetriever(retriever_sess, get_embedding)
            chunks = await retriever.retrieve_relevant_chunks(
                query=clean_message,
                top_k=settings.TOP_K_CHUNKS,
                similarity_threshold=effective_threshold
            )
        finally:
            if retriever_sess is not None:
                await retriever_sess.close()
        
        # Step C: Yield sources
        yield f"data: {json.dumps({'type': 'sources', 'data': chunks})}\n\n"

        full_assistant_response = ""

        # Step D: Check if this is an ungrounded query (0 chunks retrieved)
        if not chunks and not (is_artifact_request and last_assistant_msg):
            # Check upstream catalog for guest or topic match
            from app.rag.discovery import discovery_service
            from app.rag.ingest import ingest_single_episode

            matching_ep = discovery_service.find_matching_episode(clean_message)
            if matching_ep:
                guest_label = matching_ep.get("guest", "episode")
                logger.info(f"JIT discovery triggered for '{guest_label}' ({matching_ep['slug']})")
                status_found = f"Found episode for {guest_label} in Lenny's podcast archive. Ingesting transcript..."
                yield f"data: {json.dumps({'type': 'status', 'content': status_found})}\n\n"
                
                try:
                    # Download raw transcript from GitHub CDN
                    local_path = discovery_service.fetch_and_cache_transcript(matching_ep["slug"])
                    # Ingest into Supabase pgvector non-destructively
                    status_indexing = f"Indexing {guest_label} transcript into vector database..."
                    yield f"data: {json.dumps({'type': 'status', 'content': status_indexing})}\n\n"
                    ingested_count = await ingest_single_episode(local_path)
                    logger.info(f"JIT ingestion indexed {ingested_count} chunks for {guest_label}")

                    # Re-run retrieval with freshly indexed episode
                    yield f"data: {json.dumps({'type': 'status', 'content': 'Synthesizing podcast insights...'})}\n\n"
                    retriever_sess2 = AsyncSessionLocal() if AsyncSessionLocal is not None else None
                    try:
                        retriever_jit = TranscriptRetriever(retriever_sess2, get_embedding)
                        chunks = await retriever_jit.retrieve_relevant_chunks(
                            query=clean_message,
                            top_k=settings.TOP_K_CHUNKS,
                            similarity_threshold=0.28
                        )
                    finally:
                        if retriever_sess2 is not None:
                            await retriever_sess2.close()
                    # Update sources on client
                    yield f"data: {json.dumps({'type': 'sources', 'data': chunks})}\n\n"
                except Exception as jit_err:
                    logger.error(f"JIT ingestion error for {matching_ep['slug']}: {jit_err}")
                    # Resilient fallback: Retrieve directly from the downloaded transcript file
                    try:
                        fallback_retriever = TranscriptRetriever(None, get_embedding)
                        chunks = fallback_retriever._retrieve_from_local_transcripts(
                            query=clean_message,
                            top_k=settings.TOP_K_CHUNKS,
                            similarity_threshold=0.28
                        )
                        if chunks:
                            yield f"data: {json.dumps({'type': 'sources', 'data': chunks})}\n\n"
                    except Exception as fallback_err:
                        logger.error(f"Local transcript fallback error: {fallback_err}")

            # If still no chunks found after JIT attempt (or no matching episode in catalog)
            if not chunks:
                logger.info(f"Refusal triggered: query '{clean_message[:40]}' had 0 chunks above {settings.SIMILARITY_THRESHOLD}")
                yield f"data: {json.dumps({'type': 'token', 'content': REFUSAL_MESSAGE})}\n\n"
                full_assistant_response = REFUSAL_MESSAGE
                yield "data: [DONE]\n\n"
                await _persist_conversation(session_uuid, req.message, full_assistant_response, [], raw_session_id=req.session_id)
                return

        # Step D: Check if this is an artifact request on prior conversation
        if is_artifact_request and last_assistant_msg:
            system_prompt = (
                "You are an elite product editor and technical writer.\n"
                "The user wants you to format the previously discussed content into a clean, standalone Markdown artifact.\n"
                "INSTRUCTIONS:\n"
                "1. Output a brief 1-sentence confirmation in the chat (e.g. 'I have created the Markdown artifact for you.').\n"
                "2. Wrap the complete document inside an artifact container:\n"
                "<artifact type=\"markdown\" title=\"Operational Essay & Framework\">\n"
                "# Operational Essay & Framework\n\n"
                "[Full formatted content with headings, bullet points, and actionable takeaways]\n"
                "</artifact>"
            )
            messages = [
                {"role": "user", "content": f"Please convert this content into a dedicated Markdown artifact file:\n\n{last_assistant_msg}"}
            ]
        elif is_ship:
            system_prompt = "You are an elite ghostwriter following the Ship 30 for 30 framework."
            user_prompt = build_ship30_prompt(clean_message, chunks)
            messages = [{"role": "user", "content": user_prompt}]
        else:
            system_prompt = GROUNDED_SYSTEM_PROMPT
            clean_context = []
            for c in chunks:
                clean_context.append(
                    f"Episode: {c['episode']} (Guest: {c['guest']}) [Timestamp: {c['timestamp']}]:\n{c['text']}"
                )
            context_block = "\n\n---\n\n".join(clean_context)

            # Include recent turns if available for conversational flow
            conv_history = ""
            if past_messages:
                recent = past_messages[-4:]
                turns = [f"{m['role'].capitalize()}: {m['content'][:250]}" for m in recent]
                conv_history = "RECENT CONVERSATION HISTORY:\n" + "\n".join(turns) + "\n\n"

            messages = [
                {
                    "role": "user", 
                    "content": (
                        f"{conv_history}"
                        f"Please provide a clear, strictly grounded answer to the user's question using the podcast insights below.\n\n"
                        f"USER QUESTION:\n{clean_message}\n\n"
                        f"PODCAST INSIGHTS:\n{context_block}\n\n"
                        f"STRICT GROUNDING INSTRUCTIONS:\n"
                        f"- Base your answer ONLY on facts and strategies explicitly discussed in the PODCAST INSIGHTS.\n"
                        f"- If the question is about an unrelated topic (e.g. cooking, general trivia, sports, coding syntax) or the provided insights do not directly answer it, reply EXACTLY with: \"{REFUSAL_MESSAGE}\".\n"
                        f"- DO NOT stretch or metaphorically apply business advice to unrelated topics.\n"
                        f"- Use structured markdown with bullet points and **bold anchor keywords**."
                    )
                }
            ]

        # Step E: Stream tokens from selected LLM
        try:
            if is_ship:
                # For Ship 30, generate essay tokens in background without flooding chat response bubble
                yield f"data: {json.dumps({'type': 'status', 'content': 'Drafting Ship 30 essay artifact (~1,250 words)...'})}\n\n"
                token_count = 0
                async for token in llm.generate_response(messages, system_prompt):
                    full_assistant_response += token
                    token_count += 1
                    if token_count % 30 == 0:
                        yield ": keepalive\n\n"
            else:
                async for token in llm.generate_response(messages, system_prompt):
                    full_assistant_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            logger.error(f"Error during LLM stream generation: {e}")
            err_msg = f"\n[Generation error: {str(e)}]"
            full_assistant_response += err_msg
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"

        # Step F: Extract and notify client of any generated artifacts
        from app.skills.artifact_generator import extract_artifacts_from_text, clean_artifact_content, clean_response_text
        is_error_response = (
            "rate limit" in full_assistant_response.lower() or 
            "api error" in full_assistant_response.lower() or 
            "api notice" in full_assistant_response.lower() or
            "authentication error" in full_assistant_response.lower() or
            "service temporarily unavailable" in full_assistant_response.lower() or
            "generation error" in full_assistant_response.lower()
        )

        raw_artifacts = [] if is_error_response else extract_artifacts_from_text(full_assistant_response)
        
        is_explicit_artifact_req = (
            is_ship or 
            is_artifact_request or 
            any(k in lower_msg for k in ["calculator", "tool", "interactive", "artifact", "save as file", "make a file", "create a file", "export to file", "spreadsheet", "simulator", "html"])
        )

        extracted_artifacts = []
        if is_ship and not is_error_response and not raw_artifacts and len(full_assistant_response) > 50:
            # Guarantee artifact generation for /ship requests even if LLM missed enclosing tags
            title = f"Ship 30 Essay: {clean_message[:45]}"
            cleaned_body = clean_artifact_content(full_assistant_response)
            extracted_artifacts = [{
                "artifact_type": "markdown",
                "title": title,
                "content": cleaned_body
            }]
        elif raw_artifacts and not is_error_response:
            for art in raw_artifacts:
                art["content"] = clean_artifact_content(art.get("content", ""))
                # Only dispatch artifact if user explicitly requested one, or if it is an interactive HTML tool, or if it is a substantial document (> 250 chars)
                if is_explicit_artifact_req or art["artifact_type"] == "html" or len(art["content"]) > 250:
                    extracted_artifacts.append(art)

        if extracted_artifacts:
            for art in extracted_artifacts:
                yield f"data: {json.dumps({'type': 'artifact', 'data': art})}\n\n"

        # Step G: Persist messages and artifacts asynchronously
        if is_ship and not is_error_response:
            cleaned_saved_response = "Artifact is created."
            yield f"data: {json.dumps({'type': 'token', 'content': cleaned_saved_response})}\n\n"
        else:
            cleaned_saved_response = clean_response_text(full_assistant_response)
            if not cleaned_saved_response and extracted_artifacts:
                cleaned_saved_response = "Artifact is created."
            if not cleaned_saved_response:
                cleaned_saved_response = full_assistant_response.strip()

        yield "data: [DONE]\n\n"

        await _persist_conversation(session_uuid, req.message, cleaned_saved_response, chunks, extracted_artifacts, raw_session_id=req.session_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def format_session_title(query: str) -> str:
    """Derives a clean, concise session title from the initial user query."""
    clean = query.strip()
    if clean.lower().startswith("/ship30"):
        clean = clean[7:].strip()
    elif clean.lower().startswith("/ship"):
        clean = clean[5:].strip()
    clean = clean.strip("\"' ")
    if not clean:
        return "Growth Discussion"
    if len(clean) > 42:
        cut = clean[:42]
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0]
        return cut + "..."
    return clean

async def _persist_conversation(
    session_id: uuid.UUID,
    user_msg: str,
    assistant_msg: str,
    sources: list,
    artifacts: list = None,
    raw_session_id: Optional[str] = None
):
    """Save messages and artifacts in memory and fresh database session."""
    from app.api.sessions import IN_MEMORY_SESSIONS, save_in_memory_sessions
    from datetime import datetime
    now = datetime.utcnow()
    asst_id = str(uuid.uuid4())

    formatted_artifacts = []
    if artifacts:
        for art in artifacts:
            formatted_artifacts.append({
                "id": str(art.get("id") or uuid.uuid4()),
                "message_id": asst_id,
                "artifact_type": art.get("artifact_type", "markdown"),
                "title": art.get("title", "Artifact"),
                "content": art.get("content", ""),
                "created_at": now.isoformat()
            })

    # Always persist in in-memory session if available
    sess = IN_MEMORY_SESSIONS.get(str(session_id))
    if not sess and raw_session_id:
        sess = IN_MEMORY_SESSIONS.get(str(raw_session_id))
    if not sess:
        sess = {
            "id": str(session_id),
            "title": format_session_title(user_msg),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "messages": []
        }
        IN_MEMORY_SESSIONS[str(session_id)] = sess
    # Clean up raw_session_id key if it was aliased to prevent duplicate ghost sessions
    if raw_session_id and raw_session_id != str(session_id) and raw_session_id in IN_MEMORY_SESSIONS:
        IN_MEMORY_SESSIONS.pop(raw_session_id, None)

    current_title = sess.get("title", "")
    if not current_title or current_title.startswith(("New", "Session")):
        sess["title"] = format_session_title(user_msg)

    user_m = {
        "id": str(uuid.uuid4()),
        "session_id": str(session_id),
        "role": "user",
        "content": user_msg,
        "created_at": now.isoformat(),
        "sources": []
    }
    asst_m = {
        "id": asst_id,
        "session_id": str(session_id),
        "role": "assistant",
        "content": assistant_msg,
        "created_at": now.isoformat(),
        "sources": sources,
        "artifacts": formatted_artifacts
    }
    sess.setdefault("messages", []).extend([user_m, asst_m])
    sess["updated_at"] = now.isoformat() if isinstance(now, datetime) else str(now)
    save_in_memory_sessions()

    if AsyncSessionLocal is None:
        return

    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(SessionModel).where(SessionModel.id == session_id))
            session_obj = res.scalar_one_or_none()
            if not session_obj:
                session_obj = SessionModel(id=session_id, title=format_session_title(user_msg))
                session.add(session_obj)
                await session.flush()
            elif not session_obj.title or session_obj.title.startswith(("New", "Session")):
                session_obj.title = format_session_title(user_msg)

            user_record = MessageModel(
                session_id=session_id,
                role="user",
                content=user_msg,
                sources=[]
            )
            session.add(user_record)

            assistant_record = MessageModel(
                session_id=session_id,
                role="assistant",
                content=assistant_msg,
                sources=sources
            )
            session.add(assistant_record)
            await session.flush()  # obtain assistant_record.id

            if artifacts:
                for art in artifacts:
                    artifact_record = ArtifactModel(
                        message_id=assistant_record.id,
                        artifact_type=art["artifact_type"],
                        title=art["title"],
                        content=art["content"]
                    )
                    session.add(artifact_record)

            await session.commit()
            logger.info(f"Persisted conversation turn for session: {session_id}")
    except Exception as e:
        logger.error(f"Error persisting conversation to database: {e}")
