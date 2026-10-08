import { afterEach, describe, expect, it, vi } from "vitest";
import { completeChat, isProvider, readCompletionStream } from "./provider";

function chunks(text: string, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  } });
}
afterEach(() => vi.unstubAllGlobals());
describe("completion streaming", () => {
  it("preserves UTF-8 and CRLF split across arbitrary network chunks", async () => {
    let reply = "";
    const source = ': heartbeat\r\n\r\ndata: {"choices":[{"delta":{"content":"héllo 🌱"}}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n';
    await readCompletionStream(chunks(source), (text) => { reply += text; });
    expect(reply).toBe("héllo 🌱");
  });
  it("handles a final event without a trailing newline", async () => {
    const received = vi.fn();
    await readCompletionStream(chunks('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}'), received);
    expect(received).toHaveBeenCalledWith("ok");
  });
  it("reports a disconnected stream instead of presenting a partial reply as complete", async () => {
    await expect(readCompletionStream(chunks('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), vi.fn())).rejects.toThrow("before the answer finished");
  });
  it("reports malformed provider events", async () => {
    await expect(readCompletionStream(chunks("data: {broken}\n\n"), vi.fn())).rejects.toThrow("invalid stream");
    await expect(readCompletionStream(chunks("data: null\n\n"), vi.fn())).rejects.toThrow("invalid stream");
  });
  it("keeps the partial answer but reports provider output limits", async () => {
    const onText = vi.fn();
    await expect(readCompletionStream(chunks('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\n'), onText)).rejects.toThrow("output limit");
    expect(onText).toHaveBeenCalledWith("partial");
  });
  it("rejects empty streams and upstream error events", async () => {
    await expect(readCompletionStream(chunks("data: [DONE]\n\n"), vi.fn())).rejects.toThrow("no text");
    await expect(readCompletionStream(chunks('data: {"error":{"message":"private detail"}}\n\n'), vi.fn())).rejects.toThrow("provider stopped");
  });
  it("stops a stalled read when cancelled", async () => {
    const aborter = new AbortController();
    const cancel = vi.fn();
    const pending = readCompletionStream(new ReadableStream({ cancel }), vi.fn(), aborter.signal);
    aborter.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
  });
});
describe("provider requests", () => {
  it("rejects prototype properties as providers", () => { expect(isProvider("constructor")).toBe(false); expect(isProvider("__proto__")).toBe(false); });
  it("sends keys only to the selected provider and excludes empty replies", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(chunks('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n')));
    vi.stubGlobal("fetch", fetch);
    await completeChat({ provider: "openrouter", model: "test-model", key: "test-key", systemPrompt: "Be concise" }, [
      { id: "1", role: "user", content: "Hello" }, { id: "2", role: "assistant", content: "" },
    ], new AbortController().signal, vi.fn());
    expect(fetch.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    const options = fetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.credentials).toBe("omit");
    expect(JSON.parse(options.body).messages).toEqual([{ role: "system", content: "Be concise" }, { role: "user", content: "Hello" }]);
  });
  it("does not request anything without a cloud provider key", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(completeChat({ provider: "openai", model: "test", key: "", systemPrompt: "" }, [], new AbortController().signal, vi.fn())).rejects.toThrow("Add your provider key");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("gives a useful error for exhausted provider credits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private upstream details", { status: 429 })));
    await expect(completeChat({ provider: "google", model: "test", key: "test", systemPrompt: "" }, [], new AbortController().signal, vi.fn())).rejects.toThrow("credit limit");
  });
});
