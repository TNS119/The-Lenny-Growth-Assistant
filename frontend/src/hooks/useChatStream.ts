// frontend/src/hooks/useChatStream.ts
import { useState, useCallback, useRef } from "react";
import { Message, Artifact } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseChatStreamProps {
  sessionId: string;
  onStreamFinish?: () => void;
}

function cleanArtifactTags(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<artifact\s+type=["'][^"']*["']\s+title=["'][^"']*["']\s*>/gi, "");
  cleaned = cleaned.replace(/<artifact[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/artifact>/gi, "");
  // Filter partial tag while streaming
  const partialTagIdx = cleaned.lastIndexOf("<artifact");
  if (partialTagIdx !== -1 && cleaned.indexOf(">", partialTagIdx) === -1) {
    cleaned = cleaned.slice(0, partialTagIdx);
  }
  const partialCloseIdx = cleaned.lastIndexOf("</artifact");
  if (partialCloseIdx !== -1 && cleaned.indexOf(">", partialCloseIdx) === -1) {
    cleaned = cleaned.slice(0, partialCloseIdx);
  }
  return cleaned.trimStart();
}

export function useChatStream({ sessionId, onStreamFinish }: UseChatStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const openArtifact = useCallback((artifact: Artifact) => {
    setActiveArtifact(artifact);
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
      onTokenUpdate: (accumulatedText: string, sources: any[]) => void
    ) => {
      if (!sessionId || !messageText.trim()) return;

      setIsStreaming(true);
      setCurrentStatus("Contacting assistant...");
      setCurrentSources([]);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-LLM-Provider": provider,
          },
          body: JSON.stringify({
            session_id: sessionId,
            message: messageText,
            mode: mode,
            provider: provider,
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
                onTokenUpdate(accumulatedContent, sourcesList);
              } else if (event.type === "token") {
                // Instantly dismiss searching/thinking indicator once tokens begin printing
                setCurrentStatus(null);
                accumulatedContent += event.content;
                const displayContent = cleanArtifactTags(accumulatedContent);
                onTokenUpdate(displayContent, sourcesList);
              } else if (event.type === "artifact") {
                const artData = event.data;
                const newArtifact: Artifact = {
                  id: String(Date.now()),
                  message_id: String(Date.now()),
                  artifact_type: artData.artifact_type,
                  title: artData.title,
                  content: artData.content,
                  created_at: new Date().toISOString(),
                };
                setActiveArtifact(newArtifact);
                setIsDrawerOpen(true); // Auto-open Claude-style drawer
              }
            } catch (err) {
              console.warn("Error parsing SSE JSON chunk:", err, payloadStr);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Stream connection error:", err);
          onTokenUpdate(`\n[Connection Error: ${err.message}]`, []);
        }
      } finally {
        setIsStreaming(false);
        setCurrentStatus(null);
        if (onStreamFinish) onStreamFinish();
      }
    },
    [sessionId, onStreamFinish]
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
    isDrawerOpen,
    openArtifact,
    closeArtifact,
    toggleDrawer,
    sendMessage,
    stopStream,
  };
}
