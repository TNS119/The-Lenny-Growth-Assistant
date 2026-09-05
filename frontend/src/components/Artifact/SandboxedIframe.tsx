// frontend/src/components/Artifact/SandboxedIframe.tsx
import React, { useMemo } from "react";
import DOMPurify from "dompurify";
import { ShieldCheck } from "lucide-react";

interface SandboxedIframeProps {
  content: string;
  title: string;
}

export const SandboxedIframe: React.FC<SandboxedIframeProps> = ({ content, title }) => {
  // Sanitize markup prior to mounting in iframe srcDoc
  const cleanHtml = useMemo(() => {
    if (typeof window === "undefined") return content;
    return DOMPurify.sanitize(content, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ["style", "link", "script"],
      ADD_ATTR: ["target", "id", "class", "style", "onclick", "type", "value", "rows", "cols", "placeholder"],
    });
  }, [content]);

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-lg overflow-hidden border border-obsidian-700 shadow-xl">
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 tracking-wide truncate max-w-[70%]">
          {title}
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sandboxed Container</span>
        </div>
      </div>
      <iframe
        title={title}
        srcDoc={cleanHtml}
        // Strict security isolation: allow scripts to run for interactivity,
        // but strictly omit allow-same-origin to prevent access to parent cookies, local storage, and DOM.
        sandbox="allow-scripts"
        className="w-full flex-1 border-none bg-white"
      />
    </div>
  );
};
