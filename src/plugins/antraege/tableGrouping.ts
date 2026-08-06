/**
 * Die **zwei Achsen** der Tabellen-Ansicht der Förderanträge ("compact"-View-Mode).
 *
 * Bis v3.0 steckten beide in einem Schalter, und das ging schief: „Verbund" stand
 * als Gruppierung neben „Status", tat aber etwas völlig anderes — es **verdichtete**
 * die Teilvorhaben eines Verbundes zu EINER Zeile, statt Abschnitte zu bilden.
 * Dadurch schlossen sich die beiden aus: wer nach Status gruppieren wollte, musste
 * die Verdichtung aufgeben. Seither sind es zwei unabhängige Schalter:
 *
 * - **Ansicht** (`TabellenAnsicht`) — die Zeilen-Körnung. `antrag`: Multi-TV-
 *   Verbünde werden zu einer aggregierten Zeile kollabiert (Solo-Anträge bleiben
 *   eine normale Zeile). `antrag-mit-tv`: jedes Teilvorhaben ist eine eigene Zeile.
 * - **Gruppierung** (`TableGroupingMode`) — die Abschnitts-Bänder über den Zeilen:
 *   keine / Status / Netzwerk / FB (TIB) / AB (BIB).
 *
 * Reihenfolge: **erst verdichten, dann gruppieren.** Eine Verbund-Zeile trägt die
 * Werte ihres Lead-TVs (Kürzel, FKZ) bzw. die Aggregate (Status, Summe, Datum) —
 * sie wird also nach dem Kürzel des Leads einsortiert.
 *
 * Die Karten-/Listen-Ansicht hat ihre eigene, größere Options-Liste
 * (`GROUPING_OPTIONS` in sort.ts) und kennt die Ansicht-Achse nicht: dort gibt es
 * keine Verbund-Verdichtung. Persistenz läuft über zwei eigene Store-Slots
 * (`tableGroupingByView`, `tableAnsichtByView`), siehe store.ts.
 */
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import {
  buildAntragGroups,
  statusPhaseForAntrag,
  statusSectionLabel,
  STATUS_SECTION_ORDER,
  type StatusSectionId,
} from './antragGroups';
import { extractNetzwerkId } from './netzwerk';
import { dominantStatus, sumFoerdersumme, verbundFkz } from './groupAggregates';

// --------------------------------------------------------------------------
// Achse 1: Ansicht (Zeilen-Körnung)
// --------------------------------------------------------------------------

/** Was EINE Tabellenzeile darstellt. */
export type TabellenAnsicht =
  /** Ein Antrag je Zeile — Verbünde als eine aggregierte Zeile. */
  | 'antrag'
  /** Ein Teilvorhaben je Zeile — Verbünde aufgefaltet. */
  | 'antrag-mit-tv';

/** Source-of-Truth für die „Ansicht"-Pille (Reihenfolge = UI-Reihenfolge). */
export const TABLE_ANSICHT_OPTIONS: readonly { key: TabellenAnsicht; label: string }[] = [
  { key: 'antrag', label: 'Antrag' },
  { key: 'antrag-mit-tv', label: 'Antrag mit TV' },
];

export const DEFAULT_TABLE_ANSICHT: TabellenAnsicht = 'antrag';

const TABLE_ANSICHT_KEYS: ReadonlySet<string> = new Set(TABLE_ANSICHT_OPTIONS.map(o => o.key));

/** Whitelist für persistierte Werte — wohnt bei den Optionen, damit die
 *  Persistenz nicht an einer zweiten Literal-Liste vorbeidriftet. */
export function istTabellenAnsicht(v: unknown): v is TabellenAnsicht {
  return typeof v === 'string' && TABLE_ANSICHT_KEYS.has(v);
}

// --------------------------------------------------------------------------
// Achse 2: Gruppierung (Abschnitts-Bänder)
// --------------------------------------------------------------------------

export type TableGroupingMode = 'none' | 'status' | 'netzwerk' | 'fb' | 'ab';

