import { useState } from "react";
import { Crown, Send, ChevronDown, Check, Key, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS } from "@/components/chat/ModelPicker";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/synthetic-public-proxy`;

// Default 3 models for compare: one anon-accessible, one free, one pro
const DEFAULT_COMPARE_MODELS = [
  "hf:openai/gpt-oss-120b",
  "hf:zai-org/GLM-4.7-Flash",
  "hf:moonshotai/Kimi-K2.6",
];

const DEFAULT_BYOK_COMPARE_MODELS = [
  "byok:openai:gpt-4o-mini",
  "byok:openrouter:openai/gpt-4o-mini",
  "byok:google:gemini-2.5-flash",
];

interface CompareModelOption {
  id: string;
  label: string;
  description: string;
  pricing?: string;
  tier: "anon" | "free" | "pro" | "byok";
  provider: "synthetic" | "byok";
  providerKey?: string;
  upstreamModel?: string;
}

const BYOK_COMPARE_MODELS: CompareModelOption[] = [
  {
    id: "byok:openai:gpt-4o-mini",
    label: "OpenAI GPT-4o mini",
    description: "Uses your OpenAI API key.",
    tier: "byok",
    provider: "byok",
    providerKey: "openai",
    upstreamModel: "gpt-4o-mini",
  },
  {
    id: "byok:openai:gpt-4o",
    label: "OpenAI GPT-4o",
    description: "Uses your OpenAI API key.",
    tier: "byok",
    provider: "byok",
    providerKey: "openai",
    upstreamModel: "gpt-4o",
  },
  {
    id: "byok:openrouter:openai/gpt-4o-mini",
    label: "OpenRouter GPT-4o mini",
    description: "Uses your OpenRouter key.",
    tier: "byok",
    provider: "byok",
    providerKey: "openrouter",
    upstreamModel: "openai/gpt-4o-mini",
  },
  {
    id: "byok:openrouter:anthropic/claude-3.5-sonnet",
    label: "OpenRouter Claude",
    description: "Claude via your OpenRouter key.",
    tier: "byok",
    provider: "byok",
    providerKey: "openrouter",
    upstreamModel: "anthropic/claude-3.5-sonnet",
  },
  {
    id: "byok:google:gemini-2.5-flash",
    label: "Google Gemini Flash",
    description: "Uses your Google AI key.",
    tier: "byok",
    provider: "byok",
    providerKey: "google",
    upstreamModel: "gemini-2.5-flash",
  },
  {
    id: "byok:google:gemini-2.5-pro",
    label: "Google Gemini Pro",
    description: "Uses your Google AI key.",
    tier: "byok",
    provider: "byok",
    providerKey: "google",
    upstreamModel: "gemini-2.5-pro",
  },
  {
    id: "byok:synthetic:hf:moonshotai/Kimi-K2.6",
    label: "Synthetic Kimi K2.6",
    description: "Uses your Synthetic.new key.",
    tier: "byok",
    provider: "byok",
    providerKey: "synthetic",
    upstreamModel: "hf:moonshotai/Kimi-K2.6",
  },
  {
    id: "byok:synthetic:hf:zai-org/GLM-5.1",
    label: "Synthetic GLM 5.1",
    description: "Uses your Synthetic.new key.",
    tier: "byok",
    provider: "byok",
    providerKey: "synthetic",
    upstreamModel: "hf:zai-org/GLM-5.1",
  },
  {
    id: "byok:ollama:llama3.1",
    label: "Ollama llama3.1",
    description: "Uses your local Ollama OpenAI-compatible endpoint.",
    tier: "byok",
    provider: "byok",
    providerKey: "ollama",
    upstreamModel: "llama3.1",
  },
];

function getAvailableCompareModels(byokKeys: Record<string, string> | undefined): CompareModelOption[] {
  const hostedModels: CompareModelOption[] = MODELS
    .filter((m) => m.modality !== "image")
    .map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      pricing: m.pricing,
      tier: m.tier === "byok" ? "byok" : m.tier,
      provider: m.provider,
    }));

  const byokModels = BYOK_COMPARE_MODELS.filter((m) => {
    if (!m.providerKey) return false;
    const value = byokKeys?.[m.providerKey];
    return typeof value === "string" && value.trim().length > 0;
  });

  return [...hostedModels, ...byokModels];
}

function getDefaultCompareModels(tier: "anon" | "free" | "pro", byokKeys: Record<string, string> | undefined): string[] {
  if (tier === "pro") return DEFAULT_COMPARE_MODELS;

  const byokDefaults = DEFAULT_BYOK_COMPARE_MODELS.filter((id) => {
    const model = BYOK_COMPARE_MODELS.find((m) => m.id === id);
    if (!model?.providerKey) return false;
    return Boolean(byokKeys?.[model.providerKey]);
  });

  if (byokDefaults.length > 0) return byokDefaults;
  return DEFAULT_COMPARE_MODELS;
}

function getSlotKey(slotIndex: number, modelId: string): string {
  return `${slotIndex}:${modelId}`;
}

interface ModelResponseState {
  text: string;
  loading: boolean;
  error: string | null;
}

interface Props {
  jwt: string | null;
  tier: "anon" | "free" | "pro";
  byokKeys: Record<string, string> | undefined;
  onUpgrade: () => void;
}

// Inline model chip selector for swapping a slot's model
function SlotModelChip({
  modelId,
  onSwap,
  tier,
  byokKeys,
  onUpgrade,
}: {
  modelId: string;
  onSwap: (newId: string) => void;
  tier: "anon" | "free" | "pro";
  byokKeys: Record<string, string> | undefined;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const availableModels = getAvailableCompareModels(byokKeys);
  const model = availableModels.find((m) => m.id === modelId) ?? availableModels[0] ?? MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
      >
        {model.label}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg">
            <div className="p-1.5 max-h-72 overflow-y-auto">
              {availableModels.map((m) => {
                const isSelected = m.id === modelId;
                const isByok = m.tier === "byok";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.tier === "pro" && tier !== "pro" && !byokKeys?.synthetic) {
                        setOpen(false);
                        onUpgrade();
                        return;
                      }
                      onSwap(m.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md transition-colors hover:bg-muted",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{m.label}</span>
                          {m.tier === "pro" && (
                            <span className="text-[9px] uppercase tracking-wider text-primary font-semibold">
                              Pro
                            </span>
                          )}
                          {isByok && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-semibold">
                              BYOK
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {m.description}
                        </p>
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                      {isByok && <Key className="h-3 w-3 text-emerald-600 shrink-0" />}
                      {m.tier === "pro" && !byokKeys?.synthetic && (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

async function fetchModelResponse(
  prompt: string,
  modelId: string,
  jwt: string | null,
  byokKeys: Record<string, string> | undefined
): Promise<string> {
  const byokModel = BYOK_COMPARE_MODELS.find((m) => m.id === modelId);
  if (byokModel) {
    return fetchBYOKModelResponse(prompt, byokModel, byokKeys);
  }

  // BYOK keys NEVER touch our server. If user has a synthetic key for an hf:
  // model, fetch direct to api.synthetic.new. Anything else routes through
  // the proxy WITHOUT the key — proxy uses its own SYNTHETIC_API_KEY (counted
  // against tier quota). This matches the Chat.tsx fetch wrapper pattern and
  // the product principle in the launch blog post.
  const syntheticKey = byokKeys?.["synthetic"];
  const useDirectBYOK = !!(modelId.startsWith("hf:") && syntheticKey);

  let res: Response;
  if (useDirectBYOK) {
    res = await fetch("https://api.synthetic.new/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${syntheticKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
  } else {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  }

  if (!res.ok) {
    let errMsg = "Request failed";
    try {
      const errData = await res.json();
      errMsg = errData?.error ?? errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function fetchBYOKModelResponse(
  prompt: string,
  model: CompareModelOption,
  byokKeys: Record<string, string> | undefined,
): Promise<string> {
  const provider = model.providerKey;
  const key = provider ? byokKeys?.[provider]?.trim() : "";
  if (!provider || !key) {
    throw new Error(`Add a ${provider ?? "provider"} key in BYOK settings first.`);
  }

  const upstreamModel = model.upstreamModel ?? model.id;
  let url = "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers.Authorization = `Bearer ${key}`;
  } else if (provider === "openrouter") {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers.Authorization = `Bearer ${key}`;
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Tag Compare";
  } else if (provider === "google") {
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    headers.Authorization = `Bearer ${key}`;
  } else if (provider === "synthetic") {
    url = "https://api.synthetic.new/v1/chat/completions";
    headers.Authorization = `Bearer ${key}`;
  } else if (provider === "ollama") {
    const base = key.replace(/\/+$/g, "");
    url = `${base}/v1/chat/completions`;
  } else {
    throw new Error(`${provider} compare is not wired yet.`);
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: upstreamModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    let errMsg = `${model.label} request failed`;
    try {
      const errData = await res.json();
      errMsg = errData?.error?.message ?? errData?.error ?? errData?.message ?? errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? data.message?.content ?? "";
}

export function CompareView({ jwt, tier, byokKeys, onUpgrade }: Props) {
  const hasBYOKCompare = BYOK_COMPARE_MODELS.some((m) => m.providerKey && Boolean(byokKeys?.[m.providerKey]));
  const [selectedModels, setSelectedModels] = useState<string[]>(() => getDefaultCompareModels(tier, byokKeys));
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponseState>>({});
  const [hasRun, setHasRun] = useState(false);

  // Pro gate, unless the user pays providers directly with BYOK.
  if (tier !== "pro" && !hasBYOKCompare) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="max-w-sm w-full rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Crown className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Pro Feature</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Compare up to 3 models side-by-side with a single prompt. Upgrade, or add BYOK keys in settings.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Crown className="h-4 w-4" />
            Upgrade for $7/mo
          </button>
        </div>
      </div>
    );
  }

  function swapModel(slotIndex: number, newModelId: string) {
    setSelectedModels((prev) => {
      const next = [...prev];
      next[slotIndex] = newModelId;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setHasRun(true);

    // Initialize all slots as loading
    const initial: Record<string, ModelResponseState> = {};
    selectedModels.forEach((modelId, slotIndex) => {
      initial[getSlotKey(slotIndex, modelId)] = { text: "", loading: true, error: null };
    });
    setResponses(initial);

    // Fire all requests in parallel — failures in one slot don't break others
    const results = await Promise.allSettled(
      selectedModels.map((modelId) =>
        fetchModelResponse(trimmed, modelId, jwt, byokKeys)
      )
    );

    // Merge results back per model slot
    setResponses((prev) => {
      const next = { ...prev };
      selectedModels.forEach((modelId, i) => {
        const result = results[i];
        if (result.status === "fulfilled") {
          next[getSlotKey(i, modelId)] = { text: result.value, loading: false, error: null };
        } else {
          next[getSlotKey(i, modelId)] = {
            text: "",
            loading: false,
            error: (result.reason as Error)?.message ?? "Unknown error",
          };
        }
      });
      return next;
    });
  }

  const isLoading = Object.values(responses).some((r) => r.loading);

  const gridCols =
    selectedModels.length === 2
      ? "grid-cols-1 lg:grid-cols-2"
      : selectedModels.length === 4
        ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        : "grid-cols-1 lg:grid-cols-3";

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Prompt input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-lg border border-border bg-card p-3"
      >
        <textarea
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Send to all models at once…"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="rounded-md bg-primary p-2 text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Send to all models"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Column grid */}
      <div className={cn("grid gap-3", gridCols)}>
        {selectedModels.map((modelId, slotIndex) => {
          const state = responses[getSlotKey(slotIndex, modelId)];
          const modelMeta = getAvailableCompareModels(byokKeys).find((m) => m.id === modelId);

          return (
            <div
              key={`${slotIndex}-${modelId}`}
              className="flex flex-col rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Card header with model chip */}
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <SlotModelChip
                  modelId={modelId}
                  onSwap={(newId) => swapModel(slotIndex, newId)}
                  tier={tier}
                  byokKeys={byokKeys}
                  onUpgrade={onUpgrade}
                />
                {modelMeta?.pricing && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                    {modelMeta.pricing}
                  </span>
                )}
              </div>

              {/* Response area */}
              <div className="flex-1 min-h-[200px] p-3">
                {!hasRun && (
                  <p className="text-xs text-muted-foreground/50 italic">
                    Response will appear here.
                  </p>
                )}
                {state?.loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="animate-pulse">Generating…</span>
                  </div>
                )}
                {state?.error && (
                  <p className="text-xs text-destructive">{state.error}</p>
                )}
                {state?.text && !state.loading && (
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {state.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
