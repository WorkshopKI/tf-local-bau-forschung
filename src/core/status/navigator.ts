/**
 * Der **Nächster-Schritt-Navigator**: welche Kürzel kommen in C16 als Nächstes
 * in Frage?
 *
 * Die App setzt nichts. Sie liest die importierte Trigger-Tabelle und grenzt ein:
 * ein Kürzel ist Kandidat, wenn mindestens eine seiner Trigger-Zeilen unter dem
 * aktuellen Status feuern würde und keine ihrer Vorbedingungen nachweislich
 * verletzt ist.
 *
 * **Was der Navigator NICHT weiß**: was fachlich als Nächstes ansteht. Er kennt
 * nur die maschinellen Vorbedingungen von C16. Ohne die Relevanz-Liste bleibt
 * die Menge deshalb groß — das ist kein Defekt, sondern der Grund, warum es die
 * Relevanz-Häkchen gibt (Konzept 4.1). Ob gefiltert wurde, steht im Ergebnis und
 * gehört in die Anzeige.
 *
 * **Drei Ehrlichkeits-Regeln**, die den Rest des Moduls erklären:
 *
 * 1. Eine Bedingung, die sich nicht auswerten lässt (Status unbekannt, Kürzel
 *    nicht im Katalog, undeutbares Argument), macht den Kandidaten **nicht
 *    ungültig** — sie macht ihn `unpruefbar` und nennt den Grund.
 * 2. Die Zeilen eines Kürzels sind **alternative Wirkungen**, keine gemeinsame
 *    Bedingung: `AAE` hat je eine Zeile für `<59` und für `<99`. Verletzt die
 *    eine, kann die andere trotzdem feuern. Ein Kürzel fällt erst raus, wenn
 *    ALLE seine Zeilen verletzt sind.
 * 3. Mail-Platzhalter (`#TB1`, `#BA1` …) werden **roh durchgereicht**. Ihre
 *    Auflösung auf Personen ist an C16 nicht verifiziert (offener Punkt 2 im
 *    Konzept); eine erfundene Legende wäre schlimmer als keine.
 *
 * **Und eine Auswahl-Regel**: geprüft wird nur die Trigger-Menge des Programms,
 * zu dem der Antrag gehört (`FM_NUMMER`). Kennen wir das Programm nicht oder
 * führt die Tabelle keines dazu, ist das Ergebnis leer und sagt WELCHER der
 * beiden Fälle vorliegt — ein Ersatz-Programm gibt es nicht, dieselben Kürzel
 * lösen dort anderes aus.
 *
 * **Testkürzel der Zuarbeit** (`TTV1`, `TTV2`, `TVB1`, siehe `sonderkuerzel.ts`)
 * stehen nicht in der Kandidatenliste — sie sind kein Arbeitsschritt, sondern
 * Testeinträge in C16. Ausgeblendet heißt hier gezählt und benannt: die Fußzeile
 * nennt sie, damit „weg" nicht mit „gibt es nicht" verwechselt wird.
 *
 * Rein und deterministisch: keine IO, keine Uhr. Der Aufrufer entscheidet, gegen
 * welche Vorkommen geprüft wird — auf der Verbund-Seite sind das die Einträge
 * ALLER Teilvorhaben, und genau das muss die Anzeige dann auch sagen.
 */
import { kuerzelIndex } from './feld-zugriff';
import { normKey } from './normalisierung';
import { betrifftRolle, rollenLabel, rollenVonFeld } from './rollen';
import { istTestKuerzel, sonderKuerzel } from './sonderkuerzel';
import { triggerFuerProgramm } from './trigger-share';
import { triggerSegmenteVon, triggerSatzVon, alsText, type TextbausteinLegende } from './trigger-satz';
import { erklaereSegmente, type ErklaerKatalog, type ErklaertesSegment } from './trigger-erklaerung';
import { pruefeTriggerBedingungen, type BedingungsUrteil, type TriggerKontext } from './trigger-bedingung';
import type { FeldVorkommen } from './feld-aufloesung';
import type { Rolle, StatusFeldEintrag, TriggerParam, TriggerZeile } from './typen';

export type { BedingungsUrteil } from './trigger-bedingung';