/** Source-of-Truth für die „Gruppierung"-Pille im Compact-Modus (Reihenfolge =
 *  UI-Reihenfolge). Wird auch von der Persistenz als Whitelist gelesen (store.ts)
 *  — ein hier fehlender Modus überlebt keinen Reload. */
export const TABLE_GROUPING_OPTIONS: readonly { key: TableGroupingMode; label: string }[] = [
  { key: 'none', label: 'Keine' },
  { key: 'status', label: 'Status' },
  { key: 'netzwerk', label: 'NW' },
  { key: 'fb', label: 'FB' },
  { key: 'ab', label: 'AB' },
];

/** Standard-Gruppierung der Tabelle — flach. Gelesen vom Store-Selektor UND vom
 *  Darstellungs-Menü (das daran erkennt, ob die Achse vom Standard abweicht). */
export const DEFAULT_TABLE_GROUPING: TableGroupingMode = 'none';

const TABLE_GROUPING_KEYS: ReadonlySet<string> = new Set(TABLE_GROUPING_OPTIONS.map(o => o.key));

/**
 * Whitelist für persistierte Werte. Aus den Optionen abgeleitet, nicht
 * handgeschrieben — eine zweite Literal-Liste driftete stumm an jedem neuen
 * Modus vorbei (persistiert wird ein `string`, TypeScript meldet nichts).
 *
 * Nebeneffekt und so gewollt: das bis v3.0 mögliche `'verbund'` fällt hier durch
 * und landet auf dem Default `'none'`. Die Verbund-Verdichtung ist seither keine
 * Gruppierung mehr, sondern die Ansicht — und deren Default (`'antrag'`) tut
 * genau das, was der Altwert meinte.
 */
export function istTableGroupingMode(v: unknown): v is TableGroupingMode {
  return typeof v === 'string' && TABLE_GROUPING_KEYS.has(v);
}

/** Metadaten, die eine kollabierte Verbund-Zeile von einer normalen TV-Zeile
 *  unterscheiden. Nur bei Multi-TV-Verbünden gesetzt. */
export interface VerbundRowMeta {
  verbundId: string;
  tvCount: number;
  /** FKZ-Range bzw. gepflegtes Verbund-FKZ für die FKZ-Zelle. */
  fkzRange: string;
  /** Alle TVs des Verbundes (für Aggregat-Renderer: Ampel, kritischste Frist). */
  tvs: AntragListItem[];
}

/** Zeilen-Typ der Tabelle. Superset von `AntragListItem` — Solo-/TV-Zeilen
 *  lassen `_verbund` weg, daher in beiden Ansichten verwendbar. */
export type AntragTableRow = AntragListItem & {
  _verbund?: VerbundRowMeta;
  /** Denormalisierter Verbund-Titel (aus `verbundById`) — fuer die „VB Titel"-
   *  Spalte, da Verbund-Level-Felder nicht in `AntragListItem` projiziert sind.
   *  Wird in `AntraegeTable` (Tabelle) bzw. im Export an die Row angehaengt. */
  verbund_titel?: string;
};

/**
 * Ansicht „Antrag": pro Antrag eine Zeile. Multi-TV-Verbünde werden zu einer
 * aggregierten Synthetik-Zeile zusammengefasst (Status = dominanter Status,
 * Antragsdatum = spätestes TV-Datum, Zuwendung = Summe). Solo-Anträge (1 TV)
 * bleiben unverändert.
 */
export function buildVerbundTableRows(
  filtered: AntragListItem[],
  verbundById: Map<string, Verbund> | null,
): AntragTableRow[] {
  const groups = buildAntragGroups(filtered, { mode: 'verbund', verbundById });
  return groups.map((g): AntragTableRow => {
    // Solo (1 TV) oder ungeclustert → unveränderte TV-Zeile.
    if (g.tvs.length < 2 || g.verbundId === null) return g.tvs[0]!;
    const tvs = g.tvs;
    const lead = tvs[0]!;
    const verbund = verbundById?.get(g.verbundId);
    const dom = dominantStatus(tvs, verbund?.status);
    return {
      ...lead,
      akronym: verbund?.akronym ?? lead.akronym,
      status: dom != null ? asAntragStatusRaw(dom) : lead.status,
      antragsdatum: verbundAntragsdatum(tvs) ?? lead.antragsdatum,
      foerdersumme: sumFoerdersumme(tvs) ?? lead.foerdersumme,
      _verbund: {
        verbundId: g.verbundId,
        tvCount: tvs.length,
        fkzRange: verbundFkz(verbund, tvs),
        tvs,
      },
    };
  });
}

