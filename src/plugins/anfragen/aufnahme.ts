/**
 * Übersetzt eine aufgenommene `.msg`-Datei in eine `AnfrageInit`-Struktur:
 * body-only-Parse über `parseMsg` (cfb + TextDecoder). Anhänge werden nur
 * gezählt, nie verarbeitet.
 */
import { parseMsg } from '@/core/services/msg';
import type { AnfrageInit } from './persistence';

export async function aufnahmeAusDatei(file: File): Promise<AnfrageInit> {
  const buf = await file.arrayBuffer();
  const parsed = parseMsg(buf);
  const betreff = parsed.betreff || file.name.replace(/\.msg$/i, '');
  return {
    absenderEmail: parsed.absenderEmail,
    betreff,
    hatAnhaenge: parsed.hatAnhaenge,
    originalMd: parsed.bodyMarkdown,
  };
}
