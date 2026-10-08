import { describe, expect, it } from "vitest";
import { SYNTHETIC_MODELS, isSyntheticModel, resolveTagModelId } from "./syntheticModels";

describe("Tag model policy", () => {
  it("uses current provider IDs and keeps the anonymous choice available", () => {
    expect(new Set(SYNTHETIC_MODELS.map(m => m.id)).size).toBe(12);
    expect(SYNTHETIC_MODELS.filter(m => m.tier === "anon").map(m => m.id)).toEqual(["hf:openai/gpt-oss-120b"]);
    expect(isSyntheticModel("syn:large:text")).toBe(true);
    expect(isSyntheticModel("constructor")).toBe(false);
    expect(isSyntheticModel("hf:deepseek-ai/DeepSeek-V3.5")).toBe(false);
  });
  it("moves retired choices to current aliases without granting anonymous access", () => {
    const replacement = resolveTagModelId("hf:moonshotai/Kimi-K2.6");
    expect(replacement).toBe("syn:large:vision");
    expect(SYNTHETIC_MODELS.find(m => m.id === replacement)?.tier).toBe("pro");
    expect(resolveTagModelId("constructor")).toBe("constructor");
    expect(resolveTagModelId("custom-provider-model")).toBe("custom-provider-model");
  });
});
