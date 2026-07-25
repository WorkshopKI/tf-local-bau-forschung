/**
 * Auswertung: wie lange dauert die Bearbeitung tatsächlich, und wo weicht sie
 * vom Soll ab — gesamt und getrennt nach Antragstyp (FuE / DS / DL / NW).
 *
 * Zwei Sichten, bewusst getrennt:
 * - **Dauer-Auswertung** über ABGESCHLOSSENE Vorgänge (Antragseingang bis
 *   Abschluss). Braucht nur Felder, die die schlanke Listen-Projektion ohnehin
 *   trägt — kein Zugriff auf volle Records.
 * - **Knoten-Auswertung** über die bewerteten Verbünde: je Meilenstein die
 *   durchschnittlich erreichte Ist-Woche gegen die Soll-Woche, plus Reißquote.
 *
 * Rein: keine IO, keine Uhr. Median und Durchschnitt bleiben `null` statt 0,
 * wenn es keine Fälle gibt — eine 0 würde als „sehr schnell" fehlgelesen.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import type { AntragstypBucket, MeilensteinPlan, VerbundMeilensteine } from './typen';

const MS_TAG = 86_400_000;

/** Dauer-Klassen der Bearbeitungszeit (Tage ab Antragseingang). */
export type DauerBucket = 'bis60' | 'bis90' | 'bis120' | 'ueber120';

export const DAUER_BUCKETS: readonly DauerBucket[] = ['bis60', 'bis90', 'bis120', 'ueber120'];

/** Obergrenze je Bucket in Tagen; `ueber120` ist offen. */
export const DAUER_BUCKET_GRENZE: Record<DauerBucket, number | null> = {
  bis60: 60, bis90: 90, bis120: 120, ueber120: null,
};

export function dauerBucket(tage: number): DauerBucket {
  if (tage <= 60) return 'bis60';
  if (tage <= 90) return 'bis90';
  if (tage <= 120) return 'bis120';
  return 'ueber120';
}

/** Ein abgeschlossener Vorgang für die Dauer-Statistik. */
export interface AbschlussFall {
  verbundId: string;
  typ: AntragstypBucket | null;
  /** Maßgebliches Antragsdatum (Anker). */
  antragsdatum: string | null;
  /** Abschluss = Bewilligung, ersatzweise finale Erstentscheidung. */
  abschlussDatum: string | null;
}

/** Bearbeitungsdauer in Tagen; `null` wenn eines der Daten fehlt/unparsbar ist
 *  oder der Abschluss vor dem Eingang liegt (Datenfehler statt Negativ-Wert). */
export function bearbeitungsdauerTage(fall: AbschlussFall): number | null {
  const von = fall.antragsdatum ? parseGermanDate(fall.antragsdatum) : null;
  const bis = fall.abschlussDatum ? parseGermanDate(fall.abschlussDatum) : null;
  if (!von || !bis) return null;
  const vonMs = new Date(von).getTime();
  const bisMs = new Date(bis).getTime();
  if (Number.isNaN(vonMs) || Number.isNaN(bisMs)) return null;
  const tage = Math.round((bisMs - vonMs) / MS_TAG);
  return tage < 0 ? null : tage;
}

export interface DauerAuswertung {
  /** `null` = Sammelzeile über alle Typen. */
  typ: AntragstypBucket | null;
  /** Fälle mit berechenbarer Dauer. */
  anzahl: number;
  durchschnittTage: number | null;
  medianTage: number | null;
  /** Anteil innerhalb der Gesamtfrist, 0–100. */
  anteilImSollProzent: number | null;
  /** Abweichung des Durchschnitts von der Gesamtfrist (positiv = zu langsam). */
  abweichungTage: number | null;
  buckets: Record<DauerBucket, number>;
}

function leereBuckets(): Record<DauerBucket, number> {
  return { bis60: 0, bis90: 0, bis120: 0, ueber120: 0 };
}

