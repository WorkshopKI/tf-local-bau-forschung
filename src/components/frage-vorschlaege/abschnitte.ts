/**
 * Was ein Suchfeld im **Frage-Modus** vorschlägt — der geteilte Kern.
 *
 * Ein leeres Feld, das eine Frage in natürlicher Sprache erwartet, ist die
 * schwerste Eingabe der App: der Platzhalter zeigt genau **ein** Beispiel, und
 * welche Achsen es sonst noch gibt, steht nirgends. Die Liste beantwortet
 * deshalb nicht „was hast du zuletzt gesucht", sondern **„was kann man hier
 * überhaupt fragen"**.
 *
 * Drei Abschnitte, in dieser Reihenfolge:
 *
 *  1. **Zuletzt gefragt** — der eigene Verlauf. Steht vorn, weil eine Frage von
 *     gestern näher an der Absicht ist als jedes Beispiel.
 *  2. **Beispielfragen** — fertige Fragen, jede über eine andere
 *     Achsen-Kombination. Sie sind der Katalog des Machbaren.
 *  3. **Zum Ausfüllen** — dieselbe Idee, aber mit Lücken.
 *
 * **Die Trennlinie, die alles trägt: fertige Frage gegen halbe Frage.** Verlauf
 * und Beispiel waren schon einmal ein Auftrag → die Auswahl tut, was die
 * Eingabetaste täte, und ruft die KI. Eine Vorlage ist ein halber Satz → sie
 * wird nur eingesetzt, und der Schreibcursor landet auf der ersten Lücke.
 *
 * **Der Katalog kommt von außen** (v4.109): die Mechanik ist überall dieselbe,
 * die Fragen sind es nie. Die Förderantrags-Liste fragt nach Metadaten-Achsen
 * (Status, Variante, PreCheck), die Dokumenten-Suche nach Themen mit
 * Einschränkungen — ein gemeinsamer Beispiel-Vorrat wäre auf jeder der beiden
 * Seiten zur Hälfte eine Einladung ins Leere. Was ein Katalog verspricht, muss
 * die Maschine dahinter auch ausführen können.
 *
 * Rein — kein React, kein Speicher, keine Uhr.
 */
import { filterRecentSearches } from '@/core/services/search/anfrage-verlauf';

export type FrageVorschlagArt = 'verlauf' | 'beispiel' | 'vorlage';

export interface FrageVorschlag {
  art: FrageVorschlagArt;
  /** Was in die Eingabe kommt. */
  text: string;
  /** Der Halbsatz dahinter — welche Achsen die Frage setzt, was die Lücke will. */
  erklaerung?: string;
  /**
   * Fertige Frage? Dann sendet die Auswahl sie ab. Eine Vorlage wird nur
   * eingesetzt — abschicken würde die KI nach „‹Kürzel›" fragen lassen.
   */
  fertig: boolean;
  /** Stabiler Schlüssel für React. */
  key: string;
}

export interface FrageAbschnitt {
  titel: string;
  eintraege: readonly FrageVorschlag[];
}

/**
 * Der Vorrat einer Seite: fertige Fragen und Vorlagen mit Lücken.
 *
 * `praefix` hält die React-Schlüssel zweier Kataloge auseinander, falls je
 * beide auf einer Seite stünden — heute nicht der Fall, aber ein Schlüssel, der
 * nur zufällig eindeutig ist, ist keiner.
 */
export interface FrageKatalog {
  praefix: string;
  beispiele: ReadonlyArray<{ text: string; erklaerung: string }>;
  vorlagen: ReadonlyArray<{ text: string; hinweis: string }>;
}

/**
 * Wie viele Verlaufs-Einträge über den Beispielen Platz haben.
 *
 * **Drei**, in `dev:local` ausgemessen: mit fünf standen neun Zeilen und drei
 * Überschriften in der Liste, sie lief auf 340 px an ihren Deckel, und der
 * Abschnitt „Zum Ausfüllen" lag unter der Kante — genau der Abschnitt, den
 * niemand sucht, der ihn noch nie gesehen hat. Mit drei je Abschnitt ist die
 * ganze Liste auf einen Blick da.
 */
