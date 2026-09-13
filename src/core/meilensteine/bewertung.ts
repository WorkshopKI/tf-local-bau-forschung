/**
 * Bewertungs-Engine der Bearbeitungs-Meilensteine — rein deterministisch, ohne
 * UI und ohne IO. Beantwortet je Verbund: welcher Meilenstein ist erreicht,
 * welcher fällig, welcher gerissen — und ist die Gesamtfrist noch zu halten.
 *
 * Zwei Entwurfs-Entscheidungen, die den Rest tragen:
 *
 * 1. **Der Ist-Termin kommt aus den Daten, nicht aus einem Log.** Entweder aus
 *    dem am Knoten benannten `istDatumFeld` oder — als Rückfall — aus dem Tag,
 *    an dem die Bedingung wahr wurde (`erfuellungsDatum`: bei „alle“ das
 *    späteste, bei „eine“ das früheste Datum der zutreffenden Teile).
 *    Damit ist auch der Bestand vom letzten Quartal auswertbar; ein Event-Log
 *    beginnt erst beim ersten Import und wüsste über Altfälle nichts.
 * 2. **Nur Blätter zählen in die Prognose.** Ein Sammel-Knoten (MST 1, 1.4)
 *    aggregiert seine Kinder; würde er zusätzlich selbst zählen, wäre derselbe
 *    Verzug doppelt in der Rechnung.
 */
import { addDays } from '@/core/services/csv/frist';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import {
  bedingungIstLeer, pruefeBedingung, type Bedingung, type BedingungsKontext,
} from '@/core/status';
import type {
  AntragstypBucket, FristLage, MeilensteinKnoten, MeilensteinPlan, MstErgebnis, MstZustand,
  Prognose, VerbundMeilensteine,
} from './typen';
import { MS_TAG } from '@/core/utils/zeitEinheiten';


/**
 * Version der **Bewertungs-Semantik**. Hochzählen, sobald dieselbe Datenlage ein
 * anderes Urteil ergibt.
 *
 * Warum das nötig ist: die Projektion wird gecacht, und ihre Signatur bestand
 * aus Plan-Fassung, Datenstand und Kalendertag (`baueSignatur`) — die Engine
 * selbst kam darin nicht vor. Eine geänderte Regel wirkte damit erst, wenn der
 * Plan angefasst wurde oder der Tag wechselte; gemessen zeigte das
 * Fristen-Widget nach der v4.134-Änderung unverändert 108 Meilenstein-Anlässe
 * aus der Ablage von vorhin. Ein Cache, der die Rechenvorschrift nicht kennt,
 * ist keine Beschleunigung, sondern ein zweiter Stand.
 *
 * 1 → 2 (v4.134): Knoten ohne auswertbare Bedingung sind `ohneBedingung` statt
 * `gerissen`/`erreicht` und zählen nicht in die Prognose.
 * 2 → 3 (v6.49): der Anker ist der wirksame Eingang (`D_AAE` oder `D_XTE`,
 * das spätere) statt des Antragsdatums allein.
 * 3 → 4 (v6.59.2): der Ist-Termin ohne `istDatumFeld` folgt der Verknüpfung
 * (`erfuellungsDatum`) statt dem frühesten Datum aller Bedingungsfelder.
 * 4 → 5 (v6.66): die Frist ist die Bearbeitungsfrist der Frist-Spalte
 * (`verbundFristLage`, hält in Phasen ohne Frist) statt einer eigenen
 * 90-Tage-Uhr ab Anker; neue Prognose `angehalten`.
 */
export const BEWERTUNGS_VERSION = 5;

/** Vorwarnfenster: so viele Tage vor dem Soll-Termin gilt ein Meilenstein als fällig. */
export const FAELLIG_FENSTER_TAGE = 7;

