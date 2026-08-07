/**
 * Altlast-Service — informativer Indikator (NICHT ranking-relevant).
 *
 * Liefert pro MA die noch offenen Antraege aus bis zu 7 Vorquartalen (exklusiv
 * aktuelles), die noch in einem der 5 vom Fachbereich benannten Status-Werte
 * sind:
 *   beantragt, bearbeitungsreif, NL eingegangen, NF gestellt, keine weiteren NF
 * (technisch: der amtliche Code steht in {@link ALTLAST_CODES}).
 *
 * **Dringlichkeits-Baender** (`quartalBand`): jeder Antrag wird nach seinem Alter
 * relativ zum aktuellen Quartal eingestuft —
 *   Band 1 = Q-1 (letztes Quartal, dringend)
 *   Band 2 = Q-2 (vorletztes Quartal, sehr dringend)
 *   Band 3 = Q-3 … Q-7 (extrem dringend)
 * Aelter als Q-7 → nicht mehr gezaehlt (Kappung). `tvsProBand` haelt die TVs je
 * Band; die Summe = `tvs`.
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
// Direktimport statt Barrel `@/core/status`: das zoege `snapshot.ts` nach und
// damit einen Laufzeit-Zyklus (Zyklen-Waechter).
import { codeFuerStatusText } from '@/core/status/kategorie-ableitung';
import { dateToQuartal } from '../verbund/externe-zuweisungen';
import type { AltlastBand, AuslastungVerbund } from './quartals-auslastung';

export interface MaAltlastBucket {
  /** Anzahl Verbund-Anteile (1 Verbund-Anteil = 1 Eintrag, auch bei mehreren TVs). */
  antraege: number;
  /** Echte Aktenzeichen-Anzahl (ueber alle Baender). */
  tvs: number;
  /** `tvs × stundenProTV` — fuer Balken-Skalierung (gleiche Skala wie Hauptbalken). */
  stunden: number;
  /** TVs je Dringlichkeits-Band: [Band 1 = Q-1, Band 2 = Q-2, Band 3 = Q-3..Q-7].
   *  Summe = `tvs`. Speist die farbige Segmentierung des Altanträge-Balkens. */
  tvsProBand: readonly [number, number, number];
  /** Die tatsaechlich vorkommenden Quartale (distinct, aeltestes zuerst) fuer das
   *  Sub-Label — z.B. ['2025-Q3', '2026-Q1']. */
  quartale: readonly string[];
  /** Aelteste zuerst sortiert (anders als Festgebucht-Verbuende — Altlasten sortieren chronologisch). */
  verbuende: AuslastungVerbund[];
}

export const EMPTY_ALTLAST: MaAltlastBucket = Object.freeze({
  antraege: 0,
  tvs: 0,
  stunden: 0,
  tvsProBand: [0, 0, 0] as [number, number, number],
  quartale: [],
  verbuende: [],
}) as MaAltlastBucket;

/**
 * Dringlichkeits-Band eines Antrags-Quartals relativ zum aktuellen Quartal.
 *
 *   Band 1 = letztes Quartal (Q-1, Distanz 1)
 *   Band 2 = vorletztes Quartal (Q-2, Distanz 2)
 *   Band 3 = Q-3 … Q-7 (Distanz 3..7)
 *   null   = aktuelles/zukuenftiges Quartal (Distanz ≤ 0) ODER aelter als Q-7
 *            (Distanz ≥ 8) → nicht gezaehlt.
 *
 * Das `YYYY-QN`-Format ist arithmetisch sortierbar (Jahr × 4 + Quartal), daher
 * die simple Distanz-Rechnung (vgl. `previousTwoQuartals`). Kappung bei Q-7.
 */
export function quartalBand(antragQuartal: string, aktuellesQuartal: string): AltlastBand | null {
  const a = /^(\d{4})-Q([1-4])$/.exec(antragQuartal);
  const c = /^(\d{4})-Q([1-4])$/.exec(aktuellesQuartal);
  if (!a || !c) return null;
  const dist = (Number(c[1]) * 4 + Number(c[2])) - (Number(a[1]) * 4 + Number(a[2]));
  if (dist === 1) return 1;
  if (dist === 2) return 2;
  if (dist >= 3 && dist <= 7) return 3;
  return null;
}

