// frontend/src/components/Chat/MessageItem.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, Artifact } from "@/lib/api";
import { User, Sparkles, BookOpen, ExternalLink, ChevronDown, ChevronUp, Layers } from "lucide-react";

interface MessageItemProps {
  message: Message;
  onOpenArtifact?: (artifact: Artifact) => void;
}

function cleanDisplayContent(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/<artifact\s+type=["'][^"']*["']\s+title=["'][^"']*["']\s*>/gi, "");
  cleaned = cleaned.replace(/<artifact[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/artifact>/gi, "");
  return cleaned.trim();
}

function extractInlineArtifact(content: string): { type: string; title: string; content: string } | null {
  if (!content) return null;
  const match = content.match(/<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/i);
  if (match) {
    return {
      type: match[1].toLowerCase(),
      title: match[2].trim(),
      content: match[3].trim()
    };
  }
  const openMatch = content.match(/<artifact\s+type=["'](html|markdown)["']\s+title=["']([^"']+)["']\s*>/i);
  if (openMatch) {
    const afterTag = content.slice(openMatch.index! + openMatch[0].length);
    return {
      type: openMatch[1].toLowerCase(),
      title: openMatch[2].trim(),
      content: afterTag.replace(/<\/artifact>/gi, "").trim()
    };
  }
  return null;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onOpenArtifact }) => {
  const isUser = message.role === "user";
  const [showSources, setShowSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  const displayContent = cleanDisplayContent(message.content);
  const inlineArt = extractInlineArtifact(message.content);

  return (
    <div className={`py-5 px-4 sm:px-6 flex gap-4 ${isUser ? "bg-obsidian-900/40" : "bg-obsidian-950"} border-b border-obsidian-600/50`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-medium text-xs shadow-sm ${
          isUser
            ? "bg-obsidian-700 text-obsidian-200 border border-obsidian-600"
            : "bg-brand-sand text-brand-teal border border-brand-teal/30 font-bold"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Content Body */}
      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-obsidian-100">
            {isUser ? "You" : "Lenny Growth Assistant"}
          </span>
          <span className="text-[10px] text-obsidian-500 font-mono">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Message Text */}
        <div className="text-sm leading-relaxed text-obsidian-200 break-words space-y-2">
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
        </div>

        {/* Artifact Generated Pill Button */}
        {((message.artifacts && message.artifacts.length > 0) || inlineArt) && onOpenArtifact && (
          <div className="pt-2 flex flex-wrap gap-2">
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

        {/* Source Citations Accordion */}
        {message.sources && message.sources.length > 0 && (
          <div className="pt-2 border-t border-obsidian-600">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs text-obsidian-400 hover:text-obsidian-100 font-semibold transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-teal" />
              <span>{message.sources.length} Verified Podcast Moments</span>
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
