/**
 * Übersetzt eine aufgenommene Datei in eine `AnfrageInit`-Struktur.
 *
 * Phase 3 ersetzt den Platzhalter durch den echten body-only-`.msg`-Parse
 * (`parseMsg` aus `@/core/services/msg`, cfb + TextDecoder). Hier ist bewusst
 * die EINZIGE Naht, die Phase 3 anfasst — die UI/Persistenz bleibt unverändert.
 */
import type { AnfrageInit } from './persistence';

export async function aufnahmeAusDatei(file: File): Promise<AnfrageInit> {
  // Phase 3: const buf = await file.arrayBuffer(); const p = parseMsg(buf);
  //          → { absenderEmail: p.absenderEmail, betreff: p.betreff,
  //              hatAnhaenge: p.hatAnhaenge, originalMd: p.bodyMarkdown }
  await Promise.resolve();
  return {
    absenderEmail: '',
    betreff: file.name.replace(/\.msg$/i, ''),
    hatAnhaenge: 0,
    originalMd: '',
  };
}
