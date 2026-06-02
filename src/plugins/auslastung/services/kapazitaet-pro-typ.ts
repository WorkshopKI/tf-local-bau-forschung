/**
 * Per-Antragstyp-Kapazität (v2.16) — primäres Kapazitätsmodell pro MA.
 *
 * Die PL pflegt pro MA ein Kontingent in **Anträgen/Jahr** je Antragstyp
 * (`AnonymerMitarbeiter.jahresKapazitaetProTyp`, aus der Kompetenz-Matrix oder
 * dem MA-Bearbeiten-Formular). Diese Funktion formt daraus zusammen mit dem
 * gezählten Quartals-Verbrauch (fest aus CSV + pending aus Store, via
 * `computeQuartalsAuslastung().*.antraegeProTyp`) die per-Typ-Auslastungs-Sicht
 * für Tabelle/Tile/Detail.
 *
 * `quartalsKontingentProTyp` ist die EINE Quelle der Kontingent-Berechnung
 * (inkl. Abschlag) — sowohl diese View als auch der Matcher (`kontingent.ts`)
 * nutzen sie, damit „verbraucht/Kontingent" überall identisch ist.
 *
 * Pure + ohne Seiteneffekte → unit-testbar.
 */
import {
  ALL_ANTRAGSTYP_BUCKETS,
  type AntragstypBucket,
  type AnonymerMitarbeiter,
} from '../types';
import { EMPTY_AUSLASTUNG, type MaQuartalsAuslastung } from './quartals-auslastung';

/**
 * Quartals-Kontingent eines MAs für einen Antragstyp (Anträge/Quartal), inkl.
 * Abschlag: `(jahresKapazitaetProTyp[bucket] × (1 − abschlag/100)) / 4`.
 * `null` = kein Kontingent gesetzt (unbegrenzt). Gemeinsamer Helper für View +
 * Matcher (Plan-Risiko #3: sonst divergiert „v/N frei").
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

/** Auslastung eines MAs für genau einen Antragstyp. */
export interface TypSlot {
  bucket: AntragstypBucket;
  /** Jahres-Kontingent (Anträge/Jahr) oder null = unbegrenzt. */
  kontingentJahr: number | null;
  /** Quartals-Kontingent nach Abschlag oder null = unbegrenzt. */
  kontingentQ: number | null;
  /** Verbrauchte Anträge im Quartal (fest + pending). */
  verbraucht: number;
  /** Verbleibend (kontingentQ − verbraucht) oder null bei unbegrenzt. */
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
  /** Summe verbrauchter Anträge über alle Typen. */
  verbrauchGesamt: number;
}

/**
 * Baut die per-Typ-Auslastungs-Sicht eines MAs. `auslastung` darf undefined sein
 * (MA hat im Quartal noch nichts → verbraucht 0).
 */
export function computeKapazitaetProTyp(
  ma: AnonymerMitarbeiter,
  auslastung: MaQuartalsAuslastung | undefined,
): KapazitaetProTypView {
  const a = auslastung ?? EMPTY_AUSLASTUNG;
  let verbrauchGesamt = 0;
  let hatKontingent = false;

  const slots: TypSlot[] = ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
    const verbraucht = (a.fest.antraegeProTyp[bucket] ?? 0) + (a.pending.antraegeProTyp[bucket] ?? 0);
    verbrauchGesamt += verbraucht;
    const kontingentQ = quartalsKontingentProTyp(ma, bucket);
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
