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
import { leseSpalten, type TfBahnSpalten } from '@/components/kanban/tfBoardBahn';
import { verschiebeUmEinen } from '@/components/ui/laneFolge';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { KATEGORIE_REIHENFOLGE, istStatusCategory } from '@/core/utils/status-category-labels';
import { schrittText } from '@/core/utils/naechsterSchritt';
import { aufgabenAnzeige, type Aufgabe, type TodoRegel } from '@/core/status';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import {
  antragMatchesBearbeiter,
  applyInaktiveExclusion,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import type { KanbanLane, KanbanWidgetConfig, VollbildLane } from './types';

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
  /** Die Aufgabe der Karte — aus der To-do-Kaskade, sonst die alte Formel. */
  schrittText: string;
  /** „wartet auf QS" / „liegt bei AB"; leer, wenn keine Rolle benannt ist. */
  adresse: string;
  /** Tooltip: die Herleitung bzw. der Grund. */
  titel: string;
  /** Eingangsalter in Tagen (antragsdatum) — null wenn unbekannt. */
  alterTage: number | null;
  /** Gruppengröße des Verbunds (1 = Solo-Antrag). */
  tvCount: number;
}

export interface KanbanLaneDaten {
  kategorie: StatusCategory;
  spalten: TfBahnSpalten;
  /** Sichtbare Karten (gekappt auf maxKartenProLane), ältester Eingang zuerst. */
  karten: KanbanKarte[];
  /** Gesamt-Zahl der Lane (Zähler-Pill; > karten.length ⇒ „+ N weitere →"). */
  gesamt: number;
}

/** Der Inaktiv-Ausschluss als Datum statt als Hook — das Modul bleibt rein. */
export interface InaktivAusschluss {
  /** Kürzel der inaktiven MAs (leer ⇒ No-op). */
  kuerzel: ReadonlySet<string>;
  /** Der Nutzer will sie ausdrücklich sehen ⇒ kein Ausschluss. */
  zeigen: boolean;
}

/** Grundmenge = identische Semantik wie useEingangAmpelCounts/Meine Anträge:
 *  Irrläufer raus, Bearbeiter-Filter (falls aktiv), Anträge inaktiver MAs raus
 *  (nur im „alle"-Modus, v4.131 — er fehlte hier, während Dashboard und
 *  Zieltabelle ihn anwandten). KEIN Status-Filter — die Lanes entscheiden über
 *  die Kategorie. */
export function filtereKanbanGrundmenge(
  antraege: AntragListItem[],
  bearbeiterFilter: BearbeiterFilterMode,
  inaktiv?: InaktivAusschluss,
): AntragListItem[] {
  const gefiltert = antraege.filter(a => {
    if (isIrrlaeufer(a.vb_phase)) return false;
    if (bearbeiterFilter.active && !antragMatchesBearbeiter(a, bearbeiterFilter)) return false;
    return true;
  });
  if (!inaktiv) return gefiltert;
  return applyInaktiveExclusion(gefiltert, bearbeiterFilter.active, inaktiv.kuerzel, inaktiv.zeigen);
}

function alterVon(a: AntragListItem, nowMs: number): number | null {
  // daysSinceEingang nutzt Date.now() — für deterministische Tests rechnen wir
  // hier selbst mit injiziertem nowMs, identische Formel (floor Tage).
  if (!a.antragsdatum) return null;
  const t = Date.parse(String(a.antragsdatum));
  if (Number.isNaN(t)) return null;
  return Math.floor((nowMs - t) / 86_400_000);
}

/**
 * Was die Karte über die Aufgabe weiß — dasselbe Register wie die Startseiten-
 * Zeile und das Vorgangs-Board. Strukturgleich zu dem, was `useZeilenAufgaben`
 * liefert; als eigene Form deklariert, damit dieses Modul rein bleibt.
 */
export interface KartenAufgaben {
  fuer: (aktenzeichen: readonly string[]) => Aufgabe | null;
  laeuftNoch: boolean;
  regeln: readonly TodoRegel[];
}

function zuKarte(
  rep: AntragListItem,
  gruppe: readonly AntragListItem[],
  nowMs: number,
  aufgaben?: KartenAufgaben,
): KanbanKarte {
  // **Die Aufgabe kommt aus der Kaskade, nicht aus dem Rohstatus** (v4.132) —
  // gefaltet über GENAU die Teilvorhaben dieser Karte. Der alte Weg bleibt der
  // Rückfall, wo die Kaskade schweigt.
  const anzeige = aufgabenAnzeige({
    aufgabe: aufgaben ? aufgaben.fuer(gruppe.map(a => a.aktenzeichen)) : null,
    rueckfall: schrittText(rep.status, rep.precheck_status_label ?? ''),
    laeuftNoch: aufgaben?.laeuftNoch === true,
    regeln: aufgaben?.regeln,
    status: rep.status,
  });
  return {
    aktenzeichen: rep.aktenzeichen,
    verbundId: rep.verbund_id?.trim() || null,
    label: rep.akronym?.trim() || rep.titel?.trim() || rep.aktenzeichen,
    schrittText: anzeige.text,
    adresse: anzeige.neben,
    titel: anzeige.titel,
    alterTage: alterVon(rep, nowMs),
    tvCount: gruppe.length,
  };
}

