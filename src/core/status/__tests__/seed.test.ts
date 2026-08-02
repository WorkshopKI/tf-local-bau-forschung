import { describe, it, expect } from 'vitest';
import { baueSeedVersion } from '@/core/status/seed';
import { ZUARBEIT_CODES } from '@/core/status/seed-codes.data';
import { getCanonicalStatusEntries } from '@/core/utils/status-canonical';
import { wertId } from '@/core/status/typen';

describe('Status-Katalog Seed', () => {
  it('ist deterministisch (zwei Aufrufe deep-equal)', () => {
    expect(baueSeedVersion()).toEqual(baueSeedVersion());
  });

  it('ist Version 1, autorlos, mit festem Zeitstempel und To-do-Kaskade', () => {
    const v = baueSeedVersion();
    expect(v.version).toBe(1);
    expect(v.autor).toBeNull();
    expect(v.zeitstempel).toBe('2026-07-24T00:00:00.000Z');
    // Die To-do-Kaskade ersetzt die fünf alten Nächste-Schritte-Regeln.
    expect(v.todoRegeln?.length ?? 0).toBeGreaterThan(0);
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

  it('lässt die kanonisch abgedeckten Codes nicht doppelt einlaufen', () => {
    // `D_AAE` & Co. sind app-weit gemappt; ein zweiter Eintrag darauf zählte
    // jedes Ereignis doppelt (siehe KATALOG-CODES.md).
    const v = baueSeedVersion();
    const codes = v.felder.map(f => f.code).filter((c): c is string => !!c);
    expect(new Set(codes).size).toBe(codes.length);
    const feldIds = v.felder.map(f => f.feldId);
    expect(new Set(feldIds).size).toBe(feldIds.length);
    for (const code of ['AAE', 'ABB', 'AZ1', 'VBE']) {
      const traeger = v.felder.filter(f => f.code === code);
      expect(traeger, `${code} muss genau einmal vorkommen`).toHaveLength(1);
      expect(traeger[0]!.feldId.startsWith('D_')).toBe(false); // das kanonische Feld
    }
  });

  it('führt den vollständigen Katalog: 505 Codes minus 4 kanonisch abgedeckte, plus 7 eigene Felder', () => {
    const v = baueSeedVersion();
    expect(v.felder).toHaveLength(ZUARBEIT_CODES.length - 4 + 7);
  });

  it('vergibt die ZAH-Phase an 24 Feldern — der Rest trägt bewusst keine', () => {
    // 22 aus der Kuration plus die beiden kanonischen Felder, die vorher keinen
    // Rang trugen und trotzdem eine klare Phase haben: `AZ1` (vorläufige
    // Erstentscheidung → Entscheidung) und `VBE` (VN-Eingang → Begleitung).
    const v = baueSeedVersion();
    expect(v.felder.filter(f => f.zahPhaseId != null)).toHaveLength(24);
  });
});
