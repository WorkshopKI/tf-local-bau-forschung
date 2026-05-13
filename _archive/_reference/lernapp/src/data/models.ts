import type { ModelOption, AIRoutingConfig } from "@/types";
import { loadFromStorage, loadArrayFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export type { ModelOption, AIRoutingConfig } from "@/types";

export const DEFAULT_AI_ROUTING: AIRoutingConfig = {
  internalEndpoint: "",
  internalModel: "",
  externalProvider: "Externer Anbieter",
  externalModel: "",
  confidentialRouting: "internal-only",
  internalRouting: "prefer-internal",
  openRouting: "prefer-external",
  warnOnExternal: true,
  auditLog: true,
};

export function loadAIRouting(): AIRoutingConfig {
  return loadFromStorage(LS_KEYS.AI_ROUTING, DEFAULT_AI_ROUTING);
}

export function saveAIRouting(config: AIRoutingConfig) {
  saveToStorage(LS_KEYS.AI_ROUTING, config);
}

/**
 * Standard-Modelle — empfohlene aktuelle Versionen für den Alltagsgebrauch.
 * Bei neuen Releases hier die Model-IDs aktualisieren.
 */
export const STANDARD_MODELS: ModelOption[] = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (latest)", isLatest: true, tier: "external" },
  { value: "openai/gpt-5", label: "GPT-5 (latest)", isLatest: true, tier: "external" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "external" },
];

/**
 * Premium-Modelle — leistungsstärkere (und teurere) Modelle für anspruchsvolle Aufgaben.
 * Bei neuen Releases hier die Model-IDs aktualisieren.
 */
export const PREMIUM_MODELS: ModelOption[] = [
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (latest)", isPremium: true, isLatest: true, tier: "external" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", isPremium: true, tier: "external" },
  { value: "openai/gpt-5.4", label: "GPT-5.4 (latest)", isPremium: true, isLatest: true, tier: "external" },
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", isPremium: true, tier: "external" },
  { value: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", isPremium: true, tier: "external" },
  { value: "anthropic/claude-haiku-3.5", label: "Claude Haiku 3.5", tier: "external" },
];

/**
 * Weitere Modelle — kleinere/schnellere Varianten.
 */
export const OPEN_SOURCE_MODELS: ModelOption[] = [
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "external" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "external" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "external" },
  { value: "mistral/mistral-large", label: "Mistral Large", tier: "external" },
  { value: "mistral/mistral-small", label: "Mistral Small", tier: "external" },
  { value: "mistral/codestral", label: "Codestral", tier: "external" },
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Open Source)", tier: "external" },
];

export { DEFAULT_MODEL } from "@/lib/constants";

const LS_CUSTOM_MODELS = LS_KEYS.CUSTOM_MODELS;

export function loadCustomModels(): ModelOption[] {
  return loadArrayFromStorage<ModelOption>(LS_CUSTOM_MODELS);
}

export function saveCustomModels(models: ModelOption[]): void {
  saveToStorage(LS_CUSTOM_MODELS, models);
}

export function addCustomModel(modelId: string): ModelOption[] {
  const current = loadCustomModels();
  const allKnown = [...STANDARD_MODELS, ...PREMIUM_MODELS, ...OPEN_SOURCE_MODELS, ...current];
  if (allKnown.some((m) => m.value === modelId)) return current;

  const label = modelId.includes("/")
    ? modelId.split("/").slice(1).join("/").replace(/[-_]/g, " ")
    : modelId;
  const updated = [...current, { value: modelId, label, isCustom: true }];
  saveCustomModels(updated);
  return updated;
}

export function removeCustomModel(modelId: string): ModelOption[] {
  const updated = loadCustomModels().filter((m) => m.value !== modelId);
  saveCustomModels(updated);
  return updated;
}

/** Alle verfügbaren Modelle: Standard + Premium + Eigene */
export function getAllModels(): ModelOption[] {
  return [...STANDARD_MODELS, ...PREMIUM_MODELS, ...OPEN_SOURCE_MODELS, ...loadCustomModels()];
}

/** Model-ID zu Display-Label auflösen */
export function getModelLabel(value: string): string {
  return getAllModels().find((m) => m.value === value)?.label ?? value;
}
