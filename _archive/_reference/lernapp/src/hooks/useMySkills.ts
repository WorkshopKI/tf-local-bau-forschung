import { useState, useCallback } from "react";
import { loadArrayFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import type { SavedSkill, PromptItem } from "@/types";

export function useMySkills() {
  const [skills, setSkills] = useState<SavedSkill[]>(() =>
    loadArrayFromStorage<SavedSkill>(LS_KEYS.MY_SKILLS)
  );

  const refresh = useCallback(() => {
    setSkills(loadArrayFromStorage<SavedSkill>(LS_KEYS.MY_SKILLS));
  }, []);

  const saveSkill = useCallback((skill: SavedSkill) => {
    const current = loadArrayFromStorage<SavedSkill>(LS_KEYS.MY_SKILLS);
    const existing = current.findIndex((s) => s.id === skill.id);
    let updated: SavedSkill[];
    if (existing >= 0) {
      updated = current.map((s) => (s.id === skill.id ? { ...skill, updatedAt: Date.now() } : s));
    } else {
      updated = [skill, ...current];
    }
    saveToStorage(LS_KEYS.MY_SKILLS, updated);
    setSkills(updated);
    return skill;
  }, []);

  const deleteSkill = useCallback((id: string) => {
    const current = loadArrayFromStorage<SavedSkill>(LS_KEYS.MY_SKILLS);
    const updated = current.filter((s) => s.id !== id);
    saveToStorage(LS_KEYS.MY_SKILLS, updated);
    setSkills(updated);
  }, []);

  const createSkillFromPrompt = useCallback((prompt: PromptItem, variableValues?: Record<string, string>): SavedSkill => {
    const now = Date.now();
    return {
      id: `skill_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title: prompt.title,
      prompt: prompt.prompt,
      sourceTitle: prompt.title,
      category: prompt.category,
      notes: "",
      variables: variableValues || {},
      confidentiality: prompt.confidentiality,
      targetDepartment: prompt.targetDepartment,
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  return { skills, saveSkill, deleteSkill, createSkillFromPrompt, refresh };
}
