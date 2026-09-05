// frontend/src/components/Chat/ModelSelector.tsx
import React, { useState, useRef, useEffect } from "react";
import { Cpu, Cloud, Sparkles, ChevronDown, Check, Zap } from "lucide-react";

export type ProviderType = "ollama" | "claude" | "openai" | "groq" | "gemini";

interface ModelSelectorProps {
  currentProvider: ProviderType;
  onSelectProvider: (provider: ProviderType) => void;
  disabled?: boolean;
}

interface ProviderOption {
  id: ProviderType;
  name: string;
  engine: string;
  badge: string;
  badgeClass: string;
  isFree: boolean;
  description: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "ollama",
    name: "Local AI",
    engine: "llama3.2:3b",
    badge: "Private • Free",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    isFree: true,
    description: "Runs locally on your computer with complete privacy and zero API costs",
  },
  {
    id: "groq",
    name: "Groq Lightning",
    engine: "Llama 3.3 70B",
    badge: "Ultra Fast",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
    isFree: true,
    description: "Sub-second cloud inference for lightning-fast product answers",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    engine: "Gemini 2.0 Flash",
    badge: "Cloud • Free",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
    isFree: true,
    description: "Google's fast multimodal model with extensive context window",
  },
  {
    id: "claude",
    name: "Claude 3.5 Sonnet",
    engine: "Anthropic API",
    badge: "Deep Reasoning",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    isFree: false,
    description: "Advanced strategic analysis & nuanced editorial essay writing",
  },
  {
    id: "openai",
    name: "ChatGPT-4o",
    engine: "OpenAI API",
    badge: "Flagship",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    isFree: false,
    description: "Industry-standard omni reasoning (requires OpenAI API key)",
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentProvider,
  onSelectProvider,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = PROVIDERS.find((p) => p.id === currentProvider) || PROVIDERS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (provider: ProviderType) => {
    onSelectProvider(provider);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 bg-obsidian-800 border rounded-lg px-2.5 sm:px-3 py-1.5 shadow-sm text-left transition-all ${
          isOpen
            ? "border-brand-teal ring-1 ring-brand-teal/40 bg-obsidian-700/50"
            : "border-obsidian-600 hover:border-obsidian-500 hover:bg-obsidian-700/30"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select AI Model"
      >
        {active.id === "ollama" ? (
          <Cpu className="w-4 h-4 text-emerald-700 shrink-0" />
        ) : active.id === "groq" ? (
          <Zap className="w-4 h-4 text-teal-700 shrink-0" />
        ) : (
          <Cloud className="w-4 h-4 text-brand-teal shrink-0" />
        )}

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold text-obsidian-100 whitespace-nowrap">
            {active.name}
          </span>
          <span className="text-[10px] text-obsidian-400 font-mono hidden md:inline truncate">
            ({active.engine})
          </span>
        </div>

        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${active.badgeClass} hidden xl:inline-flex items-center shrink-0 whitespace-nowrap`}
        >
          {active.badge}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-obsidian-500 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-brand-teal" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-obsidian-850 border border-obsidian-600 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-2 bg-obsidian-800/90 border-b border-obsidian-600/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-obsidian-500 uppercase tracking-wider">
              Select Reasoning Engine
            </span>
            <span className="text-[10px] text-brand-teal font-medium">
              Multi-LLM Switcher
            </span>
          </div>

          <div className="p-1.5 space-y-1 max-h-80 overflow-y-auto">
            {PROVIDERS.map((provider) => {
              const isSelected = provider.id === currentProvider;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelect(provider.id)}
                  className={`w-full p-2.5 rounded-lg flex items-start justify-between gap-2.5 text-left transition-colors group cursor-pointer ${
                    isSelected
                      ? "bg-brand-sand/70 border border-brand-teal/40"
                      : "hover:bg-obsidian-700/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                        provider.id === "ollama"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : provider.id === "groq"
                          ? "bg-teal-100 text-teal-800 border border-teal-300"
                          : "bg-obsidian-700 text-brand-teal border border-obsidian-600"
                      }`}
                    >
                      {provider.id === "ollama" ? (
                        <Cpu className="w-3.5 h-3.5" />
                      ) : provider.id === "groq" ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-obsidian-100">
                          {provider.name}
                        </span>
                        <span className="text-[10px] text-obsidian-400 font-mono">
                          {provider.engine}
                        </span>
                      </div>
                      <p className="text-[11px] text-obsidian-400 group-hover:text-obsidian-300 mt-0.5 leading-relaxed">
                        {provider.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${provider.badgeClass} whitespace-nowrap`}
                    >
                      {provider.badge}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-brand-teal mt-0.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
