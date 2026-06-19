/**
 * DSGVO-Inhalts-Guard (hart). Ein Feedback-/Nutzungs-Event darf AUSSCHLIESSLICH
 * die in `types.ts` deklarierten Felder enthalten. Die Sanitizer bauen das
 * Ergebnis per **Whitelist-Konstruktion** neu auf (nie `...raw` spreaden) — so ist
 * es strukturell unmöglich, dass generierter Abschnittstext, VB-Inhalt, FKZ,
 * Aktenzeichen oder sonstige Antragsdaten in die (ggf. team-weit lesbaren)
 * Dateien gelangen. Ungültige/unvollständige Eingaben → `null` (werden verworfen).
 */
import {
  MAX_NOTIZ_LENGTH,
  type FeedbackEvent,
  type SkillSignalEvent,
  type UsageEvent,
} from './types';

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Validiert + säubert ein rohes Feedback-Event. Übernimmt NUR die erlaubten
 * Felder, kürzt `notiz` auf {@link MAX_NOTIZ_LENGTH}. `null` bei Pflichtfeld-Mangel.
 */
export function sanitizeFeedbackEvent(raw: unknown): FeedbackEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const skillId = asNonEmptyString(r.skillId);
  const skillVersion = asFiniteNumber(r.skillVersion);
  const rating = r.rating === 'up' || r.rating === 'down' ? r.rating : undefined;
  const ts = asNonEmptyString(r.ts);
  const userId = asNonEmptyString(r.userId);
  if (!skillId || skillVersion === undefined || !rating || !ts || !userId) return null;
  const clean: FeedbackEvent = { skillId, skillVersion, rating, ts, userId };
  const notiz = asNonEmptyString(r.notiz);
  if (notiz) clean.notiz = notiz.slice(0, MAX_NOTIZ_LENGTH);
  return clean;
}

/**
 * Validiert + säubert ein rohes Nutzungs-Event (`event: 'lauf'`). Whitelist-
 * Konstruktion wie oben. `null` bei Pflichtfeld-Mangel oder falschem `event`.
 */
export function sanitizeUsageEvent(raw: unknown): UsageEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.event !== 'lauf') return null;
  const skillId = asNonEmptyString(r.skillId);
  const skillVersion = asFiniteNumber(r.skillVersion);
  const ts = asNonEmptyString(r.ts);
  const userId = asNonEmptyString(r.userId);
  if (!skillId || skillVersion === undefined || !ts || !userId) return null;
  return { skillId, skillVersion, event: 'lauf', ts, userId };
}

/**
 * Dispatcht nach Event-Sorte: `event === 'lauf'` → Usage, sonst (mit `rating`) →
 * Feedback. Liefert ein gesäubertes Event oder `null`.
 */
export function sanitizeEvent(raw: unknown): SkillSignalEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.event === 'lauf') return sanitizeUsageEvent(raw);
  return sanitizeFeedbackEvent(raw);
}
