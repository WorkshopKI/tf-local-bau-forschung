import { LS_KEYS } from "@/lib/constants";
import { loadArrayFromStorage, saveToStorage } from "@/lib/storage";
import type { Constraint } from "@/types";

// ═══ LOAD ═══
export function loadConstraints(): Constraint[] {
  return loadArrayFromStorage<Constraint>(LS_KEYS.CONSTRAINTS);
}

// ═══ SAVE ALL ═══
export function saveConstraints(constraints: Constraint[]): void {
  saveToStorage(LS_KEYS.CONSTRAINTS, constraints);
}

// ═══ ADD ═══
export function addConstraint(data: {
  title: string;
  rule: string;
  domain: string;
  source?: "manual" | "rejection";
  example?: { before: string; after: string };
}): Constraint[] {
  const constraints = loadConstraints();
  const constraint: Constraint = {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: data.title,
    rule: data.rule,
    domain: data.domain,
    active: true,
    source: data.source ?? "manual",
    example: data.example,
    createdAt: new Date().toISOString(),
  };
  constraints.unshift(constraint);
  saveConstraints(constraints);
  return constraints;
}

// ═══ UPDATE ═══
export function updateConstraint(
  id: string,
  updates: Partial<Pick<Constraint, "title" | "rule" | "domain" | "example">>
): Constraint[] {
  const constraints = loadConstraints();
  const c = constraints.find((x) => x.id === id);
  if (c) {
    if (updates.title !== undefined) c.title = updates.title;
    if (updates.rule !== undefined) c.rule = updates.rule;
    if (updates.domain !== undefined) c.domain = updates.domain;
    if (updates.example !== undefined) c.example = updates.example;
    saveConstraints(constraints);
  }
  return constraints;
}

// ═══ DELETE ═══
export function deleteConstraint(id: string): Constraint[] {
  const constraints = loadConstraints().filter((c) => c.id !== id);
  saveConstraints(constraints);
  return constraints;
}

// ═══ TOGGLE ACTIVE ═══
export function toggleConstraintActive(id: string): Constraint[] {
  const constraints = loadConstraints();
  const c = constraints.find((x) => x.id === id);
  if (c) {
    c.active = !c.active;
    saveConstraints(constraints);
  }
  return constraints;
}

// ═══ GET ACTIVE CONSTRAINTS ═══
export function getActiveConstraints(): Constraint[] {
  return loadConstraints().filter((c) => c.active);
}
