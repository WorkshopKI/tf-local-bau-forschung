/**
 * Die importierten Trigger-Regeln: erfasst, geprüft — und **nicht wirksam**.
 *
 * Die Zusagen hier sind die, deren Bruch teuer wäre: eine versehentlich scharfe
 * Regel würde Status ableiten (Pitfall #44), und eine Benachrichtigung, die als
 * Statuswechsel gelesen wird, ändert stillschweigend Daten.
 */
import { describe, it, expect } from 'vitest';
import { KUERZEL_TRIGGER_REGELN } from '../kuerzel-trigger.data';

describe('Import-Zusagen', () => {
  it('KEINE Regel ist aktiv — Aktivierung ist eine eigene Entscheidung', () => {
    for (const r of KUERZEL_TRIGGER_REGELN) {
      expect(r.aktiv, `${r.kuerzel}/${r.projektform}`).toBe(false);
    }
  });

  it('jede Regel führt ihren Originalsatz mit', () => {
    // Bei Zweifeln gilt der Originaltext, nicht der Parser.
    for (const r of KUERZEL_TRIGGER_REGELN) {
      expect(r.original.trim().length, r.kuerzel).toBeGreaterThan(0);
    }
  });

  it('Benachrichtigung und Statuswechsel sind getrennte Felder', () => {
    // „trigger an AB, Stw TV auf abgebrochen" ist zweierlei. Der Empfänger darf
    // nie im Zielstatus landen und umgekehrt.
    const aba = KUERZEL_TRIGGER_REGELN.find(r => r.kuerzel === 'ABA');
    expect(aba).toBeDefined();
    expect(aba!.benachrichtigt).toEqual(['AB', 'FB']);
    expect(aba!.zielStatus?.roh).toBe('abgebrochen');
    for (const r of KUERZEL_TRIGGER_REGELN) {
      for (const e of r.benachrichtigt) {
        expect(r.zielStatus?.roh ?? '', `${r.kuerzel}: „${e}" im Zielstatus`).not.toBe(e);
      }
    }
  });
});

describe('Bedingungen sind strukturiert, nicht Freitext', () => {
  it('Aggregation über Teilvorhaben ist als solche erkannt', () => {
    const agg = KUERZEL_TRIGGER_REGELN.filter(r => r.bedingung?.art === 'aggregation-tv');
    expect(agg.length).toBeGreaterThan(0);
    for (const r of agg) {
      const b = r.bedingung as Extract<typeof r.bedingung, { art: 'aggregation-tv' }>;
      expect(['alle', 'kein']).toContain(b.quantor);
      expect(b.kuerzel.length).toBeGreaterThan(0);
    }
  });

  it('Vorbedingung auf den aktuellen Status ist als solche erkannt', () => {
    const vor = KUERZEL_TRIGGER_REGELN.filter(r => r.bedingung?.art === 'status-vorbedingung');
    expect(vor.length).toBeGreaterThan(0);
  });

  it('behält den Rohtext auch bei strukturierter Bedingung', () => {
    for (const r of KUERZEL_TRIGGER_REGELN) {
      if (r.bedingung) expect(r.bedingung.roh.length, r.kuerzel).toBeGreaterThan(0);
    }
  });
});

describe('Zielstatus wird aufgelöst, nicht geraten', () => {
  it('markiert unauflösbare Ziele statt einen Code zu erfinden', () => {
    for (const r of KUERZEL_TRIGGER_REGELN) {
      if (!r.zielStatus) continue;
      if (r.zielStatus.aufloesbar) expect(typeof r.zielStatus.code).toBe('number');
      else expect(r.zielStatus.code).toBeNull();
    }
  });

  it('die Tippfehler der Zuarbeit bleiben unaufgelöst und sichtbar', () => {
    // „bewilligungseif" und „Irrläuder" sind Tippfehler. Sie zu erraten hieße,
    // eine Regel scharf zu machen, die auf einen falschen Status zeigt.
    const roh = KUERZEL_TRIGGER_REGELN.map(r => r.zielStatus?.roh);
    expect(roh).toContain('bewilligungseif');
    const tf = KUERZEL_TRIGGER_REGELN.filter(r => r.zielStatus?.roh === 'bewilligungseif');
    for (const r of tf) expect(r.zielStatus!.aufloesbar).toBe(false);
  });
});
