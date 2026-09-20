// frontend/src/lib/api.ts

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  message_id: string;
  artifact_type: "markdown" | "html";
  title: string;
  content: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Array<{
    episode: string;
    guest: string;
    timestamp: string;
    text: string;
    score: number;
  }>;
  created_at: string;
  artifacts?: Artifact[];
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface HealthStatus {
  status: string;
  database: string;
  pgvector_chunks_indexed: number;
  ollama_connected: boolean;
  active_model: string;
  timestamp: string;
}

/**
 * Normalizes and returns the target API base URL for both local and live deployments.
 * Prevents trailing slashes, resolves relative proxies on live URLs, and supports runtime overrides.
 */
export function getApiBase(): string {
  // 1. Runtime override stored in localStorage if custom backend URL configured
  if (typeof window !== "undefined") {
    try {
      const customUrl = localStorage.getItem("lenny_backend_url");
      if (customUrl && customUrl.trim()) {
        return customUrl.trim().replace(/\/+$/, "");
      }
    } catch {}
  }

  // 2. Build-time / environment variable (strip any trailing slashes)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 3. Browser environment fallback:
  if (typeof window !== "undefined") {
    // If running on localhost or 127.0.0.1, use default local backend port
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // In production live deployment, use relative path "" to leverage Next.js rewrite proxying
    // and avoid mixed content or CORS preflight failures
    return "";
  }

  return "http://localhost:8000";
}

export async function fetchSessions(): Promise<Session[]> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch sessions from backend:", err);
    return [];
  }
}

export async function createSession(title?: string, explicitId?: string): Promise<Session | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "New Conversation",
        ...(explicitId ? { id: explicitId } : {}),
      }),
    });
    if (!res.ok) {
      console.warn(`Backend session creation returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Backend session creation request failed (using optimistic session):", err);
    return null;
  }
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Failed to fetch session detail for ${sessionId}:`, err);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to delete session ${sessionId}:`, err);
    return false;
  }
}

export async function fetchHealth(): Promise<HealthStatus | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Failed to fetch health probe:", err);
    return null;
  }
}
