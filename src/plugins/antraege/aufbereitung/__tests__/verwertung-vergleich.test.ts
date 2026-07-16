import { describe, it, expect } from 'vitest';
import { gruppiereVergleich, hatExterneVerwertung } from '../verwertung-vergleich';
import type { VerwertungAussage } from '../verwertung';
import type { ExterneRecherche } from '../types';

const antrag: VerwertungAussage[] = [
  { kategorie: 'zielmarkt', text: 'Antrag: Markt A', sektionIds: ['k-1'] },
  { kategorie: 'umsatz', text: 'Antrag: 5 Mio', sektionIds: ['k-2'] },
];

function extern(aussagen: ExterneRecherche['aussagen'], modellLabel = 'ChatGPT'): ExterneRecherche {
  return { schemaVersion: 1, importiertAm: '2026-07-16T00:00:00.000Z', herkunft: 'json', modellLabel, quellen: [], aussagen };
}

describe('gruppiereVergleich', () => {
  it('gruppiert Antrag + extern in derselben Kategorie', () => {
    const g = gruppiereVergleich(antrag, [extern([{ kategorie: 'zielmarkt', text: 'Extern: Markt A wächst', quellenUrls: ['https://x'] }])]);
    const ziel = g.find(x => x.kat === 'zielmarkt')!;
    expect(ziel.antrag).toHaveLength(1);
    expect(ziel.extern).toHaveLength(1);
    expect(ziel.extern[0]?.modellLabel).toBe('ChatGPT');
  });

  it('lässt sdt-Aussagen aus (kein Verwertungs-Vergleich)', () => {
    const g = gruppiereVergleich([], [extern([{ kategorie: 'sdt', text: 'Stand der Technik …' }])]);
    expect(g).toHaveLength(0);
    expect(hatExterneVerwertung([extern([{ kategorie: 'sdt', text: 'x' }])])).toBe(false);
  });

  it('zeigt eine Kategorie auch, wenn nur eine externe Aussage existiert (kein Antrag)', () => {
    const g = gruppiereVergleich([], [extern([{ kategorie: 'wettbewerb', text: 'Extern: Anbieter Z' }])]);
    const w = g.find(x => x.kat === 'wettbewerb')!;
    expect(w.antrag).toHaveLength(0);
    expect(w.extern).toHaveLength(1);
  });

  it('ohne externe Schicht kommen die Gruppen nur aus dem Antrag', () => {
    const g = gruppiereVergleich(antrag, undefined);
    expect(g.map(x => x.kat)).toEqual(['zielmarkt', 'umsatz']);
    expect(g.every(x => x.extern.length === 0)).toBe(true);
    expect(hatExterneVerwertung(undefined)).toBe(false);
  });

  it('führt mehrere Importe derselben Kategorie zusammen', () => {
    const g = gruppiereVergleich(antrag, [
      extern([{ kategorie: 'umsatz', text: 'Extern A' }], 'ChatGPT'),
      extern([{ kategorie: 'umsatz', text: 'Extern B' }], 'Claude'),
    ]);
    const u = g.find(x => x.kat === 'umsatz')!;
    expect(u.extern.map(a => a.text)).toEqual(['Extern A', 'Extern B']);
    expect(hatExterneVerwertung([extern([{ kategorie: 'umsatz', text: 'x' }])])).toBe(true);
  });
});
