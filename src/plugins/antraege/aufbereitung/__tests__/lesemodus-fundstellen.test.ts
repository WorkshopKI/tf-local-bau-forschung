import { describe, it, expect } from 'vitest';
import { aggregiereFundstellen } from '../lesemodus-fundstellen';
import type { VbSektion } from '../gliederung';
import type { AspektMapping } from '../aspekte';
import type { SteckbriefDaten } from '../steckbrief';

const sek = (id: string): VbSektion => ({ id, nummer: null, titel: id, ebene: 1, start: 0, end: 10 } as unknown as VbSektion);
const gliederung: VbSektion[] = [sek('k-1'), sek('k-2'), sek('k-3')];

const leererSteckbrief = (over: Partial<SteckbriefDaten> = {}): SteckbriefDaten => ({
  einSatz: null, innovation: [], fueGegenstand: [], laufzeit: null, kernZielwert: null,
  zielmaerkte: [], personal: [], auftraegeDritte: [], ...over,
});

describe('aggregiereFundstellen', () => {
  it('aggregiert mehrere Bausteine je Sektions-ID', () => {
    const aspekte: AspektMapping = { zuordnung: { A: ['k-1'], B: ['k-1', 'k-2'] }, fehlend: {} };
    const map = aggregiereFundstellen({
      gliederung,
      aspekte,
      steckbrief: leererSteckbrief({ einSatz: { text: 'Das Vorhaben …', sektionIds: ['k-1'] } }),
      zahlen: { schemaVersion: 1, claims: [{ wert: '24 Monate', kategorie: 'zeit', kontext: '', sektionIds: ['k-2'] }] },
      verwertung: { schemaVersion: 1, aussagen: [{ kategorie: 'zielmarkt', text: 'Markt A', sektionIds: ['k-3'] }] },
      glossar: { schemaVersion: 1, begriffe: [{ begriff: 'RFID', definition: 'x', sektionIds: ['k-1'] }] },
    });
    // k-1: Aspekt(A/B) + Steckbrief + Glossar
    expect(map.get('k-1')?.map(r => r.baustein).sort()).toEqual(['aspekte', 'glossar', 'steckbrief']);
    expect(map.get('k-2')?.some(r => r.baustein === 'zahlen')).toBe(true);
    expect(map.get('k-3')?.[0]?.baustein).toBe('verwertung');
  });

  it('ignoriert Sektions-IDs außerhalb der Gliederung', () => {
    const map = aggregiereFundstellen({
      gliederung,
      zahlen: { schemaVersion: 1, claims: [{ wert: '5', kategorie: 'kosten', kontext: '', sektionIds: ['k-999'] }] },
    });
    expect(map.has('k-999')).toBe(false);
    expect(map.size).toBe(0);
  });

  it('erzeugt keine Marker ohne Baustein-Daten (leerer Eingang)', () => {
    expect(aggregiereFundstellen({ gliederung }).size).toBe(0);
  });

  it('kürzt lange Kurztexte', () => {
    const lang = 'x'.repeat(200);
    const map = aggregiereFundstellen({
      gliederung,
      verwertung: { schemaVersion: 1, aussagen: [{ kategorie: 'umsatz', text: lang, sektionIds: ['k-1'] }] },
    });
    expect(map.get('k-1')?.[0]?.kurztext.length).toBeLessThanOrEqual(70);
  });
});
