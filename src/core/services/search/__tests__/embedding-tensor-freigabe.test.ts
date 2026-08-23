/**
 * Jede Einbettung gibt ihre GPU-Puffer wieder her.
 *
 * Der Anlass (08/2026): ein Vollbau verlor auf einer Maschine mit **12 GB**
 * Grafikspeicher reproduzierbar nach ~807 Einbettungen den WebGPU-Kontext,
 * waehrend der Verbrauch zwischen 2,6 und 3,3 GB hin und her sprang. Es war
 * kein Speichermangel (8,7 GB frei) und kein auffaelliger Datensatz (Position
 * 808 hat 17 Zeichen; der laengste Text des Bestands liegt auf Position 1.083
 * und wurde nie erreicht) — sondern ein Saegezahn: die `Tensor`-Objekte aus
 * Transformers.js halten in `ort_tensor` je einen GPU-Puffer, und der wird erst
 * frei, wenn der JS-GC sie einsammelt.
 *
 * `dispose()` gab es die ganze Zeit. Gerufen wurde es nur beim Entladen des
 * Modells — einmal statt 14.221-mal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmbeddingModelConfig } from '../model-registry';

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
  AutoModel: { from_pretrained: vi.fn() },
  AutoTokenizer: { from_pretrained: vi.fn() },
  env: { backends: { onnx: { wasm: {} } } },
}));
vi.mock('../ort-wasm-init', () => ({ ensureOrtWasmBinary: vi.fn(async () => undefined) }));
vi.mock('../pipeline-logger', () => ({
  pipelineLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { EmbeddingService } = await import('../embedding-service');

const CONFIG: EmbeddingModelConfig = {
  id: 'test', name: 'test/modell', label: 'Test', dimensions: 4,
  downloadSize: '1 MB', strategy: 'automodel', normalize: true,
  queryPrefix: 'q: ', documentPrefix: 'd: ',
} as unknown as EmbeddingModelConfig;

/** Ein Tensor, der sich merkt, ob er freigegeben wurde. */
function tensor(daten: number[], dims: number[]) {
  return { dims, data: new Float32Array(daten), dispose: vi.fn() };
}

let service: InstanceType<typeof EmbeddingService>;

beforeEach(() => {
  vi.clearAllMocks();
  service = new EmbeddingService();
});

describe('embedSingle — der AutoModel-Pfad (EmbeddingGemma) gibt frei', () => {
  it('gibt Ein- UND Ausgabe-Tensoren nach jeder Einbettung zurück', async () => {
    const eingabe = { input_ids: tensor([1, 2], [1, 2]), attention_mask: tensor([1, 1], [1, 2]) };
    const ausgabe = { last_hidden_state: tensor([1, 0, 0, 0, 0, 1, 0, 0], [1, 2, 4]) };
    (service as unknown as Record<string, unknown>).autoTokenizer = () => eingabe;
    (service as unknown as Record<string, unknown>).autoModel = async () => ausgabe;

    const vec = await service.embedSingle('text', CONFIG, 'document');

    expect(vec).toHaveLength(4);
    expect(ausgabe.last_hidden_state.dispose).toHaveBeenCalledTimes(1);
    expect(eingabe.input_ids.dispose).toHaveBeenCalledTimes(1);
    expect(eingabe.attention_mask.dispose).toHaveBeenCalledTimes(1);
  });

  it('gibt auch dann frei, wenn die Auswertung wirft', async () => {
    // Gerade im Fehlerfall — verlorener Grafik-Kontext — darf nichts liegen
    // bleiben, sonst haeuft ein scheiternder Lauf noch Puffer an.
    const eingabe = { input_ids: tensor([1], [1, 1]) };
    const ausgabe = { etwas_anderes: tensor([1], [1, 1]) };
    (service as unknown as Record<string, unknown>).autoTokenizer = () => eingabe;
    (service as unknown as Record<string, unknown>).autoModel = async () => ausgabe;

    await expect(service.embedSingle('t', CONFIG, 'document')).rejects.toThrow(/sentence_embedding/);
    expect(eingabe.input_ids.dispose).toHaveBeenCalledTimes(1);
    expect(ausgabe.etwas_anderes.dispose).toHaveBeenCalledTimes(1);
  });

  it('gibt über viele Läufe hinweg jedes Mal frei — nicht nur beim ersten', async () => {
    // Der eigentliche Befund: einmal freigeben reicht nicht, 14.221-mal schon.
    const freigaben: number[] = [];
    (service as unknown as Record<string, unknown>).autoTokenizer = () => ({
      input_ids: tensor([1], [1, 1]),
    });
    (service as unknown as Record<string, unknown>).autoModel = async () => {
      const t = tensor([1, 0, 0, 0], [1, 1, 4]);
      t.dispose = vi.fn(() => { freigaben.push(1); });
      return { last_hidden_state: t };
    };

    for (let i = 0; i < 50; i++) await service.embedSingle(`t${i}`, CONFIG, 'document');
    expect(freigaben).toHaveLength(50);
  });
});

describe('embedSingle — der Pipeline-Pfad gibt frei', () => {
  it('gibt den Ausgabe-Tensor zurück', async () => {
    const out = tensor([1, 0, 0, 0], [1, 4]);
    (service as unknown as Record<string, unknown>).pipelineExtractor =
      async () => out as unknown;

    const vec = await service.embedSingle('text', CONFIG, 'query');

    expect(vec).toEqual([1, 0, 0, 0]);
    expect(out.dispose).toHaveBeenCalledTimes(1);
  });
});
