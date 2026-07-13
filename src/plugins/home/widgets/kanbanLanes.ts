/**
 * Reine Lane-Ableitung für das Anträge-Kanban-Widget (testbar ohne React/IDB).
 *
 * Lanes binden an Status-KATEGORIEN (getStatusCategory, Pitfall #12 — nie
 * Roh-Status-Literale). Verbünde erscheinen als EIN Eintrag (Konvention der
 * Meine-Anträge-Liste): Repräsentant ist der älteste Eingang der Gruppe
 * (kritischster), `tvCount` hält die Gruppengröße für die Karten-Metazeile.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import {
  antragMatchesBearbeiter,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import type { KanbanLane, KanbanWidgetConfig } from './types';

/** Lane-Kopf-Akzente (bunt): feste Kategorie→Token-Zuordnung. Tokens leben in
 *  theme.css (:root + dark — theme-token-contract). Kein Hex im Widget-Code. */
export const KANBAN_LANE_ACCENT: Record<StatusCategory, string> = {
  offen: 'var(--tf-kanban-offen)',
  in_pruefung: 'var(--tf-kanban-in-pruefung)',
  nachforderung: 'var(--tf-kanban-nachforderung)',
  entscheidung: 'var(--tf-kanban-entscheidung)',
  bewilligt: 'var(--tf-kanban-bewilligt)',
  begleitung: 'var(--tf-kanban-begleitung)',
  abgelehnt: 'var(--tf-kanban-abgelehnt)',
  abgeschlossen: 'var(--tf-kanban-abgeschlossen)',
  sonstige: 'var(--tf-kanban-sonstige)',
};

/** Monochrom: 3 Abstufungen der Primär-Hue, zyklisch nach Lane-INDEX (nicht
 *  Kategorie) — so bleiben benachbarte Köpfe unterscheidbar und die wählbare
 *  Primärfarbe (--tf-primary-h) schlägt durch. */
const MONO_ACCENTS = [
  'var(--tf-kanban-mono-1)',
  'var(--tf-kanban-mono-2)',
  'var(--tf-kanban-mono-3)',
] as const;

/** Monochrom-Akzent zyklisch nach Lane-Index — geteilt von Anträge- und
 *  Feedback-Kanban (feedbackKanbanLanes), damit die Mono-Rampe eine Quelle hat. */
export function monoLaneAccent(laneIndex: number): string {
  return MONO_ACCENTS[laneIndex % MONO_ACCENTS.length]!;
}

export function laneAccent(
  farbmodus: KanbanWidgetConfig['farbmodus'],
  kategorie: StatusCategory,
  laneIndex: number,
): string {
  if (farbmodus === 'monochrom') return monoLaneAccent(laneIndex);
  return KANBAN_LANE_ACCENT[kategorie];
}

/** Default-Lanes eines Anträge-Kanbans (Katalog-Default + Quellenwechsel-Reset). */
export function defaultAntragKanbanLanes(): KanbanLane[] {
  return [
    { kategorie: 'offen', spalten: 1 },
    { kategorie: 'in_pruefung', spalten: 2 },
    { kategorie: 'nachforderung', spalten: 1 },
    { kategorie: 'entscheidung', spalten: 1 },
  ];
}

export interface KanbanKarte {
  /** Aktenzeichen des Repräsentanten — Navigations-Ziel (selectedId). */
  aktenzeichen: string;
  verbundId: string | null;
  /** Primär-Label: Akronym bevorzugt, sonst Titel, sonst Aktenzeichen. */
  label: string;
  /** Handlungs-Formel „Phase → Aktion" (naechsterSchritt) — leer wenn unbekannt. */
  schrittText: string;
  /** Eingangsalter in Tagen (antragsdatum) — null wenn unbekannt. */
  alterTage: number | null;
  /** Gruppengröße des Verbunds (1 = Solo-Antrag). */
  tvCount: number;
}

export interface KanbanLaneDaten {
  kategorie: StatusCategory;
  spalten: 1 | 2;
  /** Sichtbare Karten (gekappt auf maxKartenProLane), ältester Eingang zuerst. */
  karten: KanbanKarte[];
  /** Gesamt-Zahl der Lane (Zähler-Pill; > karten.length ⇒ „+ N weitere →"). */
  gesamt: number;
}

