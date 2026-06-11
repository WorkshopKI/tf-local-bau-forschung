/** Persistierter Zustand eines Kurzfassung-Skill-Laufs (pro Antrag). */
import type { CheckResult } from '@/core/services/skills';

export type KurzfassungStatus = 'entwurf' | 'freigegeben';

export interface KurzfassungRecord {
  /** Aktenzeichen des Antrags (= IDB-Key-Suffix). */
  aktenzeichen: string;
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  checks: CheckResult[];
  status: KurzfassungStatus;
  /** ISO-Zeitstempel der (letzten) Generierung. */
  erstellt_am: string;
  /** ISO-Zeitstempel der Freigabe. */
  freigegeben_am?: string;
  /** Transport-/Provider-Name zum Zeitpunkt der Generierung. */
  modell: string;
  /** Gesetzt, wenn die VB für den Prompt gekürzt wurde. */
  vbGekuerzt?: boolean;
  /** Parser-Warnung (z.B. Ausgabe ohne saubere Abschnitte). */
  warnung?: string;
}