export interface BewertungsEingabe {
  verbundId: string;
  /** Spätestes Antragsdatum über alle TVs (`verbundAntragsdatum`) — nur zur Einordnung. */
  antragsdatum: string | null;
  /** Anker aller Termine: wirksamer Eingang des Verbunds (`verbundWirksamerEingang`). */
  anker: string | null;
  typ: AntragstypBucket | null;
  kontext: BedingungsKontext;
  /**
   * Die Bearbeitungsfrist des Verbunds — **dieselbe** wie in der Frist-Spalte
   * (`verbundFristLage`, gefaltet über die Teilvorhaben). Bis v6.65 rechnete die
   * Engine eine eigene 90-Tage-Uhr ab Anker ohne Halt (Messung in
   * `frist-lage.ts`). Die Soll-Wochen zählen weiter ab `anker`.
   */
  frist: FristLage;
  /**
   * Der Verbund ist amtlich fertig (terminaler Status). Wird vom Aufrufer über
   * `isTerminalStatus` bestimmt — die Engine kennt keine Status-Literale.
   */
  terminal?: boolean;
}

/**
 * Ganze Tage von `heuteMs` bis zum Ziel-Zeitpunkt, aufgerundet; `null` ohne Ziel.
 *
 * **Normalisiert `-0` zu `0`.** `Math.ceil` liefert für einen Termin, der heute
 * um Mitternacht lag und damit ein paar Stunden zurückliegt, `-0` — und
 * `-0 < 0` ist `false`. Jede Anzeige, die daran „überfällig oder nicht"
 * entscheidet, schrieb daraus „in 0 T", während die Zeile unter der Überschrift
 * „Überfällig" stand. Die Fallunterscheidung gehört an die Zahl, nicht in jeden
 * Formatierer.
 */
export function restTageBis(zielMs: number | null, heuteMs: number): number | null {
  if (zielMs === null || Number.isNaN(zielMs) || Number.isNaN(heuteMs)) return null;
  const tage = Math.ceil((zielMs - heuteMs) / MS_TAG);
  return tage === 0 ? 0 : tage;
}

/**
 * Frühester Tag, an dem der Plan überhaupt fertig sein kann: die späteste
 * fristrelevante Soll-Woche in Tagen. Liegt er über der Gesamtfrist, ist der
 * Plan in sich unerfüllbar — dann gilt JEDER Verbund als „Frist nicht haltbar",
 * ganz gleich wie er läuft, und drei der fünf Prognose-Chips filtern dauerhaft
 * auf eine leere Liste.
 *
 * Ohne Typ-Zuschnitt (anders als `bewerteVerbund`): die Frage ist eine an den
 * Plan, nicht an einen einzelnen Verbund.
 */
export function planEndeTage(knoten: readonly MeilensteinKnoten[]): number {
  const hatKinder = new Set(
    knoten.filter(k => k.aktiv && k.elternId !== null).map(k => k.elternId as string),
  );
  const blaetter = knoten.filter(k => k.aktiv && k.relevantFuerFrist && !hatKinder.has(k.id)
    // Ein Blatt ohne auswertbare Bedingung ist kein Termin, sondern eine Luecke
    // im Plan (v4.134). Es hier mitzuzaehlen schoebe das Plan-Ende auf eine
    // Woche, die niemand je erreichen kann — und damit JEDEN Verbund auf
    // „Frist nicht haltbar", ganz gleich wie er laeuft.
    && !bedingungIstLeer(k.bedingung));
  return blaetter.length === 0 ? 0 : Math.max(...blaetter.map(k => k.sollWoche)) * 7;
}

/**
 * Die aktiven Knoten, die **nichts messen können** — keine eigene Bedingung und
 * keine (aktiven) Kinder, aus denen sich eine ergäbe.
 *
 * Eine Aussage über den PLAN, nicht über einen Vorgang: dieselbe Liste gilt für
 * jeden Verbund. Sie hat zwei Leser — das Fristen-Widget, das sie unter seiner
 * Liste beziffert, und der Meilenstein-Editor, der die Zeile markiert. Der
 * gemessene Anlass: im ausgelieferten Plan waren es 4 von 11 (20.08.2026), und
 * sie erzeugten den Großteil aller Frist-Anlässe.
 */
export function knotenOhneBedingung(
  knoten: readonly MeilensteinKnoten[],
): MeilensteinKnoten[] {
  const hatKinder = new Set(
    knoten.filter(k => k.aktiv && k.elternId !== null).map(k => k.elternId as string),
  );
  return knoten.filter(k => k.aktiv && !hatKinder.has(k.id) && bedingungIstLeer(k.bedingung));
}

