/**
 * Der zweite KI-Aufruf der Frage-Suche: aus Befund und Belegen wird eine
 * Antwort.
 *
 * Bis v4.88 war dieser Lauf keiner — die Frage stand nach dem Suchlauf ein
 * zweites Mal im Assistenten-Panel und musste dort noch einmal abgeschickt
 * werden. Zwei Absendungen für eine Frage, und die zweite antwortete auf 40 von
 * 663 Treffern. Jetzt läuft er von selbst, direkt nach der Suche, und er
 * bekommt etwas anderes zu sehen: die **gezählten Zahlen über alle Treffer**
 * ([frageBefund.ts](src/plugins/suche/frageBefund.ts)) plus die relevantesten
 * im Volltext.
 *
 * Dieselben sechs Pflichten wie beim Frageplan
 * ([frageplan-lauf.ts](./frageplan-lauf.ts)) — nur intern, passiver Ping,
 * frischer Chat, Ziel ausdrücklich `standard`, System-Prompt inline, ein Aufruf
 * ohne Retry. Dazu zwei eigene:
 *
 *  7. **Die Zahlen sind gegeben, nicht zu erfinden.** Das Modell sieht den
 *     Befund und darf keine eigene Menge behaupten. Sonst widerspricht die
 *     Antwortkarte der Trefferliste unmittelbar darunter — und von zwei Zahlen
 *     für dieselbe Sache ist immer eine falsch.
 *  8. **Jede Aussage über ein Vorhaben nennt sein FKZ.** Was ohne Kennzeichen
 *     dasteht, ist in der Liste darunter nicht nachprüfbar; die Karte wäre dann
 *     eine Behauptung statt einer Auskunft.
 *
 * Scheitert der Lauf, ist das kein Suchfehler: die Trefferliste ist
 * deterministisch entstanden und steht unabhängig davon.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { kiVerbindungGeprueft, istVerbindungsFehler, useKiConnectPrompt } from '@/core/services/ai/ki-guard';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';

/** Ziel-Tab — wie beim Frageplan, aus demselben Grund (`ki-ziel.ts`). */
const ANTWORT_ZIEL: BridgeZiel = 'standard';

/** Benennt den Lauf in der Fehlermeldung der Transport-Policy. */
const ZWECK = 'Die Antwort auf eine Suchfrage';

/** Deckel für die Antwort. Sie steht über einer Trefferliste, nicht an ihrer
 *  Stelle — wer mehr will, klickt sich durch die Treffer. */
export const MAX_ANTWORT_ZEICHEN = 1400;

export type FrageantwortErgebnis =
  | { ok: true; antwort: string }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

const MELDUNG = {
  leer: 'Zu dieser Frage gab es keine Treffer, über die sich etwas sagen ließe.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — die Treffer stehen, eine Antwort dazu nicht.',
  keineAntwort: 'Die KI hat keine verwertbare Antwort geliefert. Die Trefferliste steht unverändert.',
  abgebrochen: 'Die Antwort wurde abgebrochen.',
} as const;

/**
 * Der Prompt.
 *
 * **Ohne Beispielantwort** — dieselbe Lehre wie beim Frageplan: ein Modell, das
 * eine Schablone vor sich sieht, liefert die Schablone.
 */