/** Eine Trigger-Zeile in der Kandidaten-Ansicht. */
export interface TriggerWirkung {
  folge: number;
  /** Deutsche Satzform — die Verkettung von `segmente`, nie ein zweiter Weg. */
  satz: string;
  /**
   * Derselbe Satz in seinen erklärbaren Stücken. Ohne `katalog` in der Eingabe
   * bleiben die Segmente unerklärt (die Anzeige zeigt dann keine Geste), der
   * Text ist derselbe.
   */
  segmente: ErklaertesSegment[];
  urteil: BedingungsUrteil;
  /** Je Bedingung ein Satz — warum verletzt bzw. warum nicht prüfbar. */
  gruende: string[];
  /** Ändert die Zeile einen Status? Solche Kandidaten stehen oben. */
  aendertStatus: boolean;
}

export interface NavigatorKandidat {
  /** Kürzel, wie es in der Trigger-Tabelle steht. */
  kuerzel: string;
  /** Katalog-Feld (`D_ABLW`), falls der Kürzel-Katalog es kennt. */
  feldId: string | null;
  /** Bezeichnung aus der Kürzel-Zuarbeit; ohne Katalog-Eintrag das Kürzel selbst. */
  label: string;
  rollen: readonly Rolle[];
  /** `AB/FB` bzw. `alle` — dieselbe Schreibweise wie im Glossar. */
  rollenText: string;
  /** Zeilen, die feuern könnten (Urteil ≠ `verletzt`), in Folge-Reihenfolge. */
  wirkung: TriggerWirkung[];
  /** Mindestens eine Bedingung ließ sich nicht auswerten. */
  unpruefbar: boolean;
  /** Unaufgelöste Mail-Platzhalter der Wirkungen (`#TB1` …), ohne Doppelte. */
  platzhalter: string[];
  /** Das Kürzel steht in der Trigger-Tabelle, aber nicht im Kürzel-Katalog. */
  unbekannt: boolean;
}

export interface NavigatorErgebnis {
  kandidaten: NavigatorKandidat[];
  /** Kürzel, die ausschieden, weil ihre Spalte schon ein Datum trägt. */
  bereitsGesetzt: number;
  /** Kürzel, deren Zeilen allesamt verletzt waren. */
  verletzt: number;
  /** Testkürzel der Zuarbeit — ausgeblendet, aber gezählt (siehe `sonderkuerzel.ts`). */
  testKuerzel: number;
  /**
   * Kürzel, die die Fassung nicht als relevant markiert. Gehört zur Fußzeile:
   * ohne diese Zahl las sich `geprueft` als Gesamtsumme, die die übrigen
   * Zähler nie ergaben (v4.124).
   */
  nichtRelevant: number;
  /** Kürzel, die eine andere Rolle betreffen als die gewählte. */
  andereRolle: number;
  /** Trigger-Zeilen, die der Parser nicht deuten konnte (`geparst: null`). */
  nichtInterpretiert: number;
  /** Wurde auf Relevanz gefiltert? `false` = die Fassung markiert noch keine. */
  relevanzGefiltert: boolean;
  /** Wie viele verschiedene Kürzel die Trigger-Tabelle überhaupt führt. */
  geprueft: number;
  /** Das Programm des Antrags ist unbekannt (`FM_NUMMER` fehlt oder ist leer). */
  programmUnbekannt: boolean;
  /** Programm bekannt, aber die Trigger-Tabelle führt keine Zeile dazu. */
  programmOhneTrigger: boolean;
}

export interface NavigatorEingabe {
  trigger: readonly TriggerZeile[];
  /**
   * Programm-/Richtlinien-Nummer des Antrags (`FM_NUMMER` → `unterprogramm_id`).
   * `null` = unbekannt; dann wird NICHTS geprüft, statt ein fremdes Programm zu
   * nehmen.
   */
  programm: string | null;
  /** Die Felder der aktiven Fassung — Quelle für Bezeichnung, Rollen, Relevanz. */
  felder: readonly StatusFeldEintrag[];
  /** Gesetzte Einträge des Antrags/Verbunds (`sammleVorkommen`). */
  vorkommen: readonly FeldVorkommen[];
  /** Aktueller Status-Code; `null`, wenn der Text nicht im Katalog steht. */
  statusCode: number | null;
  /** Rollen-Filter. Default `alle`; neutrale Kürzel bleiben immer sichtbar. */
  rolle?: Rolle | 'alle';
  /** Optionale Textbaustein-Legende für die Mail-Sätze. */
  legende?: TextbausteinLegende;
  /**
   * Fassungs-Ausschnitt für die Zeichen-Erklärungen (`ABB` → „Bewilligung").
   * Optional, weil der Navigator ohne ihn dasselbe Ergebnis liefert — nur eben
   * ohne die Erklärungen an den Segmenten.
   */
  katalog?: ErklaerKatalog;
}

