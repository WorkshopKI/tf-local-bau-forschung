/**
 * Phase 3 Sponsoring-Logik: Punkte/Stunden-Sponsoring + Schwellen-Berechnung.
 *
 * Trennung vom Kern-Service:
 *  - Domain-Spezifik (Sponsoring-Logik) ist eigenständig
 *  - Budget-Spendings/Refunds gehen über budgetService (separater Modul)
 */

import type { StorageService } from '@/core/services/storage';
import {
  DEFAULT_HOURS_TO_POINTS_FACTOR,
  DEFAULT_SPONSORING_THRESHOLDS,
  EFFORT_HOURS,
} from '@/core/types/feedback';
import type {
  EffortEstimate,
  FeedbackCategory,
  FeedbackConfig,
  FeedbackItem,
  FeedbackSponsor,
} from '@/core/types/feedback';
import { refundPoints, spendPoints } from './budgetService';
import { FEEDBACK_STATUS } from './feedback-status';
import {
  emitFeedbackUpdated,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import { mergeItems, readSharedFile, writeSharedFile } from './feedbackSharedFile';
import { updateFeedback } from './feedbackService';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadSponsorVotes,
  writeSponsorVotes,
  type SponsorVoteFile,
} from './feedbackSponsorOutbox';

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

/**
 * Single Source of Truth: welche Kategorien sind sponsorbar (Aufwand schätzbar,
 * Punkte setzbar)? Aktuell nur Wünsche (`idea`) — inklusive der früheren
 * UX-Verbesserungen, die seit v2.289 dort aufgehen. Bugs/Lob/Fragen sind es nicht.
 *
 * Statt verstreuter `=== 'idea'`-Vergleiche überall diesen Helper nutzen, damit
 * eine künftige sponsorbare Kategorie an EINER Stelle ergänzt wird.
 */
export function isSponsorableCategory(category: FeedbackCategory | undefined): boolean {
  return category === 'idea';
}

/** Sponsoring ist nur für sponsorbare Kategorien mit gesetztem Aufwand + offenem Status möglich. */
export function isSponsoringOpen(ticket: FeedbackItem): boolean {
  if (!isSponsorableCategory(ticket.category)) return false;
  if (!ticket.effort_estimate) return false;
  return ticket.kurator_status === FEEDBACK_STATUS.neu || ticket.kurator_status === FEEDBACK_STATUS.geplant;
}

export interface SponsorResult {
  ok: boolean;
  error?: 'no_budget' | 'already_sponsored' | 'not_open' | 'invalid' | 'write_failed';
  /** Nicht-fatal: Stimme lokal/IDB gesichert, aber persönlicher Ordner fehlt
   *  (read-only prod ohne verbundenen Ordner → Kurator kann nicht einsammeln). */
  warning?: 'no_personal_folder';
}

/**
 * User sponsort ein Ticket. Für `type==='points'` ist `sponsor.amount` die
 * **Ziel-Punktzahl** (Stepper-Upsert): existiert bereits ein eigener Punkte-
 * Eintrag, wird er auf den neuen Betrag gesetzt und das Budget um die Differenz
 * angepasst. Stunden bleiben Single-Entry (Duplikat → `already_sponsored`).
 *
 * Persistenz: Shared-Datei via `writeSharedFile` (self-gated, wie die anderen
 * Feedback-CRUD-Ops). Schlägt der Shared-Write fehl (read-only prod), wird die
 * Punkte-Stimme in die persönliche Outbox gespiegelt (`writeSponsorVotesToOutbox`)
 * — der Kurator sammelt sie später ein.
 */