/** Datum → ms; akzeptiert ISO und deutsches Format. `null` bei Unparsbarem. */
function alsMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const iso = parseGermanDate(raw);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Das späteste (`spaeter`) bzw. früheste parsbare Datum der Liste; `null` ohne eines. */
function waehleDatum(daten: readonly (string | null)[], spaeter: boolean): string | null {
  let best: string | null = null;
  let bestMs: number | null = null;
  for (const d of daten) {
    const ms = alsMs(d);
    if (ms === null) continue;
    if (bestMs === null || (spaeter ? ms > bestMs : ms < bestMs)) {
      best = d;
      bestMs = ms;
    }
  }
  return best;
}

/** Frühestes parsbares Datum eines Feldes über die Teilvorhaben (ISO). */
function fruehestesFeldDatum(ctx: BedingungsKontext, feldId: string): string | null {
  return waehleDatum((ctx.get(feldId) ?? []).map(roh => parseGermanDate(roh) || null), false);
}

/**
 * Der Tag, an dem eine **erfüllte** Bedingung wahr wurde — der Ist-Termin, wenn
 * der Knoten kein `istDatumFeld` nennt.
 *
 * - Blatt: das früheste Datum **seines** Feldes über die Teilvorhaben. Bei
 *   „A nach B" (`datumNachFeld`) ist das A — das Vergleichsfeld B liegt per
 *   Definition davor und hat den Meilenstein nicht ausgelöst.
 * - „alle": das **späteste** Datum der Teile — wahr erst, wenn der letzte zutrifft.
 * - „eine": das **früheste** Datum der **zutreffenden** Teile; ein Teil, der
 *   nicht zutrifft, hat nichts ausgelöst, auch wenn sein Feld ein Datum trägt.
 *
 * Teile ohne Datum (Status-, Förderart-Vergleiche) fallen heraus. Vorher galt
 * das früheste Datum ALLER Bedingungsfelder: bei „alle" maß das den ersten statt
 * den letzten Schritt, und die Abweichung sah besser aus, als sie war.
 */
function erfuellungsDatum(b: Bedingung, ctx: BedingungsKontext, heute: string): string | null {
  if ('alle' in b) return waehleDatum(b.alle.map(x => erfuellungsDatum(x, ctx, heute)), true);
  if ('einige' in b) {
    const zutreffend = b.einige.filter(x => pruefeBedingung(x, ctx, heute));
    return waehleDatum(zutreffend.map(x => erfuellungsDatum(x, ctx, heute)), false);
  }
  return fruehestesFeldDatum(ctx, b.feldId);
}

/** Gilt der Knoten für diesen Verbund? Inaktive und typ-fremde zählen nirgends mit. */
/**
 * Gilt ein Knoten für diesen Antragstyp? Leere Liste = für alle. Exportiert,
 * weil die Probe am Bestand (`probe.ts`) denselben Nenner braucht — eine zweite
 * Fassung dieser Regel liefe beim ersten neuen Typ still auseinander.
 */
export function giltFuerTyp(
  nurTypen: readonly AntragstypBucket[], typ: AntragstypBucket | null,
): boolean {
  if (nurTypen.length === 0) return true;
  return typ !== null && nurTypen.includes(typ);
}

function istRelevant(k: MeilensteinKnoten, typ: AntragstypBucket | null): boolean {
  return k.aktiv && giltFuerTyp(k.nurTypen, typ);
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
      const istDatum = k.istDatumFeld
        ? fruehestesFeldDatum(ctx, k.istDatumFeld)
        : erfuellungsDatum(k.bedingung, ctx, heute);
      ergebnis = { erreicht: true, ueberKinder: false, istDatum };
    } else {
      const relevanteKinder = (kinder.get(k.id) ?? []).filter(c => istRelevant(c, typ));
      const kindBefunde = relevanteKinder.map(befund);
      const alleErreicht = kindBefunde.length > 0 && kindBefunde.every(b => b.erreicht);
      // Ein Sammel-Knoten ist erst fertig, wenn sein LETZTES Kind fertig ist —
      // dieselbe Regel wie bei „alle" innerhalb einer Bedingung.
      const spaetestes = alleErreicht ? waehleDatum(kindBefunde.map(b => b.istDatum), true) : null;
      ergebnis = { erreicht: alleErreicht, ueberKinder: alleErreicht, istDatum: spaetestes };
    }

    laufend.delete(k.id);
    memo.set(k.id, ergebnis);
    return ergebnis;
  };

  for (const k of byId.values()) befund(k);
  return memo;
}

