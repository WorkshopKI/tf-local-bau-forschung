/**
 * Die erste Klärung: der ZAH-Phasenschnitt zur Abstimmung mit AB/FB.
 *
 * **Die Phasentabelle wird nicht abgeschrieben.** Die 30 Zeilen entstehen zur
 * Laufzeit aus `STATUS_CODE_KATALOG` (Bezeichnungen), `SEED_CODE_ZU_ZAH_PHASE`
 * (Zuordnung) und `SEED_MARKER_CODES` (die vier ohne Phase). Eine kopierte Liste
 * driftet beim ersten neuen Statuscode auseinander, und ein Fragebogen, der nach
 * einer Zuordnung fragt, die es nicht mehr gibt, ist schlimmer als keiner.
 *
 * Wörtlicher Text steht hier nur für die Grundsatzfragen — jede mit der
 * Begründung, warum sie überhaupt eine Frage ist. Ohne diese Begründung liest sich
 * „32 ablehnungsreif" wie eine Behauptung statt wie ein Zweifel.
 *
 * **Fragen werden angepasst, solange niemand geantwortet hat.** Eine Frage, zu
 * der eine Antwort auf dem Share liegt, wird NIE umformuliert — sonst bezieht
 * sich die Antwort auf etwas, das so nicht mehr dasteht; dann bekommt die neue
 * Fassung eine eigene Id und verweist im `zusatz` auf die alte. Vor jeder
 * Umformulierung wird der Antwort-Stand geprüft, nicht vermutet.
 *
 * **Jede Frage trägt ihre Id selbst** (`frage-32-ablehnungsreif`), sie wird nicht
 * aus der Position gebildet. Bis v2.412 stand hier `frage-${i + 1}`: der nächste
 * eingefügte Punkt hätte alle Antworten dahinter lautlos verschoben, und die
 * Ablage ist append-only — nachträglich korrigieren lässt sich das nicht. Die
 * bereits geschriebenen Zeilen werden über {@link ALT_PUNKT_IDS} beim LESEN
 * übersetzt.
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
 * Die Grundsatzfragen. Sie hängen nicht an einem einzelnen Code, sondern an einer
 * Entscheidung, die den Schnitt als Ganzes betrifft.
 *
 * Die `id` ist Teil der Frage, nicht ihrer Position — siehe Modulkopf. Neue
 * Fragen werden **angehängt**; eine bestehende wird nie umsortiert oder gelöscht,
 * sonst zeigen die Antworten auf dem Share ins Leere.
 */
