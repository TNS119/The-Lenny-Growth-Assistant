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
import { ModelSelector, ProviderType } from "@/components/Chat/ModelSelector";
import { useChatStream } from "@/hooks/useChatStream";
import { PanelLeft, Compass, Layers } from "lucide-react";

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProvider, setCurrentProvider] = useState<ProviderType>("ollama");

  // Refresh messages from server upon stream finish
  const handleStreamFinish = useCallback(async () => {
    if (!activeSessionId) return;
    const detail = await fetchSessionDetail(activeSessionId);
    if (detail) {
      setMessages(detail.messages);
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

  // Initial Load: Fetch sessions
  useEffect(() => {
    async function init() {
      const sessList = await fetchSessions();
      setSessions(sessList);
      if (sessList.length > 0) {
        setActiveSessionId(sessList[0].id);
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

  // Fetch messages when active session changes
  useEffect(() => {
    if (!activeSessionId) return;
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
    // Optimistically append user message to UI
    const tempUserMsg: Message = {
      id: String(Date.now()),
      session_id: activeSessionId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    const tempAssistantMsg: Message = {
      id: String(Date.now() + 1),
      session_id: activeSessionId,
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
      }
    );
  };

  // Adjustable Artifact Section Width State & Resizing Handler
  const [artifactWidth, setArtifactWidth] = useState<number>(640);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setArtifactWidth(Math.min(760, Math.max(480, Math.floor(window.innerWidth * 0.48))));
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
      const minWidth = 360;
      const maxWidth = window.innerWidth - 420; // Ensure chat pane gets at least 420px
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
    <div className="flex flex-col h-screen w-screen bg-obsidian-950 text-obsidian-100 overflow-hidden select-none">
      {/* 1. Full-Width Fixed Top Navigation Bar */}
      <header className="h-14 px-4 bg-obsidian-900 border-b border-obsidian-600 flex items-center justify-between shrink-0 w-full z-40">
        {/* Left: Single Sidebar Toggle Button + Logo & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-800 transition-colors shrink-0 ${
              isSidebarOpen ? "bg-obsidian-800 text-obsidian-100" : ""
            }`}
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-5 h-5 text-brand-teal shrink-0" />
            <span className="text-sm font-bold text-obsidian-100 whitespace-nowrap">
              Lenny Assistant
            </span>
            <span className="text-[10px] bg-obsidian-800 text-brand-teal px-2 py-0.5 rounded-full border border-obsidian-600 font-semibold hidden sm:inline whitespace-nowrap shrink-0">
              Verified Podcast Advice
            </span>
          </div>
        </div>

        {/* Right: Artifacts Workspace Toggle + Model Selector */}
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

          <ModelSelector
            currentProvider={currentProvider}
            onSelectProvider={setCurrentProvider}
            disabled={isStreaming}
          />
        </div>
      </header>

      {/* 2. Main Section Below Fixed Navbar: Divided into Sidebar | Chat Pane | Resizer | Artifact Workspace */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* Chat Pane & Sidebar Area */}
        <div className="flex-1 h-full min-w-0 flex overflow-hidden">
          <ChatPane
            sessions={sessions}
            activeSessionId={activeSessionId}
            messages={messages}
            isStreaming={isStreaming}
            currentStatus={currentStatus}
            onSelectSession={setActiveSessionId}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onSendMessage={handleSendMessage}
            onStopStream={stopStream}
            onOpenArtifact={openArtifact}
            isSidebarOpen={isSidebarOpen}
            onCloseSidebar={() => setIsSidebarOpen(false)}
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

        {/* Right Claude-Style Artifact Section */}
        {isDrawerOpen && (
          <div
            style={{ width: `${artifactWidth}px` }}
            className="h-full shrink-0 relative flex flex-col overflow-hidden"
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
  );
}
