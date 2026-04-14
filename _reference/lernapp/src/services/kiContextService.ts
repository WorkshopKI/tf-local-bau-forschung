import { LS_KEYS } from "@/lib/constants";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import type { KIContext, WorkRule } from "@/types";

const DEFAULT_CONTEXT: KIContext = {
  profile: {
    abteilung: "",
    fachgebiet: "",
    aufgaben: "",
    stil: "",
  },
  workRules: [],
};

// ═══ LOAD ═══
export function loadKIContext(): KIContext {
  return loadFromStorage<KIContext>(LS_KEYS.KI_CONTEXT, DEFAULT_CONTEXT);
}

// ═══ SAVE ═══
export function saveKIContext(ctx: KIContext): void {
  saveToStorage(LS_KEYS.KI_CONTEXT, ctx);
}

// ═══ UPDATE PROFILE FIELD ═══
export function updateKIContextProfile(field: keyof KIContext["profile"], value: string): KIContext {
  const ctx = loadKIContext();
  ctx.profile[field] = value;
  saveKIContext(ctx);
  return ctx;
}

// ═══ WORK RULES ═══
export function addWorkRule(text: string, domain: string): KIContext {
  const ctx = loadKIContext();
  const newRule: WorkRule = {
    id: `wr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    domain,
    active: true,
    createdAt: new Date().toISOString(),
  };
  ctx.workRules.unshift(newRule);
  saveKIContext(ctx);
  return ctx;
}

export function updateWorkRule(id: string, updates: Partial<Pick<WorkRule, "text" | "domain">>): KIContext {
  const ctx = loadKIContext();
  const idx = ctx.workRules.findIndex(r => r.id === id);
  if (idx !== -1) {
    ctx.workRules[idx] = { ...ctx.workRules[idx], ...updates };
    saveKIContext(ctx);
  }
  return ctx;
}

export function deleteWorkRule(id: string): KIContext {
  const ctx = loadKIContext();
  ctx.workRules = ctx.workRules.filter(r => r.id !== id);
  saveKIContext(ctx);
  return ctx;
}

export function toggleWorkRuleActive(id: string): KIContext {
  const ctx = loadKIContext();
  const idx = ctx.workRules.findIndex(r => r.id === id);
  if (idx !== -1) {
    ctx.workRules[idx].active = !ctx.workRules[idx].active;
    saveKIContext(ctx);
  }
  return ctx;
}
