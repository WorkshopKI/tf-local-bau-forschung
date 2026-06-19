/**
 * Datenmodell des Skill-Feedback-Substrats (S1).
 *
 * Roh-Signale werden als Pro-Nutzer-JSONL auf der Share abgelegt (jeder Nutzer
 * schreibt NUR seine eigene Datei → kein Last-Write-Wins-Clobbering). Ein Event
 * enthält bewusst NUR die hier deklarierten Felder — siehe `guard.ts`
 * (DSGVO-Inhalts-Guard): niemals generierter Abschnittstext, VB-Inhalt, FKZ,
 * Aktenzeichen oder sonstige Antragsdaten. Diese Dateien liegen ggf. in einem
 * für alle lesbaren Verzeichnis; Antragsbezug wäre ein Leck.
 */

/** Re-Export aus der Registry — der `Reifegrad` lebt am `SkillRecord` (kuratiert). */
export type { Reifegrad } from '@/core/services/skills/registry/types';

/** Bewertung eines Skill-Ergebnisses. */
export type Rating = 'up' | 'down';

/** Maximale Länge der qualitativen Notiz (kurz, z.B. „zu lang"). */
export const MAX_NOTIZ_LENGTH = 140;

/**
 * Ein 👍/👎-Feedback zu einer konkreten Skill-Version, gebunden an den Nutzer.
 * `notiz` ist optional, kurz und qualitativ (≤ {@link MAX_NOTIZ_LENGTH} Zeichen).
 */
export interface FeedbackEvent {
  skillId: string;
  skillVersion: number;
  rating: Rating;
  /** Optionale kurze qualitative Notiz (≤ {@link MAX_NOTIZ_LENGTH}). */
  notiz?: string;
  /** ISO-Zeitstempel des Events. */
  ts: string;
  userId: string;
}

/**
 * Ein Nutzungs-Event: ein Skill (in einer bestimmten Version) ist gelaufen.
 * Grundlage des „meistgenutzt"-Rankings (S2/S3 aggregieren).
 */
export interface UsageEvent {
  skillId: string;
  skillVersion: number;
  event: 'lauf';
  /** ISO-Zeitstempel des Laufs. */
  ts: string;
  userId: string;
}

/** Gemeinsamer Obertyp für die Schreib-/Lese-Schicht. */
export type SkillSignalEvent = FeedbackEvent | UsageEvent;

/** Type-Guard: unterscheidet die beiden Event-Sorten strukturell. */
export function istUsageEvent(ev: SkillSignalEvent): ev is UsageEvent {
  return (ev as UsageEvent).event === 'lauf';
}
