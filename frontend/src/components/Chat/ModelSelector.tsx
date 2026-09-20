import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronUp,
  Settings,
  Check,
  X,
  Key,
  Lock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2
} from "lucide-react";
import { getApiBase } from "@/lib/api";

export type ProviderType = "ollama" | "claude" | "openai" | "groq" | "gemini";

interface ModelSelectorProps {
  currentProvider: ProviderType;
  onSelectProvider: (provider: ProviderType) => void;
  disabled?: boolean;
}

interface ProviderMeta {
  id: ProviderType;
  name: string;
  shortName: string;
  engine: string;
  isLocalOrFree: boolean;
  typeLabel: "Local (Free)" | "Free Tier" | "Paid" | "Cloud API";
  keyName: string;
  docsUrl: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "ollama",
    name: "Llama 3.2 3B",
    shortName: "Llama 3.2 3B",
    engine: "Local Ollama",
    isLocalOrFree: true,
    typeLabel: "Local (Free)",
    keyName: "",
    docsUrl: "https://ollama.com",
  },
  {
    id: "groq",
    name: "Groq Qwen 3.8 27B",
    shortName: "Qwen 27B",
    engine: "Groq Cloud API",
    isLocalOrFree: false,
    typeLabel: "Free Tier",
    keyName: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini 2.0 Flash",
    shortName: "Gemini 2.0",
    engine: "Google AI Studio",
    isLocalOrFree: false,
    typeLabel: "Free Tier",
    keyName: "GEMINI_API_KEY",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "claude",
    name: "Claude 3.5 Sonnet",
    shortName: "Claude 3.5",
    engine: "Anthropic API",
    isLocalOrFree: false,
    typeLabel: "Paid",
    keyName: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "ChatGPT-4o",
    shortName: "GPT-4o",
    engine: "OpenAI API",
    isLocalOrFree: false,
    typeLabel: "Paid",
    keyName: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentProvider,
  onSelectProvider,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConfigModel, setActiveConfigModel] = useState<ProviderMeta | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User entered API key in modal
  const [inputApiKey, setInputApiKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Locally stored custom API keys
  const [customKeys, setCustomKeys] = useState<Record<string, string>>({});
  const [maskedServerKeys, setMaskedServerKeys] = useState<Record<string, string | null>>({});

  // Status mapping: providerId -> boolean (true = configured in server .env / online)
  const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({
    ollama: true,
    groq: false,
    gemini: false,
    claude: false,
    openai: false,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeMeta = PROVIDERS.find((p) => p.id === currentProvider) || PROVIDERS[0];

  // Load custom keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("lenny_custom_api_keys");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setCustomKeys(parsed);
          }
        }
      } catch (e) {
        console.warn("Could not load custom API keys from localStorage:", e);
      }
    }
  }, []);

  // Fetch live server provider status (.env variables & connection state)
  const checkStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${getApiBase()}/api/providers/status`);
      if (res.ok) {
        const data = await res.json();
        const newStatus: Record<string, boolean> = {
          ollama: !!data.ollama?.connected,
          groq: !!data.groq?.has_env_key || !!data.groq?.connected,
          gemini: !!data.gemini?.has_env_key || !!data.gemini?.connected,
          claude: !!data.claude?.has_env_key || !!data.claude?.connected,
          openai: !!data.openai?.has_env_key || !!data.openai?.connected,
        };
        const masked: Record<string, string | null> = {
          groq: data.groq?.masked_key || null,
          gemini: data.gemini?.masked_key || null,
          claude: data.claude?.masked_key || null,
          openai: data.openai?.masked_key || null,
        };
        setProviderStatus(newStatus);
        setMaskedServerKeys(masked);
      }
    } catch {
      setProviderStatus({ ollama: true, groq: false, gemini: false, claude: false, openai: false });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveConfigModel(null);
      }
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

  const handleOpenConfig = (e: React.MouseEvent, provider: ProviderMeta) => {
    e.stopPropagation();
    setActiveConfigModel(provider);
    setInputApiKey(customKeys[provider.id] || "");
    setVerifyFeedback(null);
    checkStatus();
  };

  const handleSaveAndVerifyKey = async (forceSave = false) => {
    if (!activeConfigModel) return;
    const providerId = activeConfigModel.id;
    const trimmedKey = inputApiKey.trim();

    if (!trimmedKey) {
      setVerifyFeedback({ type: "error", message: "Please enter a valid API key." });
      return;
    }

    setIsVerifying(true);
    setVerifyFeedback(null);

    try {
      // 1. Verify key against endpoint
      if (!forceSave) {
        const verifyRes = await fetch(`${getApiBase()}/api/providers/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: providerId, api_key: trimmedKey }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setIsVerifying(false);
          setVerifyFeedback({
            type: "error",
            message: verifyData.message || "Verification failed. Check the key or click 'Save Anyway'.",
          });
          return;
        }
      }

      // 2. Persist to server runtime & .env
      const saveRes = await fetch(`${getApiBase()}/api/providers/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, api_key: trimmedKey }),
      });
      const saveData = await saveRes.json();

      // 3. Persist to browser localStorage
      const updated = { ...customKeys, [providerId]: trimmedKey };
      setCustomKeys(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("lenny_custom_api_keys", JSON.stringify(updated));
      }

      setVerifyFeedback({
        type: "success",
        message: saveData.message || "API key verified and saved successfully!",
      });

      await checkStatus();
    } catch (err: any) {
      setVerifyFeedback({
        type: "error",
        message: `Error connecting to backend: ${err.message || "Network error"}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!activeConfigModel) return;
    const providerId = activeConfigModel.id;
    setIsVerifying(true);
    try {
      await fetch(`${getApiBase()}/api/providers/key/${providerId}`, { method: "DELETE" });
      const updated = { ...customKeys };
      delete updated[providerId];
      setCustomKeys(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("lenny_custom_api_keys", JSON.stringify(updated));
      }
      setInputApiKey("");
      setVerifyFeedback({ type: "success", message: "API key removed." });
      await checkStatus();
    } catch (err: any) {
      setVerifyFeedback({ type: "error", message: `Error removing key: ${err.message}` });
    } finally {
      setIsVerifying(false);
    }
  };

  const isConfigured = (pId: string) => {
    return !!providerStatus[pId] || !!customKeys[pId];
  };

  const isCurrentActiveConfigured = isConfigured(activeMeta.id);

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* 1. Full Model Name Trigger in the Input Box */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs ${isOpen
            ? "bg-obsidian-750 border-brand-teal text-obsidian-100 ring-1 ring-brand-teal/30"
            : "bg-obsidian-800 border-obsidian-600 hover:border-obsidian-500 text-obsidian-200 hover:text-obsidian-100 hover:bg-obsidian-750"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Selected Model: ${activeMeta.name} (${isCurrentActiveConfigured ? "Ready" : "Key Required"})`}
      >
        {/* Live Status Indicator */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isCurrentActiveConfigured
              ? "bg-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-amber-500 ring-2 ring-amber-500/20"
            }`}
          title={isCurrentActiveConfigured ? "Configured & Ready" : "Missing key / Fallback"}
        />

        {/* Full Model Name */}
        <span className="font-semibold text-obsidian-100 whitespace-nowrap">
          {activeMeta.name}
        </span>

        {/* Status Badge */}
        {activeMeta.id === "ollama" ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            Local
          </span>
        ) : isCurrentActiveConfigured ? (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            Ready
          </span>
        ) : (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            Key Required
          </span>
        )}

        <ChevronUp
          className={`w-3.5 h-3.5 text-obsidian-400 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180 text-brand-teal" : ""
            }`}
        />
      </button>

      {/* 2. DropUp Menu */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-88 max-w-[calc(100vw-2rem)] bg-obsidian-850 border border-obsidian-600 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3.5 py-2 bg-obsidian-800/90 border-b border-obsidian-600/60 flex items-center justify-between">
            <span className="text-[10px] font-bold text-obsidian-500 uppercase tracking-wider">
              Reasoning Engine
            </span>
            <span className="text-[10px] text-obsidian-400 font-mono">
              Live Configuration
            </span>
          </div>

          <div className="p-1.5 space-y-1 max-h-72 overflow-y-auto">
            {PROVIDERS.map((provider) => {
              const isSelected = provider.id === currentProvider;
              const configured = isConfigured(provider.id);

              return (
                <div
                  key={provider.id}
                  onClick={() => {
                    onSelectProvider(provider.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer group ${isSelected
                      ? "bg-brand-sand/70 border border-brand-teal/40"
                      : "hover:bg-obsidian-700/40 border border-transparent"
                    }`}
                >
                  {/* Left: Status Dot + Full Model Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${configured
                          ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-amber-500 ring-2 ring-amber-500/20"
                        }`}
                      title={configured ? "Configured & Ready" : "Requires API key"}
                    />

                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-obsidian-100 truncate">
                          {provider.name}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-obsidian-400 block truncate">
                        {provider.engine}
                      </span>
                    </div>
                  </div>

                  {/* Right: Explicit Free/Local Confirmation OR Config Button */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {provider.isLocalOrFree ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {provider.typeLabel}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {provider.typeLabel.includes("Free") && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 hidden sm:inline">
                            Free
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleOpenConfig(e, provider)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${configured
                              ? "bg-obsidian-800 hover:bg-obsidian-700 text-brand-teal border-brand-teal/40 hover:border-brand-teal"
                              : "bg-obsidian-800 hover:bg-obsidian-700 text-amber-500 border-amber-500/40 hover:border-amber-500"
                            } shadow-xs`}
                          title={`Configure ${provider.name} API Key`}
                        >
                          <Settings className="w-3 h-3" />
                          <span>{configured ? "Edit Key" : "Add Key"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Interactive API Key Configuration Modal */}
      {activeConfigModel && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setActiveConfigModel(null)}
        >
          <div
            className="w-full max-w-md bg-obsidian-850 border border-obsidian-600 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-obsidian-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-sand text-brand-teal border border-brand-teal/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-obsidian-100">
                    {activeConfigModel.name}
                  </h3>
                  <span className="text-[10px] text-obsidian-400">
                    API Key Configuration & Management
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveConfigModel(null)}
                className="p-1 rounded-lg text-obsidian-400 hover:text-obsidian-100 hover:bg-obsidian-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 text-xs">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isConfigured(activeConfigModel.id)
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                  }`}
              >
                <div className="flex items-center gap-2">
                  {isConfigured(activeConfigModel.id) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold block">
                      {isConfigured(activeConfigModel.id)
                        ? "Configured & Ready"
                        : "API Key Required"}
                    </span>
                    {maskedServerKeys[activeConfigModel.id] && (
                      <span className="text-[10px] text-emerald-700 font-mono block">
                        Server Key: {maskedServerKeys[activeConfigModel.id]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={checkStatus}
                  className="p-1 hover:bg-black/10 rounded transition-colors shrink-0"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Interactive Input Form */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-obsidian-200 uppercase tracking-wide flex items-center justify-between">
                  <span>Enter / Edit API Key</span>
                  <a
                    href={activeConfigModel.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-teal hover:underline text-[11px] font-medium lowercase flex items-center gap-1"
                  >
                    <span>Get API key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>

                <div className="relative flex items-center">
                  <input
                    type="password"
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder={`Paste ${activeConfigModel.keyName} here...`}
                    className="w-full bg-obsidian-900 border border-obsidian-700 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/50 rounded-xl px-3 py-2.5 text-xs font-mono text-obsidian-100 placeholder:text-obsidian-500 outline-hidden transition-colors"
                  />
                </div>
                <span className="text-[10px] text-obsidian-400 block">
                  Keys are stored in your server configuration and browser session.
                </span>
              </div>

              {/* Feedback Message */}
              {verifyFeedback && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${verifyFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-900 border-amber-300"
                    }`}
                >
                  {verifyFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="leading-snug">{verifyFeedback.message}</p>
                    {verifyFeedback.type === "error" && (
                      <button
                        type="button"
                        onClick={() => handleSaveAndVerifyKey(true)}
                        className="mt-1.5 text-[11px] font-bold text-amber-800 underline hover:text-amber-950 block"
                      >
                        Save Anyway (Bypass Test)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-obsidian-700/80">
              {isConfigured(activeConfigModel.id) ? (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  disabled={isVerifying}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Key</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveConfigModel(null)}
                  className="px-3 py-1.5 rounded-lg bg-obsidian-750 hover:bg-obsidian-700 text-obsidian-300 hover:text-obsidian-100 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAndVerifyKey(false)}
                  disabled={isVerifying || !inputApiKey.trim()}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-teal hover:bg-brand-skyDark text-white text-xs font-bold transition-all shadow-sm ${isVerifying || !inputApiKey.trim() ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify & Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