export interface KanbanLanesErgebnis {
  lanes: KanbanLaneDaten[];
  /** Summe der GEZEIGTEN Bahnen — „N Vorgänge" im Widget-Kopf. */
  gesamt: number;
  /**
   * Was in der Grundmenge liegt, aber in keiner gezeigten Bahn steht (v4.131).
   *
   * `gesamt` summiert nur die konfigurierten Kategorien; wer „bewilligt" und
   * „abgeschlossen" nicht als Bahn führt, sah eine Kopfzahl, die sich als
   * Gesamtzahl las und ein Auszug war. Die Zahl steht hier, damit der Kopf sie
   * benennen kann, statt zu schweigen. `0` = die Bahnen decken alles ab.
   */
  ausserhalb: number;
}

/** Karten je Status-Kategorie — die gemeinsame Datengrundlage beider Ansichten.
 *  `Readonly`, weil jeder Konsument nur liest (und niemand die Sortierung kippen
 *  darf, die hier einmal hergestellt wird). */
export type KartenProKategorie = ReadonlyMap<StatusCategory, KanbanKarte[]>;

/**
 * Verbund-Clustering → Kategorie-Zuordnung → Sortierung (ältester Eingang
 * zuerst). Die geteilte Grundlage beider Ansichten: das Widget kappt danach auf
 * die konfigurierten Kategorien, das Fenster projiziert seine eigene Anordnung
 * darauf (`projiziereVollbildLanes`).
 */
export function kartenProKategorie(
  antraege: AntragListItem[],
  nowMs: number = Date.now(),
  aufgaben?: KartenAufgaben,
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
    const karte = zuKarte(rep, gruppe, nowMs, aufgaben);
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
  aufgaben?: KartenAufgaben,
): KanbanLanesErgebnis {
  const proKategorie = kartenProKategorie(antraege, nowMs, aufgaben);
  const cap = Math.max(1, maxKartenProLane);

  let gesamt = 0;
  const gezeigt = new Set<StatusCategory>();
  const ergebnis = lanes.map(lane => {
    const alle = proKategorie.get(lane.kategorie) ?? [];
    // Eine doppelt konfigurierte Kategorie zählt nur einmal in `gesamt`.
    if (!gezeigt.has(lane.kategorie)) {
      gesamt += alle.length;
      gezeigt.add(lane.kategorie);
    }
    return {
      kategorie: lane.kategorie,
      spalten: lane.spalten,
      karten: alle.slice(0, cap),
      gesamt: alle.length,
    };
  });
  let ausserhalb = 0;
  for (const [kategorie, karten] of proKategorie) {
    if (!gezeigt.has(kategorie)) ausserhalb += karten.length;
  }
  return { lanes: ergebnis, gesamt, ausserhalb };
}

/**
 * Ab wie vielen Karten eine Bahn im Fenster zweispaltig VORGESCHLAGEN wird —
 * gemessen, nicht geschätzt: in einem 1600×900-Fenster hat der Kartenbereich
 * einer Bahn 738 px, eine Karte misst mit ihrer Lücke 106 px. Sechs passen also
 * ohne Scrollen; ab der siebten halbiert die zweite Spalte den Weg (gemessen 12
 * statt 6 sichtbare Karten).
 *
 * Seit v4.26 ist das ein **Startvorschlag** und keine Regel: die Zahl geht einmal
 * in den Seed (`seedVollbildLanes`), danach steht im Fenster, was der Nutzer
 * eingestellt hat. Bis dahin überstimmte die Ableitung jede Einstellung — und
 * genau das war der Grund, warum der Schalter im Fenster nichts tat.
 */
export const ZWEISPALTIG_AB = 6;

/**
 * Der Vorschlag, mit dem ein Fenster startet, das noch nie eingerichtet wurde:
 * **alle** Kategorien sichtbar, die konfigurierten zuerst in ihrer Anordnung
 * (der Nutzer hat sie so gelegt), dahinter der Rest in Taxonomie-Reihenfolge;
 * die Spaltenzahl einmalig aus dem Bestand abgeleitet.
 *
 * Damit sieht das erste Öffnen aus wie bisher — nur steht der Anblick ab jetzt
 * IN der Einstellung und nicht daneben. Leere Kategorien sind bewusst dabei: sie
 * stehen als Schiene da („hier ist gerade nichts"), statt zu fehlen, wenn sie
 * angehakt sind. Und sie füllen sich, ohne dass jemand nachjustieren muss.
 */
