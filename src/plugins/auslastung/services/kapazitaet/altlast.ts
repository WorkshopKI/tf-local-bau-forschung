/**
 * Altlast-Service — informativer Indikator (NICHT ranking-relevant).
 *
 * Liefert pro MA die Antraege aus den letzten 2 Quartalen (exklusiv aktuelles),
 * die noch in einem der 5 vom User definierten Status-Werte sind:
 *   beantragt, bearbeitungsreif, NL eingegangen, NF gestellt, keine weiteren NF
 * (technisch: getStatusCategory ∈ {offen, nachforderung}).
 *
 * Verbund-Aggregation analog zu `computeQuartalsAuslastung`: 1 Verbund-Anteil
 * pro MA = 1 "Antrag", `tvs` = die diesem MA gehoerenden Aktenzeichen.
 *
 * **Kein Pending-Pool** — nur CSV-Master. Pending-Zuweisungen sind manuelle
 * Q0-Vorschlaege, keine historisch entstandenen Antraege.
 *
 * **Kein Ranking-Bezug**: die Daten fliessen NICHT in `kapazitaetsScore` ein —
 * sonst wuerden langsame MAs durch ihre Altlast indirekt bevorzugt (weniger
 * Score → weniger neue Antraege → bleibt langsam). Convention-Test
 * `altlast-ranking-guard.test.ts` sichert das ab.
 */
import type { AntragOderSlim } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { dateToQuartal, previousTwoQuartals } from '../verbund/externe-zuweisungen';
import type { AuslastungVerbund } from './quartals-auslastung';

export interface MaAltlastBucket {
  /** Anzahl Verbund-Anteile (1 Verbund-Anteil = 1 Eintrag, auch bei mehreren TVs). */
  antraege: number;
  /** Echte Aktenzeichen-Anzahl. */
  tvs: number;
  /** `tvs × stundenProTV` — fuer Balken-Skalierung (gleiche Skala wie Hauptbalken). */
  stunden: number;
  /** Welche 2 Quartale wurden untersucht — z.B. ['2025-Q4', '2026-Q1'] fuer Sub-Label. */
  quartale: readonly string[];
  /** Aelteste zuerst sortiert (anders als Festgebucht-Verbuende — Altlasten sortieren chronologisch). */
  verbuende: AuslastungVerbund[];
}

export const EMPTY_ALTLAST: MaAltlastBucket = Object.freeze({
  antraege: 0,
  tvs: 0,
  stunden: 0,
  quartale: [],
  verbuende: [],
}) as MaAltlastBucket;

interface GroupState {
  verbundId: string | null;
  aktenzeichen: string[];
  akronym?: string;
  titel?: string;
  antragsdatum?: string;
  /** Roh-Status des ersten zur Gruppe gehoerenden Teilantrags (Repraesentant —
   *  alle Teilantraege sind ohnehin in Kategorie offen/nachforderung). */
  status?: string;
}

function readField(a: AntragOderSlim, key: string): string | undefined {
  const v = (a as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

/** True wenn der Status in einem der 5 vom User benannten "offen"-Status ist. */
function isAltlastStatus(status: unknown): boolean {
  const c = getStatusCategory(status);
  return c === 'offen' || c === 'nachforderung';
}

/**
 * Hauptberechnung — gibt eine Map `anonId → MaAltlastBucket` zurueck. MAs ohne
 * Altlasten erscheinen NICHT in der Map (Konsumenten muessen `Map.get(anonId)
 * ?? EMPTY_ALTLAST` nutzen, oder `?.` auf undefined pruefen).
 *
 * Filter-Kaskade:
 *  1. `tib_kuerz` vorhanden und in `toAnon` enthalten
 *  2. `antragsdatum` faellt in eines der 2 vorhergehenden Quartale
 *  3. `status` ist einer der 5 "offen"-Status (Kategorie offen oder nachforderung)
 */
export function computeAltlasten(
  antraege: ReadonlyArray<AntragOderSlim>,
  toAnon: ReadonlyMap<string, string>,
  aktuellesQuartal: string,
  stundenProTV: number,
): Map<string, MaAltlastBucket> {
  const stunden = stundenProTV > 0 ? stundenProTV : 9;
  const prevQs = previousTwoQuartals(aktuellesQuartal);
  if (!prevQs) return new Map();
  const targetQuartals = new Set<string>(prevQs);

  // pro (anonId, groupKey) sammeln; groupKey = verbund_id || aktenzeichen
  const collect = new Map<string, Map<string, GroupState>>();

  for (const a of antraege) {
    const rawKuerzel = (a as { tib_kuerz?: unknown }).tib_kuerz;
    if (typeof rawKuerzel !== 'string') continue;
    const kuerzel = rawKuerzel.trim().toUpperCase();
    if (!kuerzel) continue;
    const anonId = toAnon.get(kuerzel);
    if (!anonId) continue;

    const datum = (a as { antragsdatum?: unknown }).antragsdatum;
    const q = dateToQuartal(typeof datum === 'string' ? datum : undefined);
    if (!q || !targetQuartals.has(q)) continue;

    const status = (a as { status?: unknown }).status;
    if (!isAltlastStatus(status)) continue;

    const verbundId = readField(a, 'verbund_id') ?? null;
    const groupKey = verbundId ?? a.aktenzeichen;

    let perAnon = collect.get(anonId);
    if (!perAnon) {
      perAnon = new Map();
      collect.set(anonId, perAnon);
    }
    let group = perAnon.get(groupKey);
    if (!group) {
      group = {
        verbundId,
        aktenzeichen: [],
        akronym: readField(a, 'akronym'),
        titel: readField(a, 'verbund_titel') ?? readField(a, 'titel'),
        antragsdatum: typeof datum === 'string' ? datum : undefined,
        status: typeof status === 'string' ? status : undefined,
      };
      perAnon.set(groupKey, group);
    }
    group.aktenzeichen.push(a.aktenzeichen);
    if (!group.akronym) group.akronym = readField(a, 'akronym');
    if (!group.titel) group.titel = readField(a, 'verbund_titel') ?? readField(a, 'titel');
  }

  const result = new Map<string, MaAltlastBucket>();
  for (const [anonId, groupsByKey] of collect) {
    const verbuende: AuslastungVerbund[] = [];
    let totalTvs = 0;
    for (const g of groupsByKey.values()) {
      const tvCount = g.aktenzeichen.length;
      if (tvCount === 0) continue;
      totalTvs += tvCount;
      verbuende.push({
        verbundId: g.verbundId,
        aktenzeichen: g.aktenzeichen.slice(),
        akronym: g.akronym,
        titel: g.titel,
        antragsdatum: g.antragsdatum,
        status: g.status,
        tvCount,
        stunden: tvCount * stunden,
      });
    }
    // Aelteste zuerst (Altlast-Lesart: "das schiebt der MA schon am laengsten")
    verbuende.sort((a, b) => {
      const da = a.antragsdatum ?? '';
      const db = b.antragsdatum ?? '';
      if (da === db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
    result.set(anonId, {
      antraege: verbuende.length,
      tvs: totalTvs,
      stunden: totalTvs * stunden,
      quartale: prevQs,
      verbuende,
    });
  }

  return result;
}
