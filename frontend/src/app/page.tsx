// frontend/src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  fetchSessions, 
  createSession, 
  fetchSessionDetail, 
  deleteSession, 
  Session, 
  Message, 
  Artifact 
} from "@/lib/api";
import { ChatPane } from "@/components/Chat/ChatPane";
import { ArtifactViewer } from "@/components/Artifact/ArtifactViewer";
import type { ProviderType } from "@/components/Chat/ModelSelector";
import { useChatStream } from "@/hooks/useChatStream";
import { PanelLeft, Compass, Layers, PlusCircle, MessageSquare, Trash2, X, Loader2 } from "lucide-react";

function formatSessionTitle(query: string): string {
  let clean = query.trim().replace(/^\/ship(30)?\s*/i, "").trim();
  clean = clean.replace(/^["']+|["']+$/g, "").trim();
  if (!clean) return "Growth Discussion";
  if (clean.length > 36) {
    const cut = clean.slice(0, 36);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut) + "...";
  }
  return clean;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  
  // Isolated per-session messages: { [sessionId: string]: Message[] }
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>({});
  
  // Isolated per-session active artifacts: { [sessionId: string]: Artifact | null }
  const [artifactsBySession, setArtifactsBySession] = useState<Record<string, Artifact | null>>({});

  // Active streaming session ID (if any)
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null);

  const [currentProvider, setCurrentProvider] = useState<ProviderType>("groq");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Track sequence of session detail fetches to discard stale network responses
  const fetchSeqRef = useRef<number>(0);

  // Refresh messages and title from server upon stream finish for that specific session
  const handleStreamFinish = useCallback(async (finishedSessionId: string) => {
    setStreamingSessionId((prev) => (prev === finishedSessionId ? null : prev));
    if (!finishedSessionId) return;

    try {
      const detail = await fetchSessionDetail(finishedSessionId);
      if (detail) {
        setMessagesBySession((prev) => ({
          ...prev,
          [finishedSessionId]: detail.messages,
        }));
        if (detail.title) {
          setSessions((prev) =>
            prev.map((s) => (s.id === finishedSessionId ? { ...s, title: detail.title } : s))
          );
        }
      }
    } catch (e) {
      console.warn("Error refreshing session detail on stream finish:", e);
    }
  }, []);

  const handleArtifactGenerated = useCallback((art: Artifact, artSessionId: string) => {
    setArtifactsBySession((prev) => ({
      ...prev,
      [artSessionId]: art,
    }));
  }, []);

  const {
    isStreaming,
    currentStatus,
    isDrawerOpen,
    openArtifact: openArtifactDrawer,
    closeArtifact,
    toggleDrawer,
    sendMessage,
    stopStream,
  } = useChatStream({
    sessionId: activeSessionId,
    onStreamFinish: handleStreamFinish,
    onArtifactGenerated: handleArtifactGenerated,
  });

  const handleOpenArtifact = useCallback((art: Artifact) => {
    if (activeSessionId) {
      setArtifactsBySession((prev) => ({
        ...prev,
        [activeSessionId]: art,
      }));
    }
    openArtifactDrawer(art, activeSessionId);
  }, [activeSessionId, openArtifactDrawer]);

  // Synchronize sessions list to localStorage for refresh reliability
  useEffect(() => {
    if (sessions.length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem("lenny_cached_sessions", JSON.stringify(sessions));
      } catch (e) {}
    }
  }, [sessions]);

  // Synchronize per-session messages to localStorage for refresh reliability
  useEffect(() => {
    if (Object.keys(messagesBySession).length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem("lenny_cached_messages", JSON.stringify(messagesBySession));
      } catch (e) {}
    }
  }, [messagesBySession]);

  // Initial Load: Restore from local persistence immediately, then reconcile with server
  useEffect(() => {
    async function init() {
      let cachedSessions: Session[] = [];
      let cachedMessages: Record<string, Message[]> = {};
      let lastActive: string | null = null;

      if (typeof window !== "undefined") {
        lastActive = localStorage.getItem("lenny_last_active_session");
        try {
          const rawSess = localStorage.getItem("lenny_cached_sessions");
          if (rawSess) cachedSessions = JSON.parse(rawSess);
        } catch (e) {}
        try {
          const rawMsgs = localStorage.getItem("lenny_cached_messages");
          if (rawMsgs) cachedMessages = JSON.parse(rawMsgs);
        } catch (e) {}
      }

      if (cachedSessions.length > 0) {
        setSessions(cachedSessions);
        if (Object.keys(cachedMessages).length > 0) {
          setMessagesBySession(cachedMessages);
        }
        const matched = lastActive ? cachedSessions.find((s) => s.id === lastActive) : null;
        const initialId = matched ? matched.id : cachedSessions[0].id;
        setActiveSessionId(initialId);
      }

      // Reconcile with server in background without wiping local state
      const sessList = await fetchSessions();
      if (sessList && sessList.length > 0) {
        setSessions(sessList);
        const currentActive = lastActive || (cachedSessions.length > 0 ? cachedSessions[0].id : null);
        const matched = currentActive ? sessList.find((s) => s.id === currentActive) : null;
        const initialId = matched ? matched.id : sessList[0].id;
        setActiveSessionId(initialId);
      } else if (cachedSessions.length === 0) {
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fallbackSess: Session = {
          id: newId,
          title: "New Growth Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions([fallbackSess]);
        setActiveSessionId(fallbackSess.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("lenny_last_active_session", fallbackSess.id);
        }
        createSession("New Growth Conversation", newId).catch(() => {});
      }
    }
    init();
  }, []);

  // Fetch messages when active session changes, preventing stale out-of-order responses
  useEffect(() => {
    if (!activeSessionId) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("lenny_last_active_session", activeSessionId);
    }

    const currentReqId = ++fetchSeqRef.current;
    async function loadMessages() {
      const detail = await fetchSessionDetail(activeSessionId);
      if (fetchSeqRef.current === currentReqId) {
        if (detail) {
          setMessagesBySession((prev) => ({
            ...prev,
            [activeSessionId]: detail.messages || [],
          }));
          if (detail.title) {
            setSessions((prev) =>
              prev.map((s) => (s.id === activeSessionId ? { ...s, title: detail.title } : s))
            );
          }
        } else {
          // If detail is null (e.g. newly created session with 0 messages or network latency),
          // preserve any existing local messages or default to empty list.
          // NEVER filter or delete activeSessionId here!
          setMessagesBySession((prev) => ({
            ...prev,
            [activeSessionId]: prev[activeSessionId] || [],
          }));
        }
      }
    }
    loadMessages();
  }, [activeSessionId]);

  const handleNewSession = useCallback(async () => {
    try {
      // 1. Optimistically generate new UUID immediately
      const newId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newSess: Session = {
        id: newId,
        title: "New Growth Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 2. Immediately update state (0ms UI latency)
      setSessions((prev) => [newSess, ...prev.filter((s) => s.id !== newId)]);
      setActiveSessionId(newId);
      setMessagesBySession((prev) => ({
        ...prev,
        [newId]: [],
      }));
      setArtifactsBySession((prev) => ({
        ...prev,
        [newId]: null,
      }));
      closeArtifact();

      if (typeof window !== "undefined") {
        localStorage.setItem("lenny_last_active_session", newId);
      }

      // 3. Sync to backend asynchronously (fire-and-reconcile in background)
      createSession("New Growth Conversation", newId).then((serverSess) => {
        if (serverSess) {
          setSessions((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, ...serverSess } : s))
          );
        }
      }).catch((e) => {
        console.warn("Backend session creation sync error (optimistic session retained):", e);
      });
    } catch (e) {
      console.error("Failed to create new session:", e);
    }
  }, [closeArtifact]);

  const handleDeleteSession = async (id: string) => {
    if (deletingSessionId) return;
    setDeletingSessionId(id);

    // Stop active streaming immediately if it belongs to the session being deleted
    if (isStreaming && (streamingSessionId === id || activeSessionId === id)) {
      stopStream();
      setStreamingSessionId(null);
    }

    const isDeletingActive = id === activeSessionId;
    let targetNextActiveId: string | null = null;

    // 1. Optimistic removal from sessions list
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (isDeletingActive) {
        targetNextActiveId = remaining.length > 0 ? remaining[0].id : null;
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("lenny_cached_sessions", JSON.stringify(remaining));
        } catch (e) {}
      }
      return remaining;
    });

    // 2. Clean up cache for deleted session
    setMessagesBySession((prev) => {
      const copy = { ...prev };
      delete copy[id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("lenny_cached_messages", JSON.stringify(copy));
        } catch (e) {}
      }
      return copy;
    });
    setArtifactsBySession((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    // 3. Smooth active session switch
    if (isDeletingActive) {
      closeArtifact();
      if (targetNextActiveId) {
        setActiveSessionId(targetNextActiveId);
        if (typeof window !== "undefined") {
          localStorage.setItem("lenny_last_active_session", targetNextActiveId);
        }
      } else {
        // No remaining sessions -> create a fresh session
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `sess-${Date.now()}`;
        const freshSess: Session = {
          id: newId,
          title: "New Growth Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions([freshSess]);
        setActiveSessionId(freshSess.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("lenny_last_active_session", freshSess.id);
          localStorage.setItem("lenny_cached_sessions", JSON.stringify([freshSess]));
        }
        createSession("New Growth Conversation", newId).catch(() => {});
      }
    }

    // 4. Send background DELETE request to server
    try {
      await deleteSession(id);
    } catch (err) {
      console.error("Failed to delete session on server:", err);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleSendMessage = (text: string, mode: "default" | "ship" | "ship30") => {
    let currentId = activeSessionId;
    if (!currentId) {
      currentId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
      setActiveSessionId(currentId);
      const newSess: Session = {
        id: currentId,
        title: formatSessionTitle(text),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSessions((prev) => [newSess, ...prev]);
    } else {
      // Optimistically update session title from initial query if default
      const computedTitle = formatSessionTitle(text);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId && (s.title.startsWith("Session") || s.title.startsWith("New"))
            ? { ...s, title: computedTitle }
            : s
        )
      );
    }

    setStreamingSessionId(currentId);

    // Optimistically append user and placeholder assistant messages strictly to currentId
    const tempUserMsg: Message = {
      id: String(Date.now()),
      session_id: currentId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    const tempAssistantMsg: Message = {
      id: String(Date.now() + 1),
      session_id: currentId,
      role: "assistant",
      content: "",
      sources: [],
      created_at: new Date().toISOString(),
    };

    setMessagesBySession((prev) => ({
      ...prev,
      [currentId]: [...(prev[currentId] || []), tempUserMsg, tempAssistantMsg],
    }));

    sendMessage(
      text,
      mode,
      currentProvider,
      (streamSessionId: string, accumulatedText: string, sources: any[]) => {
        // Guarantee isolation: strictly update the session ID that owns this stream
        setMessagesBySession((prev) => {
          const sessionMsgs = prev[streamSessionId] ? [...prev[streamSessionId]] : [];
          const lastIdx = sessionMsgs.length - 1;
          if (lastIdx >= 0 && sessionMsgs[lastIdx].role === "assistant") {
            sessionMsgs[lastIdx] = {
              ...sessionMsgs[lastIdx],
              content: accumulatedText,
              sources: sources,
            };
          }
          return {
            ...prev,
            [streamSessionId]: sessionMsgs,
          };
        });
      },
      currentId
    );
  };

  // Reasonable Initial Artifact Section Width State (~440px - 480px)
  const [artifactWidth, setArtifactWidth] = useState<number>(460);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setArtifactWidth(Math.min(480, Math.max(380, Math.floor(window.innerWidth * 0.35))));
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 340;
      const maxWidth = window.innerWidth - 420;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setArtifactWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Sidebar open/collapse state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen bg-obsidian-950 text-obsidian-100 overflow-hidden select-none">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* 1. Full-Height Side Navbar (h-screen, from top of window to bottom) */}
      <aside
        className={`h-screen bg-obsidian-900 border-r border-obsidian-600 flex flex-col transition-all duration-200 ease-in-out z-50 shrink-0 ${
          isSidebarOpen
            ? "w-72 fixed inset-y-0 left-0 lg:static lg:w-72 opacity-100 shadow-2xl lg:shadow-none"
            : "w-0 border-r-0 opacity-0 overflow-hidden pointer-events-none fixed inset-y-0 left-0 -translate-x-full lg:translate-x-0 lg:static"
        }`}
      >
        {/* Sidebar Brand Header (Logo "LENNY" + Tagline "Growth-Assistant" + 200+ Episodes Metric + Collapse Button) */}
        <div className="py-3 px-3.5 flex items-center justify-between shrink-0 bg-obsidian-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-5 h-5 text-brand-teal shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-sm font-black tracking-wider text-obsidian-100 uppercase">
                  LENNY
                </span>
                <span className="text-[11px] font-semibold text-brand-teal whitespace-nowrap">
                  Growth-Assistant
                </span>
              </div>
              <span className="text-[9.5px] text-obsidian-400 font-medium tracking-tight whitespace-nowrap">
                200+ Episodes Indexed · 2.5M Words
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-800 transition-colors shrink-0 border border-obsidian-600 shadow-xs"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Recent Conversations List (Named by Initial Query) */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <span className="px-3 text-[10px] font-bold text-obsidian-500 uppercase tracking-wider block mb-1.5">
            Recent Conversations
          </span>
          {sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-obsidian-500 text-xs">
              No conversations yet
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const isDeleting = deletingSessionId === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    if (isDeleting) return;
                    setActiveSessionId(sess.id);
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-all duration-150 select-none ${
                    isActive
                      ? "bg-obsidian-800 text-obsidian-100 border border-obsidian-600 font-semibold shadow-xs"
                      : "text-obsidian-400 hover:bg-obsidian-800/60 hover:text-obsidian-200 border border-transparent"
                  } ${isDeleting ? "opacity-30 pointer-events-none" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        isActive ? "text-brand-teal" : "text-obsidian-500 group-hover:text-obsidian-400"
                      }`}
                    />
                    <span className="truncate block leading-tight" title={sess.title}>
                      {sess.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(sess.id);
                    }}
                    disabled={isDeleting}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-obsidian-700/80 text-obsidian-400 hover:text-red-400 transition-all shrink-0 cursor-pointer"
                    title="Delete conversation"
                    aria-label={`Delete ${sess.title}`}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-obsidian-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* New Session Action (Placed at bottom of sidebar) */}
        <div className="p-3 border-t border-obsidian-600 shrink-0 bg-obsidian-900">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-600 hover:border-brand-teal text-xs font-bold text-obsidian-100 transition-all shadow-sm group cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-brand-teal group-hover:scale-110 transition-transform" />
            <span>New Session</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Container (Starts from right of sidebar, spans full height) */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Header Bar (Starts from main container) */}
        <header className="h-14 px-4 bg-obsidian-900 border-b border-obsidian-600 flex items-center justify-between shrink-0 w-full z-30">
          {/* Left: When sidebar is CLOSED, display Toggle Button + "LENNY Growth-Assistant" */}
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <div className="flex items-center gap-2.5 min-w-0 animate-in fade-in duration-150">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-lg text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-800 transition-colors shrink-0 border border-obsidian-600 shadow-xs"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <Compass className="w-5 h-5 text-brand-teal shrink-0" />
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-sm font-black tracking-wider text-obsidian-100 uppercase">
                      LENNY
                    </span>
                    <span className="text-[11px] font-semibold text-brand-teal whitespace-nowrap">
                      Growth-Assistant
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Artifacts Workspace Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={toggleDrawer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm whitespace-nowrap ${
                isDrawerOpen
                  ? "bg-brand-teal text-white border-brand-teal shadow-brand-teal/20"
                  : "bg-obsidian-800 text-obsidian-200 border-obsidian-600 hover:text-obsidian-100 hover:border-obsidian-500"
              }`}
              title={isDrawerOpen ? "Close artifact workspace" : "Open artifact workspace"}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Artifacts</span>
              {artifactsBySession[activeSessionId] && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              )}
            </button>
          </div>
        </header>

        {/* Content Area Below Header: Divided into Chat Area | Resizer | Reasonable Width Artifact Section */}
        <div className="flex-1 w-full flex overflow-hidden relative">
          {/* Chat Pane */}
          <div className="flex-1 h-full min-w-0 flex overflow-hidden">
            <ChatPane
              messages={activeSessionId ? (messagesBySession[activeSessionId] || []) : []}
              isStreaming={isStreaming && streamingSessionId === activeSessionId}
              currentStatus={streamingSessionId === activeSessionId ? currentStatus : null}
              currentProvider={currentProvider}
              onSelectProvider={setCurrentProvider}
              onSendMessage={handleSendMessage}
              onStopStream={stopStream}
              onOpenArtifact={handleOpenArtifact}
            />
          </div>

          {/* Adjustable Split Resizer Handle */}
          {isDrawerOpen && (
            <div
              onMouseDown={handleMouseDown}
              className={`w-2.5 hover:w-3 h-full bg-obsidian-700 hover:bg-brand-teal/80 cursor-col-resize transition-colors flex items-center justify-center group z-30 shrink-0 select-none relative ${
                isResizing ? "bg-brand-teal ring-2 ring-brand-teal/40" : ""
              }`}
              title="Drag horizontally to adjust section width"
              aria-label="Resize workspace split"
            >
              <div className="w-1 h-12 bg-obsidian-500 rounded-full group-hover:bg-white transition-colors" />
            </div>
          )}

          {/* Right Claude-Style Artifact Section with Reasonable Initial Width */}
          {isDrawerOpen && (
            <div
              style={{ width: `${artifactWidth}px` }}
              className="h-full shrink-0 relative flex flex-col overflow-hidden shadow-lg"
            >
              <ArtifactViewer
                artifact={artifactsBySession[activeSessionId] || null}
                isOpen={isDrawerOpen}
                onClose={closeArtifact}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
