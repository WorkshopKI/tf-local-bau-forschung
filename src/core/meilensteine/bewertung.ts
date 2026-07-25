/**
 * Bewertungs-Engine der Bearbeitungs-Meilensteine — rein deterministisch, ohne
 * UI und ohne IO. Beantwortet je Verbund: welcher Meilenstein ist erreicht,
 * welcher fällig, welcher gerissen — und ist die Gesamtfrist noch zu halten.
 *
 * Zwei Entwurfs-Entscheidungen, die den Rest tragen:
 *
 * 1. **Der Ist-Termin kommt aus den Daten, nicht aus einem Log.** Entweder aus
 *    dem am Knoten benannten `istDatumFeld` oder — als Rückfall — aus dem
 *    frühesten parsbaren Datum unter den Feldern, die den Meilenstein erfüllen.
 *    Damit ist auch der Bestand vom letzten Quartal auswertbar; ein Event-Log
 *    beginnt erst beim ersten Import und wüsste über Altfälle nichts.
 * 2. **Nur Blätter zählen in die Prognose.** Ein Sammel-Knoten (MST 1, 1.4)
 *    aggregiert seine Kinder; würde er zusätzlich selbst zählen, wäre derselbe
 *    Verzug doppelt in der Rechnung.
 */
import { addDays } from '@/core/services/csv/frist';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { pruefeBedingung, type BedingungsKontext } from '@/core/status';
import type {
  AntragstypBucket, MeilensteinKnoten, MeilensteinPlan, MstErgebnis, MstZustand,
  Prognose, VerbundMeilensteine,
} from './typen';
import { feldRefsAusBedingung } from './felder';

const MS_TAG = 86_400_000;

/** Vorwarnfenster: so viele Tage vor dem Soll-Termin gilt ein Meilenstein als fällig. */
export const FAELLIG_FENSTER_TAGE = 7;

export interface BewertungsEingabe {
  verbundId: string;
  /** Maßgebliches Antragsdatum (spätestes über alle TVs, `verbundAntragsdatum`). */
  antragsdatum: string | null;
  typ: AntragstypBucket | null;
  kontext: BedingungsKontext;
  /**
   * Der Verbund ist amtlich fertig (terminaler Status). Wird vom Aufrufer über
   * `isTerminalStatus` bestimmt — die Engine kennt keine Status-Literale.
   */
  terminal?: boolean;
}

