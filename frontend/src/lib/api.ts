// frontend/src/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export async function fetchSessions(): Promise<Session[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch sessions:", err);
    return [];
  }
}

export async function createSession(title?: string): Promise<Session | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "New Conversation" }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to create session:", err);
    return null;
  }
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch session detail:", err);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to delete session:", err);
    return false;
  }
}

export async function fetchHealth(): Promise<HealthStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch health probe:", err);
    return null;
  }
}
