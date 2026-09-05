// frontend/src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { PanelLeft, Compass, Layers, PlusCircle, MessageSquare, Trash2, X } from "lucide-react";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProvider, setCurrentProvider] = useState<ProviderType>("ollama");

  // Refresh messages and title from server upon stream finish
  const handleStreamFinish = useCallback(async () => {
    if (!activeSessionId) return;
    const detail = await fetchSessionDetail(activeSessionId);
    if (detail) {
      setMessages(detail.messages);
      if (detail.title) {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, title: detail.title } : s))
        );
      }
    }
  }, [activeSessionId]);

  const {
    isStreaming,
    currentStatus,
    activeArtifact,
    isDrawerOpen,
    openArtifact,
    closeArtifact,
    toggleDrawer,
    sendMessage,
    stopStream,
  } = useChatStream({
    sessionId: activeSessionId,
    onStreamFinish: handleStreamFinish,
  });

  // Initial Load: Fetch sessions with local persistence restore
  useEffect(() => {
    async function init() {
      const sessList = await fetchSessions();
      setSessions(sessList);
      if (sessList.length > 0) {
        const lastActive = typeof window !== "undefined" ? localStorage.getItem("lenny_last_active_session") : null;
        const matched = lastActive ? sessList.find((s) => s.id === lastActive) : null;
        setActiveSessionId(matched ? matched.id : sessList[0].id);
      } else {
        const newSess = await createSession("New Growth Conversation");
        if (newSess) {
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
        } else {
          const fallbackSess: Session = {
            id: "local-session-1",
            title: "New Growth Conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setSessions([fallbackSess]);
          setActiveSessionId(fallbackSess.id);
        }
      }
    }
    init();
  }, []);

  // Fetch messages when active session changes and save active ID to localStorage
  useEffect(() => {
    if (!activeSessionId) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("lenny_last_active_session", activeSessionId);
    }
    async function loadMessages() {
      const detail = await fetchSessionDetail(activeSessionId);
      if (detail) {
        setMessages(detail.messages);
      } else {
        setMessages([]);
      }
    }
    loadMessages();
  }, [activeSessionId]);

  const handleNewSession = async () => {
    const newSess = await createSession(`Session ${sessions.length + 1}`);
    if (newSess) {
      setSessions([newSess, ...sessions]);
      setActiveSessionId(newSess.id);
      setMessages([]);
    }
  };

  const handleDeleteSession = async (id: string) => {
    const success = await deleteSession(id);
    if (success) {
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (id === activeSessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          handleNewSession();
        }
      }
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

    // Optimistically append user message to UI
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

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);

    sendMessage(
      text,
      mode,
      currentProvider,
      (accumulatedText: string, sources: any[]) => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: accumulatedText,
              sources: sources,
            };
          }
          return updated;
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
          {sessions.map((sess) => (
            <div
              key={sess.id}
              onClick={() => {
                setActiveSessionId(sess.id);
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                sess.id === activeSessionId
                  ? "bg-obsidian-700 text-obsidian-100 border border-obsidian-600 font-bold shadow-xs"
                  : "text-obsidian-400 hover:bg-obsidian-800/60 hover:text-obsidian-200"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-obsidian-500" />
                <span className="truncate">{sess.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(sess.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                title="Delete session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
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
              {activeArtifact && (
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
              messages={messages}
              isStreaming={isStreaming}
              currentStatus={currentStatus}
              currentProvider={currentProvider}
              onSelectProvider={setCurrentProvider}
              onSendMessage={handleSendMessage}
              onStopStream={stopStream}
              onOpenArtifact={openArtifact}
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
                artifact={activeArtifact}
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