/**
 * Mail-Platzhalter des Fachsystems: `#TB1`, `#BA1`, `#FB1`, `#TV1` …
 *
 * Bewusst großzügig gefasst (Buchstaben + optionale Ziffern) — die vollständige
 * Liste ist unbekannt, und ein zu enges Muster ließe stillschweigend welche
 * durchrutschen.
 */
const PLATZHALTER_RE = /#[A-Za-z][A-Za-z0-9]{0,5}/g;

function platzhalterAus(p: TriggerParam): string[] {
  if (p.art !== 'vorgEintragMail') return [];
  const quelle = `${p.empfaenger} ${p.cc ?? ''}`;
  return quelle.match(PLATZHALTER_RE) ?? [];
}

/** Setzt die Zeile einen Status? Nur solche Kandidaten bewegen das Verfahren. */
function aendertStatus(p: TriggerParam): boolean {
  if (p.art === 'statusSetzen') return true;
  return p.art === 'statusTvVb' && (p.statusTv !== null || p.statusVb !== null);
}

/**
 * Der Prüfkontext des Navigators: der {@link TriggerKontext} plus die Quelle der
 * Zeichen-Erklärungen. Letztere gehört nicht ins Prädikat — sie ist Anzeige.
 */
interface Kontext extends TriggerKontext {
  /** Quelle der Zeichen-Erklärungen; fehlt sie, bleiben die Segmente unerklärt. */
  katalog?: ErklaerKatalog;
}

/**
 * Eine Trigger-Zeile in der Kandidaten-Ansicht: Satzform vom Navigator, Urteil
 * vom geteilten Auswerter ({@link pruefeTriggerBedingungen}).
 */
function pruefeZeile(zeile: TriggerZeile, k: Kontext, legende?: TextbausteinLegende): TriggerWirkung {
  const p = zeile.geparst;
  const roh = triggerSegmenteVon(zeile, legende);
  const basis = {
    folge: zeile.folge,
    satz: alsText(roh),
    segmente: k.katalog ? erklaereSegmente(k.katalog, roh, k.felderNachCode) : [...roh],
  };
  if (!p) {
    // Nicht gedeutete Zeilen zählen separat und tragen hier nichts bei — sie
    // als „erfüllt" mitzuzählen erfände eine Wirkung, die wir nicht kennen.
    return { ...basis, urteil: 'unpruefbar', gruende: ['Zeile nicht interpretiert.'], aendertStatus: false };
  }
  const befund = pruefeTriggerBedingungen(p, k);
  return { ...basis, urteil: befund.urteil, gruende: befund.gruende, aendertStatus: aendertStatus(p) };
}

/**
 * Berechnet die Kandidaten. Rein — dieselbe Eingabe liefert dieselbe Ausgabe.
 *
 * Reihenfolge der Ausgabe: erst was den Status bewegt, dann Prüfbares vor
 * Unprüfbarem, dann alphabetisch. Das ist eine Anzeige-Entscheidung, keine
 * fachliche Rangfolge — der Navigator behauptet nirgends, das erste Kürzel sei
 * das richtige.
 */
