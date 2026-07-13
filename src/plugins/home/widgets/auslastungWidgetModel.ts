/**
 * Reine Modell-Helfer des Auslastungs-Mini-Widgets (Phase 2 v1.1), node-testbar.
 *
 * Nimmt bereits berechnete Auslastungs-Sichten (KapazitaetsView / Quartals-
 * Statistik / Altlast-Buckets — die schweren compute*-Aufrufe passieren im
 * Widget, Muster NeueAntraegeFuerDich) und leitet die Prozent-/TV-Props für die
 * geteilte `GesamtauslastungBar` ab. Zwei Sichten:
 *  - **Ich**  (ein MA): aus computeKapazitaet + dessen Altlast-Bucket.
 *  - **Team** (Aggregat): aus computeQuartalsStatistik + Altlast summiert über
 *    alle AKTIVEN MAs — nur Kennzahlen, nie eine MA-Rangliste (Anti-Pattern).
 */
import type { AnonymerMitarbeiter } from '@/plugins/auslastung/types';
import type {
  KapazitaetsView,
  MaAltlastBucket,
  QuartalsStatistik,
} from '@/plugins/auslastung/services/kapazitaet';

export type AuslastungSicht = 'ich' | 'team';

/**
 * Effektive Sicht: 'auto' leitet aus dem Kürzel-Modus ab (auflösbares Kürzel →
 * ich, „alle"/leer → team); 'ich'/'team' erzwingen sie.
 */
export function ermittleSicht(
  configSicht: 'auto' | 'ich' | 'team',
  myAnonId: string | null,
): AuslastungSicht {
  if (configSicht === 'ich') return 'ich';
  if (configSicht === 'team') return 'team';
  return myAnonId ? 'ich' : 'team';
}

/** Vorquartal (jahresübergreifend): 2026-Q3 → 2026-Q2, 2026-Q1 → 2025-Q4. */
export function vorherigesQuartal(quartal: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(quartal);
  if (!m) return null;
  const jahr = Number(m[1]);
  const q = Number(m[2]);
  return q > 1 ? `${jahr}-Q${q - 1}` : `${jahr - 1}-Q4`;
}

export interface AuslastungBalkenModell {
  /** Belegt-% (UNGEKAPPT — > 100 = überbucht, Danger-Farbe der Vollansicht). */
  belegtPct: number;
  altlastBandPct: [number, number, number];
  freiTVs: number;
  altlastTvs: number;
  altlastBandTvs: [number, number, number];
  /** Belegte TVs (fest + pending) — „N von M". */
  belegteTVs: number;
  /** Gesamt-TVs (belegt + frei) — das „M". */
  gesamtTVs: number;
}

function bandPct(
  bandTvs: readonly [number, number, number],
  effektivStunden: number,
  stundenProTV: number,
): [number, number, number] {
  if (effektivStunden <= 0) return [0, 0, 0];
  return [
    (bandTvs[0] * stundenProTV / effektivStunden) * 100,
    (bandTvs[1] * stundenProTV / effektivStunden) * 100,
    (bandTvs[2] * stundenProTV / effektivStunden) * 100,
  ];
}

/** Ich-Sicht: Balken-Props aus KapazitaetsView + Altlast-Bucket. */
export function ichBalkenModell(
  kapView: KapazitaetsView,
  altlast: MaAltlastBucket | undefined,
  stundenProTV: number,
): AuslastungBalkenModell {
  const eff = kapView.effektivStunden;
  const belegtPct = eff > 0 ? Math.round((kapView.verbrauchteStunden / eff) * 100) : 0;
  const bandTvs = altlast?.tvsProBand ?? ([0, 0, 0] as const);
  const belegteTVs = kapView.fest.tvs + kapView.pending.tvs;
  return {
    belegtPct,
    altlastBandPct: bandPct(bandTvs, eff, stundenProTV),
    freiTVs: kapView.restTVs,
    altlastTvs: altlast?.tvs ?? 0,
    altlastBandTvs: [bandTvs[0], bandTvs[1], bandTvs[2]],
    belegteTVs,
    gesamtTVs: belegteTVs + kapView.restTVs,
  };
}

