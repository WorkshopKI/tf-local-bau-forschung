/**
 * Anzeige-Modell von „Änderungen der letzten Nacht" — rein, ohne IO und React.
 *
 * **Gruppiert wird nach ANTRAG, nicht nach Feld** (v4.134). Die Feld-Gruppierung
 * beantwortete eine Frage über den ganzen Bestand („216× D_ANT geändert") und
 * ließ genau die offen, mit der ein Arbeitstag anfängt: *ist an meinen Vorgängen
 * etwas passiert?* Am echten Bestand sind das je Nacht 7–69 Einträge auf 3–18
 * Anträgen (gemessen über fünf Läufe im August 2026, 195–525 Einträge gesamt) —
 * eine Liste, die man liest, statt sie zu überfliegen.
 *
 * **Die Zeile ist eine Segment-Liste, kein Satz.** Bis v4.135 stand hier ein
 * fertiger String („D_AB, D_ABB +2 gesetzt"). An einem String lässt sich kein
 * einzelnes Kürzel aufhängen — und genau das braucht die Anzeige: jedes Kürzel
 * trägt seinen eigenen Tooltip mit Klartext, Datum und Werten. Deshalb behält
 * jedes Segment seine Einträge, statt sie in Text aufzulösen.
 *
 * **Weiterhin keine Personen-Achse** (Pitfall #48). Das Journal führt keine
 * Bearbeiter-Kürzel, und keine Zeile hier sagt, WER etwas gesetzt hat — sie sagt,
 * WAS sich an WELCHEM Vorgang geändert hat. Der Bearbeiter-Ausschnitt des
 * Widgets wählt Anträge aus (dieselbe Sicht wie Startseite und Liste), er
 * erzeugt keine Aussage über Personen.
 */
import type { JournalEintrag } from '@/core/status';
// Der Wortlaut aller Journal-Ansichten lebt an EINER Stelle: dieselbe Änderung
// darf im Widget nicht anders heißen als am Antrag (Modulkopf `journalTexte`).
// Der Tooltip zeigt zudem `eintragText` — zwei Formulierungsorte wären hier
// besonders teuer, weil beide Fassungen in derselben Zeile sichtbar werden.
import { ART_TEXT } from '@/plugins/antraege/status/journalTexte';

export { ART_TEXT };

/** Reihenfolge der Arten in einer Zeile — die einschneidendste zuerst. */
const ART_FOLGE: ReadonlyArray<JournalEintrag['art']> = [
  'antrag-neu', 'antrag-fehlt', 'gesetzt', 'geaendert', 'geleert',
];

/** Ein Kürzel der Zeile mit allem, was das Journal über es sagt. */
export interface NachtlaufKuerzel {
  /** Rohe Journal-Spalte, `D_AB` / `STATUS_TV` (= `feldId` des Katalogs). */
  feld: string;
  /** Die Einträge dieses Feldes in diesem Lauf/Fenster, aufsteigend nach Datum. */
  eintraege: JournalEintrag[];
}

/** Was einer Art an einem Antrag widerfahren ist: „D_AB, D_ABB +2 gesetzt". */
export interface NachtlaufSegment {
  art: JournalEintrag['art'];
  /** `ART_TEXT[art]` — hier mitgeführt, damit die Anzeige nicht nachschlagen muss. */
  artText: string;
  /** Gezeigte Kürzel (auf `maxKuerzel` gekappt). Leer bei `antrag-neu`/`-fehlt`. */
  kuerzel: NachtlaufKuerzel[];
  /** Der „+N"-Rest — nicht verworfen, sondern für dessen eigenen Tooltip behalten. */
  versteckt: NachtlaufKuerzel[];
}

/** Eine Zeile: ein Antrag mit dem, was sich an ihm geändert hat. */
export interface NachtlaufZeile {
  antragId: string;
  /** Akronym, sonst das Aktenzeichen. */
  label: string;
  /** Zahl der Einträge dieses Antrags in diesem Lauf. */
  anzahl: number;
  segmente: NachtlaufSegment[];
  /** Mindestens ein Eintrag ist nur als Zeitraum belegt (Wochenende, Ausfall). */
  unscharf: boolean;
}

/** Wie viele Feldnamen je Art in einer Zeile stehen, bevor „+N" übernimmt. */
export const MAX_KUERZEL_STANDARD = 3;

/** Wonach die Zeilen geordnet werden. */
export type NachtlaufSortierung = 'anzahl' | 'label';

export interface GruppierOptionen {
  /** Feldnamen je Art, bevor „+N" übernimmt. Default {@link MAX_KUERZEL_STANDARD}. */
  maxKuerzel?: number;
  /** `'anzahl'` = änderungsreichste zuerst (Default), `'label'` = alphabetisch. */
  sortierung?: NachtlaufSortierung;
}

/** Die Kürzel einer Art, jedes mit seinen Einträgen (Reihenfolge des Auftretens). */
function kuerzelDerArt(eintraege: readonly JournalEintrag[]): NachtlaufKuerzel[] {
  const proFeld = new Map<string, JournalEintrag[]>();
  for (const e of eintraege) {
    if (!e.feld) continue;
    const liste = proFeld.get(e.feld);
    if (liste) liste.push(e); else proFeld.set(e.feld, [e]);
  }
  return [...proFeld.entries()].map(([feld, es]) => ({
    feld,
    eintraege: [...es].sort((a, b) => a.datum.localeCompare(b.datum)),
  }));
}