export function navigatorKandidaten(e: NavigatorEingabe): NavigatorErgebnis {
  // Zuerst das Programm: dieselben Kürzel lösen in Richtlinie 76 und 131
  // Verschiedenes aus. Ohne bekanntes Programm bleibt die Menge leer.
  const programm = (e.programm ?? '').trim();
  const eigene = triggerFuerProgramm(e.trigger, programm);
  const leerGrund = {
    programmUnbekannt: programm === '',
    programmOhneTrigger: programm !== '' && eigene.length === 0,
  };

  const felderNachCode = kuerzelIndex(e.felder);

  const gesetzt = new Set<string>();
  for (const v of e.vorkommen) {
    if (v.feld.code) gesetzt.add(normKey(v.feld.code));
  }

  // Gefiltert wird nur, wenn die Fassung überhaupt Relevanz kennt. Eine leere
  // Liste als „nichts ist relevant" zu lesen, machte den Navigator am ersten Tag
  // leer — und zwar ohne dass jemand merkte, warum (dieselbe Regel wie in
  // `baueHerleitung`).
  const relevante = new Set<string>();
  for (const f of e.felder) {
    if (f.relevant === true && f.code) relevante.add(normKey(f.code));
  }
  const relevanzGefiltert = relevante.size > 0;

  // Der Navigator kennt nur EINE Menge gesetzter Kürzel: `vorkommen` ist auf der
  // Verbund-Seite bereits die Vereinigung aller Teilvorhaben. Die Trennung
  // TV/Verbund braucht erst die Verlaufsableitung, die je Spur fragt.
  const kontext: Kontext = {
    felderNachCode, gesetztTv: gesetzt, gesetztVerbund: gesetzt,
    statusCode: e.statusCode, ...(e.katalog ? { katalog: e.katalog } : {}),
  };
  const rolle = e.rolle ?? 'alle';

  // Zeilen je Kürzel bündeln, Reihenfolge der Tabelle bewahren.
  const jeKuerzel = new Map<string, { kuerzel: string; zeilen: TriggerZeile[] }>();
  let nichtInterpretiert = 0;
  for (const z of eigene) {
    if (!z.geparst) nichtInterpretiert += 1;
    const key = normKey(z.kuerzel);
    if (!key) continue;
    const eintrag = jeKuerzel.get(key);
    if (eintrag) eintrag.zeilen.push(z);
    else jeKuerzel.set(key, { kuerzel: z.kuerzel, zeilen: [z] });
  }

  const kandidaten: NavigatorKandidat[] = [];
  let bereitsGesetzt = 0;
  let verletzt = 0;
  let testKuerzel = 0;
  let nichtRelevant = 0;
  let andereRolle = 0;

  for (const [key, { kuerzel, zeilen }] of jeKuerzel) {
    // Testkürzel der Zuarbeit sind kein Arbeitsschritt (Fachabstimmung V6). Sie
    // fliegen VOR jedem anderen Filter raus, damit sie unter jeder Rollenwahl
    // und in jeder Relevanz-Fassung verschwinden — gezählt und in der Fußzeile
    // genannt, nicht stillschweigend geschluckt.
    if (istTestKuerzel(kuerzel)) { testKuerzel += 1; continue; }
    // Ab hier zählt jeder Ausschluss (v4.124): die Fußzeile las sich als
    // Aufschlüsselung von `geprueft`, aber Relevanz- und Rollenfilter warfen
    // die Mehrheit ohne Zahl und ohne Satz weg — Kandidaten + bereitsGesetzt +
    // verletzt + Testkürzel ergaben nie die genannte Gesamtzahl.
    if (relevanzGefiltert && !relevante.has(key)) { nichtRelevant += 1; continue; }
    const feld = felderNachCode.get(key) ?? null;
    // Ein neutrales oder unbekanntes Kürzel bleibt unter jeder Rollenwahl
    // sichtbar — „jeder darf setzen", nie „niemand" (Pitfall #43).
    if (feld && !betrifftRolle(feld, rolle)) { andereRolle += 1; continue; }
    if (gesetzt.has(key)) { bereitsGesetzt += 1; continue; }

    const geprueft = [...zeilen]
      .sort((a, b) => a.folge - b.folge)
      .map(z => pruefeZeile(z, kontext, e.legende));
    const moeglich = geprueft.filter(w => w.urteil !== 'verletzt');
    if (moeglich.length === 0) { verletzt += 1; continue; }

    const platzhalter: string[] = [];
    for (const z of zeilen) {
      if (!z.geparst) continue;
      for (const ph of platzhalterAus(z.geparst)) {
        if (!platzhalter.includes(ph)) platzhalter.push(ph);
      }
    }

    kandidaten.push({
      kuerzel,
      feldId: feld?.feldId ?? null,
      // Ohne Katalog-Eintrag stand hier bisher das Kürzel selbst („ID · ID").
      // Was die Fachseite benannt hat, steht jetzt da — der `unbekannt`-Hinweis
      // bleibt trotzdem: im Katalog steht es weiterhin nicht.
      label: feld?.label ?? sonderKuerzel(kuerzel)?.label ?? kuerzel,
      rollen: feld ? rollenVonFeld(feld) : [],
      rollenText: feld ? rollenLabel(feld) : 'alle',
      wirkung: moeglich,
      unpruefbar: moeglich.some(w => w.urteil === 'unpruefbar'),
      platzhalter,
      unbekannt: feld === null,
    });
  }

  kandidaten.sort((a, b) => {
    const statusA = a.wirkung.some(w => w.aendertStatus && w.urteil === 'erfuellt') ? 0 : 1;
    const statusB = b.wirkung.some(w => w.aendertStatus && w.urteil === 'erfuellt') ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;
    if (a.unpruefbar !== b.unpruefbar) return a.unpruefbar ? 1 : -1;
    return a.kuerzel.localeCompare(b.kuerzel, 'de');
  });

  return {
    kandidaten,
    bereitsGesetzt,
    verletzt,
    testKuerzel,
    nichtRelevant,
    andereRolle,
    nichtInterpretiert,
    relevanzGefiltert,
    geprueft: jeKuerzel.size,
    ...leerGrund,
  };
}

