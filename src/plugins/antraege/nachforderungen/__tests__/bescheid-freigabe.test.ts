/**
 * RNE/ABL-Freigabe-Tor + Konsistenz-Checks (rein, deterministisch).
 */
import { describe, it, expect } from 'vitest';
import { extractPlatzhalter, type TextbausteinRecord } from '@/core/services/skills';
import type { MapChecklistenDefinition, MapPruefung } from '@/plugins/map-foerderfaehig/checkliste/typen';
import {
  aspektBewertung, bescheidFreigabeTor, pruefeKonsistenz, type KonsistenzWarnung,
} from '../bescheid-freigabe';

function baustein(id: string, aspekte: string[]): TextbausteinRecord {
  return {
    id, artefaktTyp: 'rne', thema: 'T', kategorie: '', aspekte, stichworte: [],
    text: 'Text.', platzhalter: extractPlatzhalter('Text.'),
    status: 'freigegeben', version: 1, historie: [], geaendertAm: 'x',
  };
}

describe('aspektBewertung', () => {
  const checkliste = {
    items: [
      { id: 'i1', aspekte: ['D'] },
      { id: 'i2', aspekte: ['D', 'E'] },
      { id: 'i3', aspekte: ['B'] },
    ],
  } as unknown as MapChecklistenDefinition;

  it('nimmt je Aspekt die beste (höchste) Stufe', () => {
    const pruefung = { bewertungen: { i1: { stufe: 'B1' }, i2: { stufe: 'B3' }, i3: { stufe: 'B0' } } } as unknown as MapPruefung;
    expect(aspektBewertung(pruefung, checkliste)).toEqual({ D: 'B3', E: 'B3', B: 'B0' });
  });

  it('ignoriert unbewertete Items', () => {
    const pruefung = { bewertungen: { i1: { stufe: 'B2' } } } as unknown as MapPruefung;
    expect(aspektBewertung(pruefung, checkliste)).toEqual({ D: 'B2' });
  });
});

describe('pruefeKonsistenz', () => {
  it('warnt, wenn ein Bescheid-Grund auf einem gut bewerteten Aspekt (B2/B3) steht', () => {
    const w = pruefeKonsistenz([baustein('R1', ['D'])], { D: 'B3' });
    expect(w).toHaveLength(1);
    expect(w[0]!.key).toBe('R1:D');
    expect(w[0]!.text).toContain('R1');
  });

  it('warnt NICHT bei schlecht/ausreichend bewerteten Aspekten (B0/B1)', () => {
    expect(pruefeKonsistenz([baustein('R1', ['D'])], { D: 'B1' })).toEqual([]);
    expect(pruefeKonsistenz([baustein('R1', ['D'])], { D: 'B0' })).toEqual([]);
  });

  it('warnt nicht ohne Bewertung des Aspekts', () => {
    expect(pruefeKonsistenz([baustein('R1', ['D'])], {})).toEqual([]);
  });
});

const KEINE_WARNUNG: KonsistenzWarnung[] = [];

describe('bescheidFreigabeTor', () => {
  const basis = {
    finalerText: 'Fertiger Text ohne Lücken.',
    offeneTodos: 0,
    warnungen: KEINE_WARNUNG,
    bewertungGefunden: true,
    quittiert: new Set<string>(),
    freigabeBestaetigt: true,
  };

  it('erlaubt den Export, wenn alle Tore erfüllt + Freigabe bestätigt', () => {
    expect(bescheidFreigabeTor(basis).exportErlaubt).toBe(true);
  });

  it('blockiert bei ungefülltem Platzhalter', () => {
    const r = bescheidFreigabeTor({ ...basis, finalerText: 'Mit {a / b} und x €.' });
    expect(r.platzhalterOk).toBe(false);
    expect(r.exportErlaubt).toBe(false);
  });

  it('blockiert bei einem unzugeordneten Punkt (TODO)', () => {
    const r = bescheidFreigabeTor({ ...basis, offeneTodos: 1 });
    expect(r.vollstaendig).toBe(false);
    expect(r.exportErlaubt).toBe(false);
  });

  it('blockiert bis alle Warnungen quittiert sind', () => {
    const warnungen = [{ key: 'R1:D', text: 'x' }];
    expect(bescheidFreigabeTor({ ...basis, warnungen }).exportErlaubt).toBe(false);
    expect(bescheidFreigabeTor({ ...basis, warnungen, quittiert: new Set(['R1:D']) }).exportErlaubt).toBe(true);
  });

  it('blockiert ohne Pflicht-Checkbox', () => {
    expect(bescheidFreigabeTor({ ...basis, freigabeBestaetigt: false }).exportErlaubt).toBe(false);
  });

  it('meldet „übersprungen", wenn keine MAP-Bewertung gefunden wurde', () => {
    const r = bescheidFreigabeTor({ ...basis, bewertungGefunden: false });
    expect(r.konsistenzUebersprungen).toBe(true);
    expect(r.exportErlaubt).toBe(true); // übersprungen blockiert nicht
  });
});
