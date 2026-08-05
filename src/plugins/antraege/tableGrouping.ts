/**
 * Gruppierung für die Tabellen-Ansicht der Förderanträge ("compact"-View-Mode).
 *
 * Eigene, kleinere Options-Liste als die List-View-Pille (Keine/Status/NW/NW-
 * Größe): die Tabelle bietet nur **Keine / Verbund / Status** — „Verbund"
 * (pro Verbund eine Zeile) existiert als Top-Level-Option ausschließlich hier,
 * „NW/NW-Größe" sind hier nicht gewünscht. Persistenz läuft über einen eigenen
 * Store-Slot (`tableGroupingByView`), siehe store.ts.
 *
 * Zwei Verhalten:
 * - `verbund`: Multi-TV-Verbünde werden zu EINER aggregierten Zeile kollabiert
 *   (Solo-Anträge bleiben eine normale Zeile). Reuse der Gruppierungs-Engine
 *   `buildAntragGroups({ mode:'verbund' })` + der Cluster-Aggregat-Helfer.
 * - `status`: jedes TV bleibt eine eigene Zeile, nur in Status-Bänder
 *   einsortiert (Per-TV via `statusPhaseForAntrag`, KEINE Verbund-
 *   Zusammenfassung — bewusste Abgrenzung zur List-View).
 */
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import {
  buildAntragGroups,
  statusPhaseForAntrag,
  STATUS_SECTION_ORDER,
  type StatusSectionId,
} from './antragGroups';
import { dominantStatus, sumFoerdersumme, verbundFkz } from './groupAggregates';

export type TableGroupingMode = 'none' | 'verbund' | 'status';

/** Source-of-Truth für die „Gruppiert"-Pille im Compact-Modus (Reihenfolge =
 *  UI-Reihenfolge). */
export const TABLE_GROUPING_OPTIONS: readonly { key: TableGroupingMode; label: string }[] = [
  { key: 'none', label: 'Keine' },
  { key: 'verbund', label: 'Verbund' },
  { key: 'status', label: 'Status' },
];

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

/** Zeilen-Typ der Tabelle. Superset von `AntragListItem` — Solo-/Status-Zeilen
 *  lassen `_verbund` weg, daher in allen drei Modi (none/verbund/status)
 *  verwendbar. */
export type AntragTableRow = AntragListItem & {
  _verbund?: VerbundRowMeta;
  /** Denormalisierter Verbund-Titel (aus `verbundById`) — fuer die „VB Titel"-
   *  Spalte, da Verbund-Level-Felder nicht in `AntragListItem` projiziert sind.
   *  Wird in `AntraegeTable` (Tabelle) bzw. im Export an die Row angehaengt. */
  verbund_titel?: string;
};

/**
 * Verbund-Modus: pro Verbund eine Zeile. Multi-TV-Verbünde werden zu einer
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

export interface StatusSectionRows {
  /** TVs in Section-Reihenfolge (STATUS_SECTION_ORDER), Innen-Reihenfolge =
   *  Eingabe (= primärer Sort der `filtered`-Pipeline). Kontiguierlich pro
   *  Phase — die Tabelle zeichnet beim Phasen-Wechsel ein Band. */
  rows: AntragTableRow[];
  /** Phase-Zuordnung pro Zeile (für `sectionKeyOf` der SortableTable). */
  sectionOf: (row: AntragTableRow) => StatusSectionId;
}

/**
 * Status-Modus: jedes TV einzeln, gebucketet per eigenem Status in
 * STATUS_SECTION_ORDER. Keine Verbund-Zusammenfassung. Leere Phasen werden
 * ausgelassen.
 */
export function buildStatusSectionRows(filtered: AntragListItem[]): StatusSectionRows {
  const buckets = new Map<StatusSectionId, AntragListItem[]>();
  for (const phase of STATUS_SECTION_ORDER) buckets.set(phase, []);
  for (const a of filtered) buckets.get(statusPhaseForAntrag(a))!.push(a);
  const rows: AntragTableRow[] = [];
  for (const phase of STATUS_SECTION_ORDER) {
    const bucket = buckets.get(phase)!;
    if (bucket.length > 0) rows.push(...bucket);
  }
  return { rows, sectionOf: statusPhaseForAntrag };
}
