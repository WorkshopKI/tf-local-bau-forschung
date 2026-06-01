/**
 * Antragstyp-Kontingent (v2.15) — weiche Pro-Typ-Deckelung im Matcher.
 *
 * Die PL pflegt pro MA ein Kontingent in **Anträgen/Jahr** je Antragstyp
 * (`AnonymerMitarbeiter.jahresKapazitaetProTyp`). Der Verbrauch wird aus den
 * Zuweisungen des aktuellen Quartals gezählt (Typ über `vb_phase` des Antrags,
 * via `getKategorieLabel` — dieselbe Single-Source-of-Truth wie der
 * Antragstyp-Filter). Erschöpftes Kontingent → weicher Malus, kein harter
 * Filter (konsistent mit dem weichen Kapazitätsmodell der Engine).
 *
 * Pure + ohne Seiteneffekte → unit-testbar.
 */
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import type { AnonymerMitarbeiter, AntragstypBucket, Zuweisung } from '../types';

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

export interface KontingentInfo {
  /** 0..1 — 1.0 = kein Limit oder Rest ≥ 1; 0.8 = unter 1 frei; 0.5 = überbucht. */
  score: number;
  /** Verbleibendes Quartals-Kontingent (Anträge) oder null = kein Limit. */
  rest: number | null;
  /** Quartals-Kontingent (Anträge) oder null = kein Limit. */
  kontingentQ: number | null;
}

const KEIN_LIMIT: KontingentInfo = { score: 1, rest: null, kontingentQ: null };

/**
 * Kontingent-Status eines MAs für einen Antragstyp. Kein Kontingent gesetzt →
 * neutral (Score 1.0). Sonst Quartals-Kontingent = Jahres-Kontingent / 4, Rest =
 * Kontingent − Verbrauch.
 */
export function kontingentInfoFor(
  ma: AnonymerMitarbeiter,
  bucket: AntragstypBucket | null,
  verbrauch: Partial<Record<AntragstypBucket, number>> | undefined,
): KontingentInfo {
  if (!bucket) return KEIN_LIMIT;
  const jahr = ma.jahresKapazitaetProTyp?.[bucket];
  if (jahr == null || jahr <= 0) return KEIN_LIMIT;
  const kontingentQ = jahr / 4;
  const used = verbrauch?.[bucket] ?? 0;
  const rest = kontingentQ - used;
  const score = rest >= 1 ? 1 : rest > 0 ? 0.8 : 0.5;
  return { score, rest, kontingentQ };
}
