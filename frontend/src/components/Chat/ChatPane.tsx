// frontend/src/components/Chat/ChatPane.tsx
import React, { useState, useRef, useEffect } from "react";
import { Message, Artifact } from "@/lib/api";
import { MessageItem } from "@/components/Chat/MessageItem";
import { ModelSelector, ProviderType } from "@/components/Chat/ModelSelector";
import { 
  Send, 
  Square, 
  PenTool, 
  Compass, 
  Sparkles,
  X
} from "lucide-react";

interface ChatPaneProps {
  messages: Message[];
  isStreaming: boolean;
  currentStatus: string | null;
  currentProvider: ProviderType;
  onSelectProvider: (provider: ProviderType) => void;
  onSendMessage: (text: string, mode: "default" | "ship" | "ship30") => void;
  onStopStream: () => void;
  onOpenArtifact: (artifact: Artifact) => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  isStreaming,
  currentStatus,
  currentProvider,
  onSelectProvider,
  onSendMessage,
  onStopStream,
  onOpenArtifact,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef<boolean>(true);

  const isShipActive = input.trim().toLowerCase().startsWith("/ship");
  const showSlashMenu = input.startsWith("/") && !input.startsWith("/ship");

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // If user is within 100px of bottom, keep auto-scroll enabled; otherwise user scrolled up
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrollEnabled.current = isNearBottom;
  };

  useEffect(() => {
    if (isAutoScrollEnabled.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentStatus]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = input.trim();
    if (!textToSend || isStreaming) return;
    const isShip = textToSend.toLowerCase().startsWith("/ship");
    // Initially scroll to bottom when a new query is submitted
    isAutoScrollEnabled.current = true;
    onSendMessage(textToSend, isShip ? "ship" : "default");
    setInput("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);
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
      handleSubmit();
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-obsidian-950 h-full overflow-hidden">
      {/* Message Thread with smart scroll detection */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto divide-y divide-obsidian-600/40"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-obsidian-800 border border-obsidian-600 flex items-center justify-center text-brand-teal mb-4 shadow-sm">
              <Compass className="w-6 h-6" />
            </div>
            <div className="flex items-baseline justify-center gap-1.5 mb-1">
              <h2 className="text-base font-black tracking-wider text-obsidian-100 uppercase">
                LENNY
              </h2>
              <span className="text-xs font-semibold text-brand-teal">
                Growth-Assistant
              </span>
            </div>
            <p className="text-xs text-obsidian-400 leading-relaxed mb-6">
              Battle-tested product and growth advice from the world's top founders, operators, and PMs, curated from Lenny's Podcast archives.
            </p>
            <div className="w-full space-y-2 text-left">
              <button
                onClick={() => {
                  isAutoScrollEnabled.current = true;
                  onSendMessage("What is Kunal Shah's Delta 4 framework for products?", "default");
                }}
                className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-brand-teal text-xs text-obsidian-300 hover:text-obsidian-100 transition-all shadow-sm group"
              >
                <span className="text-brand-teal mr-1.5 font-bold">💡</span> "What is Kunal Shah's Delta 4 framework for products?"
              </button>
              <button
                onClick={() => {
                  isAutoScrollEnabled.current = true;
                  onSendMessage("What is Shreyas Doshi's advice on managing time?", "default");
                }}
                className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-brand-teal text-xs text-obsidian-300 hover:text-obsidian-100 transition-all shadow-sm group"
              >
                <span className="text-brand-teal mr-1.5 font-bold">💡</span> "What is Shreyas Doshi's advice on managing time?"
              </button>
              <button
                onClick={() => {
                  isAutoScrollEnabled.current = true;
                  onSendMessage("/ship Elena Verna's B2B growth loops and viral product motion", "ship");
                }}
                className="w-full p-2.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-600 hover:border-amber-400 text-xs text-amber-900/90 hover:text-amber-950 transition-all shadow-sm group font-medium"
              >
                <span className="text-amber-700 mr-1.5 font-bold">✍️ [/ship Skill]</span> "Write a 1,250-word Ship 30 essay on Elena Verna's B2B growth loops"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                onOpenArtifact={onOpenArtifact}
                currentStatus={isLast && isStreaming ? currentStatus : null}
                isStreaming={isLast && isStreaming}
              />
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar with Embedded Model Selector */}
      <div className="p-4 pt-2 pb-5 bg-obsidian-950 shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Active Skill Indicator */}
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
            {/* Slash Command Autocomplete Popover */}
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

            {/* Integrated Input Container with elevated shadow and seamless chat background */}
            <div className="bg-obsidian-800 border border-obsidian-600 rounded-2xl p-3 shadow-md shadow-black/5 hover:shadow-lg focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/20 transition-all">
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
                className="w-full bg-transparent px-2.5 py-1.5 text-sm text-obsidian-100 placeholder-obsidian-400 focus:outline-none resize-none"
              />

              {/* Bottom Action Bar Inside Input Box */}
              <div className="flex items-center justify-between pt-2 px-1 border-t border-obsidian-700/60 mt-1">
                {/* Left: Embedded Minimal LLM Switcher (DropUp) */}
                <div className="flex items-center gap-2">
                  <ModelSelector
                    currentProvider={currentProvider}
                    onSelectProvider={onSelectProvider}
                    disabled={isStreaming}
                  />
                  <span className="text-[10px] text-obsidian-400 hidden sm:inline">
                    Type <kbd className="px-1 py-0.5 rounded bg-obsidian-700 text-obsidian-300 font-mono text-[9px]">/</kbd> for skills
                  </span>
                </div>

                {/* Right: Stop / Send Controls */}
                <div className="flex items-center gap-1.5">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={onStopStream}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold border border-red-300 transition-colors shadow-xs"
                      title="Stop generating"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmit();
                      }}
                      disabled={!input.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-teal hover:bg-brand-skyDark text-white text-xs font-bold disabled:opacity-30 transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
                      title="Send message"
                    >
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
         
        </div>
      </div>
    </main>
  );
};
