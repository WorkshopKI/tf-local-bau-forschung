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

  it('die Begründung einer Regel überlebt Export und Import', () => {
    // Sie ist der einzige Weg zurück zu der Sitzung, in der eine Regel entstand
    // — ein Feld, das beim Austausch verschwindet, wäre schlimmer als keines.
    const v = baueSeedVersion();
    const mit = {
      ...v,
      todoRegeln: (v.todoRegeln ?? []).map((r, i) => (
        i === 0 ? { ...r, begruendung: 'AB-Sitzung 03.08.2026, beschlossen von MUE/SCH' } : r
      )),
    };
    const r = validiereImport(exportiereVersion(mit));
    expect(r.ok).toBe(true);
    expect(r.version?.todoRegeln?.[0]?.begruendung)
      .toBe('AB-Sitzung 03.08.2026, beschlossen von MUE/SCH');
  });

  it('lehnt eine Regel mit unbekanntem Feld ab', () => {
    const v = baueSeedVersion();
    const kaputt = {
      ...v,
      todoRegeln: [{ id: 'x', position: 1, aktiv: true, todo: 'X', zustaendig: [], bedingung: { feldId: 'gibtsnicht', op: 'ist', wert: 'a' } }],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekanntes Feld');
  });

  // --- Kategoriebaum (optional, aber wenn vorhanden dann konsistent) ---

  const KAT = { id: 'zz.test', elternId: null, label: 'Testordner', ebene: 'tv', reihenfolge: 10, aktiv: true };

  /** Fassung im Zuschnitt vor dem Code-Inventar: keine Kategorien, keine Zuordnung. */
  function ohneBaum(): Record<string, unknown> {
    const v = baueSeedVersion();
    const { kategorien: _weg, ...rest } = v;
    return {
      ...rest,
      felder: v.felder.map(({ kategorieId: _k, ...f }) => f),
    };
  }

  it('nimmt eine Fassung ohne Kategorien an (Bestand vor dem Code-Inventar)', () => {
    expect(validiereImport(JSON.stringify(ohneBaum())).ok).toBe(true);
  });

  it('nimmt den ausgelieferten Baum an', () => {
    expect(validiereImport(exportiereVersion(baueSeedVersion())).ok).toBe(true);
  });

  it('lehnt ein Feld mit unbekannter Kategorie ab', () => {
    const v = baueSeedVersion();
    const kaputt = {
      ...v,
      felder: [{ ...v.felder[0]!, kategorieId: 'gibtsnicht' }, ...v.felder.slice(1)],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekannte Kategorie');
  });

  it('lehnt einen unbekannten Elternknoten ab', () => {
    const kaputt = { ...ohneBaum(), kategorien: [{ ...KAT, elternId: 'gibtsnicht' }] };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('unbekannten Elternknoten');
  });

  it('lehnt doppelte Kategorie-Ids ab', () => {
    const kaputt = { ...ohneBaum(), kategorien: [KAT, { ...KAT, label: 'Zwilling' }] };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('doppelt');
  });

  it('lehnt einen Ringschluss im Baum ab', () => {
    const kaputt = {
      ...ohneBaum(),
      kategorien: [{ ...KAT, id: 'a', elternId: 'b' }, { ...KAT, id: 'b', elternId: 'a' }],
    };
    const r = validiereImport(JSON.stringify(kaputt));
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('Ringschluss');
  });
});
