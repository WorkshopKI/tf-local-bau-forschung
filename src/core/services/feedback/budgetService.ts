// Quartals-basiertes Sponsoring-Budget pro User.
// Storage: localStorage `teamflow_user_budget_v1_{userId}`.
// Auto-Reset bei Quartalswechsel.

import {
  BUDGET_LS_KEY_PREFIX,
  DEFAULT_BUDGET_POINTS_PER_QUARTER,
} from '@/core/types/feedback';
import type { UserBudget } from '@/core/types/feedback';

function keyFor(userId: string): string {
  return `${BUDGET_LS_KEY_PREFIX}_${userId}`;
}

/** z.B. "2026-Q2" aus aktuellem Datum. */
export function getCurrentQuarter(date: Date = new Date()): string {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function readRaw(userId: string): UserBudget | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserBudget;
    if (parsed && typeof parsed.quarter === 'string' && typeof parsed.points_spent === 'number') {
      return parsed;
    }
    return null;
  } catch { return null; }
}

function writeRaw(userId: string, budget: UserBudget): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(budget));
  } catch (err) {
    console.error('[budgetService] write failed:', err);
  }
}

/** Lädt oder erstellt das Budget für einen User im aktuellen Quartal.
 *  Wenn gespeichertes Quartal abweicht → Reset. */
export function loadUserBudget(
  userId: string,
  pointsPerQuarter: number = DEFAULT_BUDGET_POINTS_PER_QUARTER,
): UserBudget {
  const currentQ = getCurrentQuarter();
  const existing = readRaw(userId);
  if (existing && existing.quarter === currentQ) {
    return { ...existing, points_total: pointsPerQuarter };
  }
  const fresh: UserBudget = {
    user_id: userId,
    quarter: currentQ,
    points_total: pointsPerQuarter,
    points_spent: 0,
  };
  writeRaw(userId, fresh);
  return fresh;
}

/** Versucht, Punkte auszugeben. Gibt false zurück wenn nicht genug übrig. */
export function spendPoints(
  userId: string,
  amount: number,
  pointsPerQuarter: number = DEFAULT_BUDGET_POINTS_PER_QUARTER,
): boolean {
  if (amount <= 0) return false;
  const budget = loadUserBudget(userId, pointsPerQuarter);
  const remaining = budget.points_total - budget.points_spent;
  if (remaining < amount) return false;
  writeRaw(userId, { ...budget, points_spent: budget.points_spent + amount });
  return true;
}

/** Gibt Punkte zurück (z.B. wenn Sponsoring zurückgezogen wird). */
export function refundPoints(
  userId: string,
  amount: number,
  pointsPerQuarter: number = DEFAULT_BUDGET_POINTS_PER_QUARTER,
): void {
  if (amount <= 0) return;
  const budget = loadUserBudget(userId, pointsPerQuarter);
  const next = Math.max(0, budget.points_spent - amount);
  writeRaw(userId, { ...budget, points_spent: next });
}

/** Prüft beim App-Start ob Quartalswechsel stattgefunden hat. */
export function checkQuarterReset(
  userId: string,
  pointsPerQuarter: number = DEFAULT_BUDGET_POINTS_PER_QUARTER,
): { resetHappened: boolean; previousQuarter?: string; currentQuarter: string } {
  const currentQ = getCurrentQuarter();
  const existing = readRaw(userId);
  if (!existing) {
    // Erstmaliger Start — kein "Reset", nur Init
    loadUserBudget(userId, pointsPerQuarter);
    return { resetHappened: false, currentQuarter: currentQ };
  }
  if (existing.quarter !== currentQ) {
    const previousQuarter = existing.quarter;
    writeRaw(userId, {
      user_id: userId,
      quarter: currentQ,
      points_total: pointsPerQuarter,
      points_spent: 0,
    });
    return { resetHappened: true, previousQuarter, currentQuarter: currentQ };
  }
  return { resetHappened: false, currentQuarter: currentQ };
}

/** Alle lokal gespeicherten Budgets (für Admin-Statistik).
 *  Iteriert nur über aktuellen Browser/LocalStorage — echte Cross-User-Stats
 *  bräuchten Shared-Storage (out of scope Phase 3). */
export function loadAllLocalBudgets(): UserBudget[] {
  const result: UserBudget[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${BUDGET_LS_KEY_PREFIX}_`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as UserBudget;
        if (parsed && typeof parsed.quarter === 'string') result.push(parsed);
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return result;
}
