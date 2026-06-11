import { describe, it, expect } from 'vitest';
import { pickVb } from '../vbDokument';
import type { DocumentFull } from '@/plugins/dokumente/store';
import type { OrdnerVb } from '@/core/services/personal-storage/antraege-eingang';

const idbDoc = { markdown: 'AUS IDB', tags: ['vorhabensbeschreibung'] } as unknown as DocumentFull;
const ordner: OrdnerVb = { markdown: 'AUS ORDNER', quelle: 'VB.pdf', fkz: '16EP1', konvertiert_am: '2026-06-11T10:00:00.000Z' };

describe('pickVb — IDB hat Vorrang', () => {
  it('IDB-Treffer gewinnt, Ordner wird ignoriert', () => {
    const r = pickVb(idbDoc, ordner);
    expect(r).toEqual({ markdown: 'AUS IDB', herkunft: 'idb', dokument: idbDoc });
  });
  it('ohne IDB → Ordner-Fallback', () => {
    const r = pickVb(null, ordner);
    expect(r?.herkunft).toBe('ordner');
    expect(r?.markdown).toBe('AUS ORDNER');
    expect(r?.quelleName).toBe('VB.pdf');
    expect(r?.dokument).toBeNull();
  });
  it('beides leer → null', () => {
    expect(pickVb(null, null)).toBeNull();
  });
});
