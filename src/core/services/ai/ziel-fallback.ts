/**
 * Transport-Fallback „agentische KI → Standard-KI" für einen einzelnen Lauf.
 *
 * Die globale KI-Varianten-Präferenz (`ki-ziel.ts`) kann Läufe auf den agentischen
 * Tab der internen KI routen. Ist dieser Tab nicht erreichbar oder liefert er
 * Unbrauchbares, soll der Lauf NICHT hart scheitern — die Standard-KI übernimmt
 * still, der Aufrufer erfährt es über `zielFallback` und meldet es dezent (Info,
 * kein Fehlerbanner).
 *
 * Bewusst eng geschnitten:
 *  - GENAU EIN Retry, immer agentisch → standard, nie umgekehrt, nie mehrfach.
 *  - KEIN Retry bei Nutzer-Abbruch (`AbortSignal` / `AbortError`) — ein Stopp ist
 *    kein Ausfall.
 *  - KEIN Retry, wenn `ziel` beim aktiven Transport gar nicht wirkt: `ziel` wählt
 *    nur den Streamlit-Tab aus; auf DirectLLM wäre der zweite Lauf byte-identisch
 *    zum ersten und damit reine Verschwendung (`zielWirktAuf`).
 *
 * Rein + React-frei; die Ziel-Präferenz wird synchron aus dem Store gelesen (wie
 * in den Runnern), damit Aufrufer nichts durchreichen müssen.
 */
import { aktivesZielFuerLauf } from './ki-ziel';
import type { BridgeZiel } from './transports/streamlit';

export interface ZielFallbackOptions<R> {
  /**
   * Wertet der aktive Transport `ziel` überhaupt aus? Nur dann kann ein zweiter
   * Lauf ein anderes Ergebnis bringen. Über `zielWirktAuf(transport)` bestimmen.
   */
  zielWirkt: boolean;
  /** Abbruch-Signal des Laufs — abgebrochen ⇒ niemals Retry. */
  signal?: AbortSignal;
  /**
   * Ergebnis liegt vor, ist aber unbrauchbar (leerer finaler Text, unparsebare
   * Antwort, vom Lauf gemeldetes Tor). Fehlt das Prädikat, gilt jedes Ergebnis
   * als brauchbar und nur ein Wurf löst den Fallback aus.
   */
  istUnbrauchbar?: (ergebnis: R) => boolean;
  /** Wird unmittelbar VOR dem Retry gerufen (z.B. Streaming-Puffer leeren). */
  vorRetry?: () => void;
}

export interface ZielFallbackErgebnis<R> {
  result: R;
  /** True ⇔ der erste (agentische) Versuch scheiterte und der Standard-Lauf übernahm. */
  zielFallback: boolean;
}

/**
 * Wirkt sich `ziel` auf diesem Transport aus? Nur die Streamlit-Bridge routet
 * damit zwischen Standard- und agentischem Tab (`starteFrischenChat` +
 * `submitMessage`); DirectLLM ignoriert die Option.
 */
export function zielWirktAuf(transport: { name: string }): boolean {
  return transport.name === 'Streamlit';
}

function istAbbruch(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Führt `lauf` mit der aktiven Ziel-Präferenz aus und wiederholt ihn GENAU EINMAL
 * mit `undefined` (= Standard-/aktiver Tab), wenn der agentische Versuch wirft
 * oder ein unbrauchbares Ergebnis liefert. Jeder Versuch ist ein eigener
 * `runSkill`-Aufruf — der Chat-Reset (Pitfall #36) greift damit pro Versuch.
 *
 * Wirft der Retry, propagiert der Fehler unverändert.
 */
export async function mitZielFallback<R>(
  lauf: (ziel: BridgeZiel | undefined) => Promise<R>,
  opts: ZielFallbackOptions<R>,
): Promise<ZielFallbackErgebnis<R>> {
  const ziel = aktivesZielFuerLauf();
  const retryMoeglich = ziel === 'agentisch' && opts.zielWirkt;

  const retry = async (): Promise<ZielFallbackErgebnis<R>> => {
    opts.vorRetry?.();
    return { result: await lauf(undefined), zielFallback: true };
  };

  let ergebnis: R;
  try {
    ergebnis = await lauf(ziel);
  } catch (err) {
    if (!retryMoeglich || istAbbruch(err) || opts.signal?.aborted) throw err;
    return retry();
  }
  if (!retryMoeglich || opts.signal?.aborted) return { result: ergebnis, zielFallback: false };
  if (!opts.istUnbrauchbar?.(ergebnis)) return { result: ergebnis, zielFallback: false };
  return retry();
}
