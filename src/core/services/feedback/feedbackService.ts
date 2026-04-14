// Feedback CRUD: localStorage primär + Shared JSON im Datenverzeichnis (Multi-User-Sync).
// Konflikt-Strategie (Sektion R4): Merge-by-id mit Field-Precedence (User-Felder lokal, Admin-Felder shared-wins).

import type { StorageService } from '@/core/services/storage';
import {
  DEFAULT_FEEDBACK_CONFIG,
  DEFAULT_HOURS_TO_POINTS_FACTOR,
  DEFAULT_SPONSORING_THRESHOLDS,
  EFFORT_HOURS,
  FEEDBACK_CONFIG_LS_KEY,
  FEEDBACK_DATA_DIR,
  FEEDBACK_LS_KEY,
  FEEDBACK_SHARED_FILE,
} from '@/core/types/feedback';
import type {
  EffortEstimate,
  FeedbackConfig,
  FeedbackFilters,
  FeedbackItem,
  FeedbackSponsor,
  SharedFeedbackFile,
} from '@/core/types/feedback';
import { refundPoints, spendPoints } from './budgetService';

// ── localStorage Helpers ─────────────────────────────────────────────────────

function loadLocalItems(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalItems(items: FeedbackItem[]): void {
  try {
    localStorage.setItem(FEEDBACK_LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('[feedbackService] localStorage write failed:', err);
  }
}

function generateId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Shared-File Helpers (No-op wenn fs nicht verbunden) ──────────────────────

async function readSharedFile(storage: StorageService): Promise<SharedFeedbackFile | null> {
  if (!storage.fs) return null;
  try {
    const exists = await storage.fs.exists(FEEDBACK_SHARED_FILE);
    if (!exists) return null;
    const data = await storage.fs.readJSON<SharedFeedbackFile>(FEEDBACK_SHARED_FILE);
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return null;
    return data;
  } catch (err) {
    console.warn('[feedbackService] readSharedFile failed:', err);
    return null;
  }
}

async function writeSharedFile(storage: StorageService, items: FeedbackItem[]): Promise<boolean> {
  if (!storage.fs || storage.fs.isReadOnly()) return false;
  try {
    await storage.fs.ensureDir(FEEDBACK_DATA_DIR);
    const payload: SharedFeedbackFile = {
      version: 1,
      updated_at: new Date().toISOString(),
      items,
    };
    await storage.fs.writeJSON(FEEDBACK_SHARED_FILE, payload);
    return true;
  } catch (err) {
    console.error('[feedbackService] writeSharedFile failed:', err);
    return false;
  }
}

/** Merge-Strategie: bei Duplikat-IDs wins shared für Admin-Felder, lokal für User-Felder. */
function mergeItems(local: FeedbackItem[], shared: FeedbackItem[]): FeedbackItem[] {
  const byId = new Map<string, FeedbackItem>();
  for (const item of shared) byId.set(item.id, item);
  for (const local_item of local) {
    const sharedItem = byId.get(local_item.id);
    if (!sharedItem) {
      byId.set(local_item.id, local_item);
      continue;
    }
    // Merge: User-Felder aus local, Admin/FAQ-Felder aus shared
    byId.set(local_item.id, {
      ...sharedItem,
      // User-fields override (User edits these locally first)
      text: local_item.text,
      stars: local_item.stars,
      context: local_item.context,
      llm_summary: local_item.llm_summary ?? sharedItem.llm_summary,
      llm_classification: local_item.llm_classification ?? sharedItem.llm_classification,
      user_confirmed: local_item.user_confirmed ?? sharedItem.user_confirmed,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ── Public API: CRUD ────────────────────────────────────────────────────────

export async function submitFeedback(
  storage: StorageService,
  data: Omit<FeedbackItem, 'id' | 'admin_status' | 'created_at'>,
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    ...data,
    id: generateId(),
    admin_status: 'neu',
    created_at: new Date().toISOString(),
  };
  // Local
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);
  // Shared (best-effort: re-read + merge + write)
  const shared = await readSharedFile(storage);
  if (shared) {
    const merged = mergeItems([item], shared.items);
    await writeSharedFile(storage, merged);
  } else if (storage.fs && !storage.fs.isReadOnly()) {
    await writeSharedFile(storage, [item]);
  }
  return item;
}

export async function getFeedbackList(
  storage: StorageService,
  filters?: FeedbackFilters,
): Promise<FeedbackItem[]> {
  const local = loadLocalItems();
  const shared = await readSharedFile(storage);
  const merged = shared ? mergeItems(local, shared.items) : local.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!filters) return merged;
  return merged.filter(item => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.status && item.admin_status !== filters.status) return false;
    if (filters.priority !== undefined && item.admin_priority !== filters.priority) return false;
    return true;
  });
}

export async function getMyFeedback(storage: StorageService, userId: string): Promise<FeedbackItem[]> {
  const all = await getFeedbackList(storage);
  return all.filter(item => item.user_id === userId);
}

export async function updateFeedback(
  storage: StorageService,
  id: string,
  updates: Partial<Pick<
    FeedbackItem,
    'admin_status' | 'admin_notes' | 'admin_priority' | 'generated_prompt'
    | 'category'
    | 'llm_summary' | 'llm_classification' | 'user_confirmed'
    | 'is_faq' | 'faq_answer' | 'faq_keywords' | 'faq_ask_count'
    | 'effort_estimate' | 'effort_hours'
  >>,
): Promise<void> {
  // Update local
  const items = loadLocalItems();
  const idx = items.findIndex(i => i.id === id);
  const localItem = idx >= 0 ? items[idx] : undefined;
  if (idx >= 0 && localItem) {
    items[idx] = { ...localItem, ...updates };
    saveLocalItems(items);
  }
  // Update shared
  if (!storage.fs || storage.fs.isReadOnly()) return;
  const shared = await readSharedFile(storage);
  if (shared) {
    const sharedIdx = shared.items.findIndex(i => i.id === id);
    const sharedItem = sharedIdx >= 0 ? shared.items[sharedIdx] : undefined;
    if (sharedIdx >= 0 && sharedItem) {
      shared.items[sharedIdx] = { ...sharedItem, ...updates };
    } else if (localItem) {
      shared.items.unshift({ ...localItem, ...updates });
    }
    await writeSharedFile(storage, shared.items);
  } else if (localItem) {
    await writeSharedFile(storage, [{ ...localItem, ...updates }]);
  }
}

export async function deleteFeedback(storage: StorageService, id: string): Promise<void> {
  const items = loadLocalItems().filter(i => i.id !== id);
  saveLocalItems(items);
  if (!storage.fs || storage.fs.isReadOnly()) return;
  const shared = await readSharedFile(storage);
  if (shared) {
    const remaining = shared.items.filter(i => i.id !== id);
    await writeSharedFile(storage, remaining);
  }
}

// ── FAQ-Logik ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'eines',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'wurde', 'wurden',
  'kann', 'können', 'könnte', 'soll', 'sollte', 'muss', 'müssen',
  'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'wieso', 'welche', 'welcher', 'welches',
  'und', 'oder', 'aber', 'doch', 'sondern',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'mir', 'dir',
  'mit', 'für', 'auf', 'in', 'an', 'zu', 'von', 'bei', 'aus', 'nach', 'um', 'über',
  'nicht', 'kein', 'keine',
  'mal', 'auch', 'noch', 'schon',
  'the', 'a', 'an', 'is', 'are', 'how', 'what', 'and', 'or',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

export function matchFaqEntries(
  input: string,
  faqs: FeedbackItem[],
): Array<{ item: FeedbackItem; score: number }> {
  const inputTokens = new Set(tokenize(input));
  if (inputTokens.size === 0) return [];
  const matches: Array<{ item: FeedbackItem; score: number }> = [];
  for (const faq of faqs) {
    if (!faq.is_faq) continue;
    const summary = faq.llm_summary ?? faq.text ?? '';
    const candidateTokens = new Set([
      ...tokenize(summary),
      ...(faq.faq_keywords ?? []).flatMap(k => tokenize(k)),
    ]);
    let score = 0;
    for (const t of inputTokens) if (candidateTokens.has(t)) score++;
    if (score >= 2) matches.push({ item: faq, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 4);
}

export async function createStandaloneFaq(
  storage: StorageService,
  data: { summary: string; answer: string; keywords?: string[] },
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    id: generateId(),
    created_at: new Date().toISOString(),
    user_id: 'admin',
    user_display_name: 'Admin',
    category: 'question',
    text: data.summary,
    context: {
      route: 'admin',
      page: 'Admin (manuell)',
      device: 'Desktop',
      viewport: '0x0',
      sessionDuration: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    },
    llm_summary: data.summary,
    admin_status: 'umgesetzt',
    is_faq: true,
    faq_answer: data.answer,
    faq_keywords: data.keywords,
    faq_ask_count: 0,
  };
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);
  if (storage.fs && !storage.fs.isReadOnly()) {
    const shared = await readSharedFile(storage);
    const merged = shared ? mergeItems([item], shared.items) : [item];
    await writeSharedFile(storage, merged);
  }
  return item;
}

export async function bumpFaqAskCount(storage: StorageService, faqId: string): Promise<void> {
  const items = loadLocalItems();
  const local = items.find(i => i.id === faqId);
  const shared = await readSharedFile(storage);
  const sharedItem = shared?.items.find(i => i.id === faqId);
  const current = (sharedItem?.faq_ask_count ?? local?.faq_ask_count ?? 0) + 1;
  await updateFeedback(storage, faqId, { faq_ask_count: current });
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function loadFeedbackConfig(_storage: StorageService): Promise<FeedbackConfig> {
  try {
    const raw = localStorage.getItem(FEEDBACK_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackConfig>;
      return { ...DEFAULT_FEEDBACK_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_FEEDBACK_CONFIG;
}

export async function saveFeedbackConfig(_storage: StorageService, cfg: FeedbackConfig): Promise<void> {
  try {
    localStorage.setItem(FEEDBACK_CONFIG_LS_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.error('[feedbackService] saveFeedbackConfig failed:', err);
  }
}

export async function getSharedFileStatus(
  storage: StorageService,
): Promise<{ path: string; exists: boolean; itemCount: number; updatedAt?: string }> {
  if (!storage.fs) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  const shared = await readSharedFile(storage);
  if (!shared) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  return { path: FEEDBACK_SHARED_FILE, exists: true, itemCount: shared.items.length, updatedAt: shared.updated_at };
}

// ── Phase 3: Sponsoring ─────────────────────────────────────────────────────

function recalcTotals(sponsors: FeedbackSponsor[]): { points: number; hours: number } {
  let points = 0;
  let hours = 0;
  for (const s of sponsors) {
    if (s.type === 'points') points += s.amount;
    else if (s.type === 'hours') hours += s.amount;
  }
  return { points, hours };
}

/** Fortschritts-Berechnung: kombiniert Punkte + (Stunden × Faktor) gegen Schwelle. */
export function getSponsoringProgress(
  ticket: FeedbackItem,
  config: FeedbackConfig,
): {
  pointsTotal: number;
  hoursTotal: number;
  combinedPoints: number;
  threshold: number;
  percentage: number;
  thresholdReached: boolean;
  sponsorCount: number;
} {
  const sponsors = ticket.sponsors ?? [];
  const { points, hours } = recalcTotals(sponsors);
  const factor = config.hours_to_points_factor ?? DEFAULT_HOURS_TO_POINTS_FACTOR;
  const thresholds = config.sponsoring_thresholds ?? DEFAULT_SPONSORING_THRESHOLDS;
  const combined = points + hours * factor;
  const effort = ticket.effort_estimate;
  const threshold = effort ? thresholds[effort] : 0;
  const percentage = threshold > 0 ? Math.min(100, Math.round((combined / threshold) * 100)) : 0;
  return {
    pointsTotal: points,
    hoursTotal: hours,
    combinedPoints: combined,
    threshold,
    percentage,
    thresholdReached: threshold > 0 && combined >= threshold,
    sponsorCount: sponsors.length,
  };
}

/** Sponsoring ist nur für Feature-Ideen mit gesetztem Aufwand + offenem Status möglich. */
export function isSponsoringOpen(ticket: FeedbackItem): boolean {
  if (ticket.category !== 'idea') return false;
  if (!ticket.effort_estimate) return false;
  return ticket.admin_status === 'neu' || ticket.admin_status === 'geplant';
}

export interface SponsorResult {
  ok: boolean;
  error?: 'no_budget' | 'already_sponsored' | 'not_open' | 'invalid' | 'write_failed';
}

/** User sponsort ein Ticket. Budget-Check + Doppel-Check + Totals + LS + Shared-JSON update. */
export async function sponsorTicket(
  storage: StorageService,
  ticketId: string,
  sponsor: FeedbackSponsor,
  config: FeedbackConfig,
): Promise<SponsorResult> {
  if (!sponsor.user_id || sponsor.amount <= 0) return { ok: false, error: 'invalid' };
  if (sponsor.type === 'hours' && !sponsor.project_ref?.trim()) return { ok: false, error: 'invalid' };

  // Re-Read shared first + merge (Konflikt-Strategie)
  const shared = await readSharedFile(storage);
  const localItems = loadLocalItems();
  const merged = shared ? mergeItems(localItems, shared.items) : localItems;
  const target = merged.find(i => i.id === ticketId);
  if (!target) return { ok: false, error: 'invalid' };
  if (!isSponsoringOpen(target)) return { ok: false, error: 'not_open' };

  // Doppel-Check: same user + same type bereits vorhanden?
  const existing = (target.sponsors ?? []).find(s => s.user_id === sponsor.user_id && s.type === sponsor.type);
  if (existing) return { ok: false, error: 'already_sponsored' };

  // Bei Punkten: Budget-Check
  if (sponsor.type === 'points') {
    const ok = spendPoints(sponsor.user_id, sponsor.amount, config.budget_points_per_quarter);
    if (!ok) return { ok: false, error: 'no_budget' };
  }

  // Sponsor hinzufügen + Totals neu
  const newSponsors = [...(target.sponsors ?? []), sponsor];
  const { points, hours } = recalcTotals(newSponsors);
  const updates: Partial<FeedbackItem> = {
    sponsors: newSponsors,
    sponsor_points_total: points,
    sponsor_hours_total: hours,
  };

  // Lokal schreiben
  const localIdx = localItems.findIndex(i => i.id === ticketId);
  if (localIdx >= 0) {
    const localTarget = localItems[localIdx];
    if (localTarget) {
      localItems[localIdx] = { ...localTarget, ...updates };
      saveLocalItems(localItems);
    }
  } else {
    // Ticket war nur im Shared — füge gemergeten Eintrag lokal hinzu
    localItems.unshift({ ...target, ...updates });
    saveLocalItems(localItems);
  }

  // Shared schreiben (merged)
  if (storage.fs && !storage.fs.isReadOnly()) {
    const writeOk = await writeSharedFile(
      storage,
      merged.map(i => (i.id === ticketId ? { ...i, ...updates } : i)),
    );
    if (!writeOk) {
      // Rollback: lokaler Stand ist sowieso da, nur Budget zurückgeben wenn points-Typ
      if (sponsor.type === 'points') refundPoints(sponsor.user_id, sponsor.amount, config.budget_points_per_quarter);
      return { ok: false, error: 'write_failed' };
    }
  }
  return { ok: true };
}

/** Sponsoring zurückziehen: entfernt Sponsor-Eintrag, erstattet Punkte zurück. */
export async function unsponsorTicket(
  storage: StorageService,
  ticketId: string,
  userId: string,
  type: 'points' | 'hours',
  config: FeedbackConfig,
): Promise<void> {
  const shared = await readSharedFile(storage);
  const localItems = loadLocalItems();
  const merged = shared ? mergeItems(localItems, shared.items) : localItems;
  const target = merged.find(i => i.id === ticketId);
  if (!target) return;

  const existing = (target.sponsors ?? []).find(s => s.user_id === userId && s.type === type);
  if (!existing) return;

  const newSponsors = (target.sponsors ?? []).filter(s => !(s.user_id === userId && s.type === type));
  const { points, hours } = recalcTotals(newSponsors);
  const updates: Partial<FeedbackItem> = {
    sponsors: newSponsors,
    sponsor_points_total: points,
    sponsor_hours_total: hours,
  };

  const localIdx = localItems.findIndex(i => i.id === ticketId);
  if (localIdx >= 0) {
    const localTarget = localItems[localIdx];
    if (localTarget) {
      localItems[localIdx] = { ...localTarget, ...updates };
      saveLocalItems(localItems);
    }
  }
  if (storage.fs && !storage.fs.isReadOnly()) {
    await writeSharedFile(
      storage,
      merged.map(i => (i.id === ticketId ? { ...i, ...updates } : i)),
    );
  }

  if (type === 'points') {
    refundPoints(userId, existing.amount, config.budget_points_per_quarter);
  }
}

/** Admin-Hilfsfunktion: setze Aufwand-Schätzung (effort_estimate + effort_hours synchron). */
export async function setEffortEstimate(
  storage: StorageService,
  ticketId: string,
  effort: EffortEstimate | undefined,
): Promise<void> {
  await updateFeedback(storage, ticketId, {
    effort_estimate: effort,
    effort_hours: effort ? EFFORT_HOURS[effort] : undefined,
  });
}
