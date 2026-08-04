/**
 * Die vier katalogfremden Kürzel aus der Fachabstimmung (V6).
 *
 * Die Tabelle ist eine ANTWORT, keine zweite Katalogfassung: sie erklärt genau
 * das, was gefragt wurde, und darf nicht anfangen, nach Muster zu raten. Ein
 * `TTV3` gäbe es im Fachsystem vielleicht — hier ist es unbekannt, bis jemand
 * sagt, was es ist.
 */
import { describe, it, expect } from 'vitest';
import { SONDER_KUERZEL, istTestKuerzel, sonderKuerzel } from '@/core/status/sonderkuerzel';

describe('sonderKuerzel', () => {
  it('findet unabhängig von Schreibweise und Unicode-Form', () => {
    expect(sonderKuerzel('ttv1')?.art).toBe('test');
    expect(sonderKuerzel(' TVB1 ')?.kuerzel).toBe('TVB1');
    expect(sonderKuerzel('ID')?.label).toBe('Rollenvergabe');
  });

  it('rät nicht nach Präfix — ein unbenanntes Kürzel bleibt unbekannt', () => {
    expect(sonderKuerzel('TTV3')).toBeNull();
    expect(sonderKuerzel('TV')).toBeNull();
    expect(sonderKuerzel('IDFA')).toBeNull();   // steht im Katalog, ist kein Sonderfall
  });

  it('nennt nur die Testkürzel als Testkürzel', () => {
    expect(istTestKuerzel('TTV2')).toBe(true);
    expect(istTestKuerzel('ID')).toBe(false);   // Rollenvergabe ist ein echter Vorgang
    expect(istTestKuerzel('AAE')).toBe(false);
  });

  it('führt jedes Kürzel genau einmal und jedes mit Begründung', () => {
    const kuerzel = SONDER_KUERZEL.map(s => s.kuerzel);
    expect(new Set(kuerzel).size).toBe(kuerzel.length);
    expect(SONDER_KUERZEL.every(s => s.label.length > 0 && s.zusatz.includes('V6'))).toBe(true);
  });
});