/**
 * Einträge → eine Zeile je Antrag.
 *
 * `label` löst das Aktenzeichen auf (Akronym aus dem Antrags-Store); ein
 * unbekannter Antrag behält sein Aktenzeichen, statt aus der Liste zu fallen —
 * „nicht mehr im Export" ist genau der Fall, der sonst unsichtbar würde.
 */
export function gruppiereNachAntrag(
  eintraege: readonly JournalEintrag[],
  label: (antragId: string) => string | undefined,
  opt: GruppierOptionen = {},
): NachtlaufZeile[] {
  const maxKuerzel = Math.max(1, Math.round(opt.maxKuerzel ?? MAX_KUERZEL_STANDARD));
  const proAntrag = new Map<string, JournalEintrag[]>();
  for (const e of eintraege) {
    const liste = proAntrag.get(e.antragId);
    if (liste) liste.push(e); else proAntrag.set(e.antragId, [e]);
  }
  const zeilen: NachtlaufZeile[] = [];
  for (const [antragId, eigene] of proAntrag) {
    const proArt = new Map<JournalEintrag['art'], JournalEintrag[]>();
    for (const e of eigene) {
      const liste = proArt.get(e.art);
      if (liste) liste.push(e); else proArt.set(e.art, [e]);
    }
    const segmente: NachtlaufSegment[] = [];
    for (const art of ART_FOLGE) {
      const es = proArt.get(art);
      if (!es) continue;
      const alle = kuerzelDerArt(es);
      segmente.push({
        art,
        artText: ART_TEXT[art],
        kuerzel: alle.slice(0, maxKuerzel),
        versteckt: alle.slice(maxKuerzel),
      });
    }
    zeilen.push({
      antragId,
      label: label(antragId)?.trim() || antragId,
      anzahl: eigene.length,
      segmente,
      unscharf: eigene.some(e => e.unscharf === true),
    });
  }
  zeilen.sort(opt.sortierung === 'label'
    ? (a, b) => a.label.localeCompare(b.label, 'de') || a.antragId.localeCompare(b.antragId)
    : (a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label, 'de'));
  return eindeutigeLabel(zeilen);
}

/**
 * Zwei Teilvorhaben eines Verbunds tragen DASSELBE Akronym.
 *
 * Ungehindert stehen dann zwei Zeilen mit identischer Beschriftung
 * untereinander, und die Liste sieht aus, als zeige sie etwas doppelt
 * (gemessen: „LADScessible" zweimal, in Wahrheit 16KN110645 und 16KN110646).
 * Zusammenfassen wäre falsch — die Änderungen betreffen verschiedene Anträge —,
 * also bekommt das Akronym sein Aktenzeichen dazu, **nur wo es mehrdeutig ist**.
 */
function eindeutigeLabel(zeilen: NachtlaufZeile[]): NachtlaufZeile[] {
  const proLabel = new Map<string, number>();
  for (const z of zeilen) proLabel.set(z.label, (proLabel.get(z.label) ?? 0) + 1);
  return zeilen.map(z => ((proLabel.get(z.label) ?? 0) > 1 && z.label !== z.antragId
    ? { ...z, label: `${z.label} · ${z.antragId}` }
    : z));
}

/**
 * Ein Segment als Text: „D_AB, D_ABB +2 gesetzt".
 *
 * Die Anzeige rendert die Kürzel EINZELN (jedes trägt seinen Tooltip) und baut
 * diesen Satz nicht. Er wird trotzdem hier gebildet, weil die Zeile ihn als
 * `aria-label` braucht: was die Maus in mehreren Blasen erfährt, muss die
 * Vorlesesoftware in einem Stück bekommen.
 */
export function segmentText(s: NachtlaufSegment): string {
  if (s.kuerzel.length === 0) return s.artText;
  const gezeigt = s.kuerzel.map(k => k.feld).join(', ');
  return `${gezeigt}${s.versteckt.length > 0 ? ` +${s.versteckt.length}` : ''} ${s.artText}`;
}

/** Die ganze Zeile als Text — s. {@link segmentText}. */
export function zeileText(z: NachtlaufZeile): string {
  return z.segmente.map(segmentText).join(' · ');
}

/** „7 Änderungen an 3 Anträgen" — der Zähler der Kopfzeile. */
export function nachtlaufBilanz(zeilen: readonly NachtlaufZeile[]): string {
  const eintraege = zeilen.reduce((n, z) => n + z.anzahl, 0);
  if (eintraege === 0) return '0';
  const a = `${eintraege.toLocaleString('de-DE')} ${eintraege === 1 ? 'Änderung' : 'Änderungen'}`;
  const b = `${zeilen.length.toLocaleString('de-DE')} ${zeilen.length === 1 ? 'Vorgang' : 'Vorgängen'}`;
  return `${a} an ${b}`;
}
