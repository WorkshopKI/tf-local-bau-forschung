/**
 * Antragstyp-Praeferenz-Service (v2.2, erweitert v2.60).
 *
 * Loest den Filter "Welche Antragstypen bearbeitet dieser MA?" — FuE/DS/DL/NW.
 * Nutzt das bestehende UI-Mapping aus `kategorieQuickfilter.ts` (Single Source
 * of Truth fuer vb_phase ↔ Bucket-Label), kein zweites Mapping.
 *
 * Datenmodell pro MA:
 *  - `antragstypUeberschreibung`: PL-Override mit Vorrang
 *  - `antragstypBevorzugt`      : explizit gesetzte Vorbelegung (PL-Edit / MA-Profil)
 *  - `jahresKapazitaetProTyp`   : Stunden/Jahr pro Typ → read-time-Ableitung (v2.60)
 *
 * Effective-Logik (Reihenfolge):
 *  1. Override nicht-leer        → Override gilt
 *  2. sonst Bevorzugt nicht-leer → Bevorzugt gilt
 *  3. sonst aus Kontingent abgeleitet (Typen mit Stunden > 0) → diese gelten
 *  4. sonst null (alle Typen erlaubt — Backwards-Kompat fuer MAs OHNE Kontingent)
 *
 * Die Ableitung (3) ist **read-time, nicht persistiert**: sie aktualisiert sich
 * automatisch bei jedem Kompetenz-XLSX-Re-Upload. Die PL ueberschreibt sie, indem
 * sie explizit Pills setzt (→ 2) oder ein Override pflegt (→ 1).
 */
import type { AntragOderSlim } from '@/core/services/csv/types';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket } from '../types';
import { hatTypKapazitaet } from './kapazitaet-pro-typ';

/**
 * Leitet die bearbeiteten Antragstypen aus dem Stunden-Kontingent ab
 * (`jahresKapazitaetProTyp` > 0 Stunden/Jahr). Annahme: wer Stunden fuer einen
 * Typ gepflegt hat, bearbeitet ihn auch.
 *  - Array = abgeleitete Buckets (in `ALL_ANTRAGSTYP_BUCKETS`-Reihenfolge).
 *  - `null` = kein Kontingent gepflegt → keine Ableitung moeglich.
 */
export function deriveAntragstypenFromKontingent(ma: AnonymerMitarbeiter): AntragstypBucket[] | null {
  const derived = ALL_ANTRAGSTYP_BUCKETS.filter(b => hatTypKapazitaet(ma, b));
  return derived.length > 0 ? derived : null;
}

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
  return deriveAntragstypenFromKontingent(ma);
}

/** Woher der effektive Antragstyp-Filter eines MAs stammt (fuer UI-Labels). */
export type AntragstypHerkunft = 'override' | 'bevorzugt' | 'abgeleitet' | 'keine';

/**
 * UI-Helper: klassifiziert die Quelle des effektiven Antragstyp-Filters, damit
 * die Oberflaeche "explizit gesetzt" von "automatisch aus Kontingent abgeleitet"
 * unterscheiden kann.
 */
export function getAntragstypHerkunft(ma: AnonymerMitarbeiter): AntragstypHerkunft {
  if (Array.isArray(ma.antragstypUeberschreibung) && ma.antragstypUeberschreibung.length > 0) {
    return 'override';
  }
  if (Array.isArray(ma.antragstypBevorzugt) && ma.antragstypBevorzugt.length > 0) {
    return 'bevorzugt';
  }
  return deriveAntragstypenFromKontingent(ma) !== null ? 'abgeleitet' : 'keine';
}

/**
 * Prueft ob ein Antrag dem effektiven Antragstyp-Filter eines MAs entspricht.
 *
 * Verhalten:
 *  - effective=null (kein Override, keine Vorbelegung, KEIN Kontingent) → IMMER
 *    true, auch fuer Irrlaeufer. Backwards-Kompat: MAs ohne Stunden-Kontingent
 *    duerfen nicht stiller filtern.
 *  - effective=Array (explizit ODER aus Kontingent abgeleitet) → Antrag muss in
 *    den allowed-Buckets sein. Irrlaeufer (vb_phase=9) → `getKategorieLabel`
 *    returnt `null` → kein Match.
 */
export function matchesAntragstyp(antrag: AntragOderSlim, ma: AnonymerMitarbeiter): boolean {
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
