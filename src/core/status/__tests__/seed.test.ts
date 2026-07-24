import { describe, it, expect } from 'vitest';
import { baueSeedVersion } from '@/core/status/seed';
import { getCanonicalStatusEntries } from '@/core/utils/status-canonical';
import { wertId } from '@/core/status/typen';

describe('Status-Katalog Seed', () => {
  it('ist deterministisch (zwei Aufrufe deep-equal)', () => {
    expect(baueSeedVersion()).toEqual(baueSeedVersion());
  });

  it('ist Version 1, autorlos, mit festem Zeitstempel und ohne Regeln', () => {
    const v = baueSeedVersion();
    expect(v.version).toBe(1);
    expect(v.autor).toBeNull();
    expect(v.zeitstempel).toBe('2026-07-24T00:00:00.000Z');
    expect(v.regeln).toEqual([]);
  });

  it('führt jeden kanonischen Statuswert unter „status" mit identischer Kategorie', () => {
    const v = baueSeedVersion();
    const statusWerte = new Map(
      v.werte.filter(w => w.feldId === 'status').map(w => [w.wert, w.kategorie]),
    );
    for (const [rohwert, kategorie] of getCanonicalStatusEntries()) {
      expect(statusWerte.get(rohwert)).toBe(kategorie);
    }
  });

  it('vergibt eindeutige, stabile Wert-IDs', () => {
    const v = baueSeedVersion();
    const ids = v.werte.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const erster = v.werte[0];
    expect(erster).toBeDefined();
    expect(erster!.id).toBe(wertId(erster!.feldId, erster!.wert));
  });

  it('kennt die kuratierten Wert- und Datumsfelder', () => {
    const v = baueSeedVersion();
    const felder = Object.fromEntries(v.felder.map(f => [f.feldId, f.typ]));
    expect(felder.status).toBe('wert');
    expect(felder.verbund_status).toBe('wert');
    expect(felder.vb_phase).toBe('wert');
    expect(felder.antragsdatum).toBe('datum');
    expect(felder.bewilligung_datum).toBe('datum');
  });

  it('seedet keine vb_phase-Wert-Einträge (bleiben der Auto-Discovery überlassen)', () => {
    const v = baueSeedVersion();
    expect(v.werte.some(w => w.feldId === 'vb_phase')).toBe(false);
  });
});
