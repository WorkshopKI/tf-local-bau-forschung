import { describe, it, expect } from 'vitest';
import {
  buildEffectiveMapping,
  lookupAktenplan,
  isDocTypeIrrelevant,
} from '../dms-csv/aktenplan-mapping';

describe('aktenplan-mapping', () => {
  it('liefert Defaults aus dem dms-sample.csv', () => {
    const m = buildEffectiveMapping();
    expect(lookupAktenplan(m, '2.7 De-minimis')?.doc_type).toBe('de_minimis');
    expect(lookupAktenplan(m, '7 Irrelevante Unterlagen')?.irrelevant).toBe(true);
    expect(lookupAktenplan(m, '6.2 QS zur Betreuung')?.doc_type).toBe('gutachten_qs');
    expect(lookupAktenplan(m, '0.2 Checklisten')?.doc_type).toBe('checkliste');
    // Checkliste gilt als irrelevant per Default
    expect(lookupAktenplan(m, '0.2 Checklisten')?.irrelevant).toBe(true);
  });

  it('case-insensitive trim Lookup', () => {
    const m = buildEffectiveMapping();
    expect(lookupAktenplan(m, '  2.7 DE-MINIMIS  ')?.doc_type).toBe('de_minimis');
  });

  it('Override gewinnt über Default', () => {
    const m = buildEffectiveMapping({
      version: 1,
      mapping: {
        '7 Irrelevante Unterlagen': { doc_type: 'sonstiges', irrelevant: false },
      },
    });
    expect(lookupAktenplan(m, '7 Irrelevante Unterlagen')?.irrelevant).toBe(false);
    expect(lookupAktenplan(m, '7 Irrelevante Unterlagen')?.doc_type).toBe('sonstiges');
    // Nicht überschriebene Werte bleiben
    expect(lookupAktenplan(m, '2.7 De-minimis')?.doc_type).toBe('de_minimis');
  });

  it('null bei unbekanntem Wert', () => {
    const m = buildEffectiveMapping();
    expect(lookupAktenplan(m, 'irgendwas das es nicht gibt')).toBeNull();
    expect(lookupAktenplan(m, null)).toBeNull();
    expect(lookupAktenplan(m, '')).toBeNull();
  });

  it('isDocTypeIrrelevant für die kanonischen Typen', () => {
    expect(isDocTypeIrrelevant('irrelevant')).toBe(true);
    expect(isDocTypeIrrelevant('checkliste')).toBe(true);
    expect(isDocTypeIrrelevant('verwendungsnachweis')).toBe(false);
    expect(isDocTypeIrrelevant('gutachten')).toBe(false);
  });

  it('1.6 Bewilligung/Ablehnung mapped auf gutachten (relevant)', () => {
    const m = buildEffectiveMapping();
    expect(lookupAktenplan(m, '1.6 Bewilligung/Ablehnung')).toEqual({
      doc_type: 'gutachten',
      irrelevant: false,
    });
  });

  it('3.3 VN-Sach mapped auf verwendungsnachweis (relevant)', () => {
    const m = buildEffectiveMapping();
    expect(lookupAktenplan(m, '3.3 VN-Sach')).toEqual({
      doc_type: 'verwendungsnachweis',
      irrelevant: false,
    });
  });
});
