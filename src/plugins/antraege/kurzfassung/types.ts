/** Persistierter Zustand eines Kurzfassung-Skill-Laufs (pro Verbund). */
import type { CheckResult, SkillModifierKey } from '@/core/services/skills';

export type KurzfassungStatus = 'entwurf' | 'freigegeben';

/**
 * Schnappschuss einer früheren Fassung (für den Versionsvergleich + Rückgriff).
 * Wird im `verlauf`-Array des Records geführt — kein eigener Object-Store
 * (siehe kurzfassung-store.ts: bewusst kein Version-Bump unter `file://`).
 */
export interface KurzfassungVersion {
  finalerText: string;
  quellenanalyse: string;
  entwurf: string;
  checks: CheckResult[];
  erstellt_am: string;
  modell: string;
  /** Modifier, der zu DIESER Fassung führte (undefined = Erstfassung). */
  modifier?: SkillModifierKey;
  vbGekuerzt?: boolean;
  warnung?: string;
  /** Reasoning-/Thinking-Text dieses Laufs, falls Thinking aktiv war (sonst undefined). */
  denkprozess?: string;
}

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
  /** Skill-Registry-Herkunft (optional; alte Läufe ohne diese Felder bleiben ladbar). */
  skillId?: string;
  skillVersion?: number;
  /** Gesetzt, wenn die VB für den Prompt gekürzt wurde. */
  vbGekuerzt?: boolean;
  /** Parser-Warnung (z.B. Ausgabe ohne saubere Abschnitte). */
  warnung?: string;
  /** Modifier, der zur AKTUELLEN Fassung führte (für die Verlaufs-Anzeige). */
  modifier?: SkillModifierKey;
  /** Frühere Fassungen (älteste zuerst), gekappt auf MAX_VERLAUF — Vergleich/Rückgriff. */
  verlauf?: KurzfassungVersion[];
  /** True, wenn dieser Lauf mit aktivem, nicht-leerem persönlichem Tweak generiert wurde (User-Tweaks v2). */
  mitTweak?: boolean;
  /** Stand des Tweaks (`geaendert_am`) zum Zeitpunkt der Generierung — Nachvollziehbarkeit. */
  tweakGeaendertAm?: string;
  /** Reasoning-/Thinking-Text der aktuellen Fassung, falls Thinking aktiv war (aufklappbarer „Denkprozess"). */
  denkprozess?: string;
  /** True, wenn dieser Lauf MIT aktivem Thinking generiert wurde — für den Hinweis, falls das Modell keinen Denkprozess lieferte. */
  denkprozessAngefordert?: boolean;
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
