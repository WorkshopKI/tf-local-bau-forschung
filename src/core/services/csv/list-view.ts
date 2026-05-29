import type { Antrag, AntragListItem } from './types';

/**
 * Projiziert einen vollen `Antrag` auf das schmale `AntragListItem`.
 * Single-Source-of-Truth fuer das Mapping — Importer und Bulk-Migration
 * rufen diese Funktion auf, damit beide Schreib-Pfade identisch projizieren.
 *
 * Whitelist liegt in `csv/constants.ts` (LIST_VIEW_FIELDS). Alle Felder
 * sind optional ausser `aktenzeichen`, `programm_id`, `_updated_at` —
 * diese sind im Antrag-Type Pflicht.
 *
 * Sicherheits-Coercion: nicht-string-Werte werden NICHT geschrieben —
 * der Slim-Type erwartet `string | undefined`.
 */
export function toAntragListItem(antrag: Antrag): AntragListItem {
  const item: AntragListItem = {
    aktenzeichen: antrag.aktenzeichen,
    programm_id: antrag.programm_id,
    _updated_at: antrag._updated_at,
  };
  copyStringField(antrag, item, 'titel');
  copyStringField(antrag, item, 'akronym');
  copyStringField(antrag, item, 'status');
  copyStringField(antrag, item, 'antragsteller');
  copyStringField(antrag, item, 'branche');
  copyStringField(antrag, item, 't_xsw');
  copyStringField(antrag, item, 'frist_datum');
  copyStringField(antrag, item, 'bewilligung_datum');
  copyStringField(antrag, item, 'antragsdatum');
  copyStringField(antrag, item, 'vn_eingang_datum');
  copyStringField(antrag, item, 'laufzeitbeginn');
  copyStringField(antrag, item, 'laufzeitende');
  copyStringField(antrag, item, 'ort_ast');
  copyStringField(antrag, item, 'foerdergeber');
  copyStringField(antrag, item, 'verbund_id');
  copyStringField(antrag, item, 'unterprogramm_id');
  copyStringField(antrag, item, 'tib_kuerz');
  copyStringField(antrag, item, 'bib_kuerz');
  copyStringField(antrag, item, 'ztp_kuerz');
  copyStringField(antrag, item, 'pfm_kuerz');
  copyNumberField(antrag, item, 'vb_phase');
  copyNumberField(antrag, item, 'foerdersumme');
  return item;
}

function copyStringField(
  src: Antrag,
  dst: AntragListItem,
  key: Exclude<keyof AntragListItem, 'aktenzeichen' | 'programm_id' | '_updated_at'>,
): void {
  const v = (src as unknown as Record<string, unknown>)[key];
  if (typeof v === 'string' && v.length > 0) {
    (dst as unknown as Record<string, unknown>)[key] = v;
  }
}

/** Wie `copyStringField`, aber für numerische Felder (z.B. `vb_phase`). Konvertiert
 *  string-Werte aus dem Merger tolerant ("3" → 3), damit auch Alt-Importe ohne
 *  type: 'number'-Mapping noch sauber projizieren. */
function copyNumberField(
  src: Antrag,
  dst: AntragListItem,
  key: Exclude<keyof AntragListItem, 'aktenzeichen' | 'programm_id' | '_updated_at'>,
): void {
  const v = (src as unknown as Record<string, unknown>)[key];
  if (typeof v === 'number' && Number.isFinite(v)) {
    (dst as unknown as Record<string, unknown>)[key] = v;
    return;
  }
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) {
      (dst as unknown as Record<string, unknown>)[key] = n;
    }
  }
}
