// frontend/src/components/Chat/MessageItem.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, Artifact } from "@/lib/api";
import { User, Sparkles, BookOpen, ExternalLink, ChevronDown, ChevronUp, Layers, Loader2 } from "lucide-react";

interface MessageItemProps {
  message: Message;
  onOpenArtifact?: (artifact: Artifact) => void;
  currentStatus?: string | null;
  isStreaming?: boolean;
}

function cleanDisplayContent(raw: string): string {
  if (!raw) return "";
  let cleaned = raw;
  // 1. Remove bracketed / bolded / backticked artifact open tags
  cleaned = cleaned.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=["'][^"']*["']\s+title=["'][^"']*["']\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "");
  // 2. Remove relaxed unbracketed artifact tags e.g. ** artifact type="markdown" title="..."**
  cleaned = cleaned.replace(/(?:\*{1,3}|`{1,3})\s*artifact\s+type=["'][^"']*["']\s+title=["'][^"']*["']\s*(?:\*{1,3}|`{1,3})/gi, "");
  // 3. Remove raw artifact tags
  cleaned = cleaned.replace(/<artifact[^>]*>/gi, "");
  // 4. Remove closing tags
  cleaned = cleaned.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "");
  // 5. Clean up any trailing broken asterisks or tags
  cleaned = cleaned.replace(/\*\*\s*artifact\b[^*]*\*\*/gi, "");
  return cleaned.trim();
}

