import React, { useState, useRef, useEffect } from "react";
import { Message, Session, Artifact } from "@/lib/api";
import { MessageItem } from "@/components/Chat/MessageItem";
import { 
  Send, 
  Square, 
  PlusCircle, 
  MessageSquare, 
  PenTool, 
  Compass, 
  Loader2, 
  Trash2,
  Sparkles,
  X
} from "lucide-react";

interface ChatPaneProps {
  sessions: Session[];
  activeSessionId: string;
  messages: Message[];
  isStreaming: boolean;
  currentStatus: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onSendMessage: (text: string, mode: "default" | "ship" | "ship30") => void;
  onStopStream: () => void;
  onOpenArtifact: (artifact: Artifact) => void;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  sessions,
  activeSessionId,
  messages,
  isStreaming,
  currentStatus,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSendMessage,
  onStopStream,
  onOpenArtifact,
  isSidebarOpen,
  onCloseSidebar,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isShipActive = input.trim().toLowerCase().startsWith("/ship");
  const showSlashMenu = input.startsWith("/") && !input.startsWith("/ship");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const isShip = input.trim().toLowerCase().startsWith("/ship");
    onSendMessage(input.trim(), isShip ? "ship" : "default");
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && showSlashMenu) {
      e.preventDefault();
      setInput("/ship ");
      return;
    }
    if (e.key === "Escape" && showSlashMenu) {
      e.preventDefault();
      setInput("");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full w-full bg-obsidian-950 text-obsidian-100 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={onCloseSidebar}
          className="fixed inset-0 bg-black/25 z-25 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sessions Sidebar (Collapsible on Desktop and Mobile) */}
      <aside
        className={`h-full bg-obsidian-900 border-r border-obsidian-600 flex flex-col transition-all duration-200 ease-in-out z-30 ${
          isSidebarOpen
            ? "w-72 fixed inset-y-0 left-0 lg:static lg:w-72 opacity-100 shadow-xl lg:shadow-none"
            : "w-0 border-r-0 opacity-0 overflow-hidden pointer-events-none fixed inset-y-0 left-0 -translate-x-full lg:translate-x-0 lg:static"
        }`}
      >
        {/* Mobile Drawer Header with Close */}
        <div className="p-3 border-b border-obsidian-600 flex items-center justify-between lg:hidden shrink-0">
          <span className="text-xs font-bold text-obsidian-100">Conversations</span>
          <button
            onClick={onCloseSidebar}
            className="p-1 rounded-md text-obsidian-400 hover:text-obsidian-100"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 shrink-0">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 text-xs font-bold text-obsidian-100 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-brand-teal" />
            <span>New Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <span className="px-3 text-[10px] font-bold text-obsidian-500 uppercase tracking-wider block mb-1">
            Recent Conversations
          </span>
          {sessions.map((sess) => (
            <div
              key={sess.id}
              onClick={() => {
                onSelectSession(sess.id);
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  onCloseSidebar();
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
                  onDeleteSession(sess.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                title="Delete session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-obsidian-950 h-full overflow-hidden">
        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto divide-y divide-obsidian-600/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-obsidian-800 border border-obsidian-600 flex items-center justify-center text-brand-teal mb-4 shadow-sm">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-obsidian-100 mb-1">
                The Lenny Growth Assistant
              </h2>
              <p className="text-xs text-obsidian-400 leading-relaxed mb-6">
                Battle-tested product and growth advice from the world's top founders, operators, and PMs, curated from Lenny's Podcast archives.
              </p>
              <div className="w-full space-y-2 text-left">
                <button
                  onClick={() => onSendMessage("What did Brian Chesky say about founder mode vs. manager mode?", "default")}
                  className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-brand-teal text-xs text-obsidian-300 hover:text-obsidian-100 transition-all shadow-sm group"
                >
                  <span className="text-brand-teal mr-1.5 font-bold">💡</span> "What did Brian Chesky say about founder mode vs. manager mode?"
                </button>
                <button
                  onClick={() => onSendMessage("Explain Elena Verna's viral loops and K-factor in B2B PLG.", "default")}
                  className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-brand-teal text-xs text-obsidian-300 hover:text-obsidian-100 transition-all shadow-sm group"
                >
                  <span className="text-brand-teal mr-1.5 font-bold">💡</span> "Explain Elena Verna's viral loops and K-factor in B2B PLG."
                </button>
                <button
                  onClick={() => onSendMessage("/ship Shreyas Doshi's LNO Framework for PMs", "ship")}
                  className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-amber-400 text-xs text-amber-900/90 hover:text-amber-950 transition-all shadow-sm group font-medium"
                >
                  <span className="text-amber-700 mr-1.5 font-bold">✍️ [/ship Skill]</span> "Write a 1,250-word Ship 30 essay on Shreyas Doshi's LNO Framework"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onOpenArtifact={onOpenArtifact}
              />
            ))
          )}

          {/* Live Status Stream Indicator - only shown before assistant starts printing tokens */}
          {currentStatus && (!messages.length || messages[messages.length - 1]?.role !== "assistant" || !messages[messages.length - 1]?.content) && (
            <div className="py-3 px-8 bg-brand-sand/60 flex items-center gap-2.5 text-xs text-brand-teal font-semibold animate-pulse border-b border-obsidian-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{currentStatus}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-obsidian-900 border-t border-obsidian-600 shrink-0">
          <div className="max-w-4xl mx-auto">
            {/* Active Skill Indicator (only visible when /ship is in prompt) */}
            {isShipActive && (
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Ship Essay Skill Active — Auto-generating ~1,250-word essay in Artifacts</span>
                  <button
                    type="button"
                    onClick={() => setInput(input.replace(/^\/ship(30)?\s*/i, ""))}
                    className="ml-1 p-0.5 hover:bg-amber-200 rounded text-amber-800 hover:text-amber-950 transition-colors"
                    title="Remove /ship command"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              {/* Slash Command Autocomplete Popover (only visible when typing "/") */}
              {showSlashMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-80 max-w-[calc(100vw-2rem)] bg-obsidian-850 border border-obsidian-600 rounded-xl shadow-xl overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-3 py-1.5 bg-obsidian-800/90 border-b border-obsidian-600/60 text-[10px] font-bold text-obsidian-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Command Suggestions</span>
                    <span className="font-mono text-[9px] lowercase text-obsidian-400">press tab or click</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInput("/ship ");
                      textareaRef.current?.focus();
                    }}
                    className="w-full px-3 py-2.5 flex items-start gap-2.5 hover:bg-amber-500/10 text-left transition-colors group cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 shrink-0 mt-0.5">
                      <PenTool className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-amber-900 group-hover:text-amber-950">/ship</span>
                        <span className="text-[10px] text-obsidian-400">&lt;topic&gt;</span>
                      </div>
                      <p className="text-[11px] text-obsidian-400 group-hover:text-obsidian-200 mt-0.5">
                        Generate ~1,250-word editorial essay in Ship 30 for 30 style
                      </p>
                    </div>
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isShipActive
                    ? "Enter topic (e.g. /ship Brian Chesky on Founder Mode) - Enter to send..."
                    : "Ask any product or growth question, or type / for skills (Enter to send)..."
                }
                rows={2}
                className="w-full bg-obsidian-800 border border-obsidian-600 rounded-xl px-4 py-3 text-sm text-obsidian-100 placeholder-obsidian-400 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal resize-none pr-14 shadow-sm"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopStream}
                    className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 transition-colors shadow-sm"
                    title="Stop generating"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2 rounded-lg bg-brand-teal hover:bg-brand-skyDark text-white font-bold disabled:opacity-30 transition-all shadow-md"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-obsidian-500 font-medium">
                Verified against Lenny's Podcast archives • Claude-style side-by-side artifacts • Private local processing
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
