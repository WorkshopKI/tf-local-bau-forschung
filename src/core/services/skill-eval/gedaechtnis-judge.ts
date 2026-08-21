/**
 * Node-freie Judge-Helfer für die Gedächtnis-Eval (Assistent Phase 2).
 *
 * Extrahiert aus dem node-gebundenen CLI-Wrapper (`gedaechtnis-eval.ts`), damit
 * das In-App-Eval-Panel dieselbe Judge-Logik über die Bridge nutzen kann OHNE
 * `node:fs`/`process` in den Browser-Bundle-Graph zu ziehen. Reine Funktionen +
 * ein injizierter `AITransport`; keine IDB-/DOM-/Node-Abhängigkeit.
 *
 * Der Judge-Prompt ist bewusst VB-frei: er bettet nur die (fiktiven) Fixture-
 * Ereignisse + die daraus abgeleiteten Gedächtnis-Einträge ein, nie Roh-VB-Text.
 */
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import type { GedaechtnisEintrag } from '@/core/services/assistent/gedaechtnis/types';
import type { GedaechtnisFixture } from './gedaechtnis-assertions';

export interface JudgeScore {
  faktentreue: number;
  nuetzlichkeit: number;
  begruendung?: string;
  fehler?: boolean;
}

/** Formatiert die Fixture-Ereignisse als kompakte Zeilen für den Judge-Prompt. */
export function ereignisText(fx: GedaechtnisFixture): string {
  const zeilen: string[] = [];
  fx.zyklen.forEach((z, i) => {
    if (fx.zyklen.length > 1) zeilen.push(`-- Zyklus ${i + 1} --`);
    for (const e of z.ereignisse) {
      const d = e.detail ? ' ' + Object.entries(e.detail).map(([k, v]) => `${k}=${String(v)}`).join(', ') : '';
      const ent = e.entitaet ? ` [${e.entitaet.art} ${e.entitaet.id}]` : '';
      zeilen.push(`${e.typ}${ent}${d}`);
    }
  });
  return zeilen.join('\n');
}

/** Baut den (VB-freien) Judge-Prompt: Ereignisse + abgeleitete Einträge → Score-Rubrik. */
export function buildJudgePrompt(fx: GedaechtnisFixture, active: GedaechtnisEintrag[]): string {
  const eintraege = active.length > 0
    ? active.map(e => `- (${e.block}) ${e.text}`).join('\n')
    : '(keine Einträge)';
  return [
    'Du bewertest das Ergebnis einer Gedächtnis-Konsolidierung. Gegeben sind die beobachteten',
    'Ereignisse eines Nutzers und die daraus abgeleiteten Gedächtnis-Einträge.',
    '',
    'Ereignisse:',
    ereignisText(fx),
    '',
    'Abgeleitete Einträge:',
    eintraege,
    '',
    'Bewerte auf einer Skala von 1 (schlecht) bis 5 (sehr gut):',
    '- faktentreue: Sind ALLE Einträge durch die Ereignisse gedeckt (nichts erfunden/widersprüchlich)?',
    '- nuetzlichkeit: Sind die Einträge knapp, relevant und nicht redundant?',
    '',
    'Antworte AUSSCHLIESSLICH als JSON: {"faktentreue": <1-5>, "nuetzlichkeit": <1-5>, "begruendung": "<kurz>"}',
  ].join('\n');
}

/** Optionale Bridge-Weitergabe: `resetVorSubmit` startet einen frischen Chat vor
 *  dem Judge-Submit (Pitfall #36, nur Streamlit); `ziel` trifft Qwen3.6;
 *  `signal` bricht den Judge-Submit ab. Ohne opts byte-identisch zum node-CLI-
 *  Verhalten (kein Reset, kein ziel, kein signal). */
export interface JudgeOptionen {
  ziel?: BridgeZiel;
  resetVorSubmit?: boolean;
  signal?: AbortSignal;
}

export async function runJudge(
  transport: AITransport,
  prompt: string,
  opts?: JudgeOptionen,
): Promise<JudgeScore> {
  try {
    if (opts?.resetVorSubmit) await starteFrischenChat(transport, opts.ziel);
    const raw = await transport.submitMessage(prompt, undefined, {
      responseFormat: { type: 'json_object' },
      ...(opts?.ziel ? { ziel: opts.ziel } : {}),
      ...(opts?.signal ? { signal: opts.signal } : {}),
    });
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < 0) return { faktentreue: 0, nuetzlichkeit: 0, fehler: true };
    const obj = JSON.parse(raw.slice(start, end + 1)) as JudgeScore;
    return {
      faktentreue: Number(obj.faktentreue) || 0,
      nuetzlichkeit: Number(obj.nuetzlichkeit) || 0,
      begruendung: obj.begruendung,
    };
  } catch {
    return { faktentreue: 0, nuetzlichkeit: 0, fehler: true };
  }
}

/** Arithmetisches Mittel (leere Liste → 0). */
export function mittel(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}