// --------------------------------------------------------------------------
// Sektionierte Gruppierungen
// --------------------------------------------------------------------------

/**
 * Die einheitliche Rückgabeform aller sektionierten Gruppierungen. Die Tabelle
 * hat damit EINEN Pfad für alle Bänder statt einer Fallunterscheidung je Modus.
 *
 * `labelOf` gehört bewusst dazu: der Abschnitts-Schlüssel ist eine stabile Id
 * (Status-Abschnitt, Netzwerk-Id, Kürzel), keine Beschriftung. Bis v3.0 zeichnete
 * die Tabelle den Schlüssel roh ins Band — die Status-Gruppierung las sich als
 * „VOR-ENTSCHEIDUNG" statt „Vor Entscheidung".
 */
export interface SektionsZeilen {
  /** Zeilen in Abschnitts-Reihenfolge, kontiguierlich je Abschnitt. Innen-
   *  Reihenfolge = Eingabe (= primärer Sort der `filtered`-Pipeline). */
  rows: AntragTableRow[];
  /** Abschnitts-Zuordnung pro Zeile (für `sectionKeyOf` der SortableTable). */
  sectionOf: (row: AntragTableRow) => string;
  /** Beschriftung eines Abschnitts-Schlüssels (für `renderSectionHeader`). */
  labelOf: (key: string) => string;
}

/**
 * Status-Modus: jede Zeile bleibt eine Zeile, gebucketet per eigenem Status in
 * STATUS_SECTION_ORDER. Keine Verbund-Zusammenfassung (die macht die Ansicht-
 * Achse). Leere Abschnitte werden ausgelassen.
 */
export function buildStatusSectionRows(filtered: AntragTableRow[]): SektionsZeilen {
  const buckets = new Map<StatusSectionId, AntragTableRow[]>();
  for (const phase of STATUS_SECTION_ORDER) buckets.set(phase, []);
  for (const a of filtered) buckets.get(statusPhaseForAntrag(a))!.push(a);
  const rows: AntragTableRow[] = [];
  for (const phase of STATUS_SECTION_ORDER) {
    const bucket = buckets.get(phase)!;
    if (bucket.length > 0) rows.push(...bucket);
  }
  return {
    rows,
    sectionOf: statusPhaseForAntrag,
    labelOf: key => statusSectionLabel(key as StatusSectionId),
  };
}

/** Abschnitts-Schlüssel für Zeilen ohne 16KN-Netzwerk. */
const OHNE_NETZWERK = '__ohne_netzwerk__';

/**
 * Netzwerk-Modus: Zeilen nach 4-Ziffer-Netzwerk-Id aus dem 16KN-FKZ gebändert.
 * Nutzt die Gruppierungs-Engine (`mode: 'netzwerk'`) und damit deren Namens-
 * Auflösung inkl. Cross-Programm-Index — die Bänder heißen „INNOWERK · Phase 1 + 2"
 * statt „Netzwerk 1062", wo der Lead bekannt ist.
 *
 * Ein Unterschied zur Karten-Ansicht: die Engine lässt Anträge ohne 16KN-Präfix
 * an ihrer Eingabe-Position zwischen den Netzwerken stehen. In einer Tabelle
 * ergäbe das bei jedem Solo-Lauf ein neues „Ohne Netzwerk"-Band. Hier wandern
 * sie deshalb gesammelt in EINEN Abschluss-Abschnitt.
 */