/** Datum → ms; akzeptiert ISO und deutsches Format. `null` bei Unparsbarem. */
function alsMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const iso = parseGermanDate(raw);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Frühestes parsbares Datum unter den Werten der genannten Felder. */
function fruehestesDatum(ctx: BedingungsKontext, feldIds: readonly string[]): string | null {
  let bestMs = Infinity;
  let best: string | null = null;
  for (const feldId of feldIds) {
    for (const roh of ctx.get(feldId) ?? []) {
      const iso = parseGermanDate(roh);
      if (!iso) continue;
      const ms = new Date(iso).getTime();
      if (Number.isNaN(ms) || ms >= bestMs) continue;
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}

/** Gilt der Knoten für diesen Verbund? Inaktive und typ-fremde zählen nirgends mit. */
function istRelevant(k: MeilensteinKnoten, typ: AntragstypBucket | null): boolean {
  if (!k.aktiv) return false;
  if (k.nurTypen.length === 0) return true;
  return typ !== null && k.nurTypen.includes(typ);
}

interface KnotenBefund {
  erreicht: boolean;
  ueberKinder: boolean;
  istDatum: string | null;
}

/**
 * Erfüllung eines Knotens — die eigene Bedingung ODER alle relevanten Kinder.
 * Die ODER-Regel erlaubt Sammel-Meilensteine, für die es keine eigene Spalte
 * gibt (MST 1.4 „Schriftstück abgestimmt" = FB + AB + QS fertig).
 *
 * Memoisiert und zyklen-sicher: ein durch fehlerhaften Import entstandener
 * Eltern-Zyklus liefert `nicht erreicht` statt einer Endlosrekursion.
 */
function baueBefunde(
  plan: MeilensteinPlan,
  ctx: BedingungsKontext,
  typ: AntragstypBucket | null,
  heute: string,
): Map<string, KnotenBefund> {
  const byId = new Map(plan.knoten.map(k => [k.id, k]));
  const kinder = new Map<string, MeilensteinKnoten[]>();
  for (const k of plan.knoten) {
    if (k.elternId === null) continue;
    const list = kinder.get(k.elternId);
    if (list) list.push(k); else kinder.set(k.elternId, [k]);
  }

  const memo = new Map<string, KnotenBefund>();
  const laufend = new Set<string>();

  const befund = (k: MeilensteinKnoten): KnotenBefund => {
    const bekannt = memo.get(k.id);
    if (bekannt) return bekannt;
    if (laufend.has(k.id)) return { erreicht: false, ueberKinder: false, istDatum: null };
    laufend.add(k.id);

    let ergebnis: KnotenBefund;
    if (pruefeBedingung(k.bedingung, ctx, heute)) {
      const refs = k.istDatumFeld ? [k.istDatumFeld] : feldRefsAusBedingung(k.bedingung);
      ergebnis = { erreicht: true, ueberKinder: false, istDatum: fruehestesDatum(ctx, refs) };
    } else {
      const relevanteKinder = (kinder.get(k.id) ?? []).filter(c => istRelevant(c, typ));
      const kindBefunde = relevanteKinder.map(befund);
      const alleErreicht = kindBefunde.length > 0 && kindBefunde.every(b => b.erreicht);
      // Ein Sammel-Knoten ist erst fertig, wenn sein LETZTES Kind fertig ist.
      const spaetestes = alleErreicht
        ? kindBefunde.reduce<string | null>((best, b) => {
          const ms = alsMs(b.istDatum);
          if (ms === null) return best;
          const bestMs = alsMs(best);
          return bestMs === null || ms > bestMs ? b.istDatum : best;
        }, null)
        : null;
      ergebnis = { erreicht: alleErreicht, ueberKinder: alleErreicht, istDatum: spaetestes };
    }

    laufend.delete(k.id);
    memo.set(k.id, ergebnis);
    return ergebnis;
  };

  for (const k of byId.values()) befund(k);
  return memo;
}

function zustandVon(
  relevant: boolean, erreicht: boolean, sollMs: number | null, heuteMs: number,
): MstZustand {
  if (!relevant) return 'nichtRelevant';
  if (erreicht) return 'erreicht';
  if (sollMs === null) return 'offen';
  if (heuteMs > sollMs) return 'gerissen';
  if (sollMs - heuteMs <= FAELLIG_FENSTER_TAGE * MS_TAG) return 'faellig';
  return 'offen';
}

/**
 * Bewertet einen Verbund gegen den Plan. `heute` wird hereingereicht, damit
 * Tests nicht an der Uhr hängen.
 */
export function bewerteVerbund(
  plan: MeilensteinPlan,
  eingabe: BewertungsEingabe,
  heute: string,
): VerbundMeilensteine {
  const heuteMs = new Date(heute).getTime();
  const ankerMs = alsMs(eingabe.antragsdatum);
  const ankerIso = ankerMs === null ? null : new Date(ankerMs).toISOString();
  const befunde = baueBefunde(plan, eingabe.kontext, eingabe.typ, heute);

  const hatRelevanteKinder = new Set(
    plan.knoten
      .filter(k => k.elternId !== null && istRelevant(k, eingabe.typ))
      .map(k => k.elternId as string),
  );

  const ergebnisse: MstErgebnis[] = [];
  /** Blätter, die in die Frist-Prognose zählen. */
  const fristBlaetter: { zustand: MstZustand; sollMs: number | null; sollWoche: number }[] = [];

  for (const k of plan.knoten) {
    const relevant = istRelevant(k, eingabe.typ);
    const b = befunde.get(k.id) ?? { erreicht: false, ueberKinder: false, istDatum: null };
    const sollDatum = ankerIso === null ? null : addDays(ankerIso, k.sollWoche * 7);
    const sollMs = alsMs(sollDatum);
    const zustand = zustandVon(relevant, b.erreicht, sollMs, heuteMs);
    const istMs = alsMs(b.istDatum);

    ergebnisse.push({
      knotenId: k.id,
      zustand,
      sollDatum,
      istDatum: zustand === 'erreicht' ? b.istDatum : null,
      abweichungTage:
        zustand === 'erreicht' && istMs !== null && sollMs !== null
          ? Math.round((istMs - sollMs) / MS_TAG)
          : null,
      ...(zustand === 'erreicht' && b.ueberKinder ? { ueberKinder: true } : {}),
    });

    if (relevant && k.relevantFuerFrist && !hatRelevanteKinder.has(k.id)) {
      fristBlaetter.push({ zustand, sollMs, sollWoche: k.sollWoche });
    }
  }

  const fristDatum = ankerIso === null ? null : addDays(ankerIso, plan.gesamtfristTage);
  const fristMs = alsMs(fristDatum);
  const restTage = fristMs === null ? null : Math.ceil((fristMs - heuteMs) / MS_TAG);

  return {
    verbundId: eingabe.verbundId,
    antragsdatum: eingabe.antragsdatum,
    typ: eingabe.typ,
    wocheAktuell: ankerMs === null ? null : Math.max(1, Math.floor((heuteMs - ankerMs) / (7 * MS_TAG)) + 1),
    fristDatum,
    restTage,
    ergebnisse,
    prognose: leitePrognoseAb(plan, fristBlaetter, restTage, heuteMs, eingabe.terminal === true, ankerMs !== null),
  };
}

/**
 * Prognose zur Gesamtfrist. Modell in einem Satz: **der größte aktuelle Verzug
 * wird auf den Plan-Endpunkt aufgeschlagen** — überschreitet die Summe die
 * Gesamtfrist, ist sie nicht mehr zu halten.
 *
 * Das ist bewusst pessimistisch: es unterstellt, dass eine bereits verlorene
 * Woche nicht aufgeholt wird. Genau davor soll die Anzeige warnen.
 */
function leitePrognoseAb(
  plan: MeilensteinPlan,
  fristBlaetter: readonly { zustand: MstZustand; sollMs: number | null; sollWoche: number }[],
  restTage: number | null,
  heuteMs: number,
  terminal: boolean,
  hatAnker: boolean,
): Prognose {
  if (fristBlaetter.length === 0) return 'unbekannt';
  if (terminal || fristBlaetter.every(b => b.zustand === 'erreicht')) return 'abgeschlossen';
  if (!hatAnker || restTage === null) return 'unbekannt';
  if (restTage < 0) return 'nichtHaltbar';

  const planEndeTage = Math.max(...fristBlaetter.map(b => b.sollWoche)) * 7;
  let verzugTage = 0;
  let faellig = false;
  for (const b of fristBlaetter) {
    if (b.zustand === 'faellig') faellig = true;
    if (b.zustand !== 'gerissen' || b.sollMs === null) continue;
    verzugTage = Math.max(verzugTage, Math.ceil((heuteMs - b.sollMs) / MS_TAG));
  }
  if (planEndeTage + verzugTage > plan.gesamtfristTage) return 'nichtHaltbar';
  if (verzugTage > 0 || faellig) return 'gefaehrdet';
  return 'imPlan';
}
