export const PROVIDERS = {
  openrouter: { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini", keysUrl: "https://openrouter.ai/keys" },
  openai: { name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", keysUrl: "https://platform.openai.com/api-keys" },
  google: { name: "Google AI", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash", keysUrl: "https://aistudio.google.com/apikey" },
  synthetic: { name: "Synthetic", endpoint: "https://api.synthetic.new/v1/chat/completions", model: "hf:openai/gpt-oss-120b", keysUrl: "https://synthetic.new" },
  ollama: { name: "Ollama (local)", endpoint: "http://localhost:11434/v1/chat/completions", model: "llama3.2", keysUrl: "https://docs.ollama.com" },
} as const;

export type Provider = keyof typeof PROVIDERS;
export interface Connection { provider: Provider; model: string; key: string; systemPrompt: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; model?: string }

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}

function providerError(status: number): string {
  if (status === 401 || status === 403) return "The provider rejected your key. Check it in Connection settings and try again.";
  if (status === 429) return "The provider's rate or credit limit was reached. Check your balance or wait before retrying.";
  if (status === 404 || status === 400) return "The provider could not use this request. Check the model ID and its support for chat completions.";
  return `The provider returned HTTP ${status}. Try again in a moment.`;
}

// A stream can split in the middle of UTF-8, JSON, or a CRLF pair. Keep both
// decoders incremental, and parse only complete SSE events.
export async function readCompletionStream(
  stream: ReadableStream<Uint8Array>, onText: (text: string) => void, signal?: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = false;
  let finished = false;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  function event(raw: string) {
    const data = raw.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") { if (data === "[DONE]") finished = true; return; }
    let parsed: { error?: unknown; choices?: Array<{ delta?: { content?: unknown }; finish_reason?: string | null }> };
    try { parsed = JSON.parse(data); } catch { throw new Error("The provider sent an invalid stream. Your conversation is saved; you can retry."); }
    if (!parsed || typeof parsed !== "object") throw new Error("The provider sent an invalid stream. Your conversation is saved; you can retry.");
    if (parsed.error) throw new Error("The provider stopped with an error. Check your model and credits, then retry.");
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason === "content_filter") throw new Error("The provider declined this request. Try rephrasing your message.");
    const text = choice?.delta?.content;
    if (typeof text === "string" && text) { received = true; onText(text); }
    if (choice?.finish_reason === "length") throw new Error("The answer reached the provider's output limit. Ask it to continue from the partial answer.");
    if (choice?.finish_reason) finished = true;
  }
  try {
    if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    while (true) {
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const raw = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        event(raw);
      }
      if (buffer.length > 1_000_000) throw new Error("The provider sent an oversized stream event.");
      if (done || finished) break;
    }
    if (buffer.trim() && !finished) event(buffer);
    if (!received) throw new Error("The provider returned no text. Choose a model that supports text chat and try again.");
    if (!finished) throw new Error("The connection ended before the answer finished. The partial answer is saved; you can retry.");
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function completeChat(
  connection: Connection, messages: ChatMessage[], signal: AbortSignal, onText: (text: string) => void,
): Promise<void> {
  if (!isProvider(connection.provider)) throw new Error("Choose a supported provider.");
  if (!connection.model.trim()) throw new Error("Enter a model ID in Connection settings.");
  if (connection.provider !== "ollama" && !connection.key.trim()) throw new Error("Add your provider key in Connection settings first.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (connection.key.trim()) headers.Authorization = `Bearer ${connection.key.trim()}`;
  if (connection.provider === "openrouter") headers["X-Title"] = "Tag";
  let response: Response;
  try {
    response = await fetch(PROVIDERS[connection.provider].endpoint, {
      method: "POST", headers, signal, credentials: "omit",
      body: JSON.stringify({ model: connection.model.trim(), stream: true,
        messages: [...(connection.systemPrompt.trim() ? [{ role: "system", content: connection.systemPrompt.trim() }] : []),
          ...messages.filter((message) => message.content.trim()).map(({ role, content }) => ({ role, content }))],
      }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Couldn't reach the provider. Check your connection and browser CORS support. For Ollama, allow this app's origin with OLLAMA_ORIGINS.");
  }
  if (!response.ok) throw new Error(providerError(response.status));
  if (!response.body) throw new Error("The provider returned an empty response.");
  await readCompletionStream(response.body, onText, signal);
}
