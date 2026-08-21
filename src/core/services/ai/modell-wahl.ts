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
 * **Nur aufwärts, nie abwärts.** Wer die starke Rolle gewählt hat, behält sie auch
 * bei einem kurzen Text: die Wahl ist eine Untergrenze, keine Schätzung, die wir
 * korrigieren dürften. Nach unten zu „optimieren" hieße, eine bewusste
 * Entscheidung des Bearbeiters zu überstimmen — und seit die Rolle `stark` mehr
 * meint als nur ein weites Fenster (agentische Fähigkeiten), wäre die Rechnung
 * „passt ja auch klein" schlicht die falsche Frage.
 *
 * Rein (kein IO) — `waehleModell` ist direkt in Node testbar;
 * `waehleModellFuerLauf` ist nur die Variante, die sich die Fenster aus
 * [llm-context.ts](./llm-context.ts) holt.
 */
import type { KiRolle } from './modell-katalog';
import { KI_ROLLEN } from './modell-katalog';
import { getVbCharCap } from './llm-context';

export interface ModellWahl {
  /** Das Modell, mit dem der Lauf tatsächlich fährt. */
  modell: KiRolle;
  /** true = wegen Umfang angehoben (die Meldung hängt hieran). */
  eskaliert: boolean;
  /** Zeichenzahl, die den Ausschlag gab. */
  zeichen: number;
  /** Kapazität der ursprünglich gewählten Rolle (für die Meldung). */
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
  gewuenscht: KiRolle,
  zeichen: number,
  kapazitaet: Record<KiRolle, number>,
): ModellWahl {
  const kapGewuenscht = kapazitaet[gewuenscht];
  const basis = { zeichen, kapazitaetGewuenscht: kapGewuenscht };

  if (zeichen <= kapGewuenscht) {
    return { ...basis, modell: gewuenscht, eskaliert: false, reichtTrotzdemNicht: false };
  }

  // Das größte verfügbare Fenster suchen. Bewusst über alle Rollen statt als fest
  // verdrahteter Einzelsprung: käme eine dritte hinzu, bliebe die Regel dieselbe,
  // statt hier eine zweite Rangfolge zu erfinden.
  const modelle = Object.keys(kapazitaet) as KiRolle[];
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
export function waehleModellFuerLauf(gewuenscht: KiRolle, zeichen: number): ModellWahl {
  const kapazitaet = {} as Record<KiRolle, number>;
  for (const m of KI_ROLLEN) kapazitaet[m] = getVbCharCap({ bridge: true, ziel: m });
  return waehleModell(gewuenscht, zeichen, kapazitaet);
}
