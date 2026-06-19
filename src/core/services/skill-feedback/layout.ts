/**
 * EINZIGE Quelle für die Pfade der Skill-Signal-Dateien (analog `personal-layout`).
 *
 * Zwei Ablagen:
 *  - **Gemeinsam** (Daten-Share-Root, `_intern/skills/…`): das Aggregat über alle
 *    Nutzer. Schreibbar nur für Rollen mit readwrite (Kurator/PL/dev).
 *  - **Persönlich** (Persoenlich-Handle, `ZAH/skills/…`): Degradations-Fallback,
 *    immer schreibbar; der Kurator führt diese später manuell zusammen.
 *
 * Pro-Nutzer-Datei `<userId>.jsonl` (sanitisiert) — jeder schreibt NUR seine
 * eigene Datei, daher kollisionssicher trotz `appendToFile`-Read-modify-write.
 */
import { INTERN_DIR, PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';
import { sanitizeSegment } from '@/core/services/personal-storage/personal-layout';

/** Sorte des Signals — zugleich der Verzeichnis-Name. */
export type SignalKind = 'feedback' | 'usage';

/** Gemeinsame (Share-weite) Wurzel der Skill-Signale. */
export const SHARED_SKILLS_DIR = `${INTERN_DIR}/skills`;
/** Persönliche Fallback-Wurzel (eigener Home-Handle). */
export const PERSONAL_SKILLS_DIR = `${PERSOENLICH_ZAH_DIR}/skills`;
/** Export-Bündel des persönlichen Fallbacks zum manuellen Kurator-Merge. */
export const PERSONAL_EXPORT_PATH = `${PERSONAL_SKILLS_DIR}/export/skill-feedback-export.json`;

/** Verzeichnis der gemeinsamen Pro-Nutzer-Dateien einer Signal-Sorte. */
export function sharedSignalDir(kind: SignalKind): string {
  return `${SHARED_SKILLS_DIR}/${kind}`;
}
/** Verzeichnis der persönlichen Pro-Nutzer-Dateien einer Signal-Sorte. */
export function personalSignalDir(kind: SignalKind): string {
  return `${PERSONAL_SKILLS_DIR}/${kind}`;
}
/** Gemeinsamer Pro-Nutzer-Dateipfad (`_intern/skills/<kind>/<userId>.jsonl`). */
export function sharedSignalPath(kind: SignalKind, userId: string): string {
  return `${sharedSignalDir(kind)}/${sanitizeSegment(userId)}.jsonl`;
}
/** Persönlicher Pro-Nutzer-Dateipfad (`ZAH/skills/<kind>/<userId>.jsonl`). */
export function personalSignalPath(kind: SignalKind, userId: string): string {
  return `${personalSignalDir(kind)}/${sanitizeSegment(userId)}.jsonl`;
}
