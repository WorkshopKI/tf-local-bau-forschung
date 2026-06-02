/**
 * Per-Antragstyp-Kapazität (v2.16, Stunden-Modell ab Juni 2026) — EINZIGE
 * Kapazitätsquelle pro MA.
 *
 * Die PL pflegt pro MA in der Kompetenz-Matrix je Antragstyp ein Kontingent in
 * **Stunden/Jahr** (`AnonymerMitarbeiter.jahresKapazitaetProTyp`). Daraus werden
 * abgeleitet:
 *  - die Gesamt-Jahresstunden des MAs (`effektiveJahresStunden` = Summe der
 *    Typ-Stunden; keine Typ-Stunden → 0), die das Stunden-Modell
 *    (`computeKapazitaet` → BELEGT/FREI/AKTUELL) speisen,
 *  - das per-Typ-Quartals-Kontingent in **TVs** (`quartalsTVsProTyp` =
 *    Stunden/Quartal ÷ `stundenProTV`), verglichen gegen den per-Typ-
 *    TV-Verbrauch (`computeQuartalsAuslastung().*.tvsProTyp`).
 *
 * So stehen per-Typ-Anzeige, FREI/AKTUELL und der Matcher (`kontingent.ts`) in
 * derselben TV-/Stunden-Währung. Pure + ohne Seiteneffekte → unit-testbar.
 */
import {
  ALL_ANTRAGSTYP_BUCKETS,
  type AntragstypBucket,
  type AnonymerMitarbeiter,
} from '../types';
import { EMPTY_AUSLASTUNG, type MaQuartalsAuslastung } from './quartals-auslastung';

/**
 * Effektive Jahresstunden eines MAs = Summe der gepflegten Typ-Stunden
 * (`jahresKapazitaetProTyp`). Keine Typ-Stunden gesetzt → **0** (kein Default
 * mehr — `ma.jahresKapazitaet` ist deprecated und wird nicht mehr gelesen).
 * Single Source für alle Kapazitäts-Reader (computeKapazitaet, statistik,
 * matching-engine, export).
 */
export function effektiveJahresStunden(ma: AnonymerMitarbeiter): number {
  const k = ma.jahresKapazitaetProTyp;
  if (!k) return 0;
  let sum = 0;
  for (const b of ALL_ANTRAGSTYP_BUCKETS) {
    const v = k[b];
    if (typeof v === 'number' && v > 0) sum += v;
  }
  return sum;
}

/**
 * Quartals-Kontingent eines MAs für einen Antragstyp in **Stunden/Quartal**,
 * inkl. Abschlag: `(jahresKapazitaetProTyp[bucket] × (1 − abschlag/100)) / 4`.
 * `null` = kein Kontingent gesetzt (unbegrenzt).
 */
export function quartalsKontingentProTyp(
  ma: AnonymerMitarbeiter,
  bucket: AntragstypBucket,
): number | null {
  const jahr = ma.jahresKapazitaetProTyp?.[bucket];
  if (jahr == null || jahr <= 0) return null;
  const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
  return (jahr * (1 - abschlag / 100)) / 4;
}

/**
 * Quartals-Kontingent eines MAs für einen Antragstyp in **TVs/Quartal** =
 * `quartalsKontingentProTyp / stundenProTV`. `null` = kein Kontingent.
 * Gemeinsamer Helper für View + Matcher, damit „verbraucht/Kontingent" überall
 * in derselben TV-Währung wie FREI/AKTUELL steht.
 */
export function quartalsTVsProTyp(
  ma: AnonymerMitarbeiter,
  bucket: AntragstypBucket,
  stundenProTV: number,
): number | null {
  const hQ = quartalsKontingentProTyp(ma, bucket);
  if (hQ == null) return null;
  const s = stundenProTV > 0 ? stundenProTV : 9;
  return hQ / s;
}

/** Auslastung eines MAs für genau einen Antragstyp. Werte in **TVs** (außer
 *  `kontingentJahr`). */
export interface TypSlot {
  bucket: AntragstypBucket;
  /** Jahres-Kontingent (Stunden/Jahr) oder null = unbegrenzt. */
  kontingentJahr: number | null;
  /** Quartals-Kontingent in TVs (Stunden/Quartal ÷ stundenProTV) oder null. */
  kontingentQ: number | null;
  /** Verbrauchte TVs im Quartal (fest + pending). */
  verbraucht: number;
  /** Verbleibende TVs (kontingentQ − verbraucht) oder null bei unbegrenzt. */
  rest: number | null;
  /** Füllgrad 0..100 für die Bar oder null bei unbegrenzt. */
  pct: number | null;
  ueberbucht: boolean;
  /** true = kein Kontingent gesetzt → nur Count anzeigen, keine Bar. */
  unlimited: boolean;
}

export interface KapazitaetProTypView {
  /** Immer 4 Slots in `ALL_ANTRAGSTYP_BUCKETS`-Reihenfolge (FuE/DS/DL/NW). */
  slots: TypSlot[];
  /** Mindestens ein Typ hat ein Kontingent → per-Typ-Bars als primäre Anzeige. */
  hatKontingent: boolean;
  /** Summe verbrauchter TVs über alle Typen. */
  verbrauchGesamt: number;
}

/**
 * Baut die per-Typ-Auslastungs-Sicht eines MAs in TVs. `auslastung` darf
 * undefined sein (MA hat im Quartal noch nichts → verbraucht 0). `stundenProTV`
 * konvertiert das Stunden-Kontingent in TVs (gleiche Skala wie FREI/AKTUELL).
 */
export function computeKapazitaetProTyp(
  ma: AnonymerMitarbeiter,
  auslastung: MaQuartalsAuslastung | undefined,
  stundenProTV: number,
): KapazitaetProTypView {
  const a = auslastung ?? EMPTY_AUSLASTUNG;
  let verbrauchGesamt = 0;
  let hatKontingent = false;

  const slots: TypSlot[] = ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
    const verbraucht = (a.fest.tvsProTyp[bucket] ?? 0) + (a.pending.tvsProTyp[bucket] ?? 0);
    verbrauchGesamt += verbraucht;
    const kontingentQ = quartalsTVsProTyp(ma, bucket, stundenProTV);
    if (kontingentQ == null) {
      return {
        bucket,
        kontingentJahr: null,
        kontingentQ: null,
        verbraucht,
        rest: null,
        pct: null,
        ueberbucht: false,
        unlimited: true,
      };
    }
    hatKontingent = true;
    const rest = kontingentQ - verbraucht;
    const pct = Math.min(100, Math.max(0, (verbraucht / kontingentQ) * 100));
    return {
      bucket,
      kontingentJahr: ma.jahresKapazitaetProTyp?.[bucket] ?? null,
      kontingentQ,
      verbraucht,
      rest,
      pct,
      ueberbucht: rest < 0,
      unlimited: false,
    };
  });

  return { slots, hatKontingent, verbrauchGesamt };
}
