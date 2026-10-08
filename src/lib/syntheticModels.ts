// Verified against https://api.synthetic.new/openai/v1/models on 2026-10-08.
// Recommended aliases follow provider updates; pinned models are this catalog snapshot.
export const SYNTHETIC_MODELS = [
  {
    "id": "syn:large:text",
    "label": "Recommended text",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Follows Synthetic's recommended text model.",
    "contextWindow": 524288,
    "vision": true,
    "alias": true,
    "inputPrice": 0.6,
    "outputPrice": 1.2
  },
  {
    "id": "syn:small:text",
    "label": "Quick text",
    "provider": "synthetic",
    "tier": "free",
    "description": "Follows Synthetic's recommended text model.",
    "contextWindow": 196608,
    "vision": false,
    "alias": true,
    "inputPrice": 0.09999999999999999,
    "outputPrice": 0.5
  },
  {
    "id": "syn:large:vision",
    "label": "Recommended vision",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Follows Synthetic's recommended vision model.",
    "contextWindow": 524288,
    "vision": true,
    "alias": true,
    "inputPrice": 3,
    "outputPrice": 15
  },
  {
    "id": "syn:small:vision",
    "label": "Quick vision",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Follows Synthetic's recommended vision model.",
    "contextWindow": 262144,
    "vision": true,
    "alias": true,
    "inputPrice": 0.44999999999999996,
    "outputPrice": 2.2
  },
  {
    "id": "hf:openai/gpt-oss-120b",
    "label": "GPT-OSS 120B",
    "provider": "synthetic",
    "tier": "anon",
    "description": "Text input · 128k context.",
    "contextWindow": 131072,
    "vision": false,
    "alias": false,
    "inputPrice": 0.09999999999999999,
    "outputPrice": 0.09999999999999999
  },
  {
    "id": "hf:zai-org/GLM-5.3",
    "label": "GLM 5.3",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text input · 512k context.",
    "contextWindow": 524288,
    "vision": false,
    "alias": false,
    "inputPrice": 1.4,
    "outputPrice": 4.4
  },
  {
    "id": "hf:zai-org/GLM-5.3-Flash",
    "label": "GLM 5.3 Flash",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text and image input · 512k context.",
    "contextWindow": 524288,
    "vision": true,
    "alias": false,
    "inputPrice": 0.15,
    "outputPrice": 0.5
  },
  {
    "id": "hf:deepseek-ai/DeepSeek-V4.1-Flash",
    "label": "DeepSeek V4.1 Flash",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text and image input · 512k context.",
    "contextWindow": 524288,
    "vision": true,
    "alias": false,
    "inputPrice": 0.6,
    "outputPrice": 1.2
  },
  {
    "id": "hf:moonshotai/Kimi-K3",
    "label": "Kimi K3",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text and image input · 512k context.",
    "contextWindow": 524288,
    "vision": true,
    "alias": false,
    "inputPrice": 3,
    "outputPrice": 15
  },
  {
    "id": "hf:Qwen/Qwen3.8-27B",
    "label": "Qwen 3.8 27B",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text and image input · 256k context.",
    "contextWindow": 262144,
    "vision": true,
    "alias": false,
    "inputPrice": 0.44999999999999996,
    "outputPrice": 2.2
  },
  {
    "id": "hf:zai-org/GLM-4.7-Flash",
    "label": "GLM 4.7 Flash",
    "provider": "synthetic",
    "tier": "free",
    "description": "Text input · 192k context.",
    "contextWindow": 196608,
    "vision": false,
    "alias": false,
    "inputPrice": 0.09999999999999999,
    "outputPrice": 0.5
  },
  {
    "id": "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
    "label": "Nemotron 3 Super 120B",
    "provider": "synthetic",
    "tier": "pro",
    "description": "Text input · 256k context.",
    "contextWindow": 262144,
    "vision": false,
    "alias": false,
    "inputPrice": 0.3,
    "outputPrice": 1
  }
] as const;

const RETIRED_MODELS: Record<string, string> = {
  "hf:moonshotai/Kimi-K2.6": "syn:large:vision",
  "hf:zai-org/GLM-5.1": "syn:large:text",
  "hf:MiniMaxAI/MiniMax-M2.5": "syn:large:text",
  "hf:Qwen/Qwen3.2-72B-Instruct": "syn:small:vision",
  "hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct": "syn:large:vision",
  "hf:deepseek-ai/DeepSeek-V3.5": "syn:large:text",
  "hf:mistralai/Mistral-Large-2.4": "syn:large:text"
};
export function resolveTagModelId(id: string): string {
  return Object.prototype.hasOwnProperty.call(RETIRED_MODELS, id) ? RETIRED_MODELS[id] : id;
}
export function isSyntheticModel(id: string): boolean {
  return SYNTHETIC_MODELS.some(model => model.id === id);
}
