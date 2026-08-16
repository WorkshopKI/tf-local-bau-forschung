/**
 * „Von der KI prüfen" für die Wortform-Chips.
 *
 * Der Wortstamm-Vergleich ist sprachlich, nicht fachlich. Er weiß, dass
 * „normotherme" und „Normung" denselben Stamm tragen — nicht, dass das eine von
 * Körpertemperatur handelt und das andere von technischen Regeln. Gemeldet
 * wurde genau das: die Vorschläge seien „überwiegend nicht sinnvoll".
 *
 * Zwei Dinge halfen deterministisch und sind vorher passiert: Buchstaben-Treffer
 * fallen an der Wortgrenze raus (`enthaeltAlsWortteil`), und die Liste ist nach
 * Häufigkeit sortiert. Was übrig bleibt, braucht Bedeutung — und dafür ist ein
 * Modell da.
 *
 * **Auf Wunsch, nicht automatisch.** Die Wortformen sind heute sofort da und
 * funktionieren ohne Verbindung; das darf ein KI-Lauf nicht kaputt machen. Der
 * Knopf ist ein Angebot, kein Ersatz — und er läuft EINMAL pro Klick, nie pro
 * Tastendruck.
 *
 * **Aussortiert wird, was das Modell NENNT.** Andersherum — „nenne die
 * passenden" — hätte jedes Wort verworfen, das das Modell schlicht vergisst,
 * und aus einem Auslassungsfehler würde eine kürzere Trefferliste. So kostet
 * Vergesslichkeit nur, dass ein unpassendes Wort stehen bleibt.
 *
 * Die Pflichten des Laufs sind dieselben wie beim Frageplan (dort ausführlich
 * im Kopfkommentar): nur intern, passiver Ping mit Verbinden-Dialog, frischer
 * Chat vor dem Submit (Pitfall #36), Ziel ausdrücklich `standard`, System-Prompt
 * inlinen, ein Aufruf ohne Retry, wirft nie.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { kiVerbindungGeprueft, istVerbindungsFehler, useKiConnectPrompt } from '@/core/services/ai/ki-guard';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';

const ZIEL: BridgeZiel = 'standard';
const ZWECK = 'Die Prüfung der Wortformen';

/** Mehr Wörter braucht keine Prüfung — so viele sammelt die Suche höchstens. */
export const MAX_KANDIDATEN = 64;

/** Antwortet das Modell damit, passt alles. Ein leerer Text wäre nicht von
 *  einer abgebrochenen Antwort zu unterscheiden. */
const KEINE = 'KEINE';

export type PruefErgebnis =
  | { ok: true; aussortiert: readonly string[] }
  | { ok: false; fehler: string; verbindungFehlt?: boolean };

export const PRUEF_MELDUNG = {
  leer: 'Es gibt keine Wortformen zu prüfen.',
  nichtVerbunden: 'Die interne KI ist nicht verbunden — die Wortformen wurden nicht geprüft.',
  unverstaendlich: 'Die Antwort der KI war nicht verwertbar. Die Wortformen bleiben unverändert.',
  abgebrochen: 'Die Prüfung wurde abgebrochen.',
} as const;

/**
 * Der Prompt. Ohne Beispiel-Liste und ohne Klammern: ein Modell, das die
 * Schablone wiederholt, lieferte sonst die Schablone (dieselbe Lehre wie beim
 * Frageplan). Die Kandidaten stehen als nummerierte Zeilen darunter — das ist
 * die einzige Liste im Text.
 */
