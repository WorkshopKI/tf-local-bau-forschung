/**
 * Antragstyp-Praeferenz-Service (v2.2).
 *
 * Loest den Filter "Welche Antragstypen bearbeitet dieser MA?" — FuE/DS/DL/NW.
 * Nutzt das bestehende UI-Mapping aus `kategorieQuickfilter.ts` (Single Source
 * of Truth fuer vb_phase ↔ Bucket-Label), kein zweites Mapping.
 *
 * Datenmodell pro MA (v2.2):
 *  - `antragstypBevorzugt`     : Vom MA selbst gepflegt
 *  - `antragstypUeberschreibung`: PL-Override mit Vorrang
 *
 * Effective-Logik:
 *  - Override nicht-leer  → Override gilt
 *  - sonst Bevorzugt nicht-leer → Bevorzugt gilt
 *  - sonst null (alle Typen erlaubt — Backwards-Kompat fuer pre-v2.2-Daten)
 */
import type { Antrag } from '@/core/services/csv/types';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import type { AnonymerMitarbeiter, AntragstypBucket } from '../types';

/**
 * Liefert die effektiv geltenden Antragstypen eines MAs.
 *  - `null` = keine Restriktion (alle erlaubt).
 *  - Array = der MA bearbeitet **nur** diese Typen.
 */
export function getEffectiveAntragstypen(ma: AnonymerMitarbeiter): AntragstypBucket[] | null {
  const override = ma.antragstypUeberschreibung;
  if (Array.isArray(override) && override.length > 0) return override;
  const bevorzugt = ma.antragstypBevorzugt;
  if (Array.isArray(bevorzugt) && bevorzugt.length > 0) return bevorzugt;
  return null;
}

/**
 * Prueft ob ein Antrag dem effektiven Antragstyp-Filter eines MAs entspricht.
 *
 * Verhalten:
 *  - MA ohne Praeferenz (effective=null) → IMMER true, auch fuer Irrlaeufer.
 *    Das ist Backwards-Kompat: pre-v2.2-Daten dürfen nicht stiller filtern.
 *  - MA mit Praeferenz → Antrag muss in den allowed-Buckets sein.
 *    Irrlaeufer (vb_phase=9) → `getKategorieLabel` returnt `null` → kein Match.
 */
export function matchesAntragstyp(antrag: Antrag, ma: AnonymerMitarbeiter): boolean {
  const allowed = getEffectiveAntragstypen(ma);
  if (allowed === null) return true;
  const label = getKategorieLabel((antrag as Record<string, unknown>).vb_phase);
  if (label === null) return false;
  return allowed.includes(label);
}

/**
 * UI-Helper: gibt zurueck, ob die PL-Ueberschreibung gerade aktiv ist
 * (zur Anzeige des "Vom PL eingeschraenkt"-Banners im MA-Profil).
 */
export function hasPlOverride(ma: AnonymerMitarbeiter): boolean {
  return Array.isArray(ma.antragstypUeberschreibung)
    && ma.antragstypUeberschreibung.length > 0;
}