export function buildNetzwerkSectionRows(
  filtered: AntragTableRow[],
  netzwerkNames: Map<string, string> | null,
): SektionsZeilen {
  const groups = buildAntragGroups(filtered, { mode: 'netzwerk', netzwerkNames });
  const labels = new Map<string, string>();
  const rows: AntragTableRow[] = [];
  const ohne: AntragTableRow[] = [];
  for (const g of groups) {
    if (g.netzwerkId === null) {
      ohne.push(...g.tvs);
      continue;
    }
    labels.set(g.netzwerkId, g.netzwerkLabel ?? `Netzwerk ${g.netzwerkId}`);
    rows.push(...g.tvs);
  }
  rows.push(...ohne);
  return {
    rows,
    sectionOf: row => extractNetzwerkId(row.aktenzeichen) ?? OHNE_NETZWERK,
    labelOf: key =>
      key === OHNE_NETZWERK ? 'Ohne Netzwerk' : labels.get(key) ?? `Netzwerk ${key}`,
  };
}

/**
 * Die Kürzel-Spalte einer Rolle. Der Rollen-Zuschnitt ist derselbe wie im
 * Bearbeiter-Filter (`ROLLEN_SPALTEN` in bearbeiterFilter.ts): **FB in TIB,
 * AB in BIB**.
 *
 * `bfm_kuerz` (dort als zweite AB-Spalte gelistet) bleibt hier bewusst außen vor:
 * die Spalte steht in keinem importierten Schema und ist nicht Teil der schmalen
 * Listen-Projektion — als Gruppierungs-Achse wäre sie durchgehend leer.
 */
export type KuerzelFeld = 'tib_kuerz' | 'bib_kuerz';

/** Abschnitts-Schlüssel für Zeilen ohne gepflegtes Kürzel. */
const OHNE_KUERZEL = '__ohne_kuerzel__';

const OHNE_KUERZEL_LABEL: Record<KuerzelFeld, string> = {
  tib_kuerz: 'ohne FB',
  bib_kuerz: 'ohne AB',
};

/** Schlüssel + Anzeige-Schreibweise eines Kürzels. NFC vor jedem Vergleich —
 *  die Umlaut-Kürzel (THÜ, …) kommen je nach Quelle in beiden Unicode-Normal-
 *  formen an und ergäben sonst zwei Abschnitte für dieselbe Person (Pitfall #22). */
function kuerzelSchluessel(
  row: AntragTableRow,
  feld: KuerzelFeld,
): { key: string; label: string | null } {
  const raw = row[feld];
  if (typeof raw !== 'string') return { key: OHNE_KUERZEL, label: null };
  const norm = raw.normalize('NFC').trim();
  if (norm.length === 0) return { key: OHNE_KUERZEL, label: null };
  return { key: norm.toUpperCase(), label: norm };
}

/**
 * FB-/AB-Modus: Zeilen nach dem Kürzel der jeweiligen Rolle gebändert,
 * alphabetisch (deutsche Kollation), Zeilen ohne Kürzel immer im letzten
 * Abschnitt. Innerhalb eines Abschnitts bleibt die Eingabe-Reihenfolge.
 */
export function buildKuerzelSectionRows(
  filtered: AntragTableRow[],
  feld: KuerzelFeld,
): SektionsZeilen {
  const buckets = new Map<string, AntragTableRow[]>();
  const labels = new Map<string, string>();
  for (const row of filtered) {
    const { key, label } = kuerzelSchluessel(row, feld);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      if (label !== null) labels.set(key, label);
    }
    bucket.push(row);
  }
  const keys = [...buckets.keys()]
    .filter(k => k !== OHNE_KUERZEL)
    .sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b, 'de'));
  if (buckets.has(OHNE_KUERZEL)) keys.push(OHNE_KUERZEL);
  const rows: AntragTableRow[] = [];
  for (const key of keys) rows.push(...buckets.get(key)!);
  return {
    rows,
    sectionOf: row => kuerzelSchluessel(row, feld).key,
    labelOf: key =>
      key === OHNE_KUERZEL ? OHNE_KUERZEL_LABEL[feld] : labels.get(key) ?? key,
  };
}
