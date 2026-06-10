/**
 * Inkrementeller Server-Sent-Events-Parser für OpenAI-kompatible Streaming-Responses.
 *
 * Pure (kein DOM, kein fetch) — wird vom DirectLLMTransport mit TextDecoder-Chunks
 * gefüttert und liefert vollständige `data:`-Payloads zurück. Verkraftet:
 * - partielle Zeilen über Chunk-Grenzen (Buffer)
 * - Multi-Line-data (per SSE-Spec mit \n gejoint)
 * - CRLF-Zeilenenden
 * - Kommentar-Zeilen (`: OPENROUTER PROCESSING` Keep-alives)
 * - ignorierte Felder (event:, id:, retry:)
 */

export interface SSEParser {
  /** Chunk anfüttern; liefert alle dadurch komplettierten data-Payloads. */
  push(chunk: string): string[];
  /** Stream-Ende: flusht ein ggf. gepuffertes Event ohne abschließende Leerzeile. */
  end(): string[];
}

export function createSSEParser(): SSEParser {
  let lineBuffer = '';
  let dataLines: string[] = [];

  const processLine = (rawLine: string, out: string[]): void => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      // Leerzeile = Event-Ende → akkumulierte data-Zeilen dispatchen
      if (dataLines.length > 0) {
        out.push(dataLines.join('\n'));
        dataLines = [];
      }
      return;
    }
    if (line.startsWith(':')) return; // SSE-Kommentar (Keep-alive)
    if (line.startsWith('data:')) {
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1);
      dataLines.push(value);
    }
    // event:/id:/retry: bewusst ignoriert — Chat-Completions nutzen nur data
  };

  return {
    push(chunk: string): string[] {
      const out: string[] = [];
      lineBuffer += chunk;
      let newlineIdx = lineBuffer.indexOf('\n');
      while (newlineIdx !== -1) {
        processLine(lineBuffer.slice(0, newlineIdx), out);
        lineBuffer = lineBuffer.slice(newlineIdx + 1);
        newlineIdx = lineBuffer.indexOf('\n');
      }
      return out;
    },
    end(): string[] {
      const out: string[] = [];
      if (lineBuffer !== '') {
        processLine(lineBuffer, out);
        lineBuffer = '';
      }
      if (dataLines.length > 0) {
        out.push(dataLines.join('\n'));
        dataLines = [];
      }
      return out;
    },
  };
}
