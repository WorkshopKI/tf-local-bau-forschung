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
  {
    id: 'frage-precheck-bearbeitungsreif',
    titel: 'Soll die App melden, wenn ein Antrag bearbeitungsreif ist, ohne dass ein '
      + 'PreCheck vermerkt wurde?',
    zusatz: 'R23a und R23b melden „PC offen" nur bei Status beantragt. Läuft ein Antrag '
      + 'ohne PreCheck auf unvollständig oder bearbeitungsreif weiter, schweigt die App — '
      + 'also gerade dann, wenn der PreCheck am deutlichsten überfällig ist. Betroffen sind '
      + 'derzeit neun Vorgänge; die Regeln gelten nur für die Fördervarianten FuE und DS, '
      + 'DL und NW haben laut Seed keinen PreCheck.',
  },
  {
    id: 'frage-precheck-vollstaendigkeit',
    titel: 'Setzt der PreCheck vollständige Antragsunterlagen voraus, oder läuft er '
      + 'unabhängig davon?',
    zusatz: 'Davon hängt ab, ob unvollständig (33) in die Regel gehört und ob die '
      + 'Wochenfrist ab Eingang oder ab Vollständigkeit läuft. Setzt er Vollständigkeit '
      + 'voraus, ist eine Woche ab Eingang bei jedem Antrag mit Nachforderung nicht '
      + 'einzuhalten.',
  },
  {
    id: 'frage-zieltage-soll-oder-ist',
    titel: 'Sind die Zieltage eine Beschreibung des Ist oder eine verbindliche Sollzeit?',
    zusatz: 'Die 26 Vorschläge sind Mediane aus dem Bestand und beschreiben, wie lange es '
      + 'dauert, nicht wie lange es dauern soll. Für beantragt schlägt das Ist 27 Tage vor; '
      + 'die fachliche Erwartung an den PreCheck liegt bei einer Woche. Wo es eine Sollzeit '
      + 'gibt, muss sie den Median schlagen — sonst zementieren die Zieltage die Liegezeiten, '
      + 'die sie sichtbar machen sollen.',
  },
  {
    id: 'frage-abgrenzung-31-33-34',
    titel: 'Wie grenzen sich beantragt, unvollständig und bearbeitungsreif voneinander ab?',
    zusatz: 'Das Fachsystem liefert nur die Bezeichnung. Die Vorkommen legen nahe, dass '
      + 'unvollständig eine Durchgangsstation ist (8 Fälle) und bearbeitungsreif ein Zustand, '
      + 'in dem Vorgänge liegen (352). Die Trigger-Tabelle sagt, welche Kürzel die Status '
      + 'setzen — im Statuswert-Detail unter „Wodurch dieser Status entsteht" nachlesbar.',
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
