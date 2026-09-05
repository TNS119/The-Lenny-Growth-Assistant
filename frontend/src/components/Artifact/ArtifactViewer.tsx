// frontend/src/components/Artifact/ArtifactViewer.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Artifact } from "@/lib/api";
import { SandboxedIframe } from "@/components/Artifact/SandboxedIframe";
import { 
  X, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  Eye, 
  Code as CodeIcon,
  Download,
  FileText,
  Sparkles
} from "lucide-react";

interface ArtifactViewerProps {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  artifact,
  isOpen,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  if (!artifact) {
    return (
      <aside
        className={`h-full bg-obsidian-900 border-l border-obsidian-700 flex flex-col overflow-hidden ${
          isFullscreen ? "fixed inset-0 z-50 w-full" : "w-full relative"
        }`}
        aria-label="Artifact Viewer Workspace"
      >
        <div className="h-14 px-4 bg-obsidian-800 border-b border-obsidian-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-brand-teal/10 text-brand-teal">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-obsidian-100">
              Artifact Workspace
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors"
            title="Close workspace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-obsidian-800 border border-obsidian-600 flex items-center justify-center text-brand-teal mb-4 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-obsidian-100 mb-1">
            Side-by-Side Artifacts
          </h3>
          <p className="text-xs text-obsidian-400 leading-relaxed mb-4">
            When you generate a Ship 30 essay, strategic teardown, or growth calculator, it will render here side-by-side in this adjustable workspace.
          </p>
          <div className="p-3 bg-obsidian-800 rounded-xl border border-obsidian-600 text-left text-xs text-obsidian-300 space-y-2 w-full">
            <div className="font-semibold text-obsidian-100 text-[11px] uppercase tracking-wide">
              Quick Tip
            </div>
            <p className="text-[11px] text-obsidian-400 leading-relaxed">
              Type <code className="px-1.5 py-0.5 rounded bg-obsidian-700 text-brand-teal font-mono font-bold">/ship30 &lt;topic&gt;</code> in the prompt bar to generate a ~1,250-word grounded essay that automatically appears here.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = artifact.artifact_type === "html" ? "html" : "md";
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${artifact.title.replace(/\s+/g, "_").toLowerCase()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      className={`h-full bg-obsidian-900 border-l border-obsidian-700 flex flex-col overflow-hidden shadow-sm ${
        isFullscreen ? "fixed inset-0 z-50 w-full" : "w-full relative"
      }`}
      aria-label="Artifact Viewer Workspace"
    >
      {/* Top Header Toolbar */}
      <div className="h-14 px-4 bg-obsidian-800 border-b border-obsidian-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1.5 rounded-md bg-brand-sky/10 text-brand-sky">
            {artifact.artifact_type === "html" ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-obsidian-50 truncate">
              {artifact.title}
            </span>
            <span className="text-[10px] text-obsidian-400 capitalize">
              {artifact.artifact_type} Artifact • Claude-Style Sandboxed
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* View Toggle */}
          <div className="flex bg-obsidian-900 rounded-lg p-0.5 border border-obsidian-700 text-xs mr-2">
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === "preview"
                  ? "bg-obsidian-700 text-obsidian-50 font-medium"
                  : "text-obsidian-400 hover:text-obsidian-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === "code"
                  ? "bg-obsidian-700 text-obsidian-50 font-medium"
                  : "text-obsidian-400 hover:text-obsidian-200"
              }`}
            >
              <CodeIcon className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors"
            title="Copy content"
            aria-label="Copy artifact content"
          >
            {copied ? (
              <Check className="w-4 h-4 text-brand-emerald" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors"
            title="Download file"
            aria-label="Download artifact"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors hidden sm:block"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors ml-1"
            title="Close workspace"
            aria-label="Close artifact drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-obsidian-950">
        {viewMode === "preview" ? (
          artifact.artifact_type === "html" ? (
            <div className="h-full min-h-[500px]">
              <SandboxedIframe content={artifact.content} title={artifact.title} />
            </div>
          ) : (
            <div className="max-w-none p-6 sm:p-8 bg-obsidian-800 rounded-xl border border-obsidian-600 font-sans leading-relaxed text-obsidian-100 shadow-sm space-y-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-bold text-obsidian-50 pb-2 border-b border-obsidian-700 mt-2 mb-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-obsidian-100 mt-5 mb-2 pb-1 border-b border-obsidian-700/60" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-obsidian-200 mt-4 mb-2" {...props} />,
                  p: ({ node, ...props }) => <p className="text-sm leading-relaxed text-obsidian-200 my-2.5" {...props} />,
                  ul: ({ node, ...props }) => <ul className="space-y-2 my-3 pl-4 list-disc marker:text-brand-teal" {...props} />,
                  ol: ({ node, ...props }) => <ol className="space-y-2 my-3 pl-4 list-decimal marker:text-brand-teal" {...props} />,
                  li: ({ node, ...props }) => <li className="text-sm text-obsidian-200 leading-relaxed" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-bold text-obsidian-100" {...props} />,
                  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-brand-teal pl-4 py-2 my-3 bg-obsidian-700/20 rounded-r text-obsidian-300 italic text-sm" {...props} />,
                  code: ({ node, ...props }) => <code className="bg-obsidian-700/40 text-brand-skyDark px-1.5 py-0.5 rounded font-mono text-xs border border-obsidian-600" {...props} />,
                }}
              >
                {artifact.content}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <pre className="p-4 bg-obsidian-800 border border-obsidian-600 rounded-xl font-mono text-xs text-obsidian-200 overflow-x-auto whitespace-pre-wrap shadow-inner">
            <code>{artifact.content}</code>
          </pre>
        )}
      </div>
    </aside>
  );
};
