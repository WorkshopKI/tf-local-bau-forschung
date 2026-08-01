/**
 * Reine Helfer für den Kurzfassung-Versionsverlauf (testbar ohne Hook/IDB —
 * gleiches Muster wie `buildAnonymMapForTests`). Der Verlauf lebt als bounded
 * Array im `KurzfassungRecord` selbst (kein eigener Object-Store/Version-Bump,
 * siehe kurzfassung-store.ts). Vor jeder Re-Generierung wird die aktuelle
 * Fassung als Schnappschuss angehängt; „Übernehmen" tauscht eine Vorfassung
 * zurück in den aktiven Slot (die bisher aktive wandert in den Verlauf — es
 * geht nichts verloren).
 */
import type { CheckResult, SkillModifierKey } from '@/core/services/skills';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { KurzfassungVersion } from './types';

/**
 * Maximale Anzahl aufbewahrter Vorfassungen (älteste fliegt beim Überlauf raus).
 *
 * Von 5 auf 8 gehoben (2026-08): seit dem automatisch angehängten Feinschliff
 * schreibt EIN Generierungs-Zyklus zwei Einträge (Rohentwurf + Vorfassung). Bei 5
 * überlebte ein bewusst erzeugtes Fassungs-Paar aus beiden internen KIs den nächsten
 * Lauf nicht — genau das, was man vergleichen will, fiel als erstes hinten raus.
 */
export const MAX_VERLAUF = 8;

/**
 * Gemeinsame Inhalts-Form für die Verlaufs-Helfer. Sowohl `KurzfassungRecord`
 * (Schritt A, alter Pfad) als auch `StepRun` (Gutachten-Workflow A–G) erfüllen
 * sie — so bleibt EINE Verlaufs-Implementierung (kein Duplikat im Runner).
 */
export interface VerlaufContent {
  finalerText: string;
  quellenanalyse: string;
  entwurf: string;
  checks: CheckResult[];
  erstellt_am: string;
  modell: string;
  modifier?: SkillModifierKey;
  /** Freie Überarbeitungs-Anweisung des Bearbeiters, die zu dieser Fassung führte. */
  anweisung?: string;
  /** True, wenn über dieser Fassung der sprachliche Feinschliff lief (Lektor-Skill). */
  lektoriert?: boolean;
  vbGekuerzt?: boolean;
  warnung?: string;
  denkprozess?: string;
  /** Die interne KI dieses Laufs (`StepRun.ziel`) — trägt den KI-Vergleich im Verlauf. */
  ziel?: BridgeZiel;
  /** Erhöhte Temperatur (`StepRun.fassung`) — trägt denselben Vergleich ohne Bridge. */
  fassung?: 'mutig';
  verlauf?: KurzfassungVersion[];
}

const MODIFIER_LABEL: Record<SkillModifierKey, string> = {
  neu: 'Neu generiert',
  kuerzer: 'Gekürzt',
  laenger: 'Verlängert',
};

/** Zeichen-Obergrenze der Anweisung IM LABEL (der Volltext gehört ins `title`). */
const ANWEISUNG_LABEL_MAX = 40;

/**
 * Anzeige-Label einer Fassung (Erstfassung = ohne Modifier). Rangfolge:
 *
 *  1. freie Anweisung — sagt als einzige, WAS an dieser Fassung anders ist;
 *  2. sprachlicher Feinschliff — der jüngere Arbeitsgang über derselben
 *     Generierung, „Gekürzt" wäre danach irreführend;
 *  3. Modifier.
 *
 * Weil an jede Generierung automatisch ein Feinschliff angehängt wird, stünde ohne
 * Regel 1 über JEDER angewiesenen Fassung nur „Sprachlich überarbeitet" — der
 * Verlauf wäre eine Liste identischer Zeilen.
 */
