/**
 * Korpus aus VB + Zusatzdokumenten.
 *
 * Der wichtigste Fall ist der langweiligste: OHNE Zusatzdokumente muss der
 * Korpus byte-identisch zum Hauptdokument sein. Sonst kippt jeder bereits
 * berechnete Baustein (der Cache keyt auf dem Hash des Korpus), und die
 * Sektions-IDs der Gliederung verschieben sich.
 */
import { describe, it, expect } from 'vitest';
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import { baueMapKorpus } from '../vb/korpus';

const HAUPT = {
  name: 'Vorhabensbeschreibung.pdf',
  markdown: '# Vorhaben\n\n## 1 Ausgangslage\n\nText A.\n\n## 2 Ziele\n\nText B.',
};
const MARKT = { name: 'Marktkonzept.pdf', markdown: '# Markt\n\nZielmarkt ist X.' };
const WIRKUNG = { name: 'Wirkung.pdf', markdown: '# Wirkung\n\nUmsatz +2 Mio.' };

const CAP = 100_000;

describe('baueMapKorpus', () => {
  it('ist ohne Zusatzdokumente byte-identisch zum Hauptdokument', () => {
    expect(baueMapKorpus(HAUPT, [], CAP).markdown).toBe(HAUPT.markdown);
  });

  it('hängt Zusatzdokumente quellenmarkiert an, in übergebener Reihenfolge', () => {
    const k = baueMapKorpus(HAUPT, [MARKT, WIRKUNG], CAP);
    expect(k.markdown.startsWith(HAUPT.markdown)).toBe(true);
    expect(k.markdown).toContain('## [Quelle: Marktkonzept.pdf]');
    expect(k.markdown).toContain('## [Quelle: Wirkung.pdf]');
    expect(k.markdown.indexOf('Marktkonzept.pdf')).toBeLessThan(k.markdown.indexOf('Wirkung.pdf'));
    expect(k.markdown).toContain('Zielmarkt ist X.');
  });

  it('macht die Dokumentgrenze in der Gliederung sichtbar', () => {
    const sektionen = parseVbGliederung(baueMapKorpus(HAUPT, [MARKT], CAP).markdown);
    expect(sektionen.some(s => s.titel.includes('Marktkonzept.pdf'))).toBe(true);
  });

  it('lässt die Sektions-IDs des Hauptdokuments unverändert', () => {
    const ohne = parseVbGliederung(baueMapKorpus(HAUPT, [], CAP).markdown);
    const mit = parseVbGliederung(baueMapKorpus(HAUPT, [MARKT, WIRKUNG], CAP).markdown);
    expect(mit.slice(0, ohne.length).map(s => s.id)).toEqual(ohne.map(s => s.id));
    expect(mit.slice(0, ohne.length).map(s => s.start)).toEqual(ohne.map(s => s.start));
  });

  it('meldet die Cap-Überschreitung über die SUMME, nicht je Datei', () => {
    const gross = { name: 'gross.pdf', markdown: 'x'.repeat(60) };
    // Beide Dateien liegen einzeln unter der Grenze, zusammen darüber — genau
    // die Lücke, die der Upload-Check je Datei nicht sieht.
    expect(baueMapKorpus(gross, [], 100).ueberCap).toBe(false);
    const k = baueMapKorpus(gross, [{ name: 'zwei.pdf', markdown: 'y'.repeat(60) }], 100);
    expect(k.ueberCap).toBe(true);
    expect(k.zeichen).toBe(k.markdown.length);
  });
});