/** Eine Wirkungszeile im Glossar: welches Programm, welche Folge, welcher Satz. */
export interface WirkungsZeile {
  programm: string;
  folge: number;
  satz: string;
}

/**
 * Die Trigger-Wirkung eines Kürzels — fürs Glossar, wo kein Antrags-Kontext
 * existiert und deshalb nichts geprüft werden kann.
 *
 * Hier wird **über alle Programme** gezeigt, mit dem Programm an jeder Zeile:
 * das Glossar erklärt das Kürzel, nicht einen Vorgang, und dasselbe Kürzel wirkt
 * je Richtlinie verschieden. Ohne die Programm-Angabe stünden widersprüchliche
 * Sätze untereinander, ohne dass man den Grund sähe.
 *
 * Bewusst dieselbe Satzform wie im Navigator: der Nutzer soll den Satz im
 * Glossar wiedererkennen, den er am Antrag gesehen hat.
 */
export function wirkungZeilen(
  trigger: readonly TriggerZeile[], kuerzel: string, legende?: TextbausteinLegende,
): WirkungsZeile[] {
  const key = normKey(kuerzel);
  return trigger
    .filter(z => normKey(z.kuerzel) === key)
    .sort((a, b) => (
      a.programm.localeCompare(b.programm, 'de', { numeric: true }) || a.folge - b.folge
    ))
    .map(z => ({ programm: z.programm, folge: z.folge, satz: triggerSatzVon(z, legende) }));
}

/** Eine Wirkung, die in mehreren Richtlinien gleich lautet — mit Erklärungen. */
export interface WirkungsGruppe {
  /** Die Segmente EINER der zusammengefassten Zeilen — alle tragen denselben Satz. */
  segmente: ErklaertesSegment[];
  /** Die Richtlinien, in denen sie so lautet, aufsteigend. */
  programme: string[];
  /**
   * Die Zielstatus dieser Wirkung — für den Sprung ins Glossar. Leer bei
   * Mail-Triggern. **Entdoppelt:** setzt ein Trigger TV und VB auf denselben
   * Code, ist das EIN Ziel; zwei gleiche Sprungmarken nebeneinander sähen aus,
   * als führten sie woandershin.
   */
  zielStatus: number[];
}

/**
 * Die Trigger-Wirkung eines Kürzels, nach WORTLAUT gebündelt statt je Programm.
 *
 * `wirkungZeilen` liefert eine Zeile je (Richtlinie, Folge) — im Kürzel-Katalog
 * richtig, weil dort der Unterschied zwischen den Richtlinien die Frage ist. Im
 * Glossar ist es die Erklärung, und dieselbe Aussage zwölfmal untereinander liest
 * niemand. Gleich lautende Zeilen stehen deshalb einmal da, mit „in 131, 133 und
 * 137" daneben (`richtlinienSatz` in `trigger-herkunft.ts`).
 *
 * Bewusst dieselbe Satzform und dieselbe Erklärung wie überall sonst — der Nutzer
 * soll den Satz wiedererkennen, den er am Antrag gesehen hat.
 */
export function wirkungGruppen(
  trigger: readonly TriggerZeile[], kuerzel: string,
  katalog: ErklaerKatalog, legende?: TextbausteinLegende,
): WirkungsGruppe[] {
  const key = normKey(kuerzel);
  const jeSatz = new Map<string, WirkungsGruppe>();

  for (const z of trigger) {
    if (normKey(z.kuerzel) !== key) continue;
    const segmente = erklaereSegmente(katalog, triggerSegmenteVon(z, legende));
    const satz = alsText(segmente);
    let gruppe = jeSatz.get(satz);
    if (!gruppe) {
      gruppe = { segmente, programme: [], zielStatus: zielStatusVon(z.geparst) };
      jeSatz.set(satz, gruppe);
    }
    if (z.programm !== '' && !gruppe.programme.includes(z.programm)) {
      gruppe.programme.push(z.programm);
    }
  }

  for (const g of jeSatz.values()) {
    g.programme.sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }
  return [...jeSatz.values()];
}

/** Welche Statuscodes ein Trigger setzt — entdoppelt, leer wenn er keinen setzt. */
function zielStatusVon(p: TriggerParam | null): number[] {
  if (p === null) return [];
  if (p.art === 'statusSetzen') return [p.status];
  if (p.art === 'statusTvVb') {
    return [...new Set([p.statusTv, p.statusVb].filter((c): c is number => c !== null))];
  }
  return [];
}