export function seedVollbildLanes(
  karten: KartenProKategorie,
  konfigurierteLanes: KanbanLane[],
  zweispaltigAb: number = ZWEISPALTIG_AB,
): VollbildLane[] {
  // `Set` über die konfigurierten Kategorien, nicht nur über den Rest: eine
  // doppelt konfigurierte Lane ergäbe sonst zwei Bahnen mit demselben Schlüssel.
  const reihenfolge = [...new Set([
    ...konfigurierteLanes.map(l => l.kategorie),
    ...KATEGORIE_REIHENFOLGE,
  ])];
  return reihenfolge.map((kategorie): VollbildLane => ({
    kategorie,
    spalten: (karten.get(kategorie)?.length ?? 0) > zweispaltigAb ? 2 : 1,
    sichtbar: true,
  }));
}

/**
 * Was das Fenster zeichnet: die sichtbaren Bahnen in ihrer Reihenfolge.
 *
 * Zwei Unterschiede zum Widget, beide beabsichtigt:
 *  - **Keine Kappung.** `maxKartenProLane` beantwortet die Frage „was passt in
 *    eine Widget-Karte" — im eigenen Fenster stellt sie sich nicht.
 *  - **Leere Bahnen bleiben.** Eine angehakte Bahn muss dastehen, sonst
 *    widerspricht die Einstellung dem Bild (das Board macht daraus von selbst
 *    eine Schmalschiene). Weg ist nur, was abgewählt ist.
 *
 * `gesamt` zählt entsprechend nur die sichtbaren Bahnen — die Zahl im Kopf
 * beschreibt, was in diesem Fenster steht.
 */
export function projiziereVollbildLanes(
  karten: KartenProKategorie,
  lanes: readonly VollbildLane[],
): KanbanLanesErgebnis {
  let gesamt = 0;
  const gezeigt = new Set<StatusCategory>();
  const ergebnis: KanbanLaneDaten[] = [];
  for (const lane of lanes) {
    if (!lane.sichtbar) continue;
    const eigene = karten.get(lane.kategorie) ?? [];
    if (!gezeigt.has(lane.kategorie)) {
      gesamt += eigene.length;
      gezeigt.add(lane.kategorie);
    }
    ergebnis.push({
      kategorie: lane.kategorie,
      spalten: lane.spalten,
      karten: eigene,
      gesamt: eigene.length,
    });
  }
  let ausserhalb = 0;
  for (const [kategorie, eigene] of karten) {
    if (!gezeigt.has(kategorie)) ausserhalb += eigene.length;
  }
  return { lanes: ergebnis, gesamt, ausserhalb };
}

/**
 * Gespeicherter Stand → gültige Bahnen-Liste (rein, ohne IDB testbar).
 *
 * Toleranz wie beim Feedback-Board (`parseBoardKanbanConfig`): unbekannte
 * Kategorien und Dubletten fallen raus, die Spaltenzahl geht durch `leseSpalten`,
 * und nur ein ausdrückliches `false` blendet aus. Fehlende Kategorien kommen
 * SICHTBAR hinten dazu — anders als dort, weil hier kein Alt-Format nachzuziehen
 * ist: eine Kategorie, die niemand je gesehen hat, still zu verschlucken wäre
 * eine unsichtbare Lücke im Arbeitsvorrat.
 *
 * Eine Liste ohne einzige sichtbare Bahn bleibt stehen — das ist eine mögliche
 * Nutzer-Entscheidung, und das Fenster sagt sie an, statt sie zu überschreiben.
 */
export function leseVollbildLanes(roh: unknown, seed: VollbildLane[]): VollbildLane[] {
  if (!Array.isArray(roh)) return seed;

  const gesehen = new Set<StatusCategory>();
  const lanes = roh.flatMap((l): VollbildLane[] => {
    if (!l || typeof l !== 'object') return [];
    const { kategorie, spalten, sichtbar } = l as {
      kategorie?: unknown; spalten?: unknown; sichtbar?: unknown;
    };
    // `istStatusCategory` prüft gegen den Katalog, nimmt aber eine Zeichenkette —
    // der gespeicherte Wert kann alles sein.
    if (typeof kategorie !== 'string' || !istStatusCategory(kategorie)) return [];
    if (gesehen.has(kategorie)) return [];
    gesehen.add(kategorie);
    return [{ kategorie, spalten: leseSpalten(spalten), sichtbar: sichtbar !== false }];
  });

  for (const kategorie of KATEGORIE_REIHENFOLGE) {
    if (!gesehen.has(kategorie)) lanes.push({ kategorie, spalten: 1, sichtbar: true });
  }
  return lanes;
}

/** Eine Bahn des Fensters um einen Platz verschieben — dieselbe Arithmetik wie
 *  im Feedback-Board (`verschiebeUmEinen`), am Rand referenzgleich. */
export function verschiebeVollbildLane(
  lanes: VollbildLane[],
  kategorie: StatusCategory,
  richtung: -1 | 1,
): VollbildLane[] {
  return verschiebeUmEinen(lanes, lanes.findIndex(l => l.kategorie === kategorie), richtung);
}
