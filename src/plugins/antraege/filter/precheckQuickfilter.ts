/**
 * PreCheck-Quickfilter: klassifiziert den `precheck_status_label` eines Antrags
 * in eine von drei fachlichen Klassen (positiv / negativ / offen) und filtert
 * die Liste danach.
 *
 * Anders als Status/Antragstyp (exakter Feld-Wert-Match über die generische
 * Filter-Engine) ist PreCheck eine **abgeleitete Klassifikation** — das Label
 * ist Label-XLS-getrieben (z.B. „PreCheck positiv - Verbund" oder roher Code
 * `D_PC+`). Ein exakter Multi-Select-Match wäre datenabhängig und fragil.
 * Deshalb läuft dieser Filter als eigener, client-seitiger Pipeline-Schritt in
 * `useFilteredAntraege` (analog Bearbeiter-Filter) über einen Store-Slot —
 * **nicht** über `useFilterState.active`. Folge: er erzeugt **keinen**
 * Filter-Chip (Design-Vorgabe: Quickfilter-Segmente = keine Chips).
 *
 * Die Klassifikation kommt aus der geteilten Kern-Formel `normalisierePrecheck`
 * (single source of truth, auch von der „Phase → nächster Schritt"-Formel
 * genutzt). Dort gilt: `'ohne'` (kein PreCheck-Datum) und `'offen'` (ausstehend,
 * z.B. `D_PC?`) werden gleich behandelt — hier zu **einem** Bucket „offen"
 * zusammengefasst, damit die vier Buckets die Liste exakt partitionieren
 * (Alle = positiv + negativ + offen).
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { normalisierePrecheck, precheckUrteil } from '@/core/utils/naechsterSchritt';
import type { CollapsibleSegItem } from './CollapsibleSeg';

/** Sichtbarer Bucket in der PreCheck-Pille. */
export type PrecheckBucket = 'Alle' | 'positiv' | 'negativ' | 'offen';

export const PRECHECK_BUCKET_ORDER: readonly PrecheckBucket[] = ['Alle', 'positiv', 'negativ', 'offen'];

/**
 * Ordnet ein `precheck_status_label` einem der drei Nicht-Alle-Buckets zu.
 * `'ohne'` (leer) und `'offen'` (ausstehend) fallen beide in „offen".
 */
export function classifyPrecheckBucket(label: string | null | undefined): Exclude<PrecheckBucket, 'Alle'> {
  const k = normalisierePrecheck(label);
  if (k === 'positiv') return 'positiv';
  if (k === 'negativ') return 'negativ';
  return 'offen'; // 'offen' | 'ohne'
}

/**
 * Der Bucket eines Antrags aus **beiden** PreCheck-Teilen (seit v6.65).
 *
 * Vorher las die Pille nur die gemeinsame Spalte, in der das jüngste Datum
 * gewann — 256 Anträge mit negativem TV-PreCheck standen deshalb unter
 * „positiv" (`precheckUrteil`).
 */
export function bucketVonAntrag(item: AntragListItem): Exclude<PrecheckBucket, 'Alle'> {
  const { klasse } = precheckUrteil({
    tv: item.precheck_tv_status_label,
    vb: item.precheck_vb_status_label,
  });
  return klasse === 'positiv' || klasse === 'negativ' ? klasse : 'offen';
}

/** True, wenn der Antrag in den gewählten Bucket fällt (`'Alle'` matcht immer). */
export function matchesPrecheckBucket(item: AntragListItem, bucket: PrecheckBucket): boolean {
  if (bucket === 'Alle') return true;
  return bucketVonAntrag(item) === bucket;
}

/** Reiner Filter-Schritt für die Antrags-Pipeline. */
export function applyPrecheckBucket(list: AntragListItem[], bucket: PrecheckBucket): AntragListItem[] {
  if (bucket === 'Alle') return list;
  return list.filter(a => matchesPrecheckBucket(a, bucket));
}

/**
 * Items für die `CollapsibleSeg`: Alle + positiv/negativ/offen, jeweils mit
 * Count über die (Kürzel-gefilterte, stabile) `countBase` — gleiche Stabilitäts-
 * Regel wie Status/Antragstyp.
 */
export function getPrecheckItems(countBase: AntragListItem[]): CollapsibleSegItem[] {
  const counts: Record<Exclude<PrecheckBucket, 'Alle'>, number> = {
    positiv: 0,
    negativ: 0,
    offen: 0,
  };
  for (const a of countBase) {
    counts[bucketVonAntrag(a)]++;
  }
  return [
    { label: 'Alle', count: countBase.length },
    { label: 'positiv', count: counts.positiv },
    { label: 'negativ', count: counts.negativ },
    { label: 'offen', count: counts.offen },
  ];
}

/** Schmales, validierendes Parse eines Bucket-Labels (für Store-Setter). */
export function asPrecheckBucket(v: unknown): PrecheckBucket {
  return v === 'positiv' || v === 'negativ' || v === 'offen' ? v : 'Alle';
}
