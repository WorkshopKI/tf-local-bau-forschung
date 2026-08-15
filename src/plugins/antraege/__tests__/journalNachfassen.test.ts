import { describe, it, expect } from 'vitest';
import {
  ABSTAND_MS, VERSUCHE_MAX, istAntwort,
} from '@/plugins/antraege/status/useJournalChroniken';
import type { AntragsChronikMitId } from '@/core/status';

const CHRONIK: AntragsChronikMitId = {
  antragId: '16KN125431', journalAb: '2026-08-05', gefuehrt: true,
  letzteAenderung: '2026-08-14', felder: [],
};

describe('journal-nachfassen — `null` ist erst am Ende eine Antwort', () => {
  it('nimmt jedes Ergebnis mit Inhalt sofort an', () => {
    expect(istAntwort([CHRONIK], 0)).toBe(true);
  });

  it('nimmt auch die LEERE Liste sofort an', () => {
    // Sie entsteht nur, wenn der Stand tatsächlich gelesen wurde — „nichts
    // geändert" ist eine Auskunft, kein Fehlschlag.
    expect(istAntwort([], 0)).toBe(true);
  });

  it('fasst bei `null` nach, statt „kein Journal" zu behaupten', () => {
    // Der Kaltstart-Fall: `leseSidecar` wirft „kein Share-Handle" und „keine
    // Datei" auf dasselbe `null`. Wer den ersten Versuch für die Antwort hält,
    // schreibt einer laufenden Installation ein fehlendes Journal zu.
    for (let v = 0; v < VERSUCHE_MAX - 1; v++) {
      expect(istAntwort(null, v)).toBe(false);
    }
  });

  it('lässt `null` nach dem letzten Versuch gelten', () => {
    expect(istAntwort(null, VERSUCHE_MAX - 1)).toBe(true);
  });

  it('hat für jeden Versuch einen Abstand, und der erste läuft sofort', () => {
    expect(ABSTAND_MS).toHaveLength(VERSUCHE_MAX);
    expect(ABSTAND_MS[0]).toBe(0);
  });

  it('wartet insgesamt lange genug für einen Kaltstart', () => {
    // Gemessen: `loadAll` über 14 225 Anträge braucht 2,5–5 s je Durchgang, und
    // beim Deep-Link-Reload läuft er zweimal. Eine Kette, die vorher abläuft,
    // heilt den Fall nicht, für den es sie gibt.
    const gesamt = ABSTAND_MS.reduce((a, b) => a + b, 0);
    expect(gesamt).toBeGreaterThanOrEqual(10_000);
  });
});
