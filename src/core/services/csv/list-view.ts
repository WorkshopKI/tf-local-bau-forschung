import type { Antrag, AntragListItem } from './types';
import { computeStatusDatum, type ResolvedStatusDatumGruppe } from './status-datum-gruppen';

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
 *
 * `gruppen` (optional): die pro Programm aufgelösten Datums-Status-Gruppen
 * (siehe `status-datum-gruppen.ts`). Wenn gesetzt, werden je Gruppe die beiden
 * Slim-Felder (`<id>_status_label`/`_datum`) aus dem jüngsten gültigen Datum
 * berechnet. Ohne den Param bleiben die Felder leer (Tests / Alt-Caller) —
 * bewusst `Array.isArray`-gegated, damit ein versehentliches
 * `.map(toAntragListItem)` (Index als 2. Arg) nichts setzt statt zu crashen.
 */
export function toAntragListItem(antrag: Antrag, gruppen?: readonly ResolvedStatusDatumGruppe[]): AntragListItem {
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
  copyStringField(antrag, item, 'erstentscheidung');
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
  // Auslastungs-Modul (v2.63, Projektion v2): billige Skalare, damit der
  // Auslastungs-Cache mit der Slim-Projektion auskommt. Bei Erweiterung hier
  // IMMER LIST_VIEW_PROJECTION_VERSION (list-view-migration.ts) bumpen —
  // sonst bekommen Bestandsinstallationen die neuen Felder nie.
  copyStringField(antrag, item, 't_hint');
  copyStringField(antrag, item, 'd_xtec');
  copyStringField(antrag, item, 'd_adv');
  copyStringField(antrag, item, 'tib_mail');
  copyStringField(antrag, item, 'verbund_titel');
  copyNumberField(antrag, item, 'vb_phase');
  copyNumberField(antrag, item, 'foerdersumme');
  // Datums-Status-Gruppen (Projektion v4): je Gruppe das jüngste gültige Datum
  // über die aufgelösten Legacy-Spalten → Label + Datum in die gruppen-eigenen
  // Slim-Felder. Nur wenn der Aufrufer die Gruppen aufgelöst durchreicht
  // (Schema-abhängig, pro Programm).
  if (Array.isArray(gruppen)) {
    const rec = antrag as unknown as Record<string, unknown>;
    const dst = item as unknown as Record<string, unknown>;
    for (const g of gruppen) {
      if (g.felder.length === 0) continue;
      const res = computeStatusDatum(rec, g.felder);
      if (res) {
        dst[g.labelKey] = res.label;
        dst[g.datumKey] = res.datum;
      }
    }
  }
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