/** Ein Segment des kombinierten Auslastungs-Balkens (geometrie + Daten, farbfrei). */
export interface StapelSegment {
  /** Stabiler Schlüssel; bestimmt im View die Farbe. */
  key: 'q3' | 'q2' | 'q1' | 'akt';
  /** Kurzlabel (Legende/Tooltip). */
  label: string;
  /** Segmentbreite in % der Quartalskapazität (auf Gesamt-100 skaliert). */
  pct: number;
  /** TVs im Segment (Zahl im Balken). */
  tvs: number;
}

/**
 * Segmente des kombinierten Home-Widget-Balkens, links→rechts nach ALTER:
 * ältestes (Q-3..Q-7) links → aktuelles Quartal rechts. Breiten = % der
 * Quartalskapazität; übersteigt die Summe 100 % (inkl. Überbuchung), wird
 * proportional auf 100 gekappt (der freie Rest = ungefüllter Track rechts).
 * Farbfrei — das View mappt `key` → Rampe (`altlast-colors`).
 */
export function stapelSegmente(m: AuslastungBalkenModell): StapelSegment[] {
  const roh: StapelSegment[] = [
    { key: 'q3', label: 'Q-3–7', pct: Math.max(0, m.altlastBandPct[2]), tvs: m.altlastBandTvs[2] },
    { key: 'q2', label: 'Q-2', pct: Math.max(0, m.altlastBandPct[1]), tvs: m.altlastBandTvs[1] },
    { key: 'q1', label: 'Q-1', pct: Math.max(0, m.altlastBandPct[0]), tvs: m.altlastBandTvs[0] },
    { key: 'akt', label: 'Aktuell', pct: Math.max(0, m.belegtPct), tvs: m.belegteTVs },
  ];
  const summe = roh.reduce((s, x) => s + x.pct, 0);
  const scale = summe > 100 ? 100 / summe : 1;
  return roh.map(x => ({ ...x, pct: x.pct * scale }));
}

export interface TeamAggregat extends AuslastungBalkenModell {
  /** Aktive MAs mit Belegung > 100 % (nur Anzahl — keine Namen!). */
  ueberMaCount: number;
  /** Aktive MAs gesamt (das „M" in „N von M MAs über 100 %"). */
  aktivMaCount: number;
}

/** Team-Sicht: Aggregat über alle AKTIVEN MAs (Summen, keine Rangliste). */
export function teamAggregat(
  stat: QuartalsStatistik,
  altlastByAnon: Map<string, MaAltlastBucket>,
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
  stundenProTV: number,
): TeamAggregat {
  const belegteTVs = stat.antraege.festTvs + stat.antraege.pendingTvs;
  const bandTvs: [number, number, number] = [0, 0, 0];
  let altlastTvs = 0;
  for (const ma of Object.values(mitarbeiter)) {
    if (!ma.aktiv) continue;
    const al = altlastByAnon.get(ma.anonId);
    if (!al) continue;
    altlastTvs += al.tvs;
    bandTvs[0] += al.tvsProBand[0];
    bandTvs[1] += al.tvsProBand[1];
    bandTvs[2] += al.tvsProBand[2];
  }
  return {
    belegtPct: stat.kapazitaet.prozent,
    altlastBandPct: bandPct(bandTvs, stat.kapazitaet.effektivStunden, stundenProTV),
    freiTVs: stat.antraege.freieTVs,
    altlastTvs,
    altlastBandTvs: bandTvs,
    belegteTVs,
    gesamtTVs: belegteTVs + stat.antraege.freieTVs,
    ueberMaCount: stat.warnungen.ueberbuchteMAs.length,
    aktivMaCount: stat.ma.aktiv,
  };
}