function extractInlineArtifact(content: string): { type: string; title: string; content: string } | null {
  if (!content) return null;
  // 1. Closed standard & bolded artifact
  const match = content.match(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>(?:\*{0,3}|`{0,3}|\])?([\s\S]*?)(?:\*{0,3}|`{0,3}|\[)?\s*<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/i);
  if (match) {
    return {
      type: match[1].toLowerCase(),
      title: match[2].trim(),
      content: cleanDisplayContent(match[3]).trim()
    };
  }
  // 2. Relaxed unbracketed artifact e.g. ** artifact type="markdown" title="..."**
  const relMatch = content.match(/(?:\*{1,3}|`{1,3})\s*artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*(?:\*{1,3}|`{1,3})([\s\S]*)/i);
  if (relMatch) {
    return {
      type: relMatch[1].toLowerCase(),
      title: relMatch[2].trim(),
      content: cleanDisplayContent(relMatch[3]).trim()
    };
  }
  // 3. Open partial standard artifact
  const openMatch = content.match(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>(?:\*{0,3}|`{0,3}|\])?/i);
  if (openMatch) {
    const afterTag = content.slice(openMatch.index! + openMatch[0].length);
    return {
      type: openMatch[1].toLowerCase(),
      title: openMatch[2].trim(),
      content: afterTag.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "").trim()
    };
  }
  return null;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  onOpenArtifact, 
  currentStatus, 
  isStreaming 
}) => {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  const displayContent = cleanDisplayContent(message.content);
  const inlineArt = extractInlineArtifact(message.content);
  const isShipPrompt = isUser && message.content.trim().toLowerCase().startsWith("/ship");

  return (
    <div className={`py-5 px-4 sm:px-6 flex gap-4 ${isUser ? "bg-obsidian-900/50" : "bg-obsidian-950"} border-b border-obsidian-600/50 transition-colors`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-medium text-xs shadow-sm ${
          isUser
            ? "bg-brand-teal/15 text-brand-teal border border-brand-teal/30 ring-2 ring-brand-teal/10"
            : "bg-brand-sand text-brand-teal border border-brand-teal/30 font-bold shadow-xs"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Content Body */}
      <div className="flex-1 space-y-2.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-obsidian-100 flex items-center gap-1.5">
            {isUser ? "You" : "Lenny Growth Assistant"}
            {isShipPrompt && (
              <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                /ship skill
              </span>
            )}
          </span>
          <span className="text-[10px] text-obsidian-500 font-mono">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Message Text / Prompt Bubble */}
        {isUser ? (
          <div className="bg-obsidian-850 border border-obsidian-600/80 rounded-2xl p-3.5 sm:p-4 shadow-sm text-obsidian-100 text-sm sm:text-[14.5px] leading-relaxed">
            {isShipPrompt ? (
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-mono font-bold">
                  <span>✍️ Ship 30 Essay Prompt</span>
                </div>
                <p className="text-obsidian-100 font-medium whitespace-pre-wrap">
                  {message.content.replace(/^\/ship(30)?\s*/i, "")}
                </p>
              </div>
            ) : (
              <p className="text-obsidian-100 font-medium whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-obsidian-200 break-words space-y-2">
            {displayContent ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-base sm:text-lg font-bold text-obsidian-100 mt-4 mb-2 pb-1.5 border-b border-obsidian-600/30" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-sm sm:text-base font-bold text-obsidian-100 mt-3.5 mb-1.5" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-xs sm:text-sm font-bold text-obsidian-100 mt-2.5 mb-1" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="text-xs sm:text-sm text-obsidian-200 leading-relaxed my-2" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="space-y-1.5 my-2.5 pl-4 list-disc marker:text-brand-teal" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="space-y-1.5 my-2.5 pl-4 list-decimal marker:text-brand-teal" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="text-xs sm:text-sm text-obsidian-200 leading-relaxed" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-bold text-obsidian-100" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-3 border-brand-teal pl-3.5 py-1.5 my-2.5 bg-obsidian-700/20 rounded-r text-obsidian-300 italic text-xs" {...props} />
                  ),
                  code: ({ node, ...props }) => (
                    <code className="bg-obsidian-700/40 text-brand-skyDark px-1.5 py-0.5 rounded font-mono text-xs border border-obsidian-600/50" {...props} />
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            ) : (currentStatus || isStreaming) ? (
              <div className="flex items-center gap-2.5 py-1 text-xs text-brand-teal font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-teal shrink-0" />
                <span>{currentStatus || "Thinking..."}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Artifact Generated Pill Button - shown when completed */}
        {((message.artifacts && message.artifacts.length > 0) || inlineArt) && onOpenArtifact && !isStreaming && (
          <div className="pt-2 flex flex-wrap gap-2 animate-in fade-in duration-150">
            {message.artifacts && message.artifacts.length > 0 ? (
              message.artifacts.map((art) => (
                <button
                  key={art.id}
                  onClick={() => onOpenArtifact(art)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-brand-teal/50 text-brand-teal text-xs font-bold transition-all shadow-sm group hover:border-brand-teal"
                >
                  <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Open Artifact: <strong>{art.title}</strong></span>
                </button>
              ))
            ) : inlineArt ? (
              <button
                onClick={() => onOpenArtifact({
                  id: String(Date.now()),
                  message_id: message.id,
                  artifact_type: inlineArt.type as any,
                  title: inlineArt.title,
                  content: inlineArt.content,
                  created_at: new Date().toISOString()
                })}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-brand-teal/50 text-brand-teal text-xs font-bold transition-all shadow-sm group hover:border-brand-teal"
              >
                <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Open Artifact: <strong>{inlineArt.title}</strong></span>
              </button>
            ) : null}
          </div>
        )}

        {/* Source Citations Accordion - ONLY rendered after full response is printed and when not a refusal */}
        {!isStreaming && 
         displayContent.length > 0 && 
         !displayContent.toLowerCase().includes("i do not have sufficient information in lenny's podcast archive") &&
         message.sources && 
         message.sources.length > 0 && (
          <div className="pt-2 border-t border-obsidian-600 animate-in fade-in duration-200">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs text-obsidian-400 hover:text-obsidian-100 font-semibold transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-teal" />
              <span>{message.sources.length} Verified Podcast {message.sources.length === 1 ? "Moment" : "Moments"}</span>
              {showSources ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showSources && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.sources.map((src, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedSource(selectedSource === src ? null : src)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedSource === src
                        ? "bg-obsidian-800 border-brand-teal text-obsidian-100 shadow-md ring-1 ring-brand-teal/20"
                        : "bg-obsidian-850 border-obsidian-600 hover:border-brand-teal/60 text-obsidian-300 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold truncate text-[11px] text-brand-teal mb-1">
                      <span className="truncate">{src.guest}</span>
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold shrink-0 ml-2">
                        {Math.round((src.score || 0.9) * 100)}% match
                      </span>
                    </div>
                    <p className="text-[11px] text-obsidian-200 font-medium line-clamp-1">{src.episode}</p>
                    <span className="text-[10px] text-obsidian-500 block mt-0.5 font-mono">▶ {src.timestamp}</span>

                    {/* Excerpt Dropdown */}
                    {selectedSource === src && (
                      <div className="mt-2 pt-2 border-t border-obsidian-600 text-[11px] text-obsidian-300 italic whitespace-pre-wrap leading-relaxed">
                        "{src.text}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