const GRUNDSATZFRAGEN: readonly { id: string; titel: string; zusatz: string }[] = [
  {
    id: 'frage-32-ablehnungsreif',
    titel: 'Gehört 32 ablehnungsreif in die Entscheidung?',
    zusatz: 'Die Zahl liegt vor 33 unvollständig und 34 bearbeitungsreif, der Status '
      + 'aber hinter ihnen. Wer nach Zahlen sortiert, findet ihn an der falschen Stelle.',
  },
  {
    id: 'frage-siebziger-grenze',
    titel: 'Ist die Grenze mitten in der Siebziger-Gruppe richtig gezogen?',
    zusatz: '70 Ablehnung versandt, 71 RNE versandt, 72 Stellungnahme RNE und '
      + '75 Widerspruch zählen zur Entscheidung, 73 abgelehnt/zurückgezogen dagegen '
      + 'zu Abgeschlossen. Die Gruppe wird also in der Mitte geteilt.',
  },
  {
    id: 'frage-59-begleitung',
    titel: 'Beginnt mit 59 bewilligt die Begleitung — und ist das kein Endzustand?',
    zusatz: 'Die Bewilligung fühlt sich wie ein Abschluss an, eröffnet aber die '
      + 'Begleitphase. Wer sie als Ende führt, verliert alles, was danach kommt.',
  },
  {
    id: 'frage-marker-ohne-phase',
    titel: 'Sollen 29, 88, 93 und 94 weiterhin gar keine Phase haben?',
    zusatz: '29 Irrläufer, 88 Sonderstatus, 93 assoziierter Partner und '
      + '94 internationaler Partner laufen als Kennzeichen neben dem Verfahren mit. '
      + 'Sie haben bewusst keine Phase — nicht aus Versehen.',
  },
  {
    id: 'frage-pruefung-gemeinsam',
    titel: 'Reicht eine gemeinsame Phase „Prüfung" für fachlich und administrativ?',
    zusatz: 'Beide Stränge laufen parallel, nicht nacheinander. Eine eigene '
      + 'AB-Phase neben einer FB-Phase hieße, dass ein Teilvorhaben dauerhaft in '
      + 'zwei Phasen zugleich stünde.',
  },
  {
    id: 'frage-widerruf-begleitung',
    titel: 'Stehen 89 Anhörung zum Widerruf und 92 Widerruf richtig in der Begleitung?',
    zusatz: 'Es sind Entscheidungen, aber sie fallen während der Begleitung. '
      + 'Die Phase sagt, wo im Verfahren man steht — nicht, was für ein Akt es ist.',
  },
  {
    id: 'frage-nf-vollstaendigkeit',
    titel: 'Gehören 35 NF gestellt und 36 NL eingegangen in die Vollständigkeit?',
    zusatz: 'Nachforderungen entstehen auch während der Prüfung. Die Arbeitsliste '
      + 'daneben ist seit v2.411 entflochten: nur noch 35 steht unter „Wartet auf '
      + 'Antragsteller", weil bei 36 und 37 der Ball wieder bei uns liegt. Offen ist '
      + 'damit allein der Verfahrensschritt.',
  },

  // --- Nachgetragen v2.412: was die Erhebung am Bestand aufgeworfen hat --------
  //
  // Alle vier wurden mit v2.414 an den Erkenntnisstand angepasst: K2 hat die
  // Trigger-Herkunft belegt, die Bestands-Erhebung hat die Zahlen gemessen.
  // ANGEPASST statt neu angelegt, weil zu keiner der Fragen eine Antwort vorlag
  // (geprüft am 05.08.2026: alle elf Fragen ohne Beitrag, keine strittige
  // Zuordnung, keine offene Rückfrage). Läge eine vor, bekäme die neue
  // Fassung eine eigene Id — eine gegebene Antwort darf nie zu einer Frage
  // stehen, die so nicht mehr dasteht.
  {
    id: 'frage-precheck-bearbeitungsreif',
    titel: 'Zwei Vorgänge stehen auf bearbeitungsreif, ohne dass ein PreCheck vermerkt ist '
      + '— Erfassungsfehler, anderer Weg auf 34, oder soll die App darauf hinweisen?',
    zusatz: 'Gemessen am 05.08.2026 über 12 356 Vorgänge: von 334 auf Status 34 tragen genau '
      + 'zwei weder PC+ noch XPC+ — 16DS260731 (DS) und 16KN128033 (FuE), beide also mit '
      + 'PreCheck-Pflicht. Kein DL-/NW-Fall, dort gibt es laut Seed gar keinen PreCheck. Das '
      + 'ist deutlich weniger als die ursprünglich vermuteten neun. Brisant bleibt es trotzdem, '
      + 'weil 34 laut Trigger-Tabelle von PC+ bzw. XPC+ GESETZT wird: ein 34 ohne Vermerk '
      + 'sollte es eigentlich nicht geben. R23a/R23b melden „PC offen" bisher nur bei Status '
      + 'beantragt.',
  },
  {
    id: 'frage-precheck-vollstaendigkeit',
    titel: 'Gibt es Fälle, in denen der PreCheck doch auf vollständige Unterlagen wartet?',
    zusatz: 'Im Kern beantwortet: 33 unvollständig wird laut Trigger-Tabelle von PC? gesetzt '
      + '(pre-check unvollständig), stammt also AUS dem PreCheck und nicht aus einer Prüfung '
      + 'der Unterlagen davor. Damit läuft der PreCheck vor der Vollständigkeit, und die '
      + 'Wochenfrist läuft ab Antragseingang — nicht ab Vollständigkeit. Offen ist nur noch '
      + 'die Gegenprobe: kennt die Praxis Fälle, in denen der PreCheck doch liegen bleibt, '
      + 'bis Unterlagen nachkommen?',
  },
  {
    id: 'frage-zieltage-soll-oder-ist',
    titel: 'Sind die Zieltage eine Beschreibung des Ist oder eine verbindliche Sollzeit?',
    zusatz: 'Die Vorschläge sind Mediane aus dem Bestand und beschreiben, wie lange es dauert, '
      + 'nicht wie lange es dauern soll. Für beantragt gemessen (05.08.2026): Ist-Median '
      + '29 Tage bei 446 Beobachtungen, gepflegt sind 27 Tage — der gepflegte Wert beschreibt '
      + 'also das Ist, er fordert nichts. Das wiegt hier besonders schwer, weil 34 durch PC+ '
      + 'gesetzt wird: die Zieltage für beantragt SIND faktisch die PreCheck-Frist, und die '
      + 'fachliche Erwartung daran liegt bei einer Woche. Wo es eine Sollzeit gibt, muss sie '
      + 'den Median schlagen — sonst zementieren die Zieltage die Liegezeiten, die sie sichtbar '
      + 'machen sollen.',
  },
  {
    id: 'frage-abgrenzung-31-33-34',
    titel: 'Bestätigung: 33 unvollständig heißt „PreCheck mit Vorbehalt" und NICHT '
      + '„Antragsunterlagen unvollständig" — trifft diese Lesart zu?',
    zusatz: 'Die Trigger-Tabelle beantwortet die Abgrenzung: 31 beantragt wird von AAE gesetzt '
      + '(Antragseingang, Rolle PA), 33 unvollständig von PC? (pre-check unvollständig) und '
      + '34 bearbeitungsreif von PC+ am Teilvorhaben bzw. XPC+ am Verbund (beide AB/FB/QS). '
      + 'Alle drei sind damit PreCheck-Ergebnisse, nicht Aussagen über die Unterlagen — '
      + 'nachlesbar im Statuswert-Detail unter „Wodurch dieser Status entsteht". Aus der '
      + 'offenen Frage wird damit eine Bestätigungsfrage: stimmt die Lesart fachlich?',
  },

  // --- Nachgetragen v2.414: was die Regel-Werkstatt am Bestand gefunden hat ----
  {
    id: 'frage-r4-schlussvermerk-qs',
    titel: 'R4 meldet „SV in QS" und trifft auf keinen einzigen Vorgang zu — wird das Feld '
      + 'nicht gepflegt, oder gibt es diesen Zwischenzustand im Ablauf gar nicht?',
    zusatz: 'R4 greift, wenn der Schlussvermerk signiert ist (D_AVK gefüllt), das Verfahren '
      + 'aber noch nicht abgeschlossen (D_VV leer). Gemessen am 05.08.2026: D_AVK ist bei '
      + '412 Vorgängen gefüllt — und bei ALLEN 412 steht zugleich D_VV. Der Zwischenzustand '
      + 'kommt im Nacht-Export also nie vor. Das ist ein anderer Befund als „Feld wird nicht '
      + 'gepflegt": keine Regel auf dieser Lücke kann je feuern, egal wie sie formuliert ist. '
      + 'Zum Vergleich dieselbe Messung für D_AAR (R5): 2 394 gefüllt, davon 2 236 zusammen '
      + 'mit D_VV — dort bleiben 158 Fälle übrig, die Regel arbeitet.',
  },
  {
    id: 'frage-r8-verdeckt',
    titel: 'Bei zwei Dritteln der versandten Rücknahmeempfehlungen gewinnt R6 statt R8 — '
      + 'ist das richtig so, oder soll die Fristüberwachung vorgehen?',
    zusatz: 'Gemessen am 05.08.2026: R8 „RNE versandt, Frist läuft" trifft auf 68 Vorgänge zu '
      + 'und bestimmt das To-do bei 22. Bei den übrigen 46 gewinnt ausnahmslos R6 '
      + '„RNE-Widerspruchsfrist abgelaufen" — eine einzige Regel, keine Streuung. Das ist so '
      + 'entworfen: R6 steht in der Kaskade vor R8 und nimmt den abgelaufenen Fall weg, damit '
      + 'R8 die „höchstens 31 Tage" nicht selbst prüfen muss. Die Frage ist also nicht, '
      + 'warum verdeckt wird, sondern ob es fachlich richtig ist, dass eine abgelaufene Frist '
      + 'die laufende Überwachung ablöst — oder ob beide nebeneinander sichtbar bleiben.',
  },
];

