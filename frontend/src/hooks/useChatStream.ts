// frontend/src/hooks/useChatStream.ts
import { useState, useCallback, useRef } from "react";
import { Message, Artifact, getApiBase } from "@/lib/api";

interface UseChatStreamProps {
  sessionId: string;
  onStreamFinish?: (finishedSessionId: string) => void;
  onArtifactGenerated?: (artifact: Artifact, artSessionId: string) => void;
}

function cleanArtifactTags(text: string): string {
  if (!text) return "";
  // 1. Remove complete artifact blocks including inner content
  let cleaned = text.replace(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact[\s\S]*?<\/artifact\s*>(?:\*{0,3}|`{0,3}|\])?/gi, "");
  // 2. Remove relaxed unbracketed artifact tag blocks
  cleaned = cleaned.replace(/(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\s\S]*?(?:<\/artifact\s*>|$)/gi, "");
  // 3. Remove in-progress unclosed artifact block so partial artifact body does not leak into chat
  const openTagIdx = cleaned.search(/(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\b/i);
  if (openTagIdx !== -1) {
    cleaned = cleaned.slice(0, openTagIdx);
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

function cleanArtifactContent(content: string): string {
  if (!content) return "";
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^<artifact\s+type=['"][^'"]*['"]\s+title=['"][^'"]*['"]\s*>/i, "");
  cleaned = cleaned.replace(/^<artifact[^>]*>/i, "");
  cleaned = cleaned.replace(/<\/artifact>\s*$/i, "");
  cleaned = cleaned.replace(/<\/artifact>/gi, "");
  cleaned = cleaned.replace(/^\s*={3,}\s*\n/g, "");
  cleaned = cleaned.replace(/^\s*-{3,}\s*\n/g, "");
  return cleaned.trim();
}

export function useChatStream({ sessionId, onStreamFinish, onArtifactGenerated }: UseChatStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactSessionId, setArtifactSessionId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const openArtifact = useCallback((artifact: Artifact, forSessionId?: string) => {
    setActiveArtifact(artifact);
    if (forSessionId) setArtifactSessionId(forSessionId);
    setIsDrawerOpen(true);
  }, []);

  const closeArtifact = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const sendMessage = useCallback(
    async (
      messageText: string,
      mode: "default" | "ship" | "ship30",
      provider: "ollama" | "claude" | "openai" | "groq" | "gemini",
      onTokenUpdate: (streamSessionId: string, accumulatedText: string, sources: any[]) => void,
      explicitSessionId?: string
    ) => {
      const targetSessionId = explicitSessionId || sessionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`);
      if (!messageText.trim()) return;

      setIsStreaming(true);
      setCurrentStatus("Contacting assistant...");
      setCurrentSources([]);

      abortControllerRef.current = new AbortController();

      // Retrieve any client-side custom API key for this provider
      let customKey: string | undefined = undefined;
      if (typeof window !== "undefined") {
        try {
          const rawKeys = localStorage.getItem("lenny_custom_api_keys");
          if (rawKeys) {
            const parsed = JSON.parse(rawKeys);
            if (parsed && parsed[provider]) {
              customKey = parsed[provider];
            }
          }
        } catch {}
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-LLM-Provider": provider,
      };
      if (customKey) {
        headers["X-API-Key"] = customKey;
      }

      try {
        const base = getApiBase();
        const response = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            session_id: targetSessionId,
            message: messageText,
            mode: mode,
            provider: provider,
            ...(customKey ? { api_key: customKey } : {}),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let accumulatedContent = "";
        let sourcesList: any[] = [];
        let buffer = "";

        // Throttled high-performance stream rendering
        let lastFlushTime = 0;
        let pendingFlushTimeout: any = null;

        const flushUpdate = (immediate = false) => {
          if (pendingFlushTimeout) {
            clearTimeout(pendingFlushTimeout);
            pendingFlushTimeout = null;
          }
          const now = Date.now();
          if (immediate || now - lastFlushTime >= 24) {
            lastFlushTime = now;
            const displayContent = cleanArtifactTags(accumulatedContent);
            onTokenUpdate(targetSessionId, displayContent, sourcesList);
          } else {
            pendingFlushTimeout = setTimeout(() => {
              pendingFlushTimeout = null;
              lastFlushTime = Date.now();
              const displayContent = cleanArtifactTags(accumulatedContent);
              onTokenUpdate(targetSessionId, displayContent, sourcesList);
            }, 24);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payloadStr = trimmed.slice(6);
            if (payloadStr === "[DONE]") {
              flushUpdate(true);
              setIsStreaming(false);
              setCurrentStatus(null);
              break;
            }

            try {
              const event = JSON.parse(payloadStr);

              if (event.type === "status") {
                setCurrentStatus(event.content);
              } else if (event.type === "sources") {
                sourcesList = event.data || [];
                setCurrentSources(sourcesList);
                flushUpdate(true);
              } else if (event.type === "token") {
                // Instantly dismiss searching/thinking indicator once tokens arrive
                setCurrentStatus(null);
                accumulatedContent += event.content;
                flushUpdate(false);
              } else if (event.type === "artifact") {
                const artData = event.data;
                const newArtifact: Artifact = {
                  id: String(Date.now()),
                  message_id: String(Date.now()),
                  artifact_type: artData.artifact_type,
                  title: artData.title,
                  content: cleanArtifactContent(artData.content),
                  created_at: new Date().toISOString(),
                };
                setActiveArtifact(newArtifact);
                setArtifactSessionId(targetSessionId);
                setIsDrawerOpen(true);
                if (onArtifactGenerated) {
                  onArtifactGenerated(newArtifact, targetSessionId);
                }
              }
            } catch (err) {
              console.warn("Error parsing SSE JSON chunk:", err, payloadStr);
            }
          }
        }
        flushUpdate(true);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Stream connection error:", err);
          onTokenUpdate(targetSessionId, `\n[Connection Error: ${err.message}]`, []);
        }
      } finally {
        setIsStreaming(false);
        setCurrentStatus(null);
        if (onStreamFinish) onStreamFinish(targetSessionId);
      }
    },
    [sessionId, onStreamFinish, onArtifactGenerated]
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentStatus(null);
  }, []);

  return {
    isStreaming,
    currentStatus,
    currentSources,
    activeArtifact,
    artifactSessionId,
    isDrawerOpen,
    openArtifact,
    closeArtifact,
    toggleDrawer,
    sendMessage,
    stopStream,
  };
}