export function versionLabel(v: { modifier?: SkillModifierKey; lektoriert?: boolean; anweisung?: string }): string {
  const anweisung = v.anweisung?.trim();
  if (anweisung) {
    const kurz = anweisung.length > ANWEISUNG_LABEL_MAX
      ? `${anweisung.slice(0, ANWEISUNG_LABEL_MAX).trimEnd()}…`
      : anweisung;
    return `Überarbeitet: „${kurz}“`;
  }
  if (v.lektoriert) return 'Sprachlich überarbeitet';
  return v.modifier ? MODIFIER_LABEL[v.modifier] : 'Erstfassung';
}

/** Schnappschuss der aktuellen Fassung eines Records für den Verlauf. */
export function snapshotOf(record: VerlaufContent): KurzfassungVersion {
  return {
    finalerText: record.finalerText,
    quellenanalyse: record.quellenanalyse,
    entwurf: record.entwurf,
    checks: record.checks,
    erstellt_am: record.erstellt_am,
    modell: record.modell,
    ...(record.modifier ? { modifier: record.modifier } : {}),
    ...(record.anweisung ? { anweisung: record.anweisung } : {}),
    ...(record.lektoriert ? { lektoriert: record.lektoriert } : {}),
    ...(record.vbGekuerzt ? { vbGekuerzt: record.vbGekuerzt } : {}),
    ...(record.warnung ? { warnung: record.warnung } : {}),
    ...(record.denkprozess ? { denkprozess: record.denkprozess } : {}),
    ...(record.ziel ? { ziel: record.ziel } : {}),
    ...(record.fassung ? { fassung: record.fassung } : {}),
  };
}

/**
 * Verlauf für die NÄCHSTE Generierung: die noch aktive Fassung als Snapshot
 * anhängen, auf MAX_VERLAUF kappen. `prev === null` (Erstlauf) → leerer Verlauf.
 */
export function appendVerlauf(prev: VerlaufContent | null): KurzfassungVersion[] {
  if (!prev) return [];
  return [...(prev.verlauf ?? []), snapshotOf(prev)].slice(-MAX_VERLAUF);
}

/**
 * Eine Vorversion zur aktiven Fassung machen: die gewählte wird aktiv, die
 * bisher aktive wandert in den Verlauf (Swap), Status zurück auf `'entwurf'`.
 * Out-of-range-Index → Record unverändert. Generisch über die Inhalts-Form,
 * damit derselbe Swap für `KurzfassungRecord` (A) und `StepRun` (A–G) gilt.
 */
export function restoreVersion<T extends VerlaufContent>(record: T, index: number): T {
  const verlauf = record.verlauf ?? [];
  const chosen = verlauf[index];
  if (!chosen) return record;
  const rest = verlauf.filter((_, i) => i !== index);
  const nextVerlauf = [...rest, snapshotOf(record)].slice(-MAX_VERLAUF);
  return {
    ...record,
    finalerText: chosen.finalerText,
    quellenanalyse: chosen.quellenanalyse,
    entwurf: chosen.entwurf,
    checks: chosen.checks,
    erstellt_am: chosen.erstellt_am,
    modell: chosen.modell,
    status: 'entwurf',
    verlauf: nextVerlauf,
    ...(chosen.modifier ? { modifier: chosen.modifier } : { modifier: undefined }),
    ...(chosen.anweisung ? { anweisung: chosen.anweisung } : { anweisung: undefined }),
    ...(chosen.lektoriert ? { lektoriert: chosen.lektoriert } : { lektoriert: undefined }),
    ...(chosen.vbGekuerzt ? { vbGekuerzt: chosen.vbGekuerzt } : { vbGekuerzt: undefined }),
    ...(chosen.warnung ? { warnung: chosen.warnung } : { warnung: undefined }),
    ...(chosen.denkprozess ? { denkprozess: chosen.denkprozess } : { denkprozess: undefined }),
    ...(chosen.ziel ? { ziel: chosen.ziel } : { ziel: undefined }),
    ...(chosen.fassung ? { fassung: chosen.fassung } : { fassung: undefined }),
  } as T;
}

/** Datums-Formatierung (de-DE, Tag.Monat.Jahr) — gemeinsam genutzt von Review + Verlauf. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}
