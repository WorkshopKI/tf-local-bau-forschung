/**
 * Der eine KI-Aufruf hinter der Suche mit natürlicher Sprache.
 *
 * Die sechs nicht verhandelbaren Pflichten eines solchen Laufs stehen in
 * [ein-schuss-lauf.ts](src/core/services/ai/ein-schuss-lauf.ts) und werden von
 * dort ausgeführt — hier bleibt nur, was diesen Lauf von anderen unterscheidet:
 * sein Prompt, sein Parser und seine Meldungen.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { fuehreEinSchussLauf } from '@/core/services/ai/ein-schuss-lauf';
import { baueFrageplanPrompt, parseFrageplan, type Frageplan } from './frageplan';

/** Benennt den Lauf in der Fehlermeldung der Transport-Policy. */
const ZWECK = 'Die Suche mit natürlicher Sprache';

export type FrageplanErgebnis =
  | { ok: true; plan: Frageplan }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

/**
 * Meldungen. Ausformuliert und ohne Schuldzuweisung — sie stehen im Suchfeld-
 * Bereich, wo der Nutzer gerade eine Antwort erwartet hat.
 */
const MELDUNG = {
  leer: 'Bitte eine Frage eingeben.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — die Frage konnte nicht übersetzt werden.',
  keinPlan: 'Aus dieser Frage ließen sich keine Suchbegriffe ableiten. Es wurde nach dem eingegebenen Text gesucht.',
  abgebrochen: 'Die Übersetzung wurde abgebrochen.',
} as const;

/**
 * Übersetzt eine Frage in einen Frageplan.
 *
 * `heuteJahr` kommt von außen, damit der reine Prompt-Bau ohne Uhr auskommt und
 * testbar bleibt. `signal` bricht einen laufenden Aufruf ab, wenn der Nutzer
 * weitertippt.
 */
export async function ermittleFrageplan(
  bridge: AIBridge,
  frage: string,
  heuteJahr: number,
  signal?: AbortSignal,
): Promise<FrageplanErgebnis> {
  if (frage.trim().length === 0) return { ok: false, fehler: MELDUNG.leer };

  const { systemPrompt, userPrompt } = baueFrageplanPrompt(frage, heuteJahr);

  const lauf = await fuehreEinSchussLauf({
    bridge,
    zweck: ZWECK,
    systemPrompt,
    userPrompt,
    meldungen: { nichtVerbunden: MELDUNG.nichtVerbunden, abgebrochen: MELDUNG.abgebrochen },
    ...(signal ? { signal } : {}),
  });
  if (!lauf.ok) return lauf;

  const plan = parseFrageplan(lauf.roh, frage);
  if (!plan) return { ok: false, fehler: MELDUNG.keinPlan };
  return { ok: true, plan };
}

/** Für die Tests der Aufrufer — die Meldungen sind Teil des Verhaltens. */
export const FRAGEPLAN_MELDUNG = MELDUNG;
