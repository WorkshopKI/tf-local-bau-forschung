/**
 * Quartals-Statistik fuer das Auslastungs-Modul (v2.6).
 *
 * Aggregiert ueber alle MAs eines Quartals zu einer PL-Uebersichts-Sicht:
 * MA-Counts (aktiv/abgemeldet/ohne-Buchungen), Stunden-Bilanz, Antrags-
 * Bilanz, Warnungen (ueberbucht, leer) und die MA-Verteilung pro Kategorie.
 *
 * Pure-Funktion, testbar ohne React. Wird einmal pro Render im
 * Statistik-Bereich (HeadlineInsight + KpiGrid + WarnungenZeile)
 * aufgerufen, kostet O(MAs) — fuer ~80 MAs unkritisch.
 */
import type { AnonymerMitarbeiter, AuslastungConfig, UeberKategorie } from '../../types';
import type { MaQuartalsAuslastung } from './quartals-auslastung';
import { effektiveJahresStunden } from './kapazitaet-pro-typ';

export interface QuartalsStatistik {
  quartal: {
    label: string;
    tagAktuell: number;       // 1..N
    tageGesamt: number;       // 90..92 abhaengig vom Quartal
    fortschrittProzent: number;  // 0..100
  };
  ma: {
    aktiv: number;
    gesamt: number;
    abgemeldet: number;       // im angefragten Quartal abgemeldet
    ohneBuchungen: number;    // aktive MAs ohne fest+pending im Quartal
  };
  kapazitaet: {
    effektivStunden: number;   // Summe aller aktiven MAs nach Abschlag
    verbrauchteStunden: number;// fest + pending
    freiStunden: number;        // effektiv − verbraucht (>= 0)
    prozent: number;            // verbraucht / effektiv × 100
  };
  antraege: {
    fest: number;             // Anzahl Antrags-Anteile (Verbund-dedupliziert)
    festTvs: number;
    pending: number;
    pendingTvs: number;
    freieTVs: number;         // freiStunden / stundenProTV
  };
  warnungen: {
    /** Aktive MAs mit verbrauchteStunden > effektivStunden. */
    ueberbuchteMAs: string[];
    /** Aktive MAs ohne fest+pending im Quartal — Pool ist frei. */
    leereMAs: string[];
  };
  kategorienVerteilung: Array<{
    id: string;
    name: string;
    farbe: import('../../types').KategorieFarbe;
    aktiveCount: number;     // aktive MAs mit hauptKategorie === id
    prozent: number;         // count / aktivGesamt × 100
  }>;
}

/**
 * Tag im Quartal (1..N), aus `now`-Date abgeleitet. Wenn `now` vor dem
 * Quartal liegt: 0. Wenn nach dem Quartal: tageGesamt.
 */
export function tageVergangenImQuartal(quartal: string, now: Date = new Date()): {
  tagAktuell: number;
  tageGesamt: number;
} {
  const match = /^(\d{4})-Q([1-4])$/.exec(quartal);
  if (!match) return { tagAktuell: 0, tageGesamt: 0 };
  const year = Number(match[1]);
  const q = Number(match[2]);
  // Quartal-Start: Q1 = Jan 1, Q2 = Apr 1, Q3 = Jul 1, Q4 = Okt 1.
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  // Quartal-Ende exklusiv (= naechstes Quartal Start).
  const endStart = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);
  const tageGesamt = Math.round((endStart.getTime() - start.getTime()) / 86400000);

  const nowMs = now.getTime();
  if (nowMs < start.getTime()) return { tagAktuell: 0, tageGesamt };
  if (nowMs >= endStart.getTime()) return { tagAktuell: tageGesamt, tageGesamt };
  const diffDays = Math.floor((nowMs - start.getTime()) / 86400000) + 1;
  return { tagAktuell: diffDays, tageGesamt };
}

/**
 * Vergangene Quartale desselben Jahres wie `aktuellesQuartal`, absteigend
 * (juengstes zuerst). Beispiel: `2026-Q2 → ['2026-Q1']`, `2026-Q4 →
 * ['2026-Q3','2026-Q2','2026-Q1']`. Bei Q1 (kein frueheres Quartal im Jahr)
 * oder ungueltigem Input → leeres Array. Speist das Vergleichs-Dropdown der
 * Statistik-Uebersicht.
 */
