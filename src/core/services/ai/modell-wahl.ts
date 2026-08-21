/**
 * Auto-Wechsel des Modells nach Umfang: passt ein Lauf nicht in das gewählte
 * Kontextfenster, hebt ihn diese Entscheidung auf das größere Modell.
 *
 * **Warum das die Reihenfolge umdreht.** Bis v4 war Kürzen der erste Reflex:
 * `capVbMarkdown` schnitt die Vorhabensbeschreibung auf den Cap des *gewählten*
 * Modells zurück, und das größere Fenster daneben blieb ungenutzt. Jetzt wird
 * erst das Modell gewählt und der Cap daraus abgeleitet — gekürzt wird nur noch,
 * wenn auch das größte Fenster nicht reicht.
 *
 * **Nur aufwärts, nie abwärts.** Wer Qwen3.6 gewählt hat, behält es auch bei
 * einem kurzen Text: die Wahl ist eine Untergrenze, keine Schätzung, die wir
 * korrigieren dürften. Nach unten zu „optimieren" hieße, eine bewusste
 * Entscheidung des Bearbeiters zu überstimmen.
 *
 * Rein (kein IO) — `waehleModell` ist direkt in Node testbar;
 * `waehleModellFuerLauf` ist nur die Variante, die sich die Fenster aus
 * [llm-context.ts](./llm-context.ts) holt.
 */
import type { BridgeZiel } from './transports/streamlit';
import { getVbCharCap } from './llm-context';

/**
 * Beschriftung der Modelle — der Name, den auch die interne KI in ihrer
 * Auswahlliste zeigt.
 *
 * **Eine Quelle für die ganze App.** `'gpt-oss'`/`'qwen35'` sind interne
 * Kennungen; sie in eine Oberfläche zu lassen, verlangt vom Leser eine
 * Übersetzung, die er nicht hat. Wer ein Modell benennt — Auswahl, Eskalations-
 * Hinweis, Kontext-Warnung, Fassungs-Herkunft — nimmt diese Zuordnung.
 */
export const MODELL_LABEL: Record<BridgeZiel, string> = {
  'gpt-oss': 'gpt-oss-120b',
  qwen35: 'Qwen3.6-35B',
};

export interface ModellWahl {
  /** Das Modell, mit dem der Lauf tatsächlich fährt. */
  modell: BridgeZiel;
  /** true = wegen Umfang angehoben (die Meldung hängt hieran). */
  eskaliert: boolean;
  /** Zeichenzahl, die den Ausschlag gab. */
  zeichen: number;
  /** Kapazität des ursprünglich gewählten Modells (für die Meldung). */
  kapazitaetGewuenscht: number;
  /**
   * true = auch das größte Fenster reicht nicht; der Lauf fährt auf dem größten
   * Modell und wird zusätzlich gekürzt. Der Unterschied ist für den Leser
   * wesentlich: „auf Qwen3.6 gewechselt" heißt vollständig, „gewechselt und
   * trotzdem gekürzt" heißt unvollständig.
   */
  reichtTrotzdemNicht: boolean;
}

/**
 * Die Entscheidung selbst.
 *
 * `kapazitaet` ist die Zeichen-Kapazität je Modell (nicht Tokens) — gemessen wird
 * gegen Zeichen, weil das die Größe ist, die an beiden Aufrufstellen wirklich
 * vorliegt.
 */
export function waehleModell(
  gewuenscht: BridgeZiel,
  zeichen: number,
  kapazitaet: Record<BridgeZiel, number>,
): ModellWahl {
  const kapGewuenscht = kapazitaet[gewuenscht];
  const basis = { zeichen, kapazitaetGewuenscht: kapGewuenscht };

  if (zeichen <= kapGewuenscht) {
    return { ...basis, modell: gewuenscht, eskaliert: false, reichtTrotzdemNicht: false };
  }

  // Das größte verfügbare Fenster suchen. Bewusst über alle Modelle statt als
  // fest verdrahtetes „gpt-oss → qwen35": käme ein drittes hinzu, bliebe die
  // Regel dieselbe, statt hier eine zweite Rangfolge zu erfinden.
  const modelle = Object.keys(kapazitaet) as BridgeZiel[];
  const groesstes = modelle.reduce((a, b) => (kapazitaet[b] > kapazitaet[a] ? b : a));

  if (kapazitaet[groesstes] <= kapGewuenscht) {
    // Nichts Größeres da — kein Wechsel, aber es passt auch nicht.
    return { ...basis, modell: gewuenscht, eskaliert: false, reichtTrotzdemNicht: true };
  }

  return {
    ...basis,
    modell: groesstes,
    eskaliert: true,
    reichtTrotzdemNicht: zeichen > kapazitaet[groesstes],
  };
}

/** Alle Modelle, zwischen denen der Auto-Wechsel wählen darf. */
const MODELLE: readonly BridgeZiel[] = ['gpt-oss', 'qwen35'];

/**
 * Wie `waehleModell`, aber mit den aktuell geltenden Fenstern der internen KI
 * (abgelesene Werte schlagen die Konstanten, siehe llm-context).
 *
 * Die Kapazität kommt aus `getVbCharCap`, zieht also die Output-Reserve bereits
 * ab. An der Transport-Stelle steckt der System-Prompt schon in der gemessenen
 * Nachricht — die Reserve wird dort faktisch doppelt gerechnet. Das ist die
 * Richtung, die nichts kostet: im Zweifel wird auf das größere Modell gewechselt,
 * nicht zu spät.
 */
export function waehleModellFuerLauf(gewuenscht: BridgeZiel, zeichen: number): ModellWahl {
  const kapazitaet = {} as Record<BridgeZiel, number>;
  for (const m of MODELLE) kapazitaet[m] = getVbCharCap({ bridge: true, ziel: m });
  return waehleModell(gewuenscht, zeichen, kapazitaet);
}
