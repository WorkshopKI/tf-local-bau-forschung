/**
 * Export-Bündel des Degradationspfads. Wenn das gemeinsame Verzeichnis nicht
 * beschreibbar ist, landen die Events in der persönlichen Ablage; `exportFeedback`
 * bündelt sie in EINE JSON-Datei, die der Kurator manuell in die Share-Aggregation
 * zurückführt. Reine Partitionierung + ein atomarer Schreibvorgang.
 */
import type { StorageService } from '@/core/services/storage';
import { atomicWrite } from '@/core/services/infrastructure/atomic-write';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { PERSONAL_EXPORT_PATH } from './layout';
import { collectPersonalEvents } from './read';
import { istUsageEvent, type FeedbackEvent, type SkillSignalEvent, type UsageEvent } from './types';

export interface FeedbackExport {
  version: 1;
  /** ISO-Zeitstempel der Erzeugung (injizierbar für deterministische Tests). */
  exportiert_am: string;
  feedback: FeedbackEvent[];
  usage: UsageEvent[];
}

/** Trennt eine Event-Liste rein in Feedback- und Usage-Events. */
export function partitionEvents(events: SkillSignalEvent[]): {
  feedback: FeedbackEvent[];
  usage: UsageEvent[];
} {
  const feedback: FeedbackEvent[] = [];
  const usage: UsageEvent[] = [];
  for (const ev of events) {
    if (istUsageEvent(ev)) usage.push(ev);
    else feedback.push(ev);
  }
  return { feedback, usage };
}

/**
 * Bündelt die eigenen (persönlich abgelegten) Events und schreibt sie nach
 * {@link PERSONAL_EXPORT_PATH}. Liefert das Bündel auch dann zurück, wenn kein
 * Persoenlich-Handle existiert (dann ohne Datei-Write). Wirft nicht.
 */
export async function exportFeedback(
  storage: StorageService,
  exportiertAm: string = new Date().toISOString(),
): Promise<FeedbackExport> {
  const { feedback, usage } = partitionEvents(await collectPersonalEvents(storage));
  const bundle: FeedbackExport = { version: 1, exportiert_am: exportiertAm, feedback, usage };
  const pers = await getPersoenlichHandle(storage.idb);
  if (pers) {
    try {
      await atomicWrite(pers, PERSONAL_EXPORT_PATH, JSON.stringify(bundle, null, 2));
    } catch (err) {
      console.warn('[skill-feedback] export write failed:', err);
    }
  }
  return bundle;
}