function median(werte: readonly number[]): number | null {
  if (werte.length === 0) return null;
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function fasseDauern(
  typ: AntragstypBucket | null, tage: readonly number[], gesamtfristTage: number,
): DauerAuswertung {
  if (tage.length === 0) {
    return {
      typ, anzahl: 0, durchschnittTage: null, medianTage: null,
      anteilImSollProzent: null, abweichungTage: null, buckets: leereBuckets(),
    };
  }
  const buckets = leereBuckets();
  let summe = 0;
  let imSoll = 0;
  for (const t of tage) {
    summe += t;
    buckets[dauerBucket(t)]++;
    if (t <= gesamtfristTage) imSoll++;
  }
  const durchschnitt = Math.round(summe / tage.length);
  return {
    typ,
    anzahl: tage.length,
    durchschnittTage: durchschnitt,
    medianTage: median(tage),
    anteilImSollProzent: Math.round((imSoll / tage.length) * 100),
    abweichungTage: durchschnitt - gesamtfristTage,
    buckets,
  };
}

/**
 * Dauer-Auswertung gesamt + je Antragstyp. Typlose Fälle (Irrläufer, leeres
 * `vb_phase`) zählen in die Gesamtzeile, aber in keine Typ-Zeile — sie
 * verschwinden nicht, werden aber auch keinem Typ untergeschoben.
 */
export function werteDauernAus(
  faelle: readonly AbschlussFall[], gesamtfristTage: number,
): { gesamt: DauerAuswertung; jeTyp: DauerAuswertung[] } {
  const alle: number[] = [];
  const proTyp = new Map<AntragstypBucket, number[]>();
  for (const t of ANTRAGSTYP_BUCKETS) proTyp.set(t, []);

  for (const f of faelle) {
    const tage = bearbeitungsdauerTage(f);
    if (tage === null) continue;
    alle.push(tage);
    if (f.typ !== null) proTyp.get(f.typ)?.push(tage);
  }

  return {
    gesamt: fasseDauern(null, alle, gesamtfristTage),
    jeTyp: ANTRAGSTYP_BUCKETS.map(t => fasseDauern(t, proTyp.get(t) ?? [], gesamtfristTage)),
  };
}

// --- Knoten-Auswertung -----------------------------------------------------

export interface KnotenAuswertung {
  knotenId: string;
  nummer: string;
  label: string;
  sollWoche: number;
  /** Verbünde, für die der Knoten überhaupt gilt. */
  betrachtet: number;
  erreicht: number;
  gerissen: number;
  /** Anteil gerissener an den betrachteten, 0–100. */
  reissquoteProzent: number | null;
  /** Durchschnittlich erreichte Ist-Woche (nur erreichte mit Ist-Datum). */
  durchschnittIstWoche: number | null;
  /** Ist-Woche minus Soll-Woche; positiv = später als geplant. */
  abweichungWochen: number | null;
}

/**
 * Je Meilenstein: wie viele Verbünde ihn erreicht bzw. gerissen haben und wie
 * spät er im Schnitt erreicht wurde. Die Ist-Woche wird aus `abweichungTage`
 * rekonstruiert (`sollWoche + abweichung/7`), damit Soll und Ist garantiert auf
 * derselben Achse liegen.
 */
export function werteKnotenAus(
  plan: MeilensteinPlan, bewertungen: readonly VerbundMeilensteine[],
): KnotenAuswertung[] {
  const proKnoten = new Map<string, { betrachtet: number; erreicht: number; gerissen: number; abweichungen: number[] }>();
  for (const k of plan.knoten) {
    proKnoten.set(k.id, { betrachtet: 0, erreicht: 0, gerissen: 0, abweichungen: [] });
  }

  for (const v of bewertungen) {
    for (const e of v.ergebnisse) {
      const agg = proKnoten.get(e.knotenId);
      if (!agg || e.zustand === 'nichtRelevant') continue;
      agg.betrachtet++;
      if (e.zustand === 'erreicht') {
        agg.erreicht++;
        if (e.abweichungTage !== null) agg.abweichungen.push(e.abweichungTage);
      } else if (e.zustand === 'gerissen') {
        agg.gerissen++;
      }
    }
  }

  return plan.knoten.map(k => {
    const agg = proKnoten.get(k.id)!;
    const mittlereAbweichungTage = agg.abweichungen.length > 0
      ? agg.abweichungen.reduce((s, t) => s + t, 0) / agg.abweichungen.length
      : null;
    return {
      knotenId: k.id,
      nummer: k.nummer,
      label: k.label,
      sollWoche: k.sollWoche,
      betrachtet: agg.betrachtet,
      erreicht: agg.erreicht,
      gerissen: agg.gerissen,
      reissquoteProzent: agg.betrachtet > 0 ? Math.round((agg.gerissen / agg.betrachtet) * 100) : null,
      durchschnittIstWoche: mittlereAbweichungTage === null
        ? null
        : Math.round((k.sollWoche + mittlereAbweichungTage / 7) * 10) / 10,
      abweichungWochen: mittlereAbweichungTage === null
        ? null
        : Math.round((mittlereAbweichungTage / 7) * 10) / 10,
    };
  });
}

/** Verteilung der Prognosen über eine Menge bewerteter Verbünde. */
export function zaehlePrognosen(
  bewertungen: readonly VerbundMeilensteine[],
): Record<VerbundMeilensteine['prognose'], number> {
  const out = { imPlan: 0, gefaehrdet: 0, nichtHaltbar: 0, abgeschlossen: 0, unbekannt: 0 };
  for (const v of bewertungen) out[v.prognose]++;
  return out;
}