export function vergangeneQuartaleImJahr(aktuellesQuartal: string): string[] {
  const match = /^(\d{4})-Q([1-4])$/.exec(aktuellesQuartal);
  if (!match) return [];
  const year = match[1];
  const q = Number(match[2]);
  const result: string[] = [];
  for (let i = q - 1; i >= 1; i--) {
    result.push(`${year}-Q${i}`);
  }
  return result;
}

export function computeQuartalsStatistik(
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
  auslastungByAnon: Map<string, MaQuartalsAuslastung>,
  config: AuslastungConfig,
  quartal: string,
  now: Date = new Date(),
): QuartalsStatistik {
  const stundenProTV = Math.max(1, config.stundenProTV ?? 9);
  const alle = Object.values(mitarbeiter);
  const aktive = alle.filter(m => m.aktiv);
  const gesamt = alle.length;
  const aktiv = aktive.length;

  let abgemeldet = 0;
  let effektivStunden = 0;
  let verbrauchteStunden = 0;
  let fest = 0;
  let festTvs = 0;
  let pending = 0;
  let pendingTvs = 0;
  const ueberbuchteMAs: string[] = [];
  const leereMAs: string[] = [];
  const verteilungMap = new Map<string, number>();  // hauptKategorie-id → count

  for (const ma of aktive) {
    if (ma.abgemeldet.includes(quartal)) abgemeldet++;
    const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
    const eff = (effektiveJahresStunden(ma) * (1 - abschlag / 100)) / 4;
    effektivStunden += eff;
    const auslastung = auslastungByAnon.get(ma.anonId);
    const festS = auslastung?.fest.stunden ?? 0;
    const pendS = auslastung?.pending.stunden ?? 0;
    const verbraucht = festS + pendS;
    verbrauchteStunden += verbraucht;
    fest += auslastung?.fest.antraege ?? 0;
    festTvs += auslastung?.fest.tvs ?? 0;
    pending += auslastung?.pending.antraege ?? 0;
    pendingTvs += auslastung?.pending.tvs ?? 0;
    if (verbraucht > eff && eff > 0) ueberbuchteMAs.push(ma.anonId);
    if (verbraucht === 0) leereMAs.push(ma.anonId);

    // Kategorien-Verteilung: nur hauptKategorie zaehlt (Default-Ansicht).
    const haupt = ma.hauptKategorie;
    if (haupt) {
      verteilungMap.set(haupt, (verteilungMap.get(haupt) ?? 0) + 1);
    }
  }

  const freiStunden = Math.max(0, effektivStunden - verbrauchteStunden);
  const freieTVs = Math.floor(freiStunden / stundenProTV);
  const prozent = effektivStunden > 0 ? Math.round((verbrauchteStunden / effektivStunden) * 100) : 0;
  const { tagAktuell, tageGesamt } = tageVergangenImQuartal(quartal, now);
  const fortschrittProzent = tageGesamt > 0 ? Math.round((tagAktuell / tageGesamt) * 100) : 0;

  // KategorienVerteilung: Reihenfolge wie config.ueberKategorien (stabil).
  const kategorienVerteilung = (config.ueberKategorien ?? []).map((k: UeberKategorie) => {
    const count = verteilungMap.get(k.id) ?? 0;
    const pctValue = aktiv > 0 ? Math.round((count / aktiv) * 100) : 0;
    return { id: k.id, name: k.name, farbe: k.farbe, aktiveCount: count, prozent: pctValue };
  });

  return {
    quartal: { label: quartal, tagAktuell, tageGesamt, fortschrittProzent },
    ma: { aktiv, gesamt, abgemeldet, ohneBuchungen: leereMAs.length },
    kapazitaet: { effektivStunden, verbrauchteStunden, freiStunden, prozent },
    antraege: { fest, festTvs, pending, pendingTvs, freieTVs },
    warnungen: { ueberbuchteMAs, leereMAs },
    kategorienVerteilung,
  };
}
