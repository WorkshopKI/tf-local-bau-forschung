/**
 * Bezeichnungen, an denen die **flache** Kürzel-Zuarbeit belegt falsch ist.
 *
 * **Warum es das gibt.** Die App führt zwei Zuarbeit-Dokumente des Fachsystems
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
 * belegte Liste statt einer Regel.
 *
 * **Was hier hineingehört** — und sonst nichts: Fälle, die sich **ohne
 * Fachwissen** entscheiden lassen (deutsche Rechtschreibung, eine Dopplung, ein
 * Projektform-Präfix, das der Katalog einstimmig nicht führt). Alles, wo sich
 * die **Aussage** unterscheidet — `ALQ` „NF von PL/QS gelesen", `XFB` „max. 2 in
 * 12 / max. 1 in 24 Monaten", `IVW2` „Sachwalter/starker Verwalter" —, ist eine
 * Frage an den Fachbereich und wird hier **nicht** geraten.
 *
 * **`falsch` ist die Sicherung.** Die Korrektur greift nur, solange die Zuarbeit
 * noch genau diesen Wortlaut trägt. Behebt eine neue Zuarbeit den Fehler an der
 * Quelle, läuft der Eintrag ins Leere statt einen inzwischen richtigen Text zu
 * überschreiben; der Test `seed-label-korrekturen` meldet ihn dann als
 * abgelaufen. Dieselbe Mechanik wie `QUELLKORREKTUREN` in `kuerzel-kuration.ts`.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import type { ZuarbeitCode } from './seed-codes.data';

export interface SeedLabelKorrektur {
  /** Code des Fachsystems, wie ihn die Zuarbeit führt. */
  code: string;
  /** Der Wortlaut, der korrigiert wird. Trifft er nicht mehr, greift nichts. */
  falsch: string;
  /** Der Wortlaut, der stattdessen gilt. */
  richtig: string;
  /** Warum das belegt falsch ist — ohne Fachwissen nachvollziehbar. */
  begruendung: string;
}

export const SEED_LABEL_KORREKTUREN: readonly SeedLabelKorrektur[] = [
  {
    code: 'XKS',
    falsch: 'DL-Gutachten fertig - FB/AB',
    richtig: 'Gutachten fertig',
    begruendung:
      'Zwei Fehler in einem Eintrag. `DL` ist eine Projektform (Dienstleistung zur '
      + 'Markteinführung), kein Bestandteil dieses Gutachtens — der form-bewusste Katalog führt '
      + 'XKS für NW, FuE und DL und sagt in allen dreien „Gutachten fertig". Und `- FB/AB` ist '
      + 'die Rolle, die Chronik und Statuseinträge-Liste ohnehin in einer eigenen Spalte zeigen.',
  },
  {
    code: 'XQS',
    falsch: 'DL-Gutachten QS fertig',
    richtig: 'Gutachten QS fertig',
    begruendung:
      'Dasselbe DL-Präfix wie bei XKS. Der form-bewusste Katalog führt XQS für NW, FuE und DL '
      + 'und sagt in allen dreien „Gutachten QS fertig".',
  },
  {
    code: 'ABLQ-',
    falsch: 'QS Ablehnung QS zurück an AB/FB',
    richtig: 'QS Ablehnung zurück an AB/FB',
    begruendung:
      'Doppeltes „QS". Das Geschwister-Kürzel ARQ- führt dieselbe Konstruktion einfach '
      + '(„QS RNE zurück an AB/FB"); der form-bewusste Katalog bestätigt sie über alle drei '
      + 'geführten Formen.',
  },
  {
    code: 'AUS',
    falsch: 'Unternehmen in Schwiergigkeiten',
    richtig: 'Unternehmen in Schwierigkeiten',
    begruendung: 'Rechtschreibung. Der form-bewusste Katalog schreibt es über alle Formen richtig.',
  },
  {
    code: 'ABX',
    falsch: 'Bewilligung ausgestezt',
    richtig: 'Bewilligung ausgesetzt',
    begruendung: 'Rechtschreibung (Buchstabendreher). Der form-bewusste Katalog schreibt es richtig.',
  },
  {
    code: 'VQK',
    falsch: 'VN-Qualitätsicherung kaufm.',
    richtig: 'VN-Qualitätssicherung kaufm.',
    begruendung:
      'Rechtschreibung (fehlendes s in „Qualitätssicherung"). Der form-bewusste Katalog '
      + 'schreibt es richtig; das Schwester-Kürzel VQT führt dasselbe Wort korrekt.',
  },
];

const NACH_CODE: ReadonlyMap<string, SeedLabelKorrektur> = new Map(
  SEED_LABEL_KORREKTUREN.map(k => [k.code, k]),
);

/**
 * Wendet die Korrekturen auf einen Zuarbeit-Eintrag an.
 *
 * Gibt **dieselbe Referenz** zurück, wenn nichts zu tun ist — der
 * Seed-Determinismus hängt an einer stabilen Ausgabe, und ein unnötiges
 * Objekt-Spread erzeugte bei jedem Aufruf neue Identitäten.
 */
export function korrigiereZuarbeitLabel(z: ZuarbeitCode): ZuarbeitCode {
  const k = NACH_CODE.get(z.code);
  return k && z.label === k.falsch ? { ...z, label: k.richtig } : z;
}
