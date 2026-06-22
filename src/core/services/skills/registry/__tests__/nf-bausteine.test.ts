import { describe, it, expect } from 'vitest';
import {
  NF_BAUSTEINE, NF_BAUSTEIN_IDS, extractPlatzhalter, nfBausteineByScope, getNfBaustein,
} from '../nf-bausteine.seed';

describe('NF-Baustein-Katalog — Struktur', () => {
  it('eindeutige IDs, alle Felder belegt', () => {
    const ids = NF_BAUSTEINE.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of NF_BAUSTEINE) {
      expect(b.id).toBeTruthy();
      expect(b.thema).toBeTruthy();
      expect(b.text.trim().length).toBeGreaterThan(0);
    }
    expect(NF_BAUSTEIN_IDS.size).toBe(NF_BAUSTEINE.length);
  });

  it('Anzahl je Kategorie stimmt mit der Quelle überein', () => {
    const count = (k: string): number => NF_BAUSTEINE.filter(b => b.kategorie === k).length;
    expect(count('Gesamtvorhaben')).toBe(9);
    expect(count('Entwicklung')).toBe(10);
    expect(count('Aufträge & Personal')).toBe(26);
    expect(count('Kosten & Verwertung')).toBe(27);
    expect(NF_BAUSTEINE).toHaveLength(72);
  });

  it('Scope leitet sich aus dem ID-Präfix ab (G→verbund, T→tv)', () => {
    for (const b of NF_BAUSTEINE) {
      expect(b.scope).toBe(b.id.startsWith('G') ? 'verbund' : 'tv');
    }
    expect(nfBausteineByScope('verbund').every(b => b.id.startsWith('G'))).toBe(true);
    expect(nfBausteineByScope('verbund')).toHaveLength(9);
    expect(nfBausteineByScope('tv').every(b => b.id.startsWith('T'))).toBe(true);
    expect(nfBausteineByScope('tv')).toHaveLength(63);
  });
});

describe('NF-Baustein-Katalog — Platzhalter-Typisierung (Stichproben)', () => {
  it('G1.2 trägt choose-Platzhalter ({mit / von})', () => {
    const b = getNfBaustein('G1.2')!;
    expect(b.platzhalter.some(p => p.typ === 'choose' && p.roh === '{mit / von}')).toBe(true);
  });

  it('T2.1.2 trägt einen wert-Platzhalter (x €)', () => {
    const b = getNfBaustein('T2.1.2')!;
    expect(b.platzhalter.some(p => p.typ === 'wert' && p.roh === 'x €')).toBe(true);
  });

  it('T1.4.2 trägt einen optional-Platzhalter ({technischen})', () => {
    const b = getNfBaustein('T1.4.2')!;
    expect(b.platzhalter.some(p => p.typ === 'optional' && p.roh === '{technischen}')).toBe(true);
  });

  it('G1.1 trägt einen fill-Platzhalter (...)', () => {
    const b = getNfBaustein('G1.1')!;
    expect(b.platzhalter.some(p => p.typ === 'fill')).toBe(true);
  });

  it('extractPlatzhalter klassifiziert die vier Typen korrekt', () => {
    expect(extractPlatzhalter('{a / b / c}')).toEqual([{ roh: '{a / b / c}', typ: 'choose' }]);
    expect(extractPlatzhalter('{nicht}')).toEqual([{ roh: '{nicht}', typ: 'optional' }]);
    expect(extractPlatzhalter('Betrag von x €.')).toEqual([{ roh: 'x €', typ: 'wert' }]);
    expect(extractPlatzhalter('insgesamt xx T€.')).toEqual([{ roh: 'xx T€', typ: 'wert' }]);
    expect(extractPlatzhalter('Punkt …')).toEqual([{ roh: '…', typ: 'fill' }]);
    expect(extractPlatzhalter('Punkt ...')).toEqual([{ roh: '...', typ: 'fill' }]);
    expect(extractPlatzhalter('ohne Platzhalter')).toEqual([]);
  });

  it('Platzhalter sind nach Textposition sortiert', () => {
    const ph = extractPlatzhalter('… danach {mit / von} und x €');
    expect(ph.map(p => p.typ)).toEqual(['fill', 'choose', 'wert']);
  });
});

describe('NF-Baustein-Katalog — Wortgetreuheit (Stichproben)', () => {
  it('kurzer Baustein ist exakt übernommen', () => {
    expect(getNfBaustein('T2.2.3')!.text).toBe('Bitte legen Sie uns den Entwurf eines FuE-Vertrags vor.');
  });

  it('Baustein-Text wird nicht umformuliert (verbatim-Marker erhalten)', () => {
    // „antragsstellender" (doppeltes s) ist ein Quell-Tippfehler — wortgetreu belassen.
    expect(getNfBaustein('G4.1')!.text).toContain('antragsstellender');
    // Listenstruktur des G4.1 bleibt erhalten.
    expect(getNfBaustein('G4.1')!.text).toContain('\n- Letter of Intent');
  });
});
