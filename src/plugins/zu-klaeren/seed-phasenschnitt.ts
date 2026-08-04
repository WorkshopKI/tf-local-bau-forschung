/**
 * Die erste Klärung: der ZAH-Phasenschnitt zur Abstimmung mit AB/FB.
 *
 * **Die Phasentabelle wird nicht abgeschrieben.** Die 30 Zeilen entstehen zur
 * Laufzeit aus `STATUS_CODE_KATALOG` (Bezeichnungen), `SEED_CODE_ZU_ZAH_PHASE`
 * (Zuordnung) und `SEED_MARKER_CODES` (die vier ohne Phase). Eine kopierte Liste
 * driftet beim ersten neuen Statuscode auseinander, und ein Fragebogen, der nach
 * einer Zuordnung fragt, die es nicht mehr gibt, ist schlimmer als keiner.
 *
 * Wörtlicher Text steht hier nur für die sieben Grundsatzfragen — jede mit der
 * Begründung, warum sie überhaupt eine Frage ist. Ohne diese Begründung liest sich
 * „32 ablehnungsreif" wie eine Behauptung statt wie ein Zweifel.
 *
 * **Eine neue Klärung anzulegen ist ein Zweizeiler**: ein `Klaerung`-Objekt und
 * eine Funktion, die ihre Punkte baut. Es gibt bewusst kein Bedienelement dafür —
 * Klärungen sind Seed-Daten, ihre Beantwortung ist die Arbeit.
 *
 * Rein: keine IO, keine Uhr.
 */
import {
  STATUS_CODE_KATALOG, SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES, ZAH_PHASEN_REIHENFOLGE,
} from '@/core/status';
import { OHNE_PHASE, type Klaerung, type KlaerungPunkt, type ZielWert } from './typen';

export const PHASENSCHNITT: Klaerung = {
  klaerungId: 'phasenschnitt-2026-08',
  titel: 'ZAH-Phasenschnitt — Abstimmung mit AB/FB',
  datum: '2026-08-04',
};

/**
 * Die sieben Grundsatzfragen. Sie hängen nicht an einem einzelnen Code, sondern
 * an einer Entscheidung, die den Schnitt als Ganzes betrifft.
 */
const GRUNDSATZFRAGEN: readonly { titel: string; zusatz: string }[] = [
  {
    titel: 'Gehört 32 ablehnungsreif in die Entscheidung?',
    zusatz: 'Die Zahl liegt vor 33 unvollständig und 34 bearbeitungsreif, der Status '
      + 'aber hinter ihnen. Wer nach Zahlen sortiert, findet ihn an der falschen Stelle.',
  },
  {
    titel: 'Ist die Grenze mitten in der Siebziger-Gruppe richtig gezogen?',
    zusatz: '70 Ablehnung versandt, 71 RNE versandt, 72 Stellungnahme RNE und '
      + '75 Widerspruch zählen zur Entscheidung, 73 abgelehnt/zurückgezogen dagegen '
      + 'zu Abgeschlossen. Die Gruppe wird also in der Mitte geteilt.',
  },
  {
    titel: 'Beginnt mit 59 bewilligt die Begleitung — und ist das kein Endzustand?',
    zusatz: 'Die Bewilligung fühlt sich wie ein Abschluss an, eröffnet aber die '
      + 'Begleitphase. Wer sie als Ende führt, verliert alles, was danach kommt.',
  },
  {
    titel: 'Sollen 29, 88, 93 und 94 weiterhin gar keine Phase haben?',
    zusatz: '29 Irrläufer, 88 Sonderstatus, 93 assoziierter Partner und '
      + '94 internationaler Partner laufen als Kennzeichen neben dem Verfahren mit. '
      + 'Sie haben bewusst keine Phase — nicht aus Versehen.',
  },
  {
    titel: 'Reicht eine gemeinsame Phase „Prüfung" für fachlich und administrativ?',
    zusatz: 'Beide Stränge laufen parallel, nicht nacheinander. Eine eigene '
      + 'AB-Phase neben einer FB-Phase hieße, dass ein Teilvorhaben dauerhaft in '
      + 'zwei Phasen zugleich stünde.',
  },
  {
    titel: 'Stehen 89 Anhörung zum Widerruf und 92 Widerruf richtig in der Begleitung?',
    zusatz: 'Es sind Entscheidungen, aber sie fallen während der Begleitung. '
      + 'Die Phase sagt, wo im Verfahren man steht — nicht, was für ein Akt es ist.',
  },
  {
    titel: 'Gehören 35 NF gestellt und 36 NL eingegangen in die Vollständigkeit?',
    zusatz: 'Nachforderungen entstehen auch während der Prüfung. Zudem führt der '
      + 'Katalog „Nachforderung" zugleich als eigene Kategorie — beides nebeneinander '
      + 'ist erklärungsbedürftig.',
  },
];

/** Der Zielwert, den der ausgelieferte Schnitt heute für einen Code vorsieht. */
function seedZielVon(code: number): ZielWert {
  return SEED_CODE_ZU_ZAH_PHASE.get(code) ?? OHNE_PHASE;
}

/**
 * Die Codes in Anzeige-Reihenfolge: Phase für Phase entlang des Verfahrens,
 * innerhalb einer Phase nach Code, die Marker zuletzt. Ein Code, den weder die
 * Phasen-Tabelle noch die Marker-Menge kennt, landet ebenfalls hinten — sichtbar,
 * statt aus dem Fragebogen zu fallen.
 */
function codesInReihenfolge(): number[] {
  const alle = STATUS_CODE_KATALOG.map(e => e.code);
  const out: number[] = [];
  for (const phase of ZAH_PHASEN_REIHENFOLGE) {
    out.push(...alle.filter(c => SEED_CODE_ZU_ZAH_PHASE.get(c) === phase).sort((a, b) => a - b));
  }
  out.push(...alle.filter(c => !SEED_CODE_ZU_ZAH_PHASE.has(c)).sort((a, b) => a - b));
  return out;
}

/** Alle Punkte der Klärung: erst die Zuordnungen, dann die Grundsatzfragen. */
export function bauePunkte(): KlaerungPunkt[] {
  const bezeichnung = new Map(STATUS_CODE_KATALOG.map(e => [e.code, e.text]));
  const zeilen: KlaerungPunkt[] = codesInReihenfolge().map(code => {
    const text = bezeichnung.get(code) ?? '—';
    return {
      id: `code-${code}`,
      klaerungId: PHASENSCHNITT.klaerungId,
      art: 'phasenzuordnung' as const,
      titel: `${code} · ${text}`,
      bezeichnung: text,
      code,
      seedZiel: seedZielVon(code),
    };
  });

  const fragen: KlaerungPunkt[] = GRUNDSATZFRAGEN.map((f, i) => ({
    id: `frage-${i + 1}`,
    klaerungId: PHASENSCHNITT.klaerungId,
    art: 'freitext' as const,
    titel: f.titel,
    zusatz: f.zusatz,
  }));

  return [...zeilen, ...fragen];
}

/** Nur zur Sicherheit dokumentiert: die Marker-Menge des Auslieferungsschnitts. */
export function istMarker(code: number): boolean {
  return SEED_MARKER_CODES.has(code);
}
