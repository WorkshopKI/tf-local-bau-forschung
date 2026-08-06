/**
 * Die Bearbeitungsfrist als **Zustand**, nicht als nackte Zahl.
 *
 * **Warum es diese Datei gibt.** `computeFristDatum` (nebenan in `frist.ts`)
 * kennt genau ein Kriterium: „gibt es ein Basisdatum?". Der Zustand des
 * Vorgangs geht nicht ein — also rechnete die 90-Tage-Uhr auch für einen 2018
 * abgelehnten Antrag bis heute weiter und meldete „seit 2 760 T". Die
 * Arithmetik stimmte, das Kriterium fehlte.
 *
 * Genauso schwer wog die Gegenrichtung: „keine Basis" und „keine Frist nötig"
 * waren beide eine leere Zelle und nicht unterscheidbar. Ein Ergebnis mit drei
 * benannten Zuständen macht aus zwei stummen Fällen zwei Aussagen.
 *
 * **Das Haltekriterium ist Katalogdatum, keine Logik.** Ob die Uhr in einer
 * Phase läuft, steht an der ZAH-Phase (`fristLaeuft`) und ist damit ohne
 * Release änderbar — der Zuschnitt ist fachlich strittig und wird iteriert.
 * Bis v3.6 kannte nur das Vorgangs-Board dieses Wissen, als feste Menge
 * `ANTRAGSPHASE`; hier steht es einmal für alle Konsumenten.
 *
 * **Import-Disziplin:** `zahPhaseFuerStatusText` kommt als Direktimport aus
 * `@/core/status/kategorie-ableitung`, nicht über das Barrel `@/core/status` —
 * das zöge `snapshot.ts` und damit `status-canonical.ts` zurück (Laufzeit-
 * Zyklus, Zyklen-Wächter). Dieselbe Stelle und derselbe Grund wie in
 * `core/utils/naechsterSchritt.ts`.
 *
 * Rein und deterministisch: keine IO, keine Uhr. Der Stichtag wird injiziert.
 */
import { isBegleitungStatus, isTerminalStatus } from '@/core/utils/status-canonical';
import { zahPhaseFuerStatusText } from '@/core/status/kategorie-ableitung';
import { fristLaeuftVon } from '@/core/status/zah-phasen';
import type { ZahPhase } from '@/core/status/typen';
import { MS_PER_DAY, addDays, addMonths, ANTRAG_SLA_DAYS, VN_SLA_MONTHS, wirksamerEingang } from './frist';

/**
 * - `laeuft` — die Uhr zählt; `tageRest` ist belastbar (negativ = überschritten).
 * - `angehalten` — in dieser Phase läuft keine Frist mehr. Steht das Haltedatum
 *   fest, sagt `bezugsZeitpunkt` es; sonst bleibt es bei der Aussage.
 * - `nicht_berechenbar` — es fehlt die Grundlage. `grund` sagt welche.
 */
export type FristZustand = 'laeuft' | 'angehalten' | 'nicht_berechenbar';

/** Welches Eingangsdatum die Frist trägt. Der wirksame Eingang ist das spätere
 *  von beiden: bearbeitet werden kann erst, wenn wirklich alles vorliegt. */
export type FristBasisFeld = 'D_AAE' | 'D_XTE';

export interface FristErgebnis {
  zustand: FristZustand;
  /** Welches der beiden Eingangsdaten gewonnen hat. */
  basisFeld?: FristBasisFeld;
  /** ISO — das Datum, ab dem gerechnet wird. */
  basisDatum?: string;
  /** ISO — Basis + 90 Tage (bzw. VN-Eingang + 6 Monate). */
  zielDatum?: string;
  /** ISO — Stichtag bei `laeuft`, Haltedatum bei `angehalten`. */
  bezugsZeitpunkt?: string;
  /** Tage bis zum Zieldatum, gegen den Bezugszeitpunkt. Negativ = überschritten. */
  tageRest?: number;
  /** Bei `nicht_berechenbar` die fehlende Grundlage; bei `angehalten` der
   *  Grund, WARUM kein Haltedatum dabeisteht. Sonst nicht gesetzt. */
  grund?: string;
}

/** Grund-Texte an einer Stelle — sie stehen im Tooltip und im kopierten Text. */
export const FRIST_GRUND = {
  ohneEingang: 'kein Eingangsdatum in D_AAE/D_XTE',
  ohneVnEingang: 'kein Verwendungsnachweis eingegangen (D_VBE)',
  haltedatumUnbekannt: 'Haltedatum unbekannt',
} as const;

