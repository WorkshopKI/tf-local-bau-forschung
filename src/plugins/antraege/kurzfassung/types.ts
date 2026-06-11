/** Persistierter Zustand eines Kurzfassung-Skill-Laufs (pro Verbund). */
import type { CheckResult } from '@/core/services/skills';

export type KurzfassungStatus = 'entwurf' | 'freigegeben';

export interface KurzfassungRecord {
  /** Verbund-Key (= IDB-Key-Suffix + VB-Relations-Tag). */
  key: string;
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

export interface KurzfassungTeilvorhaben {
  nr: number;
  aktenzeichen: string;
  titel: string | null;
  antragsteller: string | null;
}

/**
 * Kontext für die Kurzfassung — bewusst auf **Verbund-Ebene**: ein Gutachten /
 * eine Kurzfassung pro Verbund (die Vorhabensbeschreibung existiert nur einmal
 * pro Verbund). Die TV-Infos (Titel etc.) fließen in den Skill-Prompt ein, da
 * das Gutachten sie auflistet.
 */
export interface KurzfassungContext {
  /** Persistenz-Key + VB-Relations-Tag (Verbund-ID; bei Solo das Aktenzeichen). */
  key: string;
  akronym: string;
  /** Verbund-Titel. */
  titel: string | null;
  /** Konsortialführer / Lead-Antragsteller. */
  antragsteller: string | null;
  /** Verbund-Förderkennzeichen (für die DOCX-Feld-Zuordnung). */
  foerderkennzeichen: string;
  /** Bekannte Kennungen für die FKZ-Erkennung in der Aufnahmefläche:
   *  Verbund-ID + Aktenzeichen aller TVs (alle gelten als zugehörig). */
  knownIds: string[];
  teilvorhaben: KurzfassungTeilvorhaben[];
}
