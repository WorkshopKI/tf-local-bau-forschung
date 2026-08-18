/**
 * Was das Suchfeld im **Frage-Modus** der Förderantrags-Liste vorschlägt.
 *
 * Ein leeres Feld, das eine Frage in natürlicher Sprache erwartet, ist die
 * schwerste Eingabe der App: der Platzhalter zeigt genau **ein** Beispiel, und
 * welche Achsen es sonst noch gibt, steht nirgends. Die Liste beantwortet
 * deshalb nicht „was hast du zuletzt gesucht", sondern „was kann man hier
 * überhaupt fragen".
 *
 * Drei Abschnitte, in dieser Reihenfolge:
 *
 *  1. **Zuletzt gefragt** — der eigene Verlauf
 *     ([frageVerlauf.ts](./frageVerlauf.ts)). Steht vorn, weil eine Frage von
 *     gestern näher an der Absicht ist als jedes Beispiel.
 *  2. **Beispielfragen** — drei fertige Fragen, jede über eine andere
 *     Achsen-Kombination. Sie sind der Katalog des Machbaren.
 *  3. **Zum Ausfüllen** — dieselbe Idee, aber mit Lücken.
 *
 * **Die Trennlinie, die alles trägt: fertige Frage gegen halbe Frage.** Verlauf
 * und Beispiel waren schon einmal ein Auftrag → die Auswahl tut, was die
 * Eingabetaste täte, und ruft die KI. Eine Vorlage ist ein halber Satz → sie
 * wird nur eingesetzt, und der Schreibcursor landet auf der ersten Lücke.
 * Dieselbe Regel wie in der Dokumenten-Suche, wo Verlaufs-Einträge mitfeuern und
 * die Syntax-Beispiele nicht.
 *
 * **Vorgeschlagen wird nur, was die App auch ausführen kann.** Jede Frage hier
 * spricht ausschließlich Achsen an, die der
 * [Antragsplan](./antragsplan.ts) kennt — Status, Variante, Jahr, Projektart,
 * PreCheck, Bearbeiter, Stillstand, Thema. Eine Beispielfrage nach dem Ort wäre
 * eine Einladung in die Zeile „nicht berücksichtigt".
 *
 * Rein — kein React, kein Speicher, keine Uhr.
 */
import { IRRLAEUFER_PHASE, VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
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
 * Wie viele Verlaufs-Einträge über den Beispielen Platz haben.
 *
 * **Drei**, in `dev:local` ausgemessen: mit fünf standen neun Zeilen und drei
 * Überschriften in der Liste, sie lief auf 340 px an ihren Deckel, und der
 * Abschnitt „Zum Ausfüllen" lag unter der Kante — genau der Abschnitt, den
 * niemand sucht, der ihn noch nie gesehen hat. Mit drei je Abschnitt ist die
 * ganze Liste auf einen Blick da. Dieselbe Abwägung wie beim gekürzten Verlauf
 * der Dokumenten-Suche (`MAX_VERLAUF_DANEBEN`).
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
function luecke(name: string): string {
  return `${LUECKE_AUF}${name}${LUECKE_ZU}`;
}

// ── Die Vorschläge selbst ────────────────────────────────────────────────────

/**
 * Die Fördervarianten als Aufzählung — aus `VB_PHASE_LABELS`, nicht
 * abgeschrieben. Dieselbe Einzelquelle, aus der auch der Prompt seine erlaubten
 * Werte nimmt: eine Hilfe, die andere Werte nennt als die Maschine akzeptiert,
 * ist schlimmer als keine.
 *
 * Ohne den Irrläufer, und zwar über seine benannte Konstante statt über eine
 * eigene Liste: er ist keine Fördervariante, nach der man fragt, sondern ein
 * falsch adressierter Antrag. Der Plan nähme ihn an — vorschlagen muss man ihn
 * deswegen nicht.
 */
function variantenHinweis(): string {
  const namen = Object.entries(VB_PHASE_LABELS)
    .filter(([n]) => Number(n) !== IRRLAEUFER_PHASE)
    .map(([, label]) => label);
  return `Variante: ${namen.join(' · ')}`;
}

/**
 * Drei fertige Fragen — jede über eine andere Achsen-Kombination, damit die
 * Liste einen Vorrat zeigt und nicht dreimal dasselbe.
 *
 * Sie sind absichtlich ausformuliert und nicht knapp: Nutzer schreiben in
 * ganzen Sätzen, und ein Beispiel, das wie eine Filterzeile aussieht, erzieht
 * zu Stichworten — dafür gibt es den anderen Modus.
 */
const BEISPIELE: ReadonlyArray<{ text: string; achsen: string }> = [
  {
    text: 'alle Einzelprojekte aus den Jahren 2025 und 2026, die noch keinen PreCheck haben',
    achsen: 'Projektart · Jahr · PreCheck',
  },
  {
    text: 'alle Anträge, die noch in Bearbeitung sind und seit mehr als 2 Monaten kein neues Kürzel bekommen haben',
    achsen: 'Status · Stillstand',
  },
  {
    text: 'alle Netzwerkanträge der Phase 2, die abgeschlossen sind',
    achsen: 'Variante · Status',
  },
];

/** Drei Vorlagen. Jede Lücke NENNT, was hineingehört — sie trägt keinen
 *  Beispielwert, den man erst als Lücke erkennen müsste. */
const VORLAGEN: ReadonlyArray<{ text: string; hinweis: string }> = [
  {
    text: `alle ${luecke('Variante')}-Anträge aus dem Jahr ${luecke('Jahr')}, die noch keinen PreCheck haben`,
    hinweis: variantenHinweis(),
  },
  {
    text: `alle Anträge von Bearbeiter ${luecke('Kürzel')}, bei denen seit mehr als ${luecke('Anzahl')} Monaten nichts passiert ist`,
    hinweis: 'Kürzel wie THÜ · Anzahl in Monaten',
  },
  {
    text: `alle Anträge zum Thema ${luecke('Stichwort')}, die noch in Bearbeitung sind`,
    hinweis: 'Stichwort aus Titel, Kurzbeschreibung oder aufgenommenen Dokumenten',
  },
];

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

  const beispiele = BEISPIELE.filter(b => gesucht === '' || passt(b.text, gesucht));
  if (beispiele.length > 0) {
    abschnitte.push({
      titel: 'Beispielfragen',
      eintraege: beispiele.map((b, i) => ({
        art: 'beispiel' as const,
        text: b.text,
        erklaerung: b.achsen,
        fertig: true,
        key: `beispiel:${i}`,
      })),
    });
  }

  const vorlagen = VORLAGEN.filter(v => gesucht === '' || passt(v.text, gesucht));
  if (vorlagen.length > 0) {
    abschnitte.push({
      titel: 'Zum Ausfüllen',
      eintraege: vorlagen.map((v, i) => ({
        art: 'vorlage' as const,
        text: v.text,
        erklaerung: v.hinweis,
        fertig: false,
        key: `vorlage:${i}`,
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
