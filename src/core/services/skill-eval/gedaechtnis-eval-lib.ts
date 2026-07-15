/**
 * Läuft eine Gedächtnis-Fixture durch die REINE Konsolidierungs-Pipeline
 * (baueEingabe → Prompt → [Transport | stubOps] → parse → wendeOperationenAn),
 * Zyklus für Zyklus. Kein IDB, kein Bridge — nur die puren Bausteine + ein
 * injizierter Transport (oder Dry-Run über die Fixture-stubOps).
 *
 * Import aus den SPEZIFISCHEN Submodulen (nicht dem Barrel), damit die CLI unter
 * vite-node in Node läuft (kein recorder/trigger/bridge im Graph).
 */
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { baueEingabe } from '@/core/services/assistent/gedaechtnis/eingabe';
import { buildKonsolidierungsPrompt } from '@/core/services/assistent/gedaechtnis/prompt';
import { parseOperationsliste } from '@/core/services/assistent/gedaechtnis/parse';
import { wendeOperationenAn } from '@/core/services/assistent/gedaechtnis/operationen';
import type { GedaechtnisEintrag, LaufErgebnis } from '@/core/services/assistent/gedaechtnis/types';
import type { GedaechtnisFixture } from './gedaechtnis-assertions';

export interface FixtureLaufErgebnis {
  active: GedaechtnisEintrag[];
  ergebnisse: LaufErgebnis[];
  rawAntworten: string[];
}

/** Optionale Bridge-Weitergabe (nur In-App-Panel): `resetVorZyklus` startet vor
 *  jedem Zyklus-Submit einen frischen Chat (Pitfall #36, nur Streamlit); `ziel`
 *  routet in den Qwen-Tab; `signal` macht lange Multi-Zyklus-Läufe (Degradation)
 *  abbrechbar — der Abbruch wird zwischen den Zyklen UND bei einem abgebrochenen
 *  Submit geprüft. Ohne opts (CLI-Pfad, stateless NodeOpenAITransport)
 *  byte-identisch zum bisherigen Verhalten (kein Reset, kein ziel, kein signal). */
export interface LaufeFixtureOptionen {
  ziel?: BridgeZiel;
  resetVorZyklus?: boolean;
  signal?: AbortSignal;
}

/** Deterministische ID-Fabrik (frisch pro Lauf). */
export function frischeIdFabrik(praefix = 'e'): () => string {
  let n = 0;
  return () => `${praefix}-${n++}`;
}

/**
 * @param transport `null` → Dry-Run (nutzt die stubOps der Fixture); sonst wird
 *   pro Zyklus der echte Prompt an den Transport geschickt und die Antwort geparst.
 * @param opts Optionale Bridge-Steuerung (Reset + Ziel-Tab) für den In-App-Lauf.
 */
export async function laufeFixture(
  fx: GedaechtnisFixture,
  transport: AITransport | null,
  neueId: () => string,
  opts?: LaufeFixtureOptionen,
): Promise<FixtureLaufErgebnis> {
  let active: GedaechtnisEintrag[] = fx.vorbestand ? fx.vorbestand.map(e => ({ ...e, belege: [...e.belege] })) : [];
  const ergebnisse: LaufErgebnis[] = [];
  const rawAntworten: string[] = [];

  for (let i = 0; i < fx.zyklen.length; i++) {
    // Abbruch zwischen Zyklen (macht den 20-Zyklen-Degradations-Lauf responsiv).
    if (opts?.signal?.aborted) break;
    const zyklus = fx.zyklen[i]!;
    const eingabe = baueEingabe(zyklus.ereignisse, active);

    let ops: unknown[];
    if (transport) {
      const prompt = buildKonsolidierungsPrompt(eingabe);
      // resetChat VOR dem Submit (Pitfall #36) — nur wenn das Panel es anfordert;
      // No-op auf stateless-Transports (NodeOpenAITransport → 'nicht-unterstuetzt').
      if (opts?.resetVorZyklus) await starteFrischenChat(transport, opts.ziel);
      const subOpts: { ziel?: BridgeZiel; signal?: AbortSignal } = {};
      if (opts?.ziel) subOpts.ziel = opts.ziel;
      if (opts?.signal) subOpts.signal = opts.signal;
      let raw: string;
      try {
        raw = await transport.submitMessage(prompt, undefined, opts?.ziel || opts?.signal ? subOpts : undefined);
      } catch (e) {
        // Ein per Signal abgebrochener Submit ist ein sauberer Stopp, kein Fehler.
        if (opts?.signal?.aborted) break;
        throw e;
      }
      rawAntworten.push(raw);
      ops = parseOperationsliste(raw) ?? [];
    } else {
      ops = zyklus.stubOps;
      rawAntworten.push(JSON.stringify(zyklus.stubOps));
    }

    const ergebnis = wendeOperationenAn(ops, active, {
      belegIndex: eingabe.belegIndex,
      jetzt: 1_000_000 + i * 1000,
      neueId,
    });
    ergebnisse.push(ergebnis);
    active = ergebnis.eintraege.filter(e => e.status === 'aktiv');
  }

  return { active, ergebnisse, rawAntworten };
}
