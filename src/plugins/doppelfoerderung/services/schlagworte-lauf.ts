/**
 * Der eine KI-Aufruf je Meldungszeile.
 *
 * Die sechs nicht verhandelbaren Pflichten eines solchen Laufs stehen in
 * [ein-schuss-lauf.ts](src/core/services/ai/ein-schuss-lauf.ts) und werden von
 * dort erledigt — hier bleibt nur, was diesen Lauf unterscheidet: sein Prompt,
 * sein Parser, seine Meldungen.
 *
 * **Ein Lauf je Zeile, nicht ein Lauf für den Stapel.** Der Chat der internen KI
 * ist zustandsbehaftet, und `fuehreEinSchussLauf` setzt ihn vor jedem Submit
 * zurück (Pitfall #36). Genau das ist hier der Punkt: Zeile 7 darf die
 * Schlagworte von Zeile 6 nicht erben. Ein gebündelter Lauf über zehn Zeilen
 * spart Wartezeit und handelt sich dafür ein, dass die Zeilen sich gegenseitig
 * färben — bei einer Liste, in der zehn Teilvorhaben desselben Verbunds
 * untereinander stehen, ist das kein theoretisches Risiko.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { fuehreEinSchussLauf } from '@/core/services/ai/ein-schuss-lauf';
import { baueSchlagwortPrompt, parseSchlagworte } from './schlagworte';

/** Benennt den Lauf in der Fehlermeldung der Transport-Policy. */
const ZWECK = 'Die Doppelförderungs-Prüfung';

/**
 * Meldungen. Sie stehen in der Zeile, deren Prüfung gerade scheiterte, und sagen
 * deshalb, was der Ausfall für DIESE Zeile bedeutet.
 */
const MELDUNG = {
  leer: 'Diese Zeile trägt weder Thema noch Aufgabenbeschreibung.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — es konnten keine Schlagworte gebildet werden.',
  abgebrochen: 'Die Prüfung wurde abgebrochen.',
  keineWorte: 'Aus dieser Zeile liessen sich keine Schlagworte ableiten.',
} as const;

export type SchlagwortErgebnis =
  | { ok: true; schlagworte: string[] }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

/**
 * Thema und Aufgabenbeschreibung einer Zeile in bis zu drei Schlagworte
 * übersetzen. Wirft nie — Fehler kommen als Ergebnis zurück.
 */
export async function ermittleSchlagworte(
  bridge: AIBridge,
  thema: string,
  aufgabenbeschreibung: string,
  signal?: AbortSignal,
): Promise<SchlagwortErgebnis> {
  if (thema.trim().length === 0 && aufgabenbeschreibung.trim().length === 0) {
    return { ok: false, fehler: MELDUNG.leer };
  }

  const { systemPrompt, userPrompt } = baueSchlagwortPrompt(thema, aufgabenbeschreibung);

  const lauf = await fuehreEinSchussLauf({
    bridge,
    zweck: ZWECK,
    systemPrompt,
    userPrompt,
    meldungen: { nichtVerbunden: MELDUNG.nichtVerbunden, abgebrochen: MELDUNG.abgebrochen },
    ...(signal ? { signal } : {}),
  });
  if (!lauf.ok) return lauf;

  const schlagworte = parseSchlagworte(lauf.roh);
  if (schlagworte.length === 0) return { ok: false, fehler: MELDUNG.keineWorte };
  return { ok: true, schlagworte };
}

/** Für die Tests der Aufrufer — die Meldungen sind Teil des Verhaltens. */
export const SCHLAGWORT_MELDUNG = MELDUNG;