export interface FristEingabe {
  /** Roher Statuswert aus dem Export — die beobachtete Tatsache. */
  status: unknown;
  /** `D_AAE` (Antragseingang), ISO. Bei Verbünden das SPÄTESTE über alle TVs. */
  antragsdatum?: string | null;
  /** `D_XTE` („alle Anträge da"), ISO. Fehlt, wo das Schema die Spalte nicht führt. */
  alleAntraegeDa?: string | null;
  /** `D_VBE` (Eingang Verwendungsnachweis), ISO — die Frist der Begleitphase. */
  vnEingangDatum?: string | null;
  /**
   * Wann der Vorgang in die haltende Phase kam (ISO). Nur wer es **belegen**
   * kann, reicht es herein — geraten wird hier nichts. Fehlt es, sagt das
   * Ergebnis „Haltedatum unbekannt", statt die Uhr ersatzweise weiterlaufen zu
   * lassen. Die Kaskade dahinter steht in `core/status/haltedatum.ts`; sie lebt
   * dort, weil sie Fassung und Vorkommen braucht — Typen, die im csv-Layer
   * einen Laufzeit-Zyklus auslösten.
   */
  haltedatum?: string | null;
  /** ISO — injiziert, nie `Date.now()` hier drin. */
  stichtag: string;
  /** Die geltenden Phasen (aus der Fassung). Fehlt = Snapshot bzw. Seed. */
  phasen?: readonly ZahPhase[];
}

/** Tage zwischen zwei ISO-Daten, aufgerundet — wie `daysUntilFristAware`. */
function tageBis(zielIso: string, vonIso: string): number | null {
  const ziel = new Date(zielIso).getTime();
  const von = new Date(vonIso).getTime();
  if (Number.isNaN(ziel) || Number.isNaN(von)) return null;
  return Math.ceil((ziel - von) / MS_PER_DAY);
}

function alsDatum(v: string | null | undefined): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Berechnet den Frist-Zustand eines Vorgangs.
 *
 * Reihenfolge der Fragen — sie ist die eigentliche Aussage der Funktion:
 *
 * 1. **Begleitphase?** Eigener Lebenszyklus mit eigener Uhr (VN-Eingang + 6
 *    Monate). Ohne Verwendungsnachweis gibt es dort keine Frist — das ist
 *    `nicht_berechenbar` mit Grund, nicht „angehalten": es fehlt die Grundlage,
 *    nicht die Zuständigkeit.
 *
 *    Gefragt wird nach der **Arbeitsliste** (`isBegleitungStatus`), nicht nach
 *    der Phase — byte-gleich zu `computeFristDatum`, und die Kategorie ist die
 *    Achse, die im Code bleibt (Pitfall #50). Der Unterschied ist sichtbar:
 *    „bewilligt" (59) liegt in der Phase Begleitung, zählt aber zur
 *    Arbeitsliste `bewilligt` und läuft deshalb hier durch auf `angehalten`.
 *    Fachlich richtig — zwischen Bewilligung und Verwendungsnachweis läuft
 *    keine Frist.
 * 2. **Läuft die Uhr in dieser Phase?** Terminal oder `fristLaeuft: false` ⇒
 *    `angehalten`. Diese Frage kommt VOR der Basis: ob überhaupt eine Frist
 *    gilt, hängt nicht daran, ob wir ihr Startdatum kennen.
 * 3. **Gibt es einen wirksamen Eingang?** Sonst `nicht_berechenbar`.
 */
export function berechneFrist(e: FristEingabe): FristErgebnis {
  const stichtag = e.stichtag;

  // 1. Begleitphase — eigene Uhr, eigener Grund.
  if (isBegleitungStatus(e.status)) {
    const vn = alsDatum(e.vnEingangDatum);
    if (!vn) {
      return { zustand: 'nicht_berechenbar', grund: FRIST_GRUND.ohneVnEingang };
    }
    const ziel = addMonths(vn, VN_SLA_MONTHS);
    if (!ziel) return { zustand: 'nicht_berechenbar', grund: FRIST_GRUND.ohneVnEingang };
    const rest = tageBis(ziel, stichtag);
    return {
      zustand: 'laeuft',
      basisDatum: vn,
      zielDatum: ziel,
      bezugsZeitpunkt: stichtag,
      ...(rest !== null ? { tageRest: rest } : {}),
    };
  }

  // 2. Läuft in dieser Phase überhaupt noch eine Frist?
  //    Terminal schlägt den Katalog: ein abgeschlossener Vorgang hat keine,
  //    egal wie seine Phase gepflegt ist.
  const phase = zahPhaseFuerStatusText(e.status);
  const laeuft = !isTerminalStatus(e.status) && fristLaeuftVon(phase, e.phasen);
  if (!laeuft) {
    const halt = alsDatum(e.haltedatum);
    return halt !== null
      ? { zustand: 'angehalten', bezugsZeitpunkt: halt }
      : { zustand: 'angehalten', grund: FRIST_GRUND.haltedatumUnbekannt };
  }

  // 3. Der wirksame Eingang trägt die laufende Uhr.
  const aae = alsDatum(e.antragsdatum);
  const xte = alsDatum(e.alleAntraegeDa);
  const basis = wirksamerEingang(aae, xte);
  if (!basis) {
    return { zustand: 'nicht_berechenbar', grund: FRIST_GRUND.ohneEingang };
  }
  const ziel = addDays(basis, ANTRAG_SLA_DAYS);
  if (!ziel) {
    return { zustand: 'nicht_berechenbar', grund: FRIST_GRUND.ohneEingang };
  }
  const rest = tageBis(ziel, stichtag);
  return {
    zustand: 'laeuft',
    basisFeld: basis === xte && basis !== aae ? 'D_XTE' : 'D_AAE',
    basisDatum: basis,
    zielDatum: ziel,
    bezugsZeitpunkt: stichtag,
    ...(rest !== null ? { tageRest: rest } : {}),
  };
}