export function bauePruefPrompt(
  suchwoerter: readonly string[],
  kandidaten: readonly string[],
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'Du prüfst Wortlisten für eine Förderdatenbank.',
    '',
    'Der Nutzer hat nach einem oder mehreren Begriffen gesucht. Ein rein',
    'sprachliches Verfahren hat daraufhin Wörter aus den Anträgen eingesammelt,',
    'die denselben Wortstamm tragen. Manche davon meinen dieselbe Sache wie die',
    'Suchbegriffe, andere teilen nur zufällig den Wortstamm: "Normung" und',
    '"Normalverteilung" fangen gleich an und handeln von Verschiedenem.',
    '',
    'Deine Aufgabe: Nenne die Wörter aus der Liste, die NICHT dieselbe Sache',
    'meinen wie die Suchbegriffe.',
    '',
    'Regeln:',
    '- Antworte ausschliesslich mit Wörtern aus der Liste, eines pro Zeile.',
    '- Schreibe sie genau so, wie sie in der Liste stehen.',
    '- Keine Nummern, keine Begründung, keine Überschrift, kein weiterer Text.',
    `- Passt jedes Wort, antworte mit dem einzelnen Wort ${KEINE}.`,
    '- Im Zweifel lässt du ein Wort stehen. Ein zu viel behaltenes Wort kostet',
    '  den Nutzer einen Klick, ein zu viel entferntes kostet ihn Treffer.',
    '- Zusammensetzungen gehören dazu, wenn sie von der gesuchten Sache handeln.',
    '- Andere Wortformen desselben Begriffs gehören dazu.',
  ].join('\n');

  const userPrompt = [
    `Gesucht wurde nach: ${suchwoerter.join(', ')}`,
    '',
    'Liste:',
    ...kandidaten.map(k => k),
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Liest die Antwort. Verglichen wird klein geschrieben und nur gegen die
 * Kandidaten — ein Modell, das ein Wort erfindet oder eine Begründung anhängt,
 * kann damit nichts aussortieren, was es nicht gab.
 *
 * Ein Ergebnis, das ALLES aussortiert, gilt als unverwertbar: dann hat das
 * Modell die Aufgabe umgedreht und die passenden genannt. Das stillschweigend
 * anzuwenden nähme dem Nutzer seine gesamte Trefferliste.
 */
export function leseAussortierte(
  roh: string,
  kandidaten: readonly string[],
): readonly string[] | null {
  const erlaubt = new Map(kandidaten.map(k => [k.toLowerCase(), k]));
  const treffer = new Set<string>();
  let sahKeine = false;
  for (const zeile of roh.split('\n')) {
    const wort = zeile.trim().replace(/^[-*\d.)\s]+/, '').trim();
    if (wort.length === 0) continue;
    if (wort.toUpperCase() === KEINE) { sahKeine = true; continue; }
    const original = erlaubt.get(wort.toLowerCase());
    if (original !== undefined) treffer.add(original);
  }
  if (treffer.size === 0) return sahKeine ? [] : null;
  if (treffer.size === kandidaten.length) return null;
  return Array.from(treffer);
}

/** Prüft die Wortform-Kandidaten. Siehe Kopfkommentar für die Pflichten. */
export async function pruefeWortformen(
  bridge: AIBridge,
  suchwoerter: readonly string[],
  kandidaten: readonly string[],
  signal?: AbortSignal,
): Promise<PruefErgebnis> {
  const liste = kandidaten.slice(0, MAX_KANDIDATEN);
  if (liste.length === 0 || suchwoerter.length === 0) {
    return { ok: false, fehler: PRUEF_MELDUNG.leer };
  }

  let transport;
  try {
    transport = bridge.getTransportForDatenLauf(ZWECK);
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  if (!await kiVerbindungGeprueft(bridge, transport.name)) {
    return { ok: false, fehler: PRUEF_MELDUNG.nichtVerbunden, verbindungFehlt: true };
  }

  const { systemPrompt, userPrompt } = bauePruefPrompt(suchwoerter, liste);

  let roh: string;
  try {
    await starteFrischenChat(transport, ZIEL);
    if (signal?.aborted) return { ok: false, fehler: PRUEF_MELDUNG.abgebrochen };
    roh = await transport.submitMessage(`${systemPrompt}\n\n${userPrompt}`, systemPrompt, {
      ziel: ZIEL,
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return { ok: false, fehler: PRUEF_MELDUNG.abgebrochen };
    if (istVerbindungsFehler(err)) {
      useKiConnectPrompt.getState().oeffnen();
      return { ok: false, fehler: PRUEF_MELDUNG.nichtVerbunden, verbindungFehlt: true };
    }
    return { ok: false, fehler: err instanceof Error ? err.message : String(err) };
  }

  const aussortiert = leseAussortierte(roh, liste);
  if (aussortiert === null) return { ok: false, fehler: PRUEF_MELDUNG.unverstaendlich };
  return { ok: true, aussortiert };
}