export async function sponsorTicket(
  storage: StorageService,
  ticketId: string,
  sponsor: FeedbackSponsor,
  config: FeedbackConfig,
): Promise<SponsorResult> {
  if (!sponsor.user_id || sponsor.amount <= 0) return { ok: false, error: 'invalid' };
  if (sponsor.type === 'hours' && !sponsor.project_ref?.trim()) return { ok: false, error: 'invalid' };

  // Re-Read shared first + merge (Konflikt-Strategie). Der Union-Merge zieht die
  // eigene lokale Stimme mit ein → `existing` kennt den aktuellen Betrag auch für
  // read-only prod (deren Stimme nie in der Shared-Datei steht).
  const shared = await readSharedFile(storage);
  const localItems = loadLocalItems();
  const merged = shared ? mergeItems(localItems, shared.items) : localItems;
  const target = merged.find(i => i.id === ticketId);
  if (!target) return { ok: false, error: 'invalid' };
  if (!isSponsoringOpen(target)) return { ok: false, error: 'not_open' };

  const sponsorsBefore = target.sponsors ?? [];
  const existing = sponsorsBefore.find(s => s.user_id === sponsor.user_id && s.type === sponsor.type);

  let newSponsors: FeedbackSponsor[];
  if (sponsor.type === 'points') {
    // Stepper-Upsert: Budget um die Differenz anpassen.
    const delta = sponsor.amount - (existing?.amount ?? 0);
    if (delta > 0) {
      const ok = spendPoints(sponsor.user_id, delta, config.budget_points_per_quarter);
      if (!ok) return { ok: false, error: 'no_budget' };
    } else if (delta < 0) {
      refundPoints(sponsor.user_id, -delta, config.budget_points_per_quarter);
    }
    newSponsors = existing
      ? sponsorsBefore.map(s =>
          s.user_id === sponsor.user_id && s.type === 'points' ? { ...sponsor } : s,
        )
      : [...sponsorsBefore, sponsor];
  } else {
    // Stunden: Single-Entry-Modell (Duplikat blockieren).
    if (existing) return { ok: false, error: 'already_sponsored' };
    newSponsors = [...sponsorsBefore, sponsor];
  }

  const { points, hours } = recalcTotals(newSponsors);
  const updates: Partial<FeedbackItem> = {
    sponsors: newSponsors,
    sponsor_points_total: points,
    sponsor_hours_total: hours,
  };

  // Lokal NUR die eigenen Sponsor-Einträge speichern (Anti-Stale-Regel für den
  // Union-Merge in mergeItems — sonst könnte ein veralteter fremder Eintrag aus
  // dem lokalen Stand einen frischen shared-Eintrag überschreiben).
  saveOwnSponsorsLocally(localItems, ticketId, target, sponsor.user_id, newSponsors);

  // Shared schreiben (self-gated → no-op für read-only prod).
  const writeOk = await writeSharedFile(
    storage,
    merged.map(i => (i.id === ticketId ? { ...i, ...updates } : i)),
  );

  let warning: SponsorResult['warning'];
  if (!writeOk && sponsor.type === 'points') {
    // Read-only prod: Stimme in die persönliche Outbox spiegeln (Kurator sammelt ein).
    const persisted = await writeSponsorVotesToOutbox(
      storage,
      ticketId,
      sponsor.user_id,
      sponsor.amount,
    );
    if (!persisted) warning = 'no_personal_folder';
  }

  emitFeedbackUpdated();
  return { ok: true, warning };
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

  // Lokal nur eigene Einträge (Anti-Stale-Regel, vgl. sponsorTicket).
  saveOwnSponsorsLocally(localItems, ticketId, target, userId, newSponsors);

  // Shared schreiben (self-gated → no-op für read-only prod).
  const writeOk = await writeSharedFile(
    storage,
    merged.map(i => (i.id === ticketId ? { ...i, ...updates } : i)),
  );
  if (!writeOk && type === 'points') {
    // Read-only prod: Retraktion in die persönliche Outbox spiegeln (Punkte = 0).
    await writeSponsorVotesToOutbox(storage, ticketId, userId, 0);
  }

  if (type === 'points') {
    refundPoints(userId, existing.amount, config.budget_points_per_quarter);
  }
  emitFeedbackUpdated();
}

/**
 * Speichert lokal NUR die eigenen Sponsor-Einträge des Users auf dem Item
 * (Anti-Stale-Regel für den `mergeItems`-Union-Merge). Der volle Aggregat-Stand
 * geht ausschließlich in die Shared-Datei.
 */
function saveOwnSponsorsLocally(
  localItems: FeedbackItem[],
  ticketId: string,
  mergedTarget: FeedbackItem,
  userId: string,
  newSponsors: readonly FeedbackSponsor[],
): void {
  const own = newSponsors.filter(s => s.user_id === userId);
  const totals = recalcTotals(own);
  const localUpdates: Partial<FeedbackItem> = {
    sponsors: own,
    sponsor_points_total: totals.points,
    sponsor_hours_total: totals.hours,
  };
  const idx = localItems.findIndex(i => i.id === ticketId);
  if (idx >= 0) {
    const t = localItems[idx];
    if (t) localItems[idx] = { ...t, ...localUpdates };
  } else {
    // Ticket war nur im Shared — gemergten Eintrag (Kurator-/User-Felder) lokal
    // cachen, aber mit den eigenen Sponsor-Einträgen.
    localItems.unshift({ ...mergedTarget, ...localUpdates });
  }
  saveLocalItems(localItems);
}

/**
 * Spiegelt eine Punkte-Stimme in die persönliche Sponsor-Outbox
 * (`ZAH/feedback/sponsor-wuensche.json`) — der Weg für read-only prod-User, die
 * `_intern/feedback/feedback.json` nicht schreiben können. `points===0` =
 * Retraktion (Key wird entfernt). Gibt zurück, ob die Datei wirklich im
 * persönlichen Ordner landete (sonst nur IDB-Cache → `warning`).
 */
async function writeSponsorVotesToOutbox(
  storage: StorageService,
  ticketId: string,
  userId: string,
  points: number,
): Promise<boolean> {
  const persHandle = await getPersoenlichHandle(storage.idb);
  const current = await loadSponsorVotes(storage.idb, persHandle);
  const votes = { ...(current?.votes ?? {}) };
  if (points > 0) votes[ticketId] = points;
  else delete votes[ticketId];
  const data: SponsorVoteFile = {
    version: 1,
    kuerzel: userId,
    votes,
    updatedAt: new Date().toISOString(),
  };
  return writeSponsorVotes(storage.idb, persHandle, data);
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
