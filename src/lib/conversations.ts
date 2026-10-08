import type { ChatMessage } from "./provider";

export interface Conversation { id: string; title: string; updatedAt: number; messages: ChatMessage[] }
export const HISTORY_KEY = "tag_local_conversations_v1";
export const MAX_HISTORY_BYTES = 4_000_000;

export function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New conversation", updatedAt: Date.now(), messages: [] };
}

export function parseConversations(text: string): Conversation[] {
  if (new Blob([text]).size > MAX_HISTORY_BYTES) throw new Error("This backup is too large. Keep it under 4 MB.");
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("Expected a Tag backup with up to 100 conversations.");
  const ids = new Set<string>();
  return parsed.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid conversation in backup.");
    const thread = item as Record<string, unknown>;
    if (typeof thread.id !== "string" || !thread.id || ids.has(thread.id) || typeof thread.title !== "string" ||
      typeof thread.updatedAt !== "number" || !Number.isFinite(thread.updatedAt) || !Array.isArray(thread.messages) || thread.messages.length > 500) throw new Error("Invalid or duplicate conversation in backup.");
    ids.add(thread.id);
    const messageIds = new Set<string>();
    const messages = thread.messages.map((item: unknown): ChatMessage => {
      if (!item || typeof item !== "object") throw new Error("Invalid message in backup.");
      const message = item as Record<string, unknown>;
      if (typeof message.id !== "string" || !message.id || messageIds.has(message.id) ||
        (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") throw new Error("Invalid message in backup.");
      messageIds.add(message.id);
      return { id: message.id, role: message.role, content: message.content,
        ...(typeof message.model === "string" ? { model: message.model.slice(0, 200) } : {}),
      };
    });
    // Reconstruct allowed fields so backups never carry keys/config into storage.
    return { id: thread.id, title: thread.title.slice(0, 120), updatedAt: thread.updatedAt, messages };
  });
}

export function readConversations(): { conversations: Conversation[]; warning: string } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return { conversations: raw ? parseConversations(raw) : [], warning: "" };
  } catch { return { conversations: [], warning: "Saved history couldn't be opened. Saving is paused to preserve it. Restore a backup or choose Start fresh to replace it." }; }
}

export function writeConversations(conversations: Conversation[]): void {
  const serialized = JSON.stringify(conversations);
  if (new Blob([serialized]).size > MAX_HISTORY_BYTES) throw new Error("History is full. Export a backup and delete older conversations to keep saving.");
  localStorage.setItem(HISTORY_KEY, serialized);
}

export function downloadFile(name: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
