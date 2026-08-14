/**
 * Was aus dem **Vergleich der beiden Kürzel-Zuarbeiten** entschieden ist.
 *
 * **Warum es das gibt.** Die App führt zwei Dokumente des Fachsystems
 * nebeneinander, und sie überschneiden sich:
 *
 * | | Dokument | Schlüssel | Codes | wirkt auf |
 * |---|---|---|---|---|
 * | flach | `kuerzel-zuarbeit-20260724.csv` | Code | 505 | `StatusFeldEintrag.label` — **jede** Anzeigefläche |
 * | form-bewusst | `Janne-Gelbe_Karte_Kürzel.xlsx` | Kürzel × Projektform | 608 | `kuerzelAuskunft()` — Verlauf, Klärfragen |
 *
 * Gemessen über alle 505 Codes: 335 sagen wortgleich dasselbe, 58 unterscheiden
 * sich **zu Recht** je Projektform, 36 kennt nur die flache Quelle — und **76
 * widersprechen sich**, obwohl der form-bewusste Katalog dort über alle Formen
 * einstimmig ist.
 *
 * **Diese 76 gehen in beide Richtungen.** Mal ist die flache Quelle veraltet
 * (`XKS` trug den DL-Wortlaut für alle Formen), mal trägt der form-bewusste
 * Katalog den Tippfehler (`Biref`, `Verwedungsnachweis`, `allgmeine`). Es gibt
 * also **keine** Quelle, die pauschal gewinnt — wer eine von beiden global
 * übernähme, tauschte Fehler gegen Fehler. Deshalb steht hier eine kurze,
 * belegte Liste statt einer Vorrangregel.
 *
 * **Warum getrennt von `QUELLKORREKTUREN`** (`kuerzel-kuration.ts`): die dortigen
 * Einträge sind an eine **Klärfrage** gebunden (`frageId`), die die Ableitung
 * ohne Kuration wirklich erzeugt. Die Entscheidungen hier entstehen aus dem
 * Quellen-Vergleich, den es als Klärfragen-Herkunft (noch) nicht gibt; ihnen eine
 * fremde `frageId` anzuheften machte den Rückweg zur Frage unbrauchbar. Zwei
 * Listen mit **verschiedener Provenienz**, nicht zwei Listen für dieselbe Sache.
 *
 * **Was hier hineingehört** — und sonst nichts: Fälle, die **ohne Fachwissen**
 * entscheidbar sind (Rechtschreibung, eine Dopplung, ein Projektform-Präfix, das
 * der Katalog einstimmig nicht führt), plus das, was der Fachbereich
 * ausdrücklich beantwortet hat. Alles Übrige — wo sich die **Aussage**
 * unterscheidet — bleibt offen und wird nicht geraten.
 *
 * **`falsch` ist die Sicherung.** Eine Seite wird nur korrigiert, solange sie
 * noch genau diesen Wortlaut trägt. Behebt eine neue Zuarbeit den Fehler an der
 * Quelle, läuft der Eintrag ins Leere statt einen inzwischen richtigen Text zu
 * überschreiben; der Test `seed-label-korrekturen` meldet ihn dann als
 * abgelaufen.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import type { ZuarbeitCode } from './seed-codes.data';

/**
 * Eine entschiedene Bezeichnung — mit der Angabe, **welche Seite** danebenlag.
 *
 * Beide Seiten sind optional, weil beide Richtungen vorkommen: `XKS` stand nur
 * flach falsch, `IVW2` nur im form-bewussten Katalog. Fehlt eine Seite, lag sie
 * schon richtig und wird nicht angefasst.
 */
export interface KuerzelEntscheidung {
  /** Code des Fachsystems, wie ihn die Zuarbeit führt. */
  code: string;
  /** Der Wortlaut, der gilt. */
  richtig: string;
  /** Wortlaut der FLACHEN Zuarbeit, falls sie danebenliegt. */
  seedFalsch?: string;
  /** Wortlaut des FORM-BEWUSSTEN Katalogs, falls er danebenliegt. */
  katalogFalsch?: string;
  /** Warum das entschieden ist — nachvollziehbar ohne den Entscheider zu fragen. */
  begruendung: string;
  /** Woher die Entscheidung stammt. */
  beleg: string;
}

const FACHDIALOG = 'Fachauskunft 08/2026';

