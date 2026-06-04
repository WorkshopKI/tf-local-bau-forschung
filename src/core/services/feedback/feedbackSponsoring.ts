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
  return ticket.kurator_status === FEEDBACK_STATUS.neu || ticket.kurator_status === FEEDBACK_STATUS.geplant;
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
  emitFeedbackUpdated();
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
  emitFeedbackUpdated();
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
