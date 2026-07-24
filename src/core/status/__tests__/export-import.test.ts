import { describe, it, expect } from 'vitest';
import { exportiereVersion, validiereImport } from '@/core/status/export-import';
import { baueSeedVersion } from '@/core/status/seed';

describe('export-import', () => {
  it('Export→Import roundtrip', () => {
    const v = baueSeedVersion();
    const r = validiereImport(exportiereVersion(v));
    expect(r.ok).toBe(true);
    expect(r.version?.werte.length).toBe(v.werte.length);
  });

  it('lehnt kaputtes JSON ab', () => {
    expect(validiereImport('{nope').ok).toBe(false);
  });

  it('lehnt fehlende Struktur ab', () => {
    expect(validiereImport('{"felder":[]}').ok).toBe(false);
  });

  it('lehnt einen Wert mit unbekanntem Feld ab (referenzielle Konsistenz)', () => {
    const v = baueSeedVersion();
    const kaputt = { ...v, werte: [{ ...v.werte[0]!, feldId: 'gibtsnicht' }, ...v.werte.slice(1)] };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekanntes Feld');
  });

  it('lehnt eine Regel mit unbekanntem Feld ab', () => {
    const v = baueSeedVersion();
    const kaputt = {
      ...v,
      regeln: [{ id: 'x', prioritaet: 1, aktiv: true, beschreibung: '', bedingung: { feldId: 'gibtsnicht', op: 'ist', wert: 'a' }, schritte: [{ label: 'x' }] }],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekanntes Feld');
  });
});