/**
 * Der Zustand eines Knotens fuer diesen Verbund.
 *
 * `bewertbar` steht VOR allen anderen Faellen (v4.134): ein Knoten ohne
 * auswertbare Bedingung und ohne Kinder hat keinen Zustand, den man messen
 * koennte. Vorher fiel er in die Zeitrechnung und galt ab seiner Soll-Woche fuer
 * immer als `gerissen` — die Anzeige meldete einen Rueckstand, wo eine
 * Pflegeluecke war. Auch die Gegenrichtung ist zu: ein leeres `{ alle: [] }`
 * wertet `true` aus und haette den Knoten dauerhaft als `erreicht` gemeldet,
 * ohne je ein Datum gesehen zu haben.
 */
function zustandVon(
  relevant: boolean, bewertbar: boolean, erreicht: boolean,
  sollMs: number | null, heuteMs: number,
): MstZustand {
  if (!relevant) return 'nichtRelevant';
  if (!bewertbar) return 'ohneBedingung';
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
  const ankerMs = alsMs(eingabe.anker);
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
    // Auswertbar ist ein Knoten mit eigener Bedingung ODER mit Kindern, aus
    // denen sich eine ergibt — die Sammel-Knoten des Seeds sind genau das.
    const bewertbar = !bedingungIstLeer(k.bedingung) || hatRelevanteKinder.has(k.id);
    const zustand = zustandVon(relevant, bewertbar, b.erreicht, sollMs, heuteMs);
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

    // Nur messbare Blaetter tragen die Prognose. Ein Knoten ohne Bedingung
    // liefert keinen Verzug, wohl aber eine Soll-Woche — und die verschoebe das
    // Plan-Ende ins Unerreichbare (s. planEndeTage).
    if (relevant && bewertbar && k.relevantFuerFrist && !hatRelevanteKinder.has(k.id)) {
      fristBlaetter.push({ zustand, sollMs, sollWoche: k.sollWoche });
    }
  }

  // Eine Frist, nicht zwei (v6.66): nur eine LAUFENDE Uhr hat ein Zieldatum und
  // Resttage. Eine angehaltene hat keins — dort sagt die Prognose „angehalten".
  const fristDatum = eingabe.frist.zustand === 'laeuft' ? eingabe.frist.zielDatum : null;
  const restTage = restTageBis(alsMs(fristDatum), heuteMs);

  return {
    verbundId: eingabe.verbundId,
    antragsdatum: eingabe.antragsdatum,
    anker: ankerIso,
    typ: eingabe.typ,
    wocheAktuell: ankerMs === null ? null : Math.max(1, Math.floor((heuteMs - ankerMs) / (7 * MS_TAG)) + 1),
    fristDatum,
    restTage,
    fristZustand: eingabe.frist.zustand,
    ergebnisse,
    prognose: leitePrognoseAb(
      plan, fristBlaetter, restTage, heuteMs, eingabe.terminal === true, ankerMs !== null, eingabe.frist.zustand,
    ),
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
  fristZustand: FristLage['zustand'],
): Prognose {
  if (fristBlaetter.length === 0) return 'unbekannt';
  if (terminal || fristBlaetter.every(b => b.zustand === 'erreicht')) return 'abgeschlossen';
  // Steht die Uhr (Entscheidung, bewilligt vor dem Verwendungsnachweis), gibt es
  // nichts mehr zu prognostizieren — die Frist-Spalte sagt dasselbe Wort.
  if (fristZustand === 'angehalten') return 'angehalten';
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
