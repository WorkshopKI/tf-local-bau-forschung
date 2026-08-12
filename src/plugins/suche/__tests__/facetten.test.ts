import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  facettenOptionen, wendeFacettenAn, aktiveFilterChips, aktiveFilterTexte,
  schalteFacette, istWahlLeer, LEERE_WAHL,
} from '../facetten';

function treffer(p: Partial<UnifiedSearchResult>): UnifiedSearchResult {
  return {
    id: p.id ?? 'X', type: 'antrag', score: 1, method: 'fulltext',
    title: 'Titel', snippet: '', ...p,
  } as UnifiedSearchResult;
}

const MENGE: UnifiedSearchResult[] = [
  treffer({ id: 'A', statusKategorie: 'bewilligt', vbPhase: 3, bewilligungsdatum: '2024-05-02', trefferfelder: ['titel'] }),
  treffer({ id: 'B', statusKategorie: 'bewilligt', vbPhase: 3, bewilligungsdatum: '2013-12-12', trefferfelder: ['titel', 'dokument'] }),
  treffer({ id: 'C', statusKategorie: 'abgelehnt', vbPhase: 5, bewilligungsdatum: '2024-01-01', trefferfelder: ['organisation'] }),
];

describe('facettenOptionen', () => {
  it('zählt die Werte einer Facette', () => {
    const status = facettenOptionen(MENGE, 'status', LEERE_WAHL);
    expect(status.find(o => o.wert === 'bewilligt')?.anzahl).toBe(2);
    expect(status.find(o => o.wert === 'abgelehnt')?.anzahl).toBe(1);
  });

  it('zählt einen Treffer bei MEHREREN Trefferstellen auch mehrfach', () => {
    const stellen = facettenOptionen(MENGE, 'trefferstelle', LEERE_WAHL);
    expect(stellen.find(o => o.wert === 'titel')?.anzahl).toBe(2);
    expect(stellen.find(o => o.wert === 'dokument')?.anzahl).toBe(1);
  });

  it('sortiert nach Häufigkeit', () => {
    const stellen = facettenOptionen(MENGE, 'trefferstelle', LEERE_WAHL);
    expect(stellen[0]?.wert).toBe('titel');
  });

  it('DIE ZUSAGE: die Zahl ist die Zeilenzahl nach dem Klick', () => {
    for (const opt of facettenOptionen(MENGE, 'status', LEERE_WAHL)) {
      const wahl = schalteFacette(LEERE_WAHL, 'status', opt.wert);
      expect(wendeFacettenAn(MENGE, wahl)).toHaveLength(opt.anzahl);
    }
  });

  it('zählt gegen die ÜBRIGEN Facetten, nicht gegen den Vollbestand', () => {
    const nurFuE = schalteFacette(LEERE_WAHL, 'antragstyp', 'FuE');
    const status = facettenOptionen(MENGE, 'status', nurFuE);
    // „abgelehnt" hat nur der DS-Antrag — unter dem FuE-Filter bleibt davon nichts.
    expect(status.find(o => o.wert === 'abgelehnt')?.anzahl ?? 0).toBe(0);
    expect(status.find(o => o.wert === 'bewilligt')?.anzahl).toBe(2);
  });

  it('hält einen gewählten Wert sichtbar, auch wenn er auf 0 fällt', () => {
    const wahl = schalteFacette(
      schalteFacette(LEERE_WAHL, 'antragstyp', 'FuE'), 'status', 'abgelehnt',
    );
    const status = facettenOptionen(MENGE, 'status', wahl);
    expect(status.some(o => o.wert === 'abgelehnt')).toBe(true);
  });

  it('das Jahr kommt aus dem Bewilligungsdatum', () => {
    const jahre = facettenOptionen(MENGE, 'jahr', LEERE_WAHL);
    expect(jahre.map(j => j.wert).sort()).toEqual(['2013', '2024']);
  });
});

describe('wendeFacettenAn', () => {
  it('leere Wahl lässt alles durch', () => {
    expect(wendeFacettenAn(MENGE, LEERE_WAHL)).toHaveLength(3);
  });

  it('mehrere Facetten sind ein UND', () => {
    const wahl = schalteFacette(
      schalteFacette(LEERE_WAHL, 'status', 'bewilligt'), 'jahr', '2024',
    );
    expect(wendeFacettenAn(MENGE, wahl).map(r => r.id)).toEqual(['A']);
  });

  it('mehrere Werte EINER Facette sind ein ODER', () => {
    const wahl = schalteFacette(
      schalteFacette(LEERE_WAHL, 'status', 'bewilligt'), 'status', 'abgelehnt',
    );
    expect(wendeFacettenAn(MENGE, wahl)).toHaveLength(3);
  });
});

describe('Chips', () => {
  it('jeder gesetzte Wert wird zu einem entfernbaren Chip', () => {
    const wahl = schalteFacette(LEERE_WAHL, 'status', 'bewilligt');
    const chips = aktiveFilterChips(wahl);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.facette).toBe('Status');
    expect(chips[0]?.wertLabel.length).toBeGreaterThan(0);
  });

  it('Chip-Text und Ausweg-Text kommen aus derselben Quelle', () => {
    const wahl = schalteFacette(LEERE_WAHL, 'jahr', '2024');
    const chip = aktiveFilterChips(wahl)[0];
    expect(aktiveFilterTexte(wahl)).toEqual([`${chip?.facette}: ${chip?.wertLabel}`]);
  });
});

describe('schalteFacette', () => {
  it('schaltet an und wieder aus', () => {
    const an = schalteFacette(LEERE_WAHL, 'jahr', '2024');
    expect(an.jahr).toEqual(['2024']);
    expect(schalteFacette(an, 'jahr', '2024').jahr).toEqual([]);
  });

  it('lässt die Ausgangs-Wahl unangetastet (rein)', () => {
    schalteFacette(LEERE_WAHL, 'jahr', '2024');
    expect(istWahlLeer(LEERE_WAHL)).toBe(true);
  });
});