export const KUERZEL_ENTSCHEIDUNGEN: readonly KuerzelEntscheidung[] = [
  // ─── Projektform-Präfix: ein Wortlaut aus EINER Form, flach für alle ───────
  {
    code: 'XKS',
    seedFalsch: 'DL-Gutachten fertig - FB/AB',
    richtig: 'Gutachten fertig',
    begruendung:
      'Zwei Fehler in einem Eintrag. `DL` ist eine Projektform (Dienstleistung zur '
      + 'Markteinführung), kein Bestandteil dieses Gutachtens — der form-bewusste Katalog führt '
      + 'XKS für NW, FuE und DL und sagt in allen dreien „Gutachten fertig". Und `- FB/AB` ist '
      + 'die Rolle, die Chronik und Statuseinträge-Liste ohnehin in einer eigenen Spalte zeigen.',
    beleg: 'Quellen-Vergleich, Katalog über 3 Formen einstimmig',
  },
  {
    code: 'XQS',
    seedFalsch: 'DL-Gutachten QS fertig',
    richtig: 'Gutachten QS fertig',
    begruendung:
      'Dasselbe DL-Präfix wie bei XKS. Der form-bewusste Katalog führt XQS für NW, FuE und DL '
      + 'und sagt in allen dreien „Gutachten QS fertig".',
    beleg: 'Quellen-Vergleich, Katalog über 3 Formen einstimmig',
  },

  // ─── Rechtschreibung und Dopplung ─────────────────────────────────────────
  {
    code: 'ABLQ-',
    seedFalsch: 'QS Ablehnung QS zurück an AB/FB',
    richtig: 'QS Ablehnung zurück an AB/FB',
    begruendung:
      'Doppeltes „QS". Das Geschwister-Kürzel ARQ- führt dieselbe Konstruktion einfach '
      + '(„QS RNE zurück an AB/FB"); der form-bewusste Katalog bestätigt sie über alle drei '
      + 'geführten Formen.',
    beleg: 'Quellen-Vergleich, Katalog über 3 Formen einstimmig',
  },
  {
    code: 'AUS',
    seedFalsch: 'Unternehmen in Schwiergigkeiten',
    richtig: 'Unternehmen in Schwierigkeiten',
    begruendung: 'Rechtschreibung. Der form-bewusste Katalog schreibt es über alle Formen richtig.',
    beleg: 'Quellen-Vergleich',
  },
  {
    code: 'ABX',
    seedFalsch: 'Bewilligung ausgestezt',
    richtig: 'Bewilligung ausgesetzt',
    begruendung: 'Rechtschreibung (Buchstabendreher). Der form-bewusste Katalog schreibt es richtig.',
    beleg: 'Quellen-Vergleich',
  },
  {
    code: 'VQK',
    seedFalsch: 'VN-Qualitätsicherung kaufm.',
    richtig: 'VN-Qualitätssicherung kaufm.',
    begruendung:
      'Rechtschreibung (fehlendes s in „Qualitätssicherung"). Der form-bewusste Katalog '
      + 'schreibt es richtig; das Schwester-Kürzel VQT führt dasselbe Wort korrekt.',
    beleg: 'Quellen-Vergleich',
  },

  // ─── PL = QS: dieselbe Stelle, zwei Schreibweisen ─────────────────────────
  // Der Fachbereich hat festgestellt: „Q ist immer QS und PL ist gleich QS".
  // Damit sind die beiden Konflikte, die sich NUR in PL/QS unterscheiden,
  // keine Bedeutungsfrage mehr, sondern eine Schreibweise. Angefasst werden
  // ausschließlich diese zwei — die sieben Kürzel, in denen BEIDE Quellen „durch
  // PL" schreiben (AZWQ, ÄAWQ, ABRWQ, ABRWQ2, WRQ, WRWQ, WRH), bleiben unberührt:
  // dort widerspricht sich nichts, und ihren Wortlaut zu vereinheitlichen wäre
  // eine Umformulierung von Fremddaten, nicht die Auflösung eines Widerspruchs.
  {
    code: 'ALQ',
    seedFalsch: 'NF von PL gelesen',
    richtig: 'NF von QS gelesen',
    begruendung: 'PL und QS bezeichnen dieselbe Stelle; QS ist die Schreibweise, die der Katalog führt.',
    beleg: FACHDIALOG,
  },
  {
    code: 'ZVT',
    seedFalsch: 'Beurteilung durch TB erfolgt; an PL',
    richtig: 'Beurteilung durch TB erfolgt; an QS',
    begruendung:
      'Derselbe PL/QS-Fall wie ALQ — der einzige weitere Konflikt, der sich ausschließlich '
      + 'darin unterscheidet.',
    beleg: FACHDIALOG,
  },

  // ─── Der form-bewusste Katalog lag daneben ────────────────────────────────
  {
    code: 'IVW2',
    katalogFalsch: 'Name des starken Verwalters',
    richtig: 'Name des Sachwalters',
    begruendung: 'Es heißt Sachwalter. Die flache Zuarbeit führte es bereits richtig.',
    beleg: FACHDIALOG,
  },
  {
    code: 'WZBR',
    katalogFalsch: 'Widerspruchsbescheid rechtskräftig',
    richtig: 'Widerspruch Zuw.Bescheid zurückgezogen',
    begruendung:
      'Der Katalog beschrieb eine andere Handlung. Die flache Zuarbeit führte es bereits '
      + 'richtig — WZBR ist die Rücknahme des Widerspruchs, nicht die Rechtskraft des Bescheids.',
    beleg: FACHDIALOG,
  },
];

