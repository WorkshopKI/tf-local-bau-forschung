/**
 * Was ein Bau tut, wenn die Einbettung wegbricht.
 *
 * Der Anlass: ein Vollbau meldete „807 Vorhaben eingebettet, 13.418
 * übersprungen (kein Text oder Fehler)" und galt als fertig — während dieselbe
 * App 14.221 Vorhaben als embedbar zählte. Es waren keine fehlenden Texte,
 * sondern 13.418 Fehlschläge, jeder einzeln per `console.warn` verschluckt.
 * Danach trug der Korpus die Signatur der neuen Textfassung über Vektoren, die
 * zu 94 % aus der alten stammten.
 *
 * Drei Zusagen werden hier festgehalten: Fehler sind von „kein Text" zu
 * unterscheiden, eine Fehlerserie beendet den Lauf, und ein solcher Lauf darf
 * den Vektorraum nicht als abgelöst behaupten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';

const embedText = vi.fn();
const merkeKorpusSignatur = vi.fn(async () => undefined);
let gespeicherteSignatur: unknown = null;
let lokalCount = 0;

vi.mock('@/core/services/embedding-corpus', () => ({
  embedText: (...a: unknown[]) => embedText(...a),
  storeEmbedding: vi.fn(async () => undefined),
  listEmbeddingKeys: vi.fn(async () => new Set<string>()),
  countEmbeddings: vi.fn(async () => lokalCount),
  ensureEmbeddingReady: vi.fn(async () => ({ id: 'testmodell', dimensions: 4 })),
  aktuelleKorpusSignatur: () => ({ modellId: 'testmodell', dim: 4, documentPrefix: 'p', buildVersion: 3 }),
  ladeKorpusSignatur: async () => gespeicherteSignatur,
  merkeKorpusSignatur: (...a: unknown[]) => merkeKorpusSignatur(...(a as [])),
  signaturenGleich: (a: { buildVersion: number }, b: { buildVersion: number }) =>
    a?.buildVersion === b?.buildVersion,
  signaturText: () => 'testraum',
  hashEmbeddingText: (t: string) => `h:${t.length}`,
  ladeTextHashes: vi.fn(async () => new Map<string, string>()),
  merkeTextHashes: vi.fn(async () => undefined),
  waehleZuEmbedden: ({ aktenzeichen }: { aktenzeichen: string[] }) => aktenzeichen,
  // Die Erholung hat ihren eigenen Test ([erholung.test.ts](src/core/services/embedding-corpus/__tests__/erholung.test.ts));
  // hier soll ein Fehler ein Fehler bleiben, sonst prüft diese Datei nicht mehr
  // die Zähler und die Fehlerserie, sondern das Nachladen.
  erzeugeErholer: () => ({
    gelungen: () => undefined,
    erhole: async () => false,
    geraet: 'webgpu' as const,
    meldungen: [] as unknown[],
  }),
  embedMitErholung: (text: string, mode: string) => embedText(text, mode),
  aktivesEmbeddingGeraet: () => 'webgpu' as const,
}));

vi.mock('@/core/services/csv/idb-csv', () => ({
  listSchemasByProgramm: vi.fn(async () => []),
  forEachAntragChunkByProgramm: vi.fn(async () => undefined),
}));

const { buildEmbeddingCorpus, FEHLERSERIE_ABBRUCH } = await import('../embedding-corpus');

const idb = { get: async () => undefined, set: async () => undefined } as unknown as IDBStore;

/** `n` Anträge mit Titel — also mit Embedding-Text. */
function antraege(n: number, mitTitel = true): Antrag[] {
  return Array.from({ length: n }, (_, i) => ({
    aktenzeichen: `AZ${String(i).padStart(4, '0')}`,
    ...(mitTitel ? { titel: `Vorhaben ${i}` } : {}),
  })) as unknown as Antrag[];
}

beforeEach(() => {
  vi.clearAllMocks();
  gespeicherteSignatur = null;
  lokalCount = 0;
  embedText.mockReset();
});

