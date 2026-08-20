/**
 * Der Korpus-Abgleich (v4.127) — was mit dem Korpus auf dem Datenspeicher zu
 * tun ist.
 *
 * Der Vorgaenger war ein einziger Vergleich (`lokal < antraegeCount`), also nur
 * die ANZAHL. Diese Tabelle haelt die Lagen fest, die er nicht unterscheiden
 * konnte — allen voran „vollstaendig, aber aus der alten Textfassung": genau der
 * Zustand, in dem der Suchindex still veraltet, weil keine Zahl auffaellig wird.
 */
import { describe, it, expect } from 'vitest';
import { entscheideAbgleich } from '../abgleich';
import { CORPUS_BUILD_VERSION, type KorpusSignatur } from '../signatur';
import type { EmbeddingCorpusManifest } from '../mirror';

const PREFIX = 'title: none | text: ';

const sig = (p: Partial<KorpusSignatur> = {}): KorpusSignatur => ({
  modellId: 'embeddinggemma-300m', dim: 768,
  documentPrefix: PREFIX, buildVersion: CORPUS_BUILD_VERSION, ...p,
});

const manifest = (p: Partial<EmbeddingCorpusManifest> = {}): EmbeddingCorpusManifest => ({
  version: 1,
  modellId: 'embeddinggemma-300m',
  dim: 768,
  antraegeCount: 14201,
  builtAt: '2026-07-14T09:00:00.000Z',
  aktenzeichenSetHash: 'egal',
  aktenzeichen: [],
  binFormat: 'f32-stream',
  binBytes: 14201 * 768 * 4,
  corpusBuildVersion: CORPUS_BUILD_VERSION,
  documentPrefix: PREFIX,
  ...p,
});

/** Kurzform: nur die Lage, die der jeweilige Fall variiert. */
const lage = (p: {
  lokalCount: number;
  lokalSignatur?: KorpusSignatur | null;
  manifest?: EmbeddingCorpusManifest | null;
}) => entscheideAbgleich({
  lokalCount: p.lokalCount,
  lokalSignatur: p.lokalSignatur === undefined ? sig() : p.lokalSignatur,
  manifest: p.manifest === undefined ? manifest() : p.manifest,
  aktiveSignatur: sig(),
});

describe('entscheideAbgleich', () => {
  it('lokal leer, Share vorhanden → ergaenzen (der Kaltstart-Fall)', () => {
    const b = lage({ lokalCount: 0, lokalSignatur: null });
    expect(b.aktion).toBe('ergaenzen');
    expect(b.versionDanach).toBe(CORPUS_BUILD_VERSION);
    expect(b.neuaufbauNoetig).toBe(false);
  });

  it('gleicher Raum, lokal unvollstaendig → ergaenzen (halber Korpus heilt)', () => {
    expect(lage({ lokalCount: 1086 }).aktion).toBe('ergaenzen');
  });

  it('gleicher Raum, lokal vollstaendig → nichts', () => {
    const b = lage({ lokalCount: 14201 });
    expect(b.aktion).toBe('nichts');
    expect(b.neuaufbauNoetig).toBe(false);
  });

  /**
   * Der Fall, der den Umbau ausgeloest hat. Die Anzahl stimmt, also schwieg die
   * alte Regel — und der Suchindex blieb auf einer Textfassung, in der der
   * Vektor eines Vorhabens seinen Inhalt nie gesehen hat.
   */
  it('Share traegt die NEUERE Textfassung → ersetzen, nicht ergaenzen', () => {
    const b = lage({ lokalCount: 14201, lokalSignatur: sig({ buildVersion: 2 }) });
    expect(b.aktion).toBe('ersetzen');
    expect(b.versionDanach).toBe(CORPUS_BUILD_VERSION);
    expect(b.neuaufbauNoetig).toBe(false);
  });

  it('lokal ist neuer als der Share → lokal-neuer, nichts wird ueberschrieben', () => {
    const b = lage({
      lokalCount: 12359,
      manifest: manifest({ corpusBuildVersion: 2 }),
    });
    expect(b.aktion).toBe('lokal-neuer');
    expect(b.versionDanach).toBe(CORPUS_BUILD_VERSION);
  });

  /**
   * Die Lage aus dem Screenshot, der den Umbau anstiess — nur mit einem lokal
   * schon vorhandenen Bestand: beide Seiten sind veraltet, und das muss die App
   * sagen koennen, statt „ergaenzen" zu melden und Ruhe zu geben.
   */
  it('beide Seiten veraltet → neuaufbauNoetig, obwohl geladen werden darf', () => {
    const b = lage({
      lokalCount: 0,
      lokalSignatur: null,
      manifest: manifest({ corpusBuildVersion: 2 }),
    });
    expect(b.aktion).toBe('ergaenzen');
    expect(b.versionDanach).toBe(2);
    expect(b.neuaufbauNoetig).toBe(true);
  });

  it('Modell-Wechsel → unbrauchbar (Pitfall #19), auch wenn der Share aktueller ist', () => {
    const b = lage({
      lokalCount: 14201,
      lokalSignatur: sig({ buildVersion: 2 }),
      manifest: manifest({ modellId: 'anderes-modell' }),
    });
    expect(b.aktion).toBe('unbrauchbar');
  });

  it('Dimensions-Wechsel → unbrauchbar', () => {
    expect(lage({ lokalCount: 14201, manifest: manifest({ dim: 384 }) }).aktion)
      .toBe('unbrauchbar');
  });

  /** Praefix ist Teil des Raums — gleiche Version reicht nicht. */
  it('gleiche Textfassung, anderer Dokument-Praefix → unbrauchbar statt ergaenzen', () => {
    const b = lage({
      lokalCount: 100,
      manifest: manifest({ documentPrefix: 'passage: ' }),
    });
    expect(b.aktion).toBe('unbrauchbar');
  });

  it('kein Manifest → nichts, und der lokale Stand bleibt unangetastet', () => {
    expect(lage({ lokalCount: 0, manifest: null }).aktion).toBe('nichts');
    expect(lage({ lokalCount: 500, manifest: null }).versionDanach).toBe(CORPUS_BUILD_VERSION);
  });

  describe('lokaler Raum unbekannt (Bestand vor v4.113)', () => {
    it('Share ist aktuell → ersetzen, statt fremde Vektoren zu verlaengern', () => {
      expect(lage({ lokalCount: 9000, lokalSignatur: null }).aktion).toBe('ersetzen');
    });

    it('Share ist auch veraltet → nichts laden, aber Neuaufbau ausweisen', () => {
      const b = lage({
        lokalCount: 9000,
        lokalSignatur: null,
        manifest: manifest({ corpusBuildVersion: 2 }),
      });
      expect(b.aktion).toBe('nichts');
      expect(b.neuaufbauNoetig).toBe(true);
    });
  });

  it('jede Entscheidung traegt einen Grund — er geht so in die Oberflaeche', () => {
    const lagen = [
      lage({ lokalCount: 0, lokalSignatur: null }),
      lage({ lokalCount: 14201 }),
      lage({ lokalCount: 14201, lokalSignatur: sig({ buildVersion: 2 }) }),
      lage({ lokalCount: 100, manifest: manifest({ dim: 384 }) }),
      lage({ lokalCount: 100, manifest: null }),
    ];
    for (const b of lagen) expect(b.grund.length).toBeGreaterThan(20);
  });
});