/** Grundmenge = identische Semantik wie useEingangAmpelCounts/Meine Anträge:
 *  Irrläufer raus, Bearbeiter-Filter (falls aktiv). KEIN Status-Filter — die
 *  Lanes entscheiden über die Kategorie. */
export function filtereKanbanGrundmenge(
  antraege: AntragListItem[],
  bearbeiterFilter: BearbeiterFilterMode,
): AntragListItem[] {
  return antraege.filter(a => {
    if (isIrrlaeufer(a.vb_phase)) return false;
    if (bearbeiterFilter.active && !antragMatchesBearbeiter(a, bearbeiterFilter)) return false;
    return true;
  });
}

function alterVon(a: AntragListItem, nowMs: number): number | null {
  // daysSinceEingang nutzt Date.now() — für deterministische Tests rechnen wir
  // hier selbst mit injiziertem nowMs, identische Formel (floor Tage).
  if (!a.antragsdatum) return null;
  const t = Date.parse(String(a.antragsdatum));
  if (Number.isNaN(t)) return null;
  return Math.floor((nowMs - t) / 86_400_000);
}

function zuKarte(rep: AntragListItem, tvCount: number, nowMs: number): KanbanKarte {
  const sr = naechsterSchritt(rep.status, rep.precheck_status_label ?? '');
  return {
    aktenzeichen: rep.aktenzeichen,
    verbundId: rep.verbund_id?.trim() || null,
    label: rep.akronym?.trim() || rep.titel?.trim() || rep.aktenzeichen,
    schrittText: sr ? (sr.aktion ? `${sr.phase} → ${sr.aktion}` : sr.phase) : '',
    alterTage: alterVon(rep, nowMs),
    tvCount,
  };
}

export interface KanbanLanesErgebnis {
  lanes: KanbanLaneDaten[];
  /** Summe aller Lane-Gesamtzahlen — „N Vorgänge" im Widget-Kopf. */
  gesamt: number;
}

/**
 * Baut die konfigurierten Lanes aus der (bereits gefilterten) Grundmenge:
 * Verbund-Clustering → Kategorie-Zuordnung → Sortierung (ältester Eingang
 * zuerst) → Kappung. Leere Lanes bleiben ERHALTEN (Schmalschiene im Board).
 */
export function buildAntragKanbanLanes(
  antraege: AntragListItem[],
  lanes: KanbanLane[],
  maxKartenProLane: number,
  nowMs: number = Date.now(),
): KanbanLanesErgebnis {
  // Verbund-Clustering: eine Gruppe je verbund_id (Solo = eigenes Aktenzeichen).
  const gruppen = new Map<string, AntragListItem[]>();
  for (const a of antraege) {
    const key = a.verbund_id?.trim() || a.aktenzeichen;
    const arr = gruppen.get(key);
    if (arr) arr.push(a); else gruppen.set(key, [a]);
  }

  const cap = Math.max(1, maxKartenProLane);
  const proKategorie = new Map<StatusCategory, KanbanKarte[]>();
  for (const gruppe of gruppen.values()) {
    // Repräsentant = ältester Eingang (kritischster); ohne Datum ans Ende.
    const sortiert = [...gruppe].sort((a, b) =>
      String(a.antragsdatum ?? '9999').localeCompare(String(b.antragsdatum ?? '9999')));
    const rep = sortiert[0]!;
    const kategorie = getStatusCategory(rep.status);
    const karte = zuKarte(rep, gruppe.length, nowMs);
    const arr = proKategorie.get(kategorie);
    if (arr) arr.push(karte); else proKategorie.set(kategorie, [karte]);
  }

  let gesamt = 0;
  const ergebnis = lanes.map(lane => {
    const alle = proKategorie.get(lane.kategorie) ?? [];
    alle.sort((a, b) => (b.alterTage ?? -1) - (a.alterTage ?? -1));
    gesamt += alle.length;
    return {
      kategorie: lane.kategorie,
      spalten: lane.spalten,
      karten: alle.slice(0, cap),
      gesamt: alle.length,
    };
  });
  return { lanes: ergebnis, gesamt };
}
