/**
 * Manages AI routing state for the Playground:
 * model selection, AI tier, thinking mode, and confidentiality routing.
 */
import { useState, useEffect } from "react";
import { loadAIRouting, getAllModels } from "@/data/models";
import { LS_KEYS, DEFAULT_MODEL } from "@/lib/constants";
import { loadStringFromStorage } from "@/lib/storage";
import type { AIRoutingConfig } from "@/types";

interface UsePlaygroundSettingsOptions {
  profileModel?: string | null;
  requestedModel?: string | null;
  promptConfidentiality: "open" | "internal" | "confidential";
}

export function usePlaygroundSettings({
  profileModel,
  requestedModel,
  promptConfidentiality,
}: UsePlaygroundSettingsOptions) {
  const allModels = getAllModels();
  const validModel = (id: string | undefined | null): string =>
    id && allModels.some((m) => m.value === id) ? id : DEFAULT_MODEL;

  const [selectedModel, setSelectedModel] = useState(() => validModel(profileModel));
  const [thinkingEnabled, setThinkingEnabled] = useState(
    () => loadStringFromStorage(LS_KEYS.THINKING_ENABLED, "false") === "true",
  );
  const [aiTier, setAiTier] = useState<"internal" | "external">("external");
  const aiRouting: AIRoutingConfig = loadAIRouting();

  const canUseExternal =
    promptConfidentiality !== "confidential" &&
    !(promptConfidentiality === "internal" && aiRouting.internalRouting === "internal-only");

  // Auto-route based on confidentiality
  useEffect(() => {
    if (promptConfidentiality === "confidential" || promptConfidentiality === "internal") {
      setAiTier("internal");
    } else {
      setAiTier(aiRouting.openRouting === "prefer-external" ? "external" : "internal");
    }
  }, [promptConfidentiality]);

  // Sync model from profile
  useEffect(() => {
    if (profileModel) setSelectedModel(validModel(profileModel));
  }, [profileModel]);

  // Sync model from URL param
  useEffect(() => {
    if (requestedModel && allModels.some((m) => m.value === requestedModel)) {
      setSelectedModel(requestedModel);
    }
  }, [requestedModel]);

  const handleThinkingChange = (checked: boolean) => {
    setThinkingEnabled(checked);
    localStorage.setItem(LS_KEYS.THINKING_ENABLED, String(checked));
  };

  return {
    selectedModel,
    setSelectedModel,
    thinkingEnabled,
    handleThinkingChange,
    aiTier,
    setAiTier,
    aiRouting,
    canUseExternal,
    validModel,
  };
}
