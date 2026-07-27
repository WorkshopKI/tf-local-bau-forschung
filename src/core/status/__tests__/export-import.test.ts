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

  // --- Kategoriebaum (optional, aber wenn vorhanden dann konsistent) ---

  const KAT = { id: 'tv.ab', elternId: null, label: 'Antragsbearbeitung', ebene: 'tv', reihenfolge: 10, aktiv: true };

  it('nimmt eine Fassung ohne Kategorien an (Bestand vor dem Code-Inventar)', () => {
    const v = baueSeedVersion();
    expect(v.kategorien).toBeUndefined();
    expect(validiereImport(JSON.stringify(v)).ok).toBe(true);
  });

  it('nimmt einen sauberen Baum mit zugeordneten Feldern an', () => {
    const v = baueSeedVersion();
    const mitBaum = {
      ...v,
      kategorien: [KAT],
      felder: [{ ...v.felder[0]!, kategorieId: 'tv.ab' }, ...v.felder.slice(1)],
    };
    expect(validiereImport(JSON.stringify(mitBaum)).ok).toBe(true);
  });

  it('lehnt ein Feld mit unbekannter Kategorie ab', () => {
    const v = baueSeedVersion();
    const kaputt = {
      ...v,
      kategorien: [KAT],
      felder: [{ ...v.felder[0]!, kategorieId: 'gibtsnicht' }, ...v.felder.slice(1)],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekannte Kategorie');
  });

  it('lehnt einen unbekannten Elternknoten ab', () => {
    const kaputt = {
      ...baueSeedVersion(),
      kategorien: [{ ...KAT, elternId: 'gibtsnicht' }],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekannten Elternknoten');
  });

  it('lehnt doppelte Kategorie-Ids ab', () => {
    const kaputt = { ...baueSeedVersion(), kategorien: [KAT, { ...KAT, label: 'Zwilling' }] };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('doppelt');
  });

  it('lehnt einen Ringschluss im Baum ab', () => {
    const kaputt = {
      ...baueSeedVersion(),
      kategorien: [
        { ...KAT, id: 'a', elternId: 'b' },
        { ...KAT, id: 'b', elternId: 'a' },
      ],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('Ringschluss');
  });
});
