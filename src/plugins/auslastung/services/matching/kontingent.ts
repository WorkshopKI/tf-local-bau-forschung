/**
 * Antragstyp-Kontingent (v2.15, Stunden-Modell ab Juni 2026) — weiche
 * Pro-Typ-Deckelung im Matcher.
 *
 * Die PL pflegt pro MA in der Kompetenz-Matrix je Antragstyp ein Kontingent in
 * **Stunden/Jahr** (`AnonymerMitarbeiter.jahresKapazitaetProTyp`); daraus wird
 * das Quartals-Kontingent in **TVs** abgeleitet (`quartalsTVsProTyp`). Der
 * Verbrauch wird in **TVs** gezählt (`tvsProTyp` aus dem Auslastungs-Index).
 * Erschöpftes Kontingent → weicher Malus, kein harter Filter (konsistent mit
 * dem weichen Kapazitätsmodell der Engine).
 *
 * Pure + ohne Seiteneffekte → unit-testbar.
 */
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket, type Zuweisung } from '../../types';
import { quartalsTVsProTyp } from '../kapazitaet/kapazitaet-pro-typ';
import type { MaQuartalsAuslastung } from '../kapazitaet/quartals-auslastung';

/** Pro anonId: gezählte Anträge je Antragstyp im betrachteten Quartal. */
export type KontingentVerbrauch = Map<string, Partial<Record<AntragstypBucket, number>>>;

/**
 * Zählt die freigegebenen/selbst-eingetragenen Zuweisungen des Quartals pro MA
 * und Antragstyp. Ohne `antraegeIndex` (z.B. in Tests ohne CSV) → leere Map
 * (= keine Deckelung).
 */
export function computeKontingentVerbrauch(
  zuweisungen: Zuweisung[],
  antraegeIndex: Map<string, { vb_phase?: unknown }> | undefined,
  quartal: string,
): KontingentVerbrauch {
  const out: KontingentVerbrauch = new Map();
  if (!antraegeIndex) return out;
  for (const z of zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.status !== 'freigegeben' && z.status !== 'selbst') continue;
    const bucket = getKategorieLabel(antraegeIndex.get(z.antragId)?.vb_phase);
    if (!bucket) continue;
    const m = out.get(z.anonId) ?? {};
    m[bucket] = (m[bucket] ?? 0) + 1;
    out.set(z.anonId, m);
  }
  return out;
}

/**
 * Verbrauch je Typ in **TVs** aus dem aggregierten Auslastungs-Index (fest CSV +
 * pending Store) — die korrekte, vollständige Quelle (v2.16). `computeKontingent‐
 * Verbrauch` zählt nur Store-Zuweisungen und übersieht fest gebuchte CSV-Anträge;
 * diese Variante nutzt dieselben deduplizierten `tvsProTyp`-Counts wie das
 * per-Typ-Kapazitätsmodell, damit „verbraucht" überall identisch (TVs) ist.
 */
export function verbrauchFromAuslastung(
  auslastungByAnon: Map<string, MaQuartalsAuslastung>,
): KontingentVerbrauch {
  const out: KontingentVerbrauch = new Map();
  for (const [anonId, a] of auslastungByAnon) {
    const m: Partial<Record<AntragstypBucket, number>> = {};
    for (const src of [a.fest.tvsProTyp, a.pending.tvsProTyp]) {
      for (const b of ALL_ANTRAGSTYP_BUCKETS) {
        const n = src[b];
        if (n) m[b] = (m[b] ?? 0) + n;
      }
    }
    if (Object.keys(m).length > 0) out.set(anonId, m);
  }
  return out;
}

export interface KontingentInfo {
  /** 0..1 — 1.0 = kein Limit oder Rest ≥ 1; 0.8 = unter 1 frei; 0.5 = überbucht. */
  score: number;
  /** Verbleibendes Quartals-Kontingent (TVs) oder null = kein Limit. */
  rest: number | null;
  /** Quartals-Kontingent (TVs) oder null = kein Limit. */
  kontingentQ: number | null;
}

const KEIN_LIMIT: KontingentInfo = { score: 1, rest: null, kontingentQ: null };

/**
 * Kontingent-Status eines MAs für einen Antragstyp. Kein Kontingent gesetzt →
 * neutral (Score 1.0). Sonst Quartals-Kontingent in TVs via `quartalsTVsProTyp`
 * (Stunden/Quartal ÷ stundenProTV), Rest = Kontingent − TV-Verbrauch.
 */
export function kontingentInfoFor(
  ma: AnonymerMitarbeiter,
  bucket: AntragstypBucket | null,
  verbrauch: Partial<Record<AntragstypBucket, number>> | undefined,
  stundenProTV: number,
): KontingentInfo {
  if (!bucket) return KEIN_LIMIT;
  // Gemeinsamer Helper (inkl. Abschlag) — identisch zur per-Typ-Kapazitäts-View.
  const kontingentQ = quartalsTVsProTyp(ma, bucket, stundenProTV);
  if (kontingentQ == null) return KEIN_LIMIT;
  const used = verbrauch?.[bucket] ?? 0;
  const rest = kontingentQ - used;
  const score = rest >= 1 ? 1 : rest > 0 ? 0.8 : 0.5;
  return { score, rest, kontingentQ };
}