describe('buildEmbeddingCorpus — Fehler sind keine „übersprungenen"', () => {
  it('zählt „kein Text" und „Fehler" getrennt', async () => {
    // 3 ohne Titel (kein Text), 2 mit Titel, davon einer scheitert.
    const liste = [...antraege(2), ...antraege(3, false)];
    let ruf = 0;
    embedText.mockImplementation(async () => {
      ruf++;
      if (ruf === 1) throw new Error('Grafik-Kontext verloren');
      return [1, 0, 0, 0];
    });

    const erg = await buildEmbeddingCorpus(idb, liste, { incremental: false });

    expect(erg.done).toBe(5);
    expect(erg.ohneText).toBe(3);
    expect(erg.fehlgeschlagen).toBe(1);
    expect(erg.skipped).toBe(4); // die Summe, mit der Aufrufer seit jeher rechnen
    expect(erg.ersterFehler).toBe('Grafik-Kontext verloren');
    expect(erg.aborted).toBe(false);
  });

  it('bricht nach einer Fehlerserie ab, statt durch den Bestand zu rauschen', async () => {
    embedText.mockRejectedValue(new Error('Out of memory'));

    const erg = await buildEmbeddingCorpus(idb, antraege(5000), { incremental: false });

    expect(erg.aborted).toBe(true);
    expect(erg.abbruchGrund).toBe('fehlerserie');
    expect(erg.fehlgeschlagen).toBe(FEHLERSERIE_ABBRUCH);
    // Der eigentliche Gewinn: 4.980 Datensätze wurden NICHT sinnlos durchlaufen.
    expect(erg.done).toBe(FEHLERSERIE_ABBRUCH);
  });

  it('setzt die Serie zurück, wenn dazwischen etwas gelingt', async () => {
    // Ein sprödes Einzelrecord ist keine tote Pipeline: jeder zweite Aufruf
    // scheitert, der Lauf muss trotzdem durchlaufen.
    let ruf = 0;
    embedText.mockImplementation(async () => {
      ruf++;
      if (ruf % 2 === 0) throw new Error('sporadisch');
      return [1, 0, 0, 0];
    });

    const erg = await buildEmbeddingCorpus(idb, antraege(100), { incremental: false });

    expect(erg.aborted).toBe(false);
    expect(erg.fehlgeschlagen).toBe(50);
    expect(erg.done).toBe(100);
  });
});

describe('buildEmbeddingCorpus — der Vektorraum wird nur behauptet, wenn er stimmt', () => {
  it('stempelt NICHT, wenn ein Lauf über fremdem Raum Fehler hatte', async () => {
    // Ausgangslage wie beim echten Fall: lokal liegen Vektoren aus v2.
    gespeicherteSignatur = { modellId: 'testmodell', dim: 4, documentPrefix: 'p', buildVersion: 2 };
    lokalCount = 14_221;
    embedText.mockRejectedValue(new Error('Grafik-Kontext verloren'));

    const erg = await buildEmbeddingCorpus(idb, antraege(3000), { incremental: true });

    expect(erg.vollErzwungen).toBe(true);
    expect(erg.fehlgeschlagen).toBeGreaterThan(0);
    expect(merkeKorpusSignatur).not.toHaveBeenCalled();
    expect(erg.signaturGestempelt).toBe(false);
  });

  it('sagt der Oberfläche, OB gestempelt wurde — statt es raten zu lassen', async () => {
    // Die Karte schreibt „die Textfassung wurde nicht als aktuell vermerkt".
    // Das ist eine Aussage über diesen Lauf; sie darf nicht aus „es gab Fehler"
    // abgeleitet werden, denn im gleichen Raum stempelt er trotzdem.
    gespeicherteSignatur = { modellId: 'testmodell', dim: 4, documentPrefix: 'p', buildVersion: 3 };
    lokalCount = 100;
    let ruf = 0;
    embedText.mockImplementation(async () => {
      ruf++;
      if (ruf === 1) throw new Error('sporadisch');
      return [1, 0, 0, 0];
    });

    const erg = await buildEmbeddingCorpus(idb, antraege(30), { incremental: true });

    expect(erg.fehlgeschlagen).toBe(1);
    expect(erg.signaturGestempelt).toBe(true);
  });

  it('stempelt, wenn derselbe Lauf sauber durchläuft', async () => {
    gespeicherteSignatur = { modellId: 'testmodell', dim: 4, documentPrefix: 'p', buildVersion: 2 };
    lokalCount = 14_221;
    embedText.mockResolvedValue([1, 0, 0, 0]);

    const erg = await buildEmbeddingCorpus(idb, antraege(30), { incremental: true });

    expect(erg.vollErzwungen).toBe(true);
    expect(erg.fehlgeschlagen).toBe(0);
    expect(merkeKorpusSignatur).toHaveBeenCalledTimes(1);
  });

  it('stempelt trotz Einzelfehler, solange der Raum derselbe bleibt', async () => {
    // Kein fremder Raum → dieser Lauf löst nichts ab, es kann nichts mischen.
    gespeicherteSignatur = { modellId: 'testmodell', dim: 4, documentPrefix: 'p', buildVersion: 3 };
    lokalCount = 100;
    let ruf = 0;
    embedText.mockImplementation(async () => {
      ruf++;
      if (ruf === 1) throw new Error('sporadisch');
      return [1, 0, 0, 0];
    });

    const erg = await buildEmbeddingCorpus(idb, antraege(30), { incremental: true });

    expect(erg.vollErzwungen).toBe(false);
    expect(erg.fehlgeschlagen).toBe(1);
    expect(merkeKorpusSignatur).toHaveBeenCalledTimes(1);
  });
});
