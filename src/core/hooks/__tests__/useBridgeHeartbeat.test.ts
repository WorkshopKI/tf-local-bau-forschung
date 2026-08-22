/**
 * Der Takt des Bridge-Heartbeats.
 *
 * Regression (v6.9.6): der Takt zaehlte Ticks statt Zeit — und `tickCount++` stand
 * HINTER dem `await` der Probe. Solange eine Probe lief (bis 5 s), sahen die
 * folgenden 3-Sekunden-Ticks denselben Zaehler, `tickCount % 5 === 0` blieb wahr,
 * und jeder von ihnen startete eine WEITERE Probe. Waehrend einer Stoerung — also
 * genau dann, wenn die Bridge ohnehin klemmt — probte die App alle 3 s statt alle
 * 15 s. Dieselbe Zaehlung machte die zweite Zusage der Datei kaputt („beim
 * Re-Fokus sofort proben"): sie traf nur zu, wenn der Zaehler zufaellig durch 5
 * teilbar war, also in einem von fuenf Faellen.
 *
 * Beides faellt weg, sobald der Takt an der UHR haengt und eine laufende Probe
 * sich selbst sperrt. Die Entscheidung ist deshalb pur — das Projekt rendert keine
 * Komponenten, der Hook bleibt reine Anbindung.
 */
import { describe, it, expect } from 'vitest';
import { probeIstFaellig, PING_INTERVAL_MS } from '../useBridgeHeartbeat';

const RUHE = { laeuft: false, sofort: false };

describe('probeIstFaellig — der Takt haengt an der Uhr, nicht an der Zahl der Ticks', () => {
  it('ohne je geprobt zu haben → proben', () => {
    expect(probeIstFaellig({ jetzt: 0, letzteProbe: null, ...RUHE })).toBe(true);
  });

  it('ein Tick spaeter (3 s) → NICHT proben (der Kern des Fehlers)', () => {
    expect(probeIstFaellig({ jetzt: 3_000, letzteProbe: 0, ...RUHE })).toBe(false);
  });

  it('nach der vollen Frist → proben', () => {
    expect(probeIstFaellig({ jetzt: PING_INTERVAL_MS, letzteProbe: 0, ...RUHE })).toBe(true);
  });

  it('eine laufende Probe sperrt — auch wenn die Frist laengst um ist', () => {
    expect(probeIstFaellig({ jetzt: 60_000, letzteProbe: 0, laeuft: true, sofort: false })).toBe(false);
  });

  it('Re-Fokus probt sofort, egal wie kurz die letzte Probe her ist', () => {
    // Die Zusage der Datei: nach dem Zurueckschalten ist der Status am ehesten
    // veraltet (waehrend `document.hidden` lief kein Poll).
    expect(probeIstFaellig({ jetzt: 1_000, letzteProbe: 0, laeuft: false, sofort: true })).toBe(true);
  });

  it('Re-Fokus stapelt nicht auf eine laufende Probe', () => {
    // Sonst waere schnelles Tab-Wechseln ein zweiter Weg zum Proben-Stau.
    expect(probeIstFaellig({ jetzt: 1_000, letzteProbe: 0, laeuft: true, sofort: true })).toBe(false);
  });

  it('die Frist ist 15 s — fuenf Takte, wie die Datei sie beschreibt', () => {
    expect(PING_INTERVAL_MS).toBe(15_000);
  });

  // Live gemessen: die Probe kam durchgehend nach 18 s statt nach 15 s, weil
  // `letzteProbe` ein paar Millisekunden NACH dem Tick gesetzt wird — der Tick
  // 15 s spaeter verfehlt die Frist damit immer knapp. Eine halbe Tick-Breite
  // Nachsicht macht die zugesagten 15 s wahr.
  it('der Tick auf der Frist zaehlt, auch wenn ihm ein paar Millisekunden fehlen', () => {
    expect(probeIstFaellig({ jetzt: 14_999, letzteProbe: 0, ...RUHE })).toBe(true);
  });

  it('der Tick DAVOR (12 s) zaehlt nicht — die Nachsicht oeffnet kein Raster frueher', () => {
    expect(probeIstFaellig({ jetzt: 12_001, letzteProbe: 0, ...RUHE })).toBe(false);
  });
});
