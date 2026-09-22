import type { Foreigner } from "@/lib/foreigners";

export type StoredChatMessage = {
  from: "them" | "me";
  text: string;
  swahili?: string;
  time: string;
};

export type StoredChatSession = {
  sessionId: string;
  foreignerId: string;
  messages: StoredChatMessage[];
  ended: boolean;
  updatedAt: string;
};

function storageKey(userId: string) {
  return `vela:chat-sessions:${userId}`;
}

function readAll(userId: string): StoredChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(userId: string, sessions: StoredChatSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
}

export function getChatSession(userId: string, foreignerId: string) {
  return readAll(userId).find((session) => session.foreignerId === foreignerId);
}

export function getChatSessions(userId: string) {
  return readAll(userId);
}

export function saveChatSession(userId: string, session: StoredChatSession) {
  const sessions = readAll(userId).filter((item) => item.foreignerId !== session.foreignerId);
  writeAll(userId, [...sessions, { ...session, updatedAt: new Date().toISOString() }]);
}

export function resetChatSession(userId: string, foreignerId: string) {
  writeAll(userId, readAll(userId).filter((session) => session.foreignerId !== foreignerId));
}

export function getChatStatus(userId: string, person: Foreigner): "new" | "continue" | "completed" {
  const session = getChatSession(userId, person.id);
  if (!session) return "new";
  return session.ended ? "completed" : "continue";
}