/**
 * Alte Punkt-Ids → heutige. Die Übersetzung greift beim **Lesen** (`fold.ts`),
 * nie beim Schreiben.
 *
 * Bis v2.412 bildete der Seed die Fragen-Ids aus dem Schleifenindex. Die
 * Antworten dazu stehen als `frage-1` … `frage-7` in den append-only
 * JSONL-Dateien auf dem Share — dort lässt sich nichts korrigieren, und eine
 * Migration zur Laufzeit hülfe nur der einen Installation, die sie ausführt.
 * Eine Zuordnung beim Lesen stimmt dagegen auch dann noch, wenn jemand in einem
 * Jahr eine archivierte Datei einspielt.
 *
 * **Die Tabelle wird nie gekürzt.** Ein hier fehlender Eintrag macht die
 * zugehörigen Antworten unsichtbar, ohne eine Meldung.
 */
export const ALT_PUNKT_IDS: ReadonlyMap<string, string> = new Map([
  ['frage-1', 'frage-32-ablehnungsreif'],
  ['frage-2', 'frage-siebziger-grenze'],
  ['frage-3', 'frage-59-begleitung'],
  ['frage-4', 'frage-marker-ohne-phase'],
  ['frage-5', 'frage-pruefung-gemeinsam'],
  ['frage-6', 'frage-widerruf-begleitung'],
  ['frage-7', 'frage-nf-vollstaendigkeit'],
]);

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

  const fragen: KlaerungPunkt[] = GRUNDSATZFRAGEN.map(f => ({
    id: f.id,
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