interface GroupState {
  verbundId: string | null;
  aktenzeichen: string[];
  akronym?: string;
  titel?: string;
  antragsdatum?: string;
  /** Roh-Status des ersten zur Gruppe gehoerenden Teilantrags (Repraesentant —
   *  alle Teilantraege sind ohnehin in Kategorie offen/nachforderung). */
  status?: string;
  /** Quartal des Repraesentanten (z.B. '2026-Q1') fuer Sub-Label + Band. */
  quartal: string;
  /** Dringlichkeits-Band des Repraesentanten (aus `quartal`). */
  band: AltlastBand;
}

function readField(a: AntragOderSlim, key: string): string | undefined {
  const v = (a as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Die 5 Altlast-Status als **amtliche Codes** des Fachsystems C16.
 *
 * Bis v3.24 fragte der Filter stattdessen die Kategorie ab
 * (`getStatusCategory ∈ {offen, nachforderung}`) — eine Abkuerzung, die genau
 * solange trug, wie die Kategorien dieser fuenf Status stillhielten. Die
 * Katalog-Fassung 19 vom 05.08.2026 loeste die ZAH-Phase „Vollstaendigkeit" auf
 * und haengte ihre Codes an „Pruefung"; damit rutschten vier der fuenf nach
 * `in_pruefung`. Gemessen am Bestand fiel der Altanträge-Balken von 395 auf 22
 * Teilvorhaben und blieb bei 22 von 32 MAs ganz leer — ohne dass sich an einem
 * einzigen Antrag etwas geaendert haette.
 *
 * „Altlast" ist eine **Fach-Festlegung dieses Moduls**, keine Ableitung aus der
 * bewusst beweglichen Phasen-Achse. Sie haengt deshalb am Code, den das
 * Fachsystem vergibt — den kann keine Katalog-Fassung verschieben. Wer die Menge
 * aendern will, aendert sie hier, sichtbar und mit Test.
 */
const ALTLAST_CODES: ReadonlySet<number> = new Set([
  31,  // beantragt
  34,  // bearbeitungsreif
  35,  // NF gestellt
  36,  // NL eingegangen
  37,  // keine weiteren NF
]);

/**
 * True wenn der Status einer der 5 Altlast-Status ist.
 *
 * **Rueckfall mit Absicht:** kennt der Code-Katalog eine Schreibweise nicht,
 * greift weiter die alte Kategorien-Pruefung. Eine nur in der Fassung gepflegte
 * Variante faellt so nicht still aus der Altlast — die Bindung an den Code ist
 * eine zusaetzliche Sicherung, nie eine Verengung gegenueber vorher.
 */
function isAltlastStatus(status: unknown): boolean {
  const code = codeFuerStatusText(status);
  if (code !== null) return ALTLAST_CODES.has(code);
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
 *  2. `antragsdatum` faellt in ein Dringlichkeits-Band (`quartalBand` ≠ null:
 *     Q-1 bis Q-7, exklusiv aktuelles, gekappt bei Q-7)
 *  3. `status` ist einer der 5 "offen"-Status (Kategorie offen oder nachforderung)
 */
export function computeAltlasten(
  antraege: ReadonlyArray<AntragOderSlim>,
  toAnon: ReadonlyMap<string, string>,
  aktuellesQuartal: string,
  stundenProTV: number,
): Map<string, MaAltlastBucket> {
  const stunden = stundenProTV > 0 ? stundenProTV : 9;
  if (!/^\d{4}-Q[1-4]$/.test(aktuellesQuartal)) return new Map();

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
    if (!q) continue;
    const band = quartalBand(q, aktuellesQuartal);
    if (!band) continue;

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
        quartal: q,
        band,
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
    const tvsProBand: [number, number, number] = [0, 0, 0];
    const quartaleSet = new Set<string>();
    let totalTvs = 0;
    for (const g of groupsByKey.values()) {
      const tvCount = g.aktenzeichen.length;
      if (tvCount === 0) continue;
      totalTvs += tvCount;
      const bi = g.band - 1;
      tvsProBand[bi] = (tvsProBand[bi] ?? 0) + tvCount;
      quartaleSet.add(g.quartal);
      verbuende.push({
        verbundId: g.verbundId,
        aktenzeichen: g.aktenzeichen.slice(),
        akronym: g.akronym,
        titel: g.titel,
        antragsdatum: g.antragsdatum,
        status: g.status,
        altlastBand: g.band,
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
      tvsProBand,
      // distinct Quartale, aeltestes zuerst (YYYY-QN sortiert chronologisch).
      quartale: Array.from(quartaleSet).sort(),
      verbuende,
    });
  }

  return result;
}
