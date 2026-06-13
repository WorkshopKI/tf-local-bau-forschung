/**
 * Tests fuer den LLM-Klassifizierungs-Service.
 *
 * Schwerpunkte:
 *  1. Prompt-Format hat pro-VERBUND-Struktur (ab v2.11):
 *     `[{id, verbundTitel, tvTitels[]}]` statt einem Eintrag pro TV.
 *  2. Robust JSON-Parsing (Markdown-Wrap, Umlaute, Erklaerungs-Text)
 *  3. Batch-Loop mit Mock-Transport
 *  4. Output-Key `byVerbundId` (ehemals `byAntragId`)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildPromptForClipboard,
  buildPromptText,
  buildResponseFormat,
  klassifiziereBatch,
  parseClipboardResponse,
  parseLLMResponse,
  type LLMVerbund,
} from '../services/klassifizierung';
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
    const out = parseLLMResponse('[{"id":"V1","primaer":"IT","aspekte":["DT"],"begruendung":"x"}]');
    expect(out).toEqual([{ id: 'V1', primaer: 'IT', aspekte: ['DT'], begruendung: 'x' }]);
  });

  it('akzeptiert Markdown-Wrapper (```json)', () => {
    const raw = '```json\n[{"id":"V1","primaer":"IT","aspekte":[],"begruendung":"x"}]\n```';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.primaer).toBe('IT');
  });

  it('akzeptiert Markdown-Wrapper (``` ohne lang)', () => {
    const raw = '```\n[{"id":"V1","primaer":"DT","aspekte":[],"begruendung":""}]\n```';
    const out = parseLLMResponse(raw);
    expect(out[0]!.primaer).toBe('DT');
  });

  it('akzeptiert Leading- und Trailing-Erklaerung', () => {
    const raw = 'Hier sind die Klassifizierungen:\n[{"id":"V1","primaer":"IT","aspekte":[],"begruendung":""}]\n\nIch hoffe das hilft!';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('V1');
  });

  it('akzeptiert Umlaut-Schluessel "primär" und "begründung"', () => {
    const raw = '[{"id":"V1","primär":"IT","aspekte":["DT"],"begründung":"KI als Werkzeug"}]';
    const out = parseLLMResponse(raw);
    expect(out[0]!.primaer).toBe('IT');
    expect(out[0]!.begruendung).toBe('KI als Werkzeug');
  });

  it('filtert Eintraege ohne id oder primaer', () => {
    const raw = '[{"id":"V1","primaer":"IT","aspekte":[],"begruendung":""},{"id":"","primaer":"DT","aspekte":[],"begruendung":""},{"primaer":"EU","aspekte":[],"begruendung":""}]';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('V1');
  });

  it('wirft bei nicht parsebarer Antwort', () => {
    expect(() => parseLLMResponse('Das ist kein JSON.')).toThrow();
    expect(() => parseLLMResponse('[invalid json}')).toThrow();
  });

  it('rettet vollstaendige Objekte aus abgeschnittenem Array (Truncation)', () => {
    // Letztes Objekt mitten im begruendung-Feld abgeschnitten, keine schliessende ].
    const raw = '[{"id":"V1","primaer":"IT","aspekte":[],"begruendung":"a"},{"id":"V2","primaer":"DT","aspekte":["EU"],"begr';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('V1');
  });

  it('rettet vollstaendiges Objekt bei Abbruch direkt nach Komma', () => {
    const raw = '[{"id":"V1","primaer":"IT","aspekte":["DT"],"begruendung":"x"},{';
    const out = parseLLMResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('V1');
    expect(out[0]!.aspekte).toEqual(['DT']);
  });

  it('wirft, wenn das erste Objekt schon abgeschnitten ist', () => {
    expect(() => parseLLMResponse('[{"id":"V1","primaer":"IT"')).toThrow();
  });

  it('parseClipboardResponse ist Identitaet zu parseLLMResponse', () => {
    const raw = '[{"id":"V1","primaer":"IT","aspekte":[],"begruendung":""}]';
    expect(parseClipboardResponse(raw)).toEqual(parseLLMResponse(raw));
  });
});

describe('buildPromptText (pro Verbund)', () => {
  it('rendert JSON-Array mit id + verbundTitel + tvTitels', () => {
    const verbuende: LLMVerbund[] = [
      {
        id: 'V-ECOPLAY',
        verbundTitel: 'H2Select - EcoPlay',
        tvTitels: [
          'Entwicklung kompatibilisierter Polymerblends',
          'Greifersystem mit adaptiver Prozessregelung',
        ],
      },
    ];
    const prompt = buildPromptText(verbuende, KATEGORIEN);
    expect(prompt).toContain('"id": "V-ECOPLAY"');
    expect(prompt).toContain('"verbundTitel": "H2Select - EcoPlay"');
    expect(prompt).toContain('"tvTitels"');
    expect(prompt).toContain('Polymerblends');
    expect(prompt).toContain('Greifersystem');
  });

  it('Solo-Verbund (1 TV) hat einen tvTitel im Array', () => {
    const verbuende: LLMVerbund[] = [
      {
        id: '16DS261161',
        verbundTitel: '2-Takt-Hybridantrieb',
        tvTitels: ['Innovativer 2-Takt-Hybridantrieb für Aerospace-Anwendungen'],
      },
    ];
    const prompt = buildPromptText(verbuende, KATEGORIEN);
    expect(prompt).toMatch(/"tvTitels":\s*\[\s*"Innovativer 2-Takt-Hybridantrieb/);
  });

  it('Multi-TV-Verbund hat N tvTitels in Reihenfolge', () => {
    const verbuende: LLMVerbund[] = [
      {
        id: 'V1',
        verbundTitel: 'Verbund-X',
        tvTitels: ['TV-A-Titel', 'TV-B-Titel', 'TV-C-Titel'],
      },
    ];
    const prompt = buildPromptText(verbuende, KATEGORIEN);
    const idxA = prompt.indexOf('TV-A-Titel');
    const idxB = prompt.indexOf('TV-B-Titel');
    const idxC = prompt.indexOf('TV-C-Titel');
    expect(idxA).toBeGreaterThan(-1);
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });

  it('antragsteller wird optional ausgegeben', () => {
    const mit: LLMVerbund[] = [{
      id: 'V1', verbundTitel: 'T', tvTitels: ['X'], antragsteller: 'TU Muenchen',
    }];
    const ohne: LLMVerbund[] = [{
      id: 'V2', verbundTitel: 'T', tvTitels: ['X'],
    }];
    expect(buildPromptText(mit, KATEGORIEN)).toContain('TU Muenchen');
    expect(buildPromptText(ohne, KATEGORIEN)).not.toContain('TU Muenchen');
  });

  it('enthaelt alle Kategorie-IDs im Prompt', () => {
    const prompt = buildPromptText([], KATEGORIEN);
    expect(prompt).toContain('IT: Industrielle Technologien');
    expect(prompt).toContain('DT: Digitale Technologien');
    expect(prompt).toContain('EU: Energie- und Umwelt');
    expect(prompt).toContain('JSON-Array');
  });

  it('User-Prompt erwaehnt Verbund-Granularitaet', () => {
    const prompt = buildPromptText([], KATEGORIEN);
    expect(prompt.toLowerCase()).toContain('verbund');
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
  it('beginnt mit System-Prompt + enthaelt User-Prompt', () => {
    const prompt = buildPromptForClipboard(
      [{ id: 'V1', verbundTitel: 'T', tvTitels: ['X'] }],
      KATEGORIEN,
    );
    expect(prompt.startsWith('Du bist ein Experte')).toBe(true);
    expect(prompt).toContain('Verbuende:');
  });
});

describe('klassifiziereBatch mit Mock-Transport', () => {
  it('batched in 12er-Chunks und sammelt alle Ergebnisse pro Verbund', async () => {
    const submitMock = vi.fn().mockImplementation(async (prompt: string) => {
      // Antworte mit IT fuer alle IDs im Prompt (Beispiel-Werte "VB-1" rausfiltern,
      // die der buildPromptText im Erklaerungs-Beispiel ausgibt).
      const idMatches = [...prompt.matchAll(/"id":\s*"(V\d+)"/g)]
        .map(m => m[1] as string);
      return JSON.stringify(
        idMatches.map(id => ({ id, primaer: 'IT', aspekte: [], begruendung: '' })),
      );
    });
    const bridge = makeMockBridge(submitMock);
    const verbuende: LLMVerbund[] = Array.from({ length: 25 }, (_, i) => ({
      id: `V${i}`, verbundTitel: `Verbund ${i}`, tvTitels: [`TV ${i}`],
    }));
    const progressLog: Array<[number, number]> = [];
    const result = await klassifiziereBatch({
      verbuende,
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 12,
      onProgress: (done, total) => progressLog.push([done, total]),
    });
    // 25 / 12 = 3 Batches (12 + 12 + 1)
    expect(submitMock).toHaveBeenCalledTimes(3);
    expect(result.byVerbundId.size).toBe(25);
    expect(result.errors).toEqual([]);
    expect(progressLog[progressLog.length - 1]).toEqual([25, 25]);
  });

  it('filtert unbekannte Primaer-Kategorien + sammelt Error', async () => {
    const bridge = makeMockBridge(async () =>
      JSON.stringify([
        { id: 'V1', primaer: 'IT', aspekte: [], begruendung: '' },
        { id: 'V2', primaer: 'XYZ', aspekte: [], begruendung: '' },
      ]),
    );
    const result = await klassifiziereBatch({
      verbuende: [
        { id: 'V1', verbundTitel: '', tvTitels: [] },
        { id: 'V2', verbundTitel: '', tvTitels: [] },
      ],
      kategorien: KATEGORIEN,
      bridge,
    });
    expect(result.byVerbundId.has('V1')).toBe(true);
    expect(result.byVerbundId.has('V2')).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('XYZ');
  });

  it('filtert unbekannte Aspekt-IDs (silent)', async () => {
    const bridge = makeMockBridge(async () =>
      JSON.stringify([{ id: 'V1', primaer: 'IT', aspekte: ['DT', 'XYZ', 'EU'], begruendung: '' }]),
    );
    const result = await klassifiziereBatch({
      verbuende: [{ id: 'V1', verbundTitel: '', tvTitels: [] }],
      kategorien: KATEGORIEN,
      bridge,
    });
    expect(result.byVerbundId.get('V1')!.aspekte).toEqual(['DT', 'EU']);
  });

  it('sammelt Batch-Fehler aber laeuft weiter', async () => {
    let callCount = 0;
    const bridge = makeMockBridge(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Network blip');
      return JSON.stringify([{ id: 'V2', primaer: 'IT', aspekte: [], begruendung: '' }]);
    });
    const result = await klassifiziereBatch({
      verbuende: [
        { id: 'V1', verbundTitel: '', tvTitels: [] },
        { id: 'V2', verbundTitel: '', tvTitels: [] },
      ],
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 1,
    });
    expect(result.errors).toHaveLength(1);
    expect(result.byVerbundId.size).toBe(1);
    expect(result.byVerbundId.has('V2')).toBe(true);
  });

  it('AbortSignal wirft AbortError und stoppt Batches', async () => {
    const controller = new AbortController();
    const bridge = makeMockBridge(async () => {
      controller.abort();
      return '[]';
    });
    await expect(klassifiziereBatch({
      verbuende: [
        { id: 'V1', verbundTitel: '', tvTitels: [] },
        { id: 'V2', verbundTitel: '', tvTitels: [] },
      ],
      kategorien: KATEGORIEN,
      bridge,
      batchSize: 1,
      signal: controller.signal,
    })).rejects.toThrow(/Aborted/);
  });
});