const MAX_VERLAUF = 3;

// ── Platzhalter ──────────────────────────────────────────────────────────────

/**
 * Die Lücken einer Vorlage stehen in ‹ › — einfachen Winkelzeichen, die auf
 * keiner deutschen Tastatur liegen und in keinem Antragstitel vorkommen. Ein
 * Paar aus normalen Klammern oder Anführungszeichen wäre in einer Frage nach
 * einem Titel ein echtes Zeichen und keine Lücke mehr.
 */
export const LUECKE_AUF = '‹';
export const LUECKE_ZU = '›';

/** Die erste noch offene Lücke, oder `null`. Die Marken gehören dazu: wer
 *  tippt, ersetzt die Lücke samt Zeichen. */
export function ersteLuecke(text: string): { start: number; ende: number } | null {
  const start = text.indexOf(LUECKE_AUF);
  if (start === -1) return null;
  const zu = text.indexOf(LUECKE_ZU, start + 1);
  if (zu === -1) return null;
  return { start, ende: zu + 1 };
}

/** Steht in dieser Frage noch eine Lücke? Dann ist sie nicht absendbar. */
export function hatLuecke(text: string): boolean {
  return ersteLuecke(text) !== null;
}

/** Eine Lücke, wie sie im Vorlagentext steht. */
export function luecke(name: string): string {
  return `${LUECKE_AUF}${name}${LUECKE_ZU}`;
}

// ── Die Abschnitte ───────────────────────────────────────────────────────────

/** Case-insensitiver Teilstring — dieselbe Regel wie im Verlaufs-Filter. */
function passt(text: string, gesucht: string): boolean {
  return text.toLowerCase().includes(gesucht);
}

/**
 * Die Abschnitte zu einer Eingabe. Leere Abschnitte fallen weg, und wenn alle
 * leer sind, kommt eine leere Liste zurück — dann zeigt der Aufrufer nichts.
 *
 * Gefiltert wird auch über Beispiele und Vorlagen: wer eine eigene Frage
 * schreibt, hat den Katalog hinter sich gelassen, und eine Liste, die dabei
 * stehen bleibt, verdeckt nur die Eingabe.
 */
export function baueFrageAbschnitte(
  text: string,
  verlauf: readonly string[],
  katalog: FrageKatalog,
): FrageAbschnitt[] {
  const gesucht = text.trim().toLowerCase();
  const abschnitte: FrageAbschnitt[] = [];

  const ausVerlauf = filterRecentSearches(verlauf as string[], text, MAX_VERLAUF);
  if (ausVerlauf.length > 0) {
    abschnitte.push({
      titel: 'Zuletzt gefragt',
      eintraege: ausVerlauf.map(q => ({
        art: 'verlauf' as const,
        text: q,
        fertig: true,
        key: `verlauf:${q.toLowerCase()}`,
      })),
    });
  }

  const beispiele = katalog.beispiele.filter(b => gesucht === '' || passt(b.text, gesucht));
  if (beispiele.length > 0) {
    abschnitte.push({
      titel: 'Beispielfragen',
      eintraege: beispiele.map((b, i) => ({
        art: 'beispiel' as const,
        text: b.text,
        erklaerung: b.erklaerung,
        fertig: true,
        key: `${katalog.praefix}:beispiel:${i}`,
      })),
    });
  }

  const vorlagen = katalog.vorlagen.filter(v => gesucht === '' || passt(v.text, gesucht));
  if (vorlagen.length > 0) {
    abschnitte.push({
      titel: 'Zum Ausfüllen',
      eintraege: vorlagen.map((v, i) => ({
        art: 'vorlage' as const,
        text: v.text,
        erklaerung: v.hinweis,
        fertig: false,
        key: `${katalog.praefix}:vorlage:${i}`,
      })),
    });
  }

  return abschnitte;
}

/** Alle Einträge in Anzeigereihenfolge — die Grundlage der Tastatur-Navigation
 *  (EIN Index über alle Abschnitte, nicht einer je Abschnitt). */
export function flacheListe(abschnitte: readonly FrageAbschnitt[]): FrageVorschlag[] {
  return abschnitte.flatMap(a => [...a.eintraege]);
}
