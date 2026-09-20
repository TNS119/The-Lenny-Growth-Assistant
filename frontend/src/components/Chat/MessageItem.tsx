// frontend/src/components/Chat/MessageItem.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, Artifact } from "@/lib/api";
import { User, Sparkles, BookOpen, ExternalLink, ChevronDown, ChevronUp, Layers, Loader2, Copy, Check } from "lucide-react";

interface MessageItemProps {
  message: Message;
  onOpenArtifact?: (artifact: Artifact) => void;
  currentStatus?: string | null;
  isStreaming?: boolean;
}

function cleanDisplayContent(raw: string): string {
  if (!raw) return "";
  let cleaned = raw;
  // 1. Remove complete artifact blocks including inner content
  cleaned = cleaned.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact[\s\S]*?<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "");
  // 2. Remove relaxed unbracketed artifact blocks
  cleaned = cleaned.replace(/(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\s\S]*?(?:<\/artifact\s*>|$)/gi, "");
  // 3. Remove unclosed partial artifact tags and trailing body
  const openIdx = cleaned.search(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\b/i);
  if (openIdx !== -1) {
    cleaned = cleaned.slice(0, openIdx);
  }
  // 4. Remove residual tags
  cleaned = cleaned.replace(/<artifact[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/artifact\s*>/gi, "");
  // 5. Strip any dangling artifact lead-in headers left behind at the end
  cleaned = cleaned.replace(/(?:\n+|^)\s*(?:\*{0,3}|#{1,6}\s*)?Artifact(?:\s+created)?(?::|\*{0,2})?\s*$/i, "");
  cleaned = cleaned.replace(/\*{1,3}Artifact:?\*{0,3}\s*$/i, "");
  cleaned = cleaned.replace(/Artifact:\s*$/i, "");
  return cleaned.trim();
}

function extractInlineArtifact(content: string): { type: string; title: string; content: string } | null {
  if (!content) return null;
  let art: { type: string; title: string; content: string } | null = null;
  // 1. Closed standard & bolded artifact
  const match = content.match(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>(?:\*{0,3}|`{0,3}|\])?([\s\S]*?)(?:\*{0,3}|`{0,3}|\[)?\s*<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/i);
  if (match) {
    art = {
      type: match[1].toLowerCase(),
      title: match[2].trim(),
      content: cleanDisplayContent(match[3]).trim()
    };
  } else {
    // 2. Relaxed unbracketed artifact e.g. ** artifact type="markdown" title="..."**
    const relMatch = content.match(/(?:\*{1,3}|`{1,3})\s*artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*(?:\*{1,3}|`{1,3})([\s\S]*)/i);
    if (relMatch) {
      art = {
        type: relMatch[1].toLowerCase(),
        title: relMatch[2].trim(),
        content: cleanDisplayContent(relMatch[3]).trim()
      };
    } else {
      // 3. Open partial standard artifact
      const openMatch = content.match(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>(?:\*{0,3}|`{0,3}|\])?/i);
      if (openMatch) {
        const afterTag = content.slice(openMatch.index! + openMatch[0].length);
        art = {
          type: openMatch[1].toLowerCase(),
          title: openMatch[2].trim(),
          content: afterTag.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "").trim()
        };
      }
    }
  }

  // Quality filter: only treat as inline artifact if HTML, or substantial markdown (> 180 chars)
  if (art && art.type === "markdown" && art.content.length < 180) {
    return null;
  }
  return art;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  onOpenArtifact, 
  currentStatus, 
  isStreaming 
}) => {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleSource = (idx: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const displayContent = cleanDisplayContent(message.content);
  const inlineArt = extractInlineArtifact(message.content);
  const isShipPrompt = isUser && message.content.trim().toLowerCase().startsWith("/ship");
  const hasArtifacts = (message.artifacts && message.artifacts.length > 0) || !!inlineArt;

  let finalAssistantContent = displayContent;
  if (!isUser) {
    if (hasArtifacts && (!finalAssistantContent || finalAssistantContent.toLowerCase().startsWith("i have created the"))) {
      finalAssistantContent = "Artifact is created.";
    }
  }

  return (
    <div className={`group py-5 px-4 sm:px-6 flex gap-4 ${isUser ? "bg-obsidian-900/50" : "bg-obsidian-950"} border-b border-obsidian-600/50 transition-colors`}>
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
          <div className="relative bg-obsidian-850 border border-obsidian-600/80 rounded-2xl p-3.5 sm:p-4 shadow-sm text-obsidian-100 text-sm sm:text-[14.5px] leading-relaxed">
            {isShipPrompt && (
              <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-mono font-bold">
                <span>✍️ Ship 30 Essay</span>
              </div>
            )}
            <p className="text-obsidian-100 font-medium whitespace-pre-wrap pr-6">
              {message.content}
            </p>
            {/* Copy button — icon only, appears on row hover */}
            <button
              type="button"
              onClick={handleCopy}
              className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700/50"
              title="Copy"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-brand-teal" />
                : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-obsidian-200 break-words space-y-2">
            {finalAssistantContent ? (
              <>
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
                    blockquote: ({ node, children, ...props }) => {
                      const textString = String((node?.children?.[0] as any)?.children?.[0]?.value || "");
                      const isWarning = 
                        textString.includes("⚠️") || 
                        textString.includes("Notice") || 
                        textString.includes("Limit") || 
                        textString.includes("Error") ||
                        displayContent.includes("Rate Limit Reached") ||
                        displayContent.includes("API Error") ||
                        displayContent.includes("Authentication Error");
                      return (
                        <blockquote
                          className={`border-l-3 pl-3.5 py-2 my-2.5 rounded-r text-xs leading-relaxed ${
                            isWarning
                              ? "border-amber-500/90 bg-amber-500/10 text-obsidian-200"
                              : "border-brand-teal bg-obsidian-700/20 text-obsidian-300 italic"
                          }`}
                          {...props}
                        >
                          {children}
                        </blockquote>
                      );
                    },
                    code: ({ node, ...props }) => (
                      <code className="bg-obsidian-700/40 text-brand-skyDark px-1.5 py-0.5 rounded font-mono text-xs border border-obsidian-600/50" {...props} />
                    ),
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
                {/* Copy icon — icon only, appears on row hover, right-aligned below text */}
                {!isStreaming && (
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700/50"
                      title="Copy response"
                    >
                      {copied
                        ? <Check className="w-3.5 h-3.5 text-brand-teal" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </>
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
         !displayContent.toLowerCase().includes("api error") &&
         !displayContent.toLowerCase().includes("api notice") &&
         !displayContent.toLowerCase().includes("rate limit") &&
         !displayContent.toLowerCase().includes("authentication error") &&
         !displayContent.toLowerCase().includes("error connecting") &&
         !displayContent.toLowerCase().includes("error: ") &&
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
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
                {message.sources.map((src, idx) => {
                  const isExpanded = expandedSources.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSource(idx)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 ${
                        isExpanded
                          ? "bg-obsidian-800 border-brand-teal text-obsidian-100 shadow-md ring-1 ring-brand-teal/20"
                          : "bg-obsidian-850 border-obsidian-600 hover:border-brand-teal/60 text-obsidian-300 shadow-xs hover:bg-obsidian-800"
                      }`}
                    >
                      <div className="font-bold truncate text-[11.5px] text-brand-teal mb-1">
                        <span className="truncate">{src.guest}</span>
                      </div>
                      <p className="text-[11px] text-obsidian-300 font-medium line-clamp-1">{src.episode}</p>

                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-obsidian-600/30 text-[10px] text-obsidian-500 font-mono">
                        <span className="flex items-center gap-1">▶ {src.timestamp}</span>
                        <span className="text-brand-teal font-sans text-[10.5px] font-semibold flex items-center gap-0.5">
                          {isExpanded ? "Hide full excerpt ▲" : "View full excerpt ▼"}
                        </span>
                      </div>

                      {/* Excerpt Content - always renders a 2-line preview or full quote so no card looks plain */}
                      {src.text && (
                        <div className={`mt-2 pt-2 border-t border-obsidian-600/40 text-[11px] leading-relaxed text-obsidian-300 italic whitespace-pre-wrap ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}>
                          "{src.text}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
