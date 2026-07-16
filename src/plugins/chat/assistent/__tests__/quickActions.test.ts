import { describe, expect, it } from 'vitest';
import { quickActionsFuer, type QuickActionKontext } from '../quickActions';
import type { KontextEntitaet } from '@/core/services/assistent/kontext';

function kontext(over: Partial<QuickActionKontext> = {}): QuickActionKontext {
  return {
    routeBeschreibung: 'Förderanträge-Liste',
    entitaet: null,
    hatIndex: false,
    ...over,
  };
}

const verbund: KontextEntitaet = { art: 'verbund', id: 'VB-1', titel: 'Muster-Verbund' };
const antrag: KontextEntitaet = { art: 'antrag', id: 'FKZ-1', titel: 'Muster-Antrag' };

const ids = (k: QuickActionKontext): string[] => quickActionsFuer(k).map(a => a.id);

describe('quickActionsFuer — routen-sensitive Sichtbarkeit', () => {
  it('Verbund selektiert + Index → Entitäts-Aktionen inkl. Zusammenfassen, kein heute-dran', () => {
    expect(ids(kontext({ entitaet: verbund, routeBeschreibung: 'Detailansicht Verbund', hatIndex: true })))
      .toEqual(['naechster-schritt', 'wo-stehe-ich', 'fristen', 'zusammenfassen']);
  });

  it('Antrag selektiert OHNE Index → Zusammenfassen ausgeblendet', () => {
    expect(ids(kontext({ entitaet: antrag, routeBeschreibung: 'Detailansicht Antrag', hatIndex: false })))
      .toEqual(['naechster-schritt', 'wo-stehe-ich', 'fristen']);
  });

  it('Liste ohne Selektion → nur Fristen + heute-dran', () => {
    expect(ids(kontext({ entitaet: null, routeBeschreibung: 'Förderanträge-Liste' })))
      .toEqual(['fristen', 'heute-dran']);
  });

  it('Startseite ohne Selektion → ebenfalls Fristen + heute-dran (Übersichtsmodus)', () => {
    expect(ids(kontext({ entitaet: null, routeBeschreibung: 'Startseite' })))
      .toEqual(['fristen', 'heute-dran']);
  });

  it('kein Index bei selektierter Entität → Zusammenfassen fehlt, sonst unverändert', () => {
    const mitIndex = ids(kontext({ entitaet: verbund, hatIndex: true }));
    const ohneIndex = ids(kontext({ entitaet: verbund, hatIndex: false }));
    expect(mitIndex).toContain('zusammenfassen');
    expect(ohneIndex).not.toContain('zusammenfassen');
  });

  it('Leiste ist nie leer — Fristen ist überall sichtbar', () => {
    for (const k of [
      kontext({ entitaet: null }),
      kontext({ entitaet: verbund, hatIndex: true }),
      kontext({ entitaet: antrag, hatIndex: false }),
    ]) {
      const liste = quickActionsFuer(k);
      expect(liste.length).toBeGreaterThan(0);
      expect(liste.map(a => a.id)).toContain('fristen');
    }
  });

  it('„Plan bis Bewilligung" ist nirgends im Katalog (bewusst weggelassen)', () => {
    for (const k of [
      kontext({ entitaet: null }),
      kontext({ entitaet: verbund, hatIndex: true }),
      kontext({ entitaet: antrag, hatIndex: true }),
    ]) {
      expect(ids(k)).not.toContain('plan-bewilligung');
    }
  });

  it('Reihenfolge ist stabil (Katalogreihenfolge, egal welche Achse variiert)', () => {
    // Selektion an/aus darf die relative Ordnung der gemeinsamen Aktionen nicht drehen.
    const mitEntitaet = ids(kontext({ entitaet: verbund, hatIndex: true }));
    expect(mitEntitaet.indexOf('naechster-schritt')).toBeLessThan(mitEntitaet.indexOf('wo-stehe-ich'));
    expect(mitEntitaet.indexOf('wo-stehe-ich')).toBeLessThan(mitEntitaet.indexOf('fristen'));
    expect(mitEntitaet.indexOf('fristen')).toBeLessThan(mitEntitaet.indexOf('zusammenfassen'));
  });

  it('exakte Fragetexte je Aktion (Preset-Kontrakt)', () => {
    const alle = quickActionsFuer(kontext({ entitaet: verbund, hatIndex: true }));
    const frageVon = (id: string): string | undefined => alle.find(a => a.id === id)?.frage;
    expect(frageVon('naechster-schritt')).toBe('Was ist mein nächster Schritt?');
    expect(frageVon('wo-stehe-ich')).toBe('Wo im Verfahren steht dieser Vorgang?');
    expect(frageVon('fristen')).toBe('Welche Fristen stehen an?');
    expect(frageVon('zusammenfassen')).toBe('Fasse den aktuellen Vorgang zusammen.');
    expect(quickActionsFuer(kontext({ entitaet: null })).find(a => a.id === 'heute-dran')?.frage)
      .toBe('Was ist heute in meinem Arbeitsvorrat dran?');
  });
});
