/**
 * Tests fuer den LLM-Klassifizierungs-Service.
 *
 * Fokus: robust JSON-Parsing (Markdown-Wrap, Umlaute, Erklaerungs-Text),
 * Prompt-Konstruktion, Batch-Loop mit Mock-Transport.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildPromptForClipboard,
  buildPromptText,
  buildResponseFormat,
  klassifiziereBatch,
  parseClipboardResponse,
  parseLLMResponse,
} from '../services/llm-klassifizierung';
import type { UeberKategorie } from '../types';
import type { AIBridge } from '@/core/services/ai/bridge';
import type { AITransport } from '@/core/services/ai/transports/streamlit';

const KATEGORIEN: UeberKategorie[] = [
  { id: 'IT', name: 'Industrielle Technologien', farbe: 'slate', deskriptorenMapping: [] },
  { id: 'DT', name: 'Digitale Technologien', farbe: 'blue', deskriptorenMapping: [] },
  { id: 'EU', name: 'Energie- und Umwelt', farbe: 'emerald', deskriptorenMapping: [] },
];

function makeMockBridge(submitImpl: (prompt: string, sys?: string) => Promise<string>): AIBridge {
  const transport: AITransport = {
    name: 'mock',
    ping: async () => true,
    submitMessage: async (msg, sys) => submitImpl(msg, sys),
  };
  return {
    getActiveTransport: () => transport,
  } as unknown as AIBridge;
}

describe('parseLLMResponse — robust JSON-Parsing', () => {
  it('akzeptiert reines JSON-Array', () => {
    const out = parseLLMResponse('[{"id":"A","primaer":"IT","aspekte":["DT"],"begruendung":"x"}]');
    expect(out).toEqual([{ id: 'A', primaer: 'IT', aspekte: ['DT'], begruendung: 'x' }]);
  });

  it('akzeptiert Markdown-Wrapper (```json)', () => {
    const raw = '```json\n[{"id":"A","primaer":"IT","aspekte":[],"begruendung":"x"}]\n```';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.primaer).toBe('IT');
  });

  it('akzeptiert Markdown-Wrapper (``` ohne lang)', () => {
    const raw = '```\n[{"id":"A","primaer":"DT","aspekte":[],"begruendung":""}]\n```';
    const out = parseLLMResponse(raw);
    expect(out[0]!.primaer).toBe('DT');
  });

  it('akzeptiert Leading- und Trailing-Erklaerung', () => {
    const raw = 'Hier sind die Klassifizierungen:\n[{"id":"A","primaer":"IT","aspekte":[],"begruendung":""}]\n\nIch hoffe das hilft!';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('A');
  });

  it('akzeptiert Umlaut-Schluessel "primär" und "begründung"', () => {
    const raw = '[{"id":"A","primär":"IT","aspekte":["DT"],"begründung":"KI als Werkzeug"}]';
    const out = parseLLMResponse(raw);
    expect(out[0]!.primaer).toBe('IT');
    expect(out[0]!.begruendung).toBe('KI als Werkzeug');
  });

  it('filtert Eintraege ohne id oder primaer', () => {
    const raw = '[{"id":"A","primaer":"IT","aspekte":[],"begruendung":""},{"id":"","primaer":"DT","aspekte":[],"begruendung":""},{"primaer":"EU","aspekte":[],"begruendung":""}]';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('A');
  });

  it('wirft bei nicht parsebarer Antwort', () => {
    expect(() => parseLLMResponse('Das ist kein JSON.')).toThrow();
    expect(() => parseLLMResponse('[invalid json}')).toThrow();
  });

  it('parseClipboardResponse ist Identitaet zu parseLLMResponse', () => {
    const raw = '[{"id":"A","primaer":"IT","aspekte":[],"begruendung":""}]';
    expect(parseClipboardResponse(raw)).toEqual(parseLLMResponse(raw));
  });
});

describe('buildPromptText', () => {
  it('enthaelt alle Kategorie-IDs + ein Beispiel', () => {
    const prompt = buildPromptText(
      [{ id: 'AZ-1', vbTitel: 'Test', tvTitel: 'TV' }],
      KATEGORIEN,
    );
    expect(prompt).toContain('IT: Industrielle Technologien');
    expect(prompt).toContain('DT: Digitale Technologien');
    expect(prompt).toContain('EU: Energie- und Umwelt');
    expect(prompt).toContain('JSON-Array');
    expect(prompt).toContain('"AZ-1"');
  });

  it('enthaelt antragsteller nur wenn gesetzt', () => {
    const withAst = buildPromptText(
      [{ id: 'AZ-1', vbTitel: 'A', tvTitel: 'B', antragsteller: 'TU Muenchen' }],
      KATEGORIEN,
    );
    expect(withAst).toContain('TU Muenchen');

    const without = buildPromptText(
      [{ id: 'AZ-1', vbTitel: 'A', tvTitel: 'B' }],
      KATEGORIEN,
    );
    expect(without).not.toContain('TU Muenchen');
  });
});

describe('buildResponseFormat', () => {
  it('Enum-Werte sind die Kategorie-IDs', () => {
    const fmt = buildResponseFormat(KATEGORIEN);
    const schema = (fmt as { json_schema: { schema: { items: { properties: { primaer: { enum: string[] } } } } } }).json_schema.schema.items.properties.primaer;
    expect(schema.enum).toEqual(['IT', 'DT', 'EU']);
  });

  it('strict mode ist aktiviert', () => {
    const fmt = buildResponseFormat(KATEGORIEN);
    expect((fmt as { json_schema: { strict: boolean } }).json_schema.strict).toBe(true);
  });
});

describe('buildPromptForClipboard', () => {
  it('beginnt mit System-Prompt', () => {
    const prompt = buildPromptForClipboard(
      [{ id: 'A', vbTitel: 'T', tvTitel: 'TV' }],
      KATEGORIEN,
    );
    expect(prompt.startsWith('Du bist ein Experte')).toBe(true);
  });
});

describe('klassifiziereBatch mit Mock-Transport', () => {
  it('batched in 12er-Chunks und sammelt alle Ergebnisse', async () => {
    const submitMock = vi.fn().mockImplementation(async (prompt: string) => {
      // Antworte mit IT fuer alle IDs im Prompt — Beispiel-ID "AZ-1" filtern.
      const idMatches = [...prompt.matchAll(/"id":\s*"([^"]+)"/g)]
        .map(m => m[1])
        .filter(id => id !== 'AZ-1');
      return JSON.stringify(
        idMatches.map(id => ({ id, primaer: 'IT', aspekte: [], begruendung: '' })),
      );
    });
    const bridge = makeMockBridge(submitMock);
    const antraege = Array.from({ length: 25 }, (_, i) => ({
      id: `A${i}`, vbTitel: `V${i}`, tvTitel: `T${i}`,
    }));
    const progressLog: Array<[number, number]> = [];
    const result = await klassifiziereBatch({
      antraege,
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 12,
      onProgress: (done, total) => progressLog.push([done, total]),
    });
    // 25 / 12 = 3 Batches (12 + 12 + 1)
    expect(submitMock).toHaveBeenCalledTimes(3);
    expect(result.byAntragId.size).toBe(25);
    expect(result.errors).toEqual([]);
    // Progress wird pro Batch gerufen, Endwert ist (25, 25).
    expect(progressLog[progressLog.length - 1]).toEqual([25, 25]);
  });

  it('filtert unbekannte Primaer-Kategorien + sammelt Error', async () => {
    const bridge = makeMockBridge(async () =>
      JSON.stringify([
        { id: 'A1', primaer: 'IT', aspekte: [], begruendung: '' },
        { id: 'A2', primaer: 'XYZ', aspekte: [], begruendung: '' },  // unbekannt
      ]),
    );
    const result = await klassifiziereBatch({
      antraege: [
        { id: 'A1', vbTitel: '', tvTitel: '' },
        { id: 'A2', vbTitel: '', tvTitel: '' },
      ],
      kategorien: KATEGORIEN,
      bridge,
    });
    expect(result.byAntragId.has('A1')).toBe(true);
    expect(result.byAntragId.has('A2')).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('XYZ');
  });

  it('filtert unbekannte Aspekt-IDs (silent)', async () => {
    const bridge = makeMockBridge(async () =>
      JSON.stringify([{ id: 'A1', primaer: 'IT', aspekte: ['DT', 'XYZ', 'EU'], begruendung: '' }]),
    );
    const result = await klassifiziereBatch({
      antraege: [{ id: 'A1', vbTitel: '', tvTitel: '' }],
      kategorien: KATEGORIEN,
      bridge,
    });
    expect(result.byAntragId.get('A1')!.aspekte).toEqual(['DT', 'EU']);
  });

  it('sammelt Batch-Fehler aber laeuft weiter', async () => {
    let callCount = 0;
    const bridge = makeMockBridge(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Network blip');
      return JSON.stringify([{ id: 'A2', primaer: 'IT', aspekte: [], begruendung: '' }]);
    });
    const result = await klassifiziereBatch({
      antraege: [
        { id: 'A1', vbTitel: '', tvTitel: '' },
        { id: 'A2', vbTitel: '', tvTitel: '' },
      ],
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 1,
    });
    // Batch 0 fehlgeschlagen, Batch 1 OK
    expect(result.errors).toHaveLength(1);
    expect(result.byAntragId.size).toBe(1);
    expect(result.byAntragId.has('A2')).toBe(true);
  });

  it('AbortSignal wirft AbortError und stoppt Batches', async () => {
    const controller = new AbortController();
    const bridge = makeMockBridge(async () => {
      controller.abort();
      return '[]';
    });
    await expect(klassifiziereBatch({
      antraege: [
        { id: 'A1', vbTitel: '', tvTitel: '' },
        { id: 'A2', vbTitel: '', tvTitel: '' },
      ],
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 1,
      signal: controller.signal,
    })).rejects.toThrow(/Aborted/);
  });
});
