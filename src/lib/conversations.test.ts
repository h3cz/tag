import { describe, expect, it, vi } from "vitest";
import { parseConversations, readConversations } from "./conversations";

const thread = { id: "thread", title: "A thought", updatedAt: 1, messages: [{ id: "message", role: "user", content: "Hello" }] };
describe("conversation backups", () => {
  it("round-trips allowed fields and drops credentials or unexpected fields", () => {
    const backup = [{ ...thread, key: "secret", messages: [{ ...thread.messages[0], apiKey: "secret" }] }];
    expect(parseConversations(JSON.stringify(backup))).toEqual([thread]);
  });
  it("rejects invalid message roles and duplicate conversation IDs", () => {
    expect(() => parseConversations(JSON.stringify([{ ...thread, messages: [{ id: "m", role: "system", content: "bad" }] }]))).toThrow("Invalid message");
    expect(() => parseConversations(JSON.stringify([thread, thread]))).toThrow("duplicate");
  });
  it("rejects duplicate message IDs and oversized histories", () => {
    expect(() => parseConversations(JSON.stringify([{ ...thread, messages: [thread.messages[0], thread.messages[0]] }]))).toThrow("Invalid message");
    expect(() => parseConversations(" ".repeat(4_000_001))).toThrow("too large");
  });
  it("recovers to an actionable warning when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("blocked"); } });
    expect(readConversations()).toEqual({ conversations: [], warning: expect.stringContaining("couldn't be opened") });
    vi.unstubAllGlobals();
  });
});
