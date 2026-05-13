import { useState, useCallback } from "react";
import {
  loadCustomModels,
  addCustomModel as addModelFn,
  removeCustomModel as removeModelFn,
  type ModelOption,
} from "@/data/models";

export function useCustomModels() {
  const [customModels, setCustomModels] = useState<ModelOption[]>(loadCustomModels);

  const addCustomModel = useCallback((modelId: string): boolean => {
    const prevLen = customModels.length;
    const updated = addModelFn(modelId);
    setCustomModels(updated);
    return updated.length > prevLen;
  }, [customModels.length]);

  const removeCustomModel = useCallback((modelId: string) => {
    const updated = removeModelFn(modelId);
    setCustomModels(updated);
  }, []);

  return { customModels, addCustomModel, removeCustomModel };
}
