/**
 * Die Korpus-Signatur (v4.113) — aus welchem Vektorraum die Vektoren stammen.
 *
 * Sie schließt die teuerste Lücke der Bug-Jagd an der Ähnlichkeitsstufe: der
 * Korpus hatte auf diese Frage keine Antwort, `incremental` filterte allein über
 * die Existenz des Aktenzeichen-Schlüssels, und ein Präfix-Wechsel mischte zwei
 * Räume, ohne dass etwas rot wurde.
 */
import { describe, it, expect } from 'vitest';
import {
  CORPUS_BUILD_VERSION,
  aktuelleKorpusSignatur,
  signaturenGleich,
  signaturAusManifest,
  signaturText,
  ladeKorpusSignatur,
  merkeKorpusSignatur,
  type KorpusSignatur,
} from '../signatur';

const cfg = {
  id: 'embeddinggemma-300m', dimensions: 768,
  documentPrefix: 'title: none | text: ',
} as Parameters<typeof aktuelleKorpusSignatur>[0];

const sig = (p: Partial<KorpusSignatur> = {}): KorpusSignatur => ({
  modellId: 'embeddinggemma-300m', dim: 768,
  documentPrefix: 'title: none | text: ', buildVersion: CORPUS_BUILD_VERSION, ...p,
});

describe('aktuelleKorpusSignatur', () => {
  it('nimmt Modell, Dimension und Praefix aus der Config und die aktuelle Textversion', () => {
    expect(aktuelleKorpusSignatur(cfg)).toEqual(sig());
  });
});

describe('signaturenGleich', () => {
  it('gleich, wenn alles gleich ist', () => {
    expect(signaturenGleich(sig(), sig())).toBe(true);
  });

  it('ungleich bei anderem Modell, anderer Dimension, anderer Textversion', () => {
    expect(signaturenGleich(sig(), sig({ modellId: 'anderes' }))).toBe(false);
    expect(signaturenGleich(sig(), sig({ dim: 384 }))).toBe(false);
    expect(signaturenGleich(sig(), sig({ buildVersion: 2 }))).toBe(false);
  });

  // Das war der eigentliche Defekt: der Praefix ging in keinen Vergleich ein.
  it('ungleich bei anderem Dokument-Praefix — der Vektorraum haengt daran', () => {
    expect(signaturenGleich(sig(), sig({ documentPrefix: 'passage: ' }))).toBe(false);
  });

  // Toleranter Leser: alte Manifests fuehren den Praefix nicht. Ein `null` darf
  // keinen Unterschied BEGRUENDEN — es macht keine Aussage.
  it('ein unbekannter Praefix begruendet keinen Unterschied', () => {
    expect(signaturenGleich(sig(), sig({ documentPrefix: null }))).toBe(true);
    expect(signaturenGleich(sig({ documentPrefix: null }), sig())).toBe(true);
  });

  it('aber ein unbekannter Praefix hebt die anderen Felder nicht auf', () => {
    expect(signaturenGleich(sig({ documentPrefix: null }), sig({ buildVersion: 1 }))).toBe(false);
  });
});

describe('signaturAusManifest', () => {
  it('liest Modell, Dimension, Praefix und Textversion', () => {
    expect(signaturAusManifest({
      modellId: 'embeddinggemma-300m', dim: 768,
      documentPrefix: 'title: none | text: ', corpusBuildVersion: 3,
    })).toEqual(sig());
  });

  it('altes Manifest ohne die neuen Felder gilt als Textversion 1 mit unbekanntem Praefix', () => {
    expect(signaturAusManifest({ modellId: 'embeddinggemma-300m', dim: 768 }))
      .toEqual(sig({ buildVersion: 1, documentPrefix: null }));
  });
});

describe('signaturText', () => {
  it('nennt alle vier Bestandteile', () => {
    expect(signaturText(sig())).toBe('embeddinggemma-300m/768d/Text v3/„title: none | text: "');
  });

  it('benennt einen unbekannten Praefix als solchen, statt ihn zu verschweigen', () => {
    expect(signaturText(sig({ documentPrefix: null }))).toContain('Praefix unbekannt');
  });
});

describe('laden und merken', () => {
  function fakeIdb(): { store: Record<string, unknown>;
    get: <T>(k: string) => Promise<T | null>; set: (k: string, v: unknown) => Promise<void> } {
    const store: Record<string, unknown> = {};
    return {
      store,
      get: async <T>(k: string) => (store[k] as T) ?? null,
      set: async (k: string, v: unknown) => { store[k] = v; },
    };
  }

  it('ohne gemerkte Signatur null — der Aufrufer behandelt den Korpus dann als fremd', async () => {
    expect(await ladeKorpusSignatur(fakeIdb())).toBeNull();
  });

  it('gemerkt und wieder gelesen', async () => {
    const idb = fakeIdb();
    await merkeKorpusSignatur(idb, sig());
    expect(await ladeKorpusSignatur(idb)).toEqual(sig());
  });

  it('unvollstaendig gemerkt: fehlende Felder fallen auf „unbekannt" bzw. Version 1', async () => {
    const idb = fakeIdb();
    await idb.set('auslastung-emb-signatur', { modellId: 'x', dim: 768 });
    expect(await ladeKorpusSignatur(idb)).toEqual({
      modellId: 'x', dim: 768, documentPrefix: null, buildVersion: 1,
    });
  });

  it('Schrott gemerkt: null statt einer erfundenen Signatur', async () => {
    const idb = fakeIdb();
    await idb.set('auslastung-emb-signatur', { irgendwas: true });
    expect(await ladeKorpusSignatur(idb)).toBeNull();
  });
});