export function baueAntwortPrompt(
  frage: string,
  befundText: string,
  belege: string,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'Du beantwortest eine Frage an eine Datenbank deutscher Förderanträge (ZIM).',
    'Die Suche ist bereits gelaufen. Du bekommst ihr gezähltes Ergebnis und die',
    'relevantesten Treffer im Volltext. Fasse zusammen, was die Zahlen und die',
    'Belege gemeinsam über die Frage sagen.',
    '',
    'Regeln:',
    '- Die Zahlen im Abschnitt „Befund" sind GEZÄHLT und gelten für ALLE Treffer.',
    '  Übernimm sie wörtlich. Erfinde keine eigenen Mengen, schätze nichts und',
    '  rechne nichts um — unter deiner Antwort steht dieselbe Trefferliste.',
    '- Die Belege sind ein AUSZUG. Sag nichts über Treffer, die nicht dabei sind;',
    '  was für die Gesamtmenge gilt, steht im Befund.',
    '- Nenne bei jeder Aussage über ein einzelnes Vorhaben sein Förderkennzeichen',
    '  in Klammern, damit es in der Liste wiederzufinden ist.',
    `- Höchstens ${MAX_ANTWORT_ZEICHEN} Zeichen. Kein Vorwort, keine Wiederholung`,
    '  der Frage, keine Schlussfloskel. Beginne mit der Antwort.',
    '- Deutsch, Fließtext mit kurzen Absätzen. Keine Tabelle: die Trefferliste',
    '  darunter ist bereits eine.',
    '- Trägt der Befund die Frage nicht, sag das in einem Satz statt zu raten.',
    'Antworte in EINEM Zug: kein Plan, keine Zwischenschritte, keine Werkzeuge,'
      + ' kein sichtbares Nachdenken — nur die Antwort.',
  ].join('\n');

  const userPrompt = [
    'Frage:', '"""', frage.trim(), '"""',
    '', 'Befund (gezählt, gilt für alle Treffer):', '"""', befundText, '"""',
    '', 'Belege (Auszug, die relevantesten Treffer):', '"""', belege, '"""',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Räumt die Modellantwort auf.
 *
 * Modelle stellen gern eine Überschrift oder ein „Zusammenfassung:" voran und
 * hängen einen Codefence drumherum. Beides ist in einer Karte über der
 * Trefferliste Lärm. Leer heißt: nichts Verwertbares.
 */
export function saeubereAntwort(roh: string): string {
  let t = (roh ?? '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  t = t.replace(/^#{1,6}\s.*(\r?\n)+/, '').trim();
  t = t.replace(/^(zusammenfassung|antwort|ergebnis)\s*:\s*/i, '').trim();
  return t.length > MAX_ANTWORT_ZEICHEN ? `${t.slice(0, MAX_ANTWORT_ZEICHEN).trimEnd()}…` : t;
}

export async function ermittleFrageantwort(
  bridge: AIBridge,
  frage: string,
  befundText: string,
  belege: string,
  signal?: AbortSignal,
): Promise<FrageantwortErgebnis> {
  if (frage.trim().length === 0 || belege.trim().length === 0) {
    return { ok: false, fehler: MELDUNG.leer };
  }

  let transport;
  try {
    transport = bridge.getTransportForDatenLauf(ZWECK);
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  if (!await kiVerbindungGeprueft(bridge, transport.name)) {
    return { ok: false, fehler: MELDUNG.nichtVerbunden, verbindungFehlt: true };
  }

  const { systemPrompt, userPrompt } = baueAntwortPrompt(frage, befundText, belege);

  let roh: string;
  try {
    await starteFrischenChat(transport, ANTWORT_ZIEL);
    if (signal?.aborted) return { ok: false, fehler: MELDUNG.abgebrochen };
    roh = await transport.submitMessage(`${systemPrompt}\n\n${userPrompt}`, systemPrompt, {
      ziel: ANTWORT_ZIEL,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return { ok: false, fehler: MELDUNG.abgebrochen };
    if (istVerbindungsFehler(err)) {
      useKiConnectPrompt.getState().oeffnen();
      return { ok: false, fehler: MELDUNG.nichtVerbunden, verbindungFehlt: true };
    }
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  const antwort = saeubereAntwort(roh);
  if (antwort.length === 0) return { ok: false, fehler: MELDUNG.keineAntwort };
  return { ok: true, antwort };
}

/** Für die Tests der Aufrufer — die Meldungen sind Teil des Verhaltens. */
export const FRAGEANTWORT_MELDUNG = MELDUNG;