/**
 * Das Ministerium heißt **BMWE**; `BMWK` ist der frühere Name.
 *
 * **Warum als Regel und nicht als 16 Listeneinträge.** Es ist eine Umbenennung,
 * keine 16 unabhängigen Urteile — und ein neues Kürzel aus der nächsten Zuarbeit
 * soll sie erben, ohne dass jemand hier nachträgt.
 *
 * **Und warum der Quellen-Vergleich sie NICHT finden konnte**: 13 der 16 Codes
 * schreiben `BMWK` in **beiden** Quellen. Sie zählten damit zu den 335
 * „wortgleichen" und tauchten in keiner Konfliktliste auf. Übereinstimmung
 * zweier veralteter Quellen ist eben keine Richtigkeit — die einzige Prüfung,
 * die das findet, ist die fachliche.
 *
 * Der Test pinnt die betroffene Code-Menge, damit die Wirkung sichtbar bleibt
 * und eine neue Zuarbeit den Kreis nicht unbemerkt verschiebt.
 */
export const BEHOERDEN_UMBENENNUNG: Readonly<Record<string, string>> = { BMWK: 'BMWE' };

/** Wendet die Umbenennung auf einen Wortlaut an. Ohne Treffer identisch zurück. */
export function aktualisiereBehoerdenname(text: string): string {
  let out = text;
  for (const [alt, neu] of Object.entries(BEHOERDEN_UMBENENNUNG)) out = out.split(alt).join(neu);
  return out;
}

const NACH_CODE: ReadonlyMap<string, KuerzelEntscheidung> = new Map(
  KUERZEL_ENTSCHEIDUNGEN.map(e => [e.code, e]),
);

/**
 * Der geltende Wortlaut für die **flache** Seite.
 *
 * Reihenfolge: erst die Einzelentscheidung, dann die Umbenennung — sonst trüge
 * ein korrigierter Wortlaut den alten Behördennamen weiter.
 */
export function korrigiertesSeedLabel(code: string, label: string): string {
  const e = NACH_CODE.get(code);
  const nachEinzel = e?.seedFalsch !== undefined && label === e.seedFalsch ? e.richtig : label;
  return aktualisiereBehoerdenname(nachEinzel);
}

/**
 * Der geltende Wortlaut für die **form-bewusste** Seite.
 *
 * Gleiche Reihenfolge, gleiche Bindung an den falschen Wortlaut.
 */
export function korrigierteKatalogBezeichnung(kuerzel: string, bezeichnung: string): string {
  const e = NACH_CODE.get(kuerzel);
  const nachEinzel = e?.katalogFalsch !== undefined && bezeichnung === e.katalogFalsch
    ? e.richtig
    : bezeichnung;
  return aktualisiereBehoerdenname(nachEinzel);
}

/**
 * Wendet die Korrekturen auf einen Zuarbeit-Eintrag an.
 *
 * Gibt **dieselbe Referenz** zurück, wenn nichts zu tun ist — der
 * Seed-Determinismus hängt an einer stabilen Ausgabe, und ein unnötiges
 * Objekt-Spread erzeugte bei jedem Aufruf neue Identitäten.
 */
export function korrigiereZuarbeitLabel(z: ZuarbeitCode): ZuarbeitCode {
  const label = korrigiertesSeedLabel(z.code, z.label);
  return label === z.label ? z : { ...z, label };
}
