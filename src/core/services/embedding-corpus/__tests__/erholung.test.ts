/**
 * Der Ablauf einer Erholung — was der Lauf tut, wenn das Modell wegbricht.
 *
 * Die Leiter selbst steht in [geraet.test.ts](./geraet.test.ts). Hier geht es um
 * die zwei Leitplanken, die verhindern, dass die Rettung teurer wird als der
 * Schaden: hoechstens ein Neuladen je Datensatz, und nur bei Geraeteverlust.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';

const embedText = vi.fn();
const ladeEmbeddingNeu = vi.fn(async () => ({}));
let geraet: 'webgpu' | 'wasm' = 'webgpu';

vi.mock('../wrapper', () => ({
  embedText: (...a: unknown[]) => embedText(...a),
  ladeEmbeddingNeu: (...a: unknown[]) => ladeEmbeddingNeu(...(a as [])),
  aktivesEmbeddingGeraet: () => geraet,
}));

const gemerkt: Record<string, unknown> = {};
const idb = {
  get: async (k: string) => gemerkt[k] ?? null,
  set: async (k: string, v: unknown) => { gemerkt[k] = v; },
  delete: async (k: string) => { delete gemerkt[k]; },
} as unknown as IDBStore;

const { erzeugeErholer, embedMitErholung } = await import('../erholung');
const { GERAET_PRAEFERENZ_KEY } = await import('../geraet');

const VERLUST = "Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost.";

beforeEach(() => {
  vi.clearAllMocks();
  geraet = 'webgpu';
  for (const k of Object.keys(gemerkt)) delete gemerkt[k];
  // Die Konsole gehoert dem Testlauf, nicht der Erholung.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('embedMitErholung — der Lauf ueberlebt einen Geraeteverlust', () => {
  it('laedt nach und liefert den Vektor DIESES Datensatzes doch noch', () => {
    let ruf = 0;
    embedText.mockImplementation(async () => {
      ruf++;
      if (ruf === 1) throw new Error(VERLUST);
      return [1, 0, 0];
    });
    const erholer = erzeugeErholer(idb);

    return embedMitErholung('text', 'document', erholer).then(vec => {
      expect(vec).toEqual([1, 0, 0]);
      expect(ladeEmbeddingNeu).toHaveBeenCalledTimes(1);
      expect(erholer.meldungen).toHaveLength(1);
      expect(erholer.meldungen[0]).toMatchObject({ nummer: 1, geraet: 'webgpu', gewechselt: false });
    });
  });

  it('laedt HOECHSTENS einmal je Datensatz nach', async () => {
    // Ein Datensatz, der das Modell reproduzierbar zerlegt, darf keine Kette
    // von Ladelaeufen ausloesen — der zweite Anlauf faellt durch.
    embedText.mockRejectedValue(new Error(VERLUST));
    const erholer = erzeugeErholer(idb);

    await expect(embedMitErholung('gift', 'document', erholer)).rejects.toThrow(/Device\] is lost/);
    expect(embedText).toHaveBeenCalledTimes(2);
    expect(ladeEmbeddingNeu).toHaveBeenCalledTimes(1);
  });

  it('laedt gar nicht nach, wenn der Fehler am Datensatz liegt', async () => {
    embedText.mockRejectedValue(new Error('Model output has neither sentence_embedding nor last_hidden_state'));
    const erholer = erzeugeErholer(idb);

    await expect(embedMitErholung('krumm', 'document', erholer)).rejects.toThrow(/sentence_embedding/);
    expect(embedText).toHaveBeenCalledTimes(1);
    expect(ladeEmbeddingNeu).not.toHaveBeenCalled();
  });

  it('gibt auf, wenn das Neuladen selbst scheitert', async () => {
    embedText.mockRejectedValue(new Error(VERLUST));
    ladeEmbeddingNeu.mockRejectedValueOnce(new Error('kein Adapter mehr'));
    const erholer = erzeugeErholer(idb);

    await expect(embedMitErholung('t', 'document', erholer)).rejects.toThrow(/Device\] is lost/);
    // Kein zweiter Anlauf ohne Modell — der waere sicher vergeblich.
    expect(embedText).toHaveBeenCalledTimes(1);
    expect(erholer.meldungen).toHaveLength(0);
  });
});

describe('erzeugeErholer — der Wechsel ueberlebt den Lauf', () => {
  it('merkt den Hauptprozessor, sobald die Grafikkarte nichts mehr einbringt', async () => {
    const erholer = erzeugeErholer(idb);

    // Erste Erholung: die Grafikkarte bekommt einen frischen Kontext.
    expect(await erholer.erhole(new Error(VERLUST))).toBe(true);
    expect(erholer.geraet).toBe('webgpu');
    expect(gemerkt[GERAET_PRAEFERENZ_KEY]).toBeUndefined();

    // Sofort wieder tot, ohne einen einzigen Vektor dazwischen → Wechsel.
    expect(await erholer.erhole(new Error(VERLUST))).toBe(true);
    expect(erholer.geraet).toBe('wasm');
    expect(gemerkt[GERAET_PRAEFERENZ_KEY]).toMatchObject({ geraet: 'wasm' });
    expect(erholer.meldungen[1]).toMatchObject({ gewechselt: true, ertrag: 0 });
  });

  it('zaehlt den Ertrag einer Runde, nicht den des ganzen Laufs', async () => {
    const erholer = erzeugeErholer(idb);
    for (let i = 0; i < 100; i++) erholer.gelungen();
    await erholer.erhole(new Error(VERLUST));
    expect(erholer.meldungen[0]?.ertrag).toBe(100);

    for (let i = 0; i < 7; i++) erholer.gelungen();
    await erholer.erhole(new Error(VERLUST));
    expect(erholer.meldungen[1]?.ertrag).toBe(7);
  });

  it('gibt auf dem Hauptprozessor auf, statt ein Modell gegen vollen Speicher zu laden', async () => {
    geraet = 'wasm';
    const erholer = erzeugeErholer(idb);
    expect(await erholer.erhole(new Error('Out of memory'))).toBe(false);
    expect(ladeEmbeddingNeu).not.toHaveBeenCalled();
  });
});
