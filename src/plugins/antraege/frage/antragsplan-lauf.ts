/**
 * Der eine KI-Aufruf hinter der Frage an die Förderantrags-Liste.
 *
 * Die sechs nicht verhandelbaren Pflichten eines einschüssigen Laufs stehen in
 * [ein-schuss-lauf.ts](src/core/services/ai/ein-schuss-lauf.ts) und werden von
 * dort ausgeführt — hier bleibt nur, was diesen Lauf unterscheidet: sein Prompt,
 * sein Parser und seine Meldungen.
 *
 * **Scheitert er, ändert sich nichts.** Weder Filter noch Liste hängen an diesem
 * Aufruf; sie sind deterministisch entstanden. Die Meldungen sagen deshalb
 * ausdrücklich, dass die bestehende Sicht steht — „Fehler" allein ließe den
 * Nutzer rätseln, ob seine Filter jetzt halb gesetzt sind.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { fuehreEinSchussLauf } from '@/core/services/ai/ein-schuss-lauf';
import { baueAntragsplanPrompt, parseAntragsplan, type Antragsplan } from './antragsplan';

/** Benennt den Lauf in der Fehlermeldung der Transport-Policy. */
const ZWECK = 'Die Frage an die Förderantrags-Liste';

export type AntragsplanErgebnis =
  | { ok: true; plan: Antragsplan }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

/**
 * Meldungen. Ausformuliert und ohne Schuldzuweisung — sie stehen unter dem
 * Suchfeld, wo der Nutzer gerade eine gefilterte Liste erwartet hat.
 */
const MELDUNG = {
  leer: 'Bitte eine Frage eingeben.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — die Frage konnte nicht in Filter '
    + 'übersetzt werden. Die Liste steht unverändert.',
  keinPlan: 'Aus dieser Frage ließen sich keine Filter ableiten. Die Filter sind unverändert; '
    + 'gesucht wurde nach dem eingegebenen Text.',
  abgebrochen: 'Die Übersetzung wurde abgebrochen.',
} as const;

/**
 * Übersetzt eine Frage in einen Antragsplan.
 *
 * `heuteJahr` kommt von außen, damit der reine Prompt-Bau ohne Uhr auskommt und
 * testbar bleibt. `signal` bricht einen laufenden Aufruf ab, wenn der Nutzer
 * weitertippt.
 */
export async function ermittleAntragsplan(
  bridge: AIBridge,
  frage: string,
  heuteJahr: number,
  signal?: AbortSignal,
): Promise<AntragsplanErgebnis> {
  if (frage.trim().length === 0) return { ok: false, fehler: MELDUNG.leer };

  const { systemPrompt, userPrompt } = baueAntragsplanPrompt(frage, heuteJahr);

  const lauf = await fuehreEinSchussLauf({
    bridge,
    zweck: ZWECK,
    systemPrompt,
    userPrompt,
    meldungen: { nichtVerbunden: MELDUNG.nichtVerbunden, abgebrochen: MELDUNG.abgebrochen },
    ...(signal ? { signal } : {}),
  });
  if (!lauf.ok) return lauf;

  const plan = parseAntragsplan(lauf.roh, frage);
  if (!plan) return { ok: false, fehler: MELDUNG.keinPlan };
  return { ok: true, plan };
}

/** Für die Tests der Aufrufer — die Meldungen sind Teil des Verhaltens. */
export const ANTRAGSPLAN_MELDUNG = MELDUNG;
