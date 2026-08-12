/**
 * Reine Lane-Ableitung für das Anträge-Kanban-Widget (testbar ohne React/IDB).
 *
 * Lanes binden an Status-KATEGORIEN (getStatusCategory, Pitfall #12 — nie
 * Roh-Status-Literale). Verbünde erscheinen als EIN Eintrag (Konvention der
 * Meine-Anträge-Liste): Repräsentant ist der älteste Eingang der Gruppe
 * (kritischster), `tvCount` hält die Gruppengröße für die Karten-Metazeile.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { monoLaneAccent } from '@/components/kanban/laneAccent';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { KATEGORIE_REIHENFOLGE } from '@/core/utils/status-category-labels';
import { schrittText } from '@/core/utils/naechsterSchritt';
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

/** Mono-Rampe lebt in @/components/kanban/laneAccent (eine Quelle für alle
 *  Kanbans); hier nur re-exportiert, damit Bestands-Importe gültig bleiben. */
export { monoLaneAccent };

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
  /** Nächste Handlung (`schrittText`), sonst die Status-Kurzform; leer ohne Status. */
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
  return {
    aktenzeichen: rep.aktenzeichen,
    verbundId: rep.verbund_id?.trim() || null,
    label: rep.akronym?.trim() || rep.titel?.trim() || rep.aktenzeichen,
    schrittText: schrittText(rep.status, rep.precheck_status_label ?? ''),
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
 * Verbund-Clustering → Kategorie-Zuordnung → Sortierung (ältester Eingang
 * zuerst). Der geteilte Kern beider Lane-Bauer: das Widget kappt danach auf die
 * konfigurierten Kategorien, das Vollbild nimmt alle.
 */
function clustereNachKategorie(
  antraege: AntragListItem[],
  nowMs: number,
): Map<StatusCategory, KanbanKarte[]> {
  // Verbund-Clustering: eine Gruppe je verbund_id (Solo = eigenes Aktenzeichen).
  const gruppen = new Map<string, AntragListItem[]>();
  for (const a of antraege) {
    const key = a.verbund_id?.trim() || a.aktenzeichen;
    const arr = gruppen.get(key);
    if (arr) arr.push(a); else gruppen.set(key, [a]);
  }

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
  for (const karten of proKategorie.values()) {
    karten.sort((a, b) => (b.alterTage ?? -1) - (a.alterTage ?? -1));
  }
  return proKategorie;
}

/**
 * Baut die konfigurierten Lanes aus der (bereits gefilterten) Grundmenge und
 * kappt sie auf `maxKartenProLane`. Leere Lanes bleiben ERHALTEN (Schmalschiene
 * im Board).
 */
export function buildAntragKanbanLanes(
  antraege: AntragListItem[],
  lanes: KanbanLane[],
  maxKartenProLane: number,
  nowMs: number = Date.now(),
): KanbanLanesErgebnis {
  const proKategorie = clustereNachKategorie(antraege, nowMs);
  const cap = Math.max(1, maxKartenProLane);

  let gesamt = 0;
  const ergebnis = lanes.map(lane => {
    const alle = proKategorie.get(lane.kategorie) ?? [];
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

/**
 * Ab wie vielen Karten eine Bahn im Vollbild zweispaltig wird — gemessen, nicht
 * geschätzt: in einem 1600×900-Fenster hat der Kartenbereich einer Bahn 738 px,
 * eine Karte misst mit ihrer Lücke 106 px. Sechs passen also ohne Scrollen; ab
 * der siebten halbiert die zweite Spalte den Weg (gemessen 12 statt 6 sichtbare
 * Karten).
 *
 * Der Wert bleibt eine Zahl und keine Messung zur Laufzeit: die Bahnen entstehen
 * in einer reinen Funktion, die kein Fenster kennt — und ein Layout, das seine
 * Spaltenzahl beim Ziehen am Fensterrand umwirft, wäre unruhiger als eine Bahn,
 * die einmal zu viel scrollt.
 */
export const ZWEISPALTIG_AB = 6;

/**
 * Die Lanes der VOLLBILD-Ansicht: alles, was Karten hat — auch die Kategorien,
 * die im Widget gar nicht konfiguriert sind und deren Anträge dort deshalb
 * unsichtbar bleiben (bewilligt, erledigt, ohne Zuordnung).
 *
 * Drei Unterschiede zum Widget, alle beabsichtigt:
 *  - **Keine Kappung.** `maxKartenProLane` beantwortet die Frage „was passt in
 *    eine Widget-Karte" — im eigenen Fenster stellt sie sich nicht.
 *  - **Leere Bahnen fallen weg.** Im Widget ist die Schiene eine sinnvolle
 *    Auskunft („hier ist gerade nichts"); neben zwei vollen Bahnen wären neun
 *    Schienen nur Lärm.
 *  - **`spalten` wird abgeleitet.** „Wo viele Karten sind, zweispaltig" ist die
 *    Ansage — die im Widget eingestellte Spaltenzahl gilt hier nicht.
 *
 * Reihenfolge: die konfigurierten Bahnen zuerst in ihrer Anordnung (der Nutzer
 * hat sie so gelegt), dahinter der Rest in Taxonomie-Reihenfolge.
 */
export function buildAlleAntragKanbanLanes(
  antraege: AntragListItem[],
  konfigurierteLanes: KanbanLane[],
  nowMs: number = Date.now(),
  zweispaltigAb: number = ZWEISPALTIG_AB,
): KanbanLanesErgebnis {
  const proKategorie = clustereNachKategorie(antraege, nowMs);

  // `Set` über die konfigurierten Kategorien, nicht nur über den Rest: eine
  // doppelt konfigurierte Lane ergäbe sonst zwei Bahnen mit demselben Schlüssel.
  const reihenfolge = [...new Set([
    ...konfigurierteLanes.map(l => l.kategorie),
    ...KATEGORIE_REIHENFOLGE,
  ])];

  let gesamt = 0;
  const ergebnis: KanbanLaneDaten[] = [];
  for (const kategorie of reihenfolge) {
    const karten = proKategorie.get(kategorie);
    if (!karten || karten.length === 0) continue;
    gesamt += karten.length;
    ergebnis.push({
      kategorie,
      spalten: karten.length > zweispaltigAb ? 2 : 1,
      karten,
      gesamt: karten.length,
    });
  }
  return { lanes: ergebnis, gesamt };
}
