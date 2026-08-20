import type { Antrag, AntragListItem } from './types';
import {
  computeStatusDatum,
  type ResolvedKategorieSpalten, type ResolvedStatusDatumGruppe,
} from './status-datum-gruppen';
import { baueFreiRoh } from '@/core/spalten/projektion';
import type { FreiesFeld } from '@/core/spalten/aufloesung';

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
export function toAntragListItem(
  antrag: Antrag,
  gruppen?: readonly ResolvedStatusDatumGruppe[],
  kategorieSpalten?: readonly ResolvedKategorieSpalten[],
  freieFelder?: readonly FreiesFeld[],
): AntragListItem {
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
  // `T_XSW` liegt je nach Mapping unter dem kanonischen `t_xsw` ODER — so in den
  // produktiven Schemas — unter dem Custom-Key `wiedereinreicher` (gemessen:
  // `t_xsw` 0 von 14 225, `wiedereinreicher` 1 452 gefüllt). Ohne den Rückfall
  // erreichte der Wiedereinreicher-Hinweis die Listen-/Home-Ansichten nie (v4.124).
  copyStringFieldMitRueckfall(antrag, item, 't_xsw', ['wiedereinreicher']);
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
  // Ordner-Spalten (Projektion v6): dieselbe Mechanik, nur kuratiert statt im
  // Code — die Schlüssel folgen dem Statuskatalog. Leere Ordner werden nicht
  // geschrieben, damit das Slim-Item nicht mit leeren Objekten aufläuft.
  if (Array.isArray(kategorieSpalten) && kategorieSpalten.length > 0) {
    const rec = antrag as unknown as Record<string, unknown>;
    const kat: Record<string, { l: string; d: string }> = {};
    for (const k of kategorieSpalten) {
      const res = computeStatusDatum(rec, k.felder);
      if (res) kat[k.kategorieId] = { l: res.label, d: res.datum };
    }
    if (Object.keys(kat).length > 0) item.kat_status = kat;
  }
  // Selbst angelegte Spalten (Projektion v7): NUR die Rohwerte der Felder, die
  // eine solche Spalte liest — nicht ihr Ergebnis. Damit bleiben Datumsregeln
  // beim Rendern taggenau, und das Ändern eines Regeltextes kostet keinen
  // Neuaufbau. Begründung: docs/architecture/eigene-spalten.md.
  if (Array.isArray(freieFelder) && freieFelder.length > 0) {
    const frei = baueFreiRoh(antrag as unknown as Record<string, unknown>, freieFelder);
    if (frei) item.frei_roh = frei;
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

/**
 * Wie `copyStringField`, probiert bei leerem kanonischem Feld aber weitere
 * Record-Keys durch. Für Spalten, die je nach Column-Mapping unter dem
 * kanonischen ODER einem Custom-Key liegen. Bewusst eine kurze, explizite
 * Liste je Feld statt einer generischen Schema-Auflösung: die Projektion läuft
 * über den ganzen Bestand und darf kein Schema nachladen.
 */
function copyStringFieldMitRueckfall(
  src: Antrag,
  dst: AntragListItem,
  key: Exclude<keyof AntragListItem, 'aktenzeichen' | 'programm_id' | '_updated_at'>,
  rueckfallKeys: readonly string[],
): void {
  const rec = src as unknown as Record<string, unknown>;
  for (const k of [key as string, ...rueckfallKeys]) {
    const v = rec[k];
    if (typeof v === 'string' && v.length > 0) {
      (dst as unknown as Record<string, unknown>)[key] = v;
      return;
    }
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
