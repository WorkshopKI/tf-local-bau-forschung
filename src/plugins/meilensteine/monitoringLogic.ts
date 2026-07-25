/**
 * Reine Auswahl-Logik der Monitoring-Tabs — Filtern, Sortieren, Sammeln.
 * Ohne React, damit sie ohne DOM testbar ist (Muster `kanbanLanes.ts`).
 *
 * Bewusst KEIN eigener Zustandsbegriff: „überfällig" ist genau `gerissen`,
 * „diese Woche fällig" genau `faellig` (das 7-Tage-Fenster der Engine). Eine
 * zweite Schwellen-Definition in der Oberfläche würde von der Engine abweichen,
 * sobald jemand eine der beiden anfasst.
 */
import type { MeilensteinPlan, MstZustand, Prognose } from '@/core/meilensteine';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { VerbundZeile } from './useMeilensteinStand';

const MS_TAG = 86_400_000;

/** Dringlichkeits-Rang: Prognose schlägt Restzeit. */
const PROGNOSE_RANG: Record<Prognose, number> = {
  nichtHaltbar: 0, gefaehrdet: 1, imPlan: 2, unbekannt: 3, abgeschlossen: 4,
};

export interface UebersichtFilter {
  suche: string;
  typen: AntragstypBucket[];
  prognosen: Prognose[];
  nurMeine: boolean;
}

export const LEERER_FILTER: UebersichtFilter = {
  suche: '', typen: [], prognosen: [], nurMeine: false,
};

/**
 * Filtert und sortiert die Übersicht. Dringendstes zuerst — ein Vorgang mit
 * gerissener Frist gehört nach oben, auch wenn ein anderer kalendarisch knapper
 * dran ist.
 */
export function filtereZeilen(
  zeilen: readonly VerbundZeile[], filter: UebersichtFilter, meinKuerzel: string,
): VerbundZeile[] {
  const suche = filter.suche.trim().toLowerCase();
  const kuerzel = meinKuerzel.trim().normalize('NFC');
  return zeilen
    .filter(z => {
      if (filter.typen.length > 0 && (z.typ === null || !filter.typen.includes(z.typ))) return false;
      if (filter.prognosen.length > 0 && !filter.prognosen.includes(z.prognose)) return false;
      if (filter.nurMeine && (!kuerzel || !z.kuerzel.includes(kuerzel))) return false;
      if (suche && !`${z.akronym} ${z.titel} ${z.verbundId}`.toLowerCase().includes(suche)) return false;
      return true;
    })
    .sort((a, b) => {
      const p = PROGNOSE_RANG[a.prognose] - PROGNOSE_RANG[b.prognose];
      if (p !== 0) return p;
      const ra = a.restTage ?? Number.POSITIVE_INFINITY;
      const rb = b.restTage ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.akronym.localeCompare(b.akronym, 'de');
    });
}

export interface WochenPunkt {
  verbundId: string;
  akronym: string;
  titel: string;
  knotenId: string;
  nummer: string;
  label: string;
  zustand: Extract<MstZustand, 'gerissen' | 'faellig'>;
  sollDatum: string | null;
  /** Tage bis zum Soll-Termin (negativ = überfällig). */
  restTage: number | null;
  kuerzel: string[];
  prognose: Prognose;
}

/**
 * Sammelt gerissene und fällige Meilensteine über alle Verbünde, am weitesten
 * überfällig zuerst. `heute` kommt von außen (Testbarkeit).
 */
export function sammleWochenPunkte(
  zeilen: readonly VerbundZeile[], plan: MeilensteinPlan, heute: string,
): WochenPunkt[] {
  const knotenById = new Map(plan.knoten.map(k => [k.id, k]));
  const heuteMs = new Date(heute).getTime();
  const out: WochenPunkt[] = [];

  for (const z of zeilen) {
    for (const e of z.ergebnisse) {
      if (e.zustand !== 'gerissen' && e.zustand !== 'faellig') continue;
      const k = knotenById.get(e.knotenId);
      if (!k) continue;
      const sollMs = e.sollDatum ? new Date(e.sollDatum).getTime() : NaN;
      out.push({
        verbundId: z.verbundId,
        akronym: z.akronym,
        titel: z.titel,
        knotenId: k.id,
        nummer: k.nummer,
        label: k.label,
        zustand: e.zustand,
        sollDatum: e.sollDatum,
        restTage: Number.isNaN(sollMs) ? null : Math.ceil((sollMs - heuteMs) / MS_TAG),
        kuerzel: z.kuerzel,
        prognose: z.prognose,
      });
    }
  }

  return out.sort((a, b) => {
    const ra = a.restTage ?? Number.POSITIVE_INFINITY;
    const rb = b.restTage ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.akronym.localeCompare(b.akronym, 'de');
  });
}

/** Auf das eigene Kürzel eingegrenzt; ohne Kürzel unverändert. */
export function nurMeinePunkte(punkte: readonly WochenPunkt[], meinKuerzel: string): WochenPunkt[] {
  const k = meinKuerzel.trim().normalize('NFC');
  return k ? punkte.filter(p => p.kuerzel.includes(k)) : [...punkte];
}
