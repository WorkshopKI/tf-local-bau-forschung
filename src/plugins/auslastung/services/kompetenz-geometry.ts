/**
 * Kompetenz-Matrix — Spalten-Geometrie (v2.16, Design-Handoff-Port).
 *
 * EINZIGE Breitenquelle für die dichte Skill-Matrix. `<colgroup>`, die beiden
 * sticky Header-Zeilen und jede Body-Row leiten Breiten + Sticky-Offsets aus
 * demselben `ColMeta[]` ab — so können Header und Body nie auseinanderdriften
 * (Plan-Risiko #1). Die Geometrie ist rein konstanten-getrieben; NIE den DOM
 * messen (der Tab ist bis zur Anzeige `display:none` → Messung läse 0).
 *
 * Frozen-Left: MA + (Kontingent FuE/DS/DL/NW + Abschlag, sofern nicht via
 * Kapazitäten-Toggle ausgeblendet). Frozen-Right: Hauptkat. Comp-Spalten
 * scrollen. `kapHidden` entfernt die Kapazitäts-Spalten komplett aus der
 * Geometrie (robuster als `visibility:collapse`, das in Chrome auf `<col>`
 * unzuverlässig ist) — MA bleibt left:0, Comp rücken nach, Hauptkat right:0.
 */
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket, type KompetenzSchemaEntry } from '../types';
import type { UeberkategorieId } from './default-labels';

/** Spaltenbreiten (px) — verbindlich aus dem Handoff (`README.md` → Table structure). */
export const COL_W = { ma: 46, kont: 54, absch: 62, comp: 48, haupt: 86 } as const;

export type ColKind = 'ma' | 'cap' | 'absch' | 'comp' | 'haupt';

export interface ColMeta {
  /** Stabiler React-Key + Sort-/Hover-Bezug. */
  key: string;
  kind: ColKind;
  width: number;
  /** Nur `cap`: welcher Antragstyp-Bucket. */
  bucket?: AntragstypBucket;
  /** Nur `comp`: Überkategorie-Gruppe. */
  ueberId?: UeberkategorieId;
  /** Nur `comp`: volles Unterkategorie-Label (Tooltip + Reveal-Bar). */
  label?: string;
  /** Nur `comp`: globaler 0-basierter Index über alle Unterkategorien. */
  subIdx?: number;
  /** Frozen-Left: px-Offset von links (Summe vorheriger Frozen-Left-Breiten). */
  stickyLeft?: number;
  /** Frozen-Right: px-Offset von rechts. */
  stickyRight?: number;
  /** Nur `comp`: erste Spalte ihrer Gruppe (linke Perimeter-Kante). */
  gsFirst?: boolean;
  /** Nur `comp`: letzte Spalte ihrer Gruppe (rechte Perimeter-Kante). */
  gsLast?: boolean;
}

export interface GroupMeta {
  ueberId: UeberkategorieId;
  label: string;
  /** Anzahl Unterkategorien (colspan des Bandes). */
  span: number;
  /** Globaler subIdx der ersten Unterkategorie der Gruppe. */
  start: number;
}

export interface Geometry {
  cols: ColMeta[];
  groups: GroupMeta[];
  totalSubCols: number;
  /** Gesamtbreite des Frozen-Left-Blocks (MA [+ Kapazität]). */
  leftFrozenWidth: number;
}

/**
 * Baut die Spalten-Geometrie aus dem Kompetenz-Schema. `kapHidden` blendet den
 * Kapazitäts-Block (FuE/DS/DL/NW + Abschlag) aus. Reihenfolge der Comp-Spalten
 * = Schema-Reihenfolge (= XLSX-Reihenfolge). Pure + memoisierbar pro
 * `(schema-identity, kapHidden)`.
 */
export function buildGeometry(schema: KompetenzSchemaEntry[], kapHidden: boolean): Geometry {
  const cols: ColMeta[] = [];
  const groups: GroupMeta[] = [];

  // ── Frozen-Left: MA ──────────────────────────────────────────────────────
  let left = 0;
  cols.push({ key: 'ma', kind: 'ma', width: COL_W.ma, stickyLeft: left });
  left += COL_W.ma;

  // ── Frozen-Left: Kapazität (optional) ────────────────────────────────────
  if (!kapHidden) {
    for (const bucket of ALL_ANTRAGSTYP_BUCKETS) {
      cols.push({ key: `cap:${bucket}`, kind: 'cap', width: COL_W.kont, bucket, stickyLeft: left });
      left += COL_W.kont;
    }
    cols.push({ key: 'absch', kind: 'absch', width: COL_W.absch, stickyLeft: left });
    left += COL_W.absch;
  }
  const leftFrozenWidth = left;

  // ── Comp-Spalten (scrollen) ──────────────────────────────────────────────
  let subIdx = 0;
  for (const entry of schema) {
    const span = entry.subKategorien.length;
    if (span === 0) continue; // colspan 0 wäre invalides <th> (Plan-Risiko #6)
    groups.push({ ueberId: entry.ueberId, label: entry.label, span, start: subIdx });
    entry.subKategorien.forEach((label, i) => {
      cols.push({
        key: `c:${entry.ueberId}:${i}`,
        kind: 'comp',
        width: COL_W.comp,
        ueberId: entry.ueberId,
        label,
        subIdx,
        gsFirst: i === 0,
        gsLast: i === span - 1,
      });
      subIdx += 1;
    });
  }

  // ── Frozen-Right: Hauptkat ───────────────────────────────────────────────
  cols.push({ key: 'haupt', kind: 'haupt', width: COL_W.haupt, stickyRight: 0 });

  return { cols, groups, totalSubCols: subIdx, leftFrozenWidth };
}
