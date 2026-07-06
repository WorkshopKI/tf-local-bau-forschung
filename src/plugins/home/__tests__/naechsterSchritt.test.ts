import { describe, it, expect } from 'vitest';
import { naechsterSchritt } from '../naechsterSchritt';

describe('naechsterSchritt — gemappte Roh-Stati (Kern-Tabelle)', () => {
  const cases: Array<[string, string, string]> = [
    // status, phase, aktion
    ['beantragt', 'Eingang', 'Vollständigkeit prüfen'],
    ['bearbeitungsreif', 'Eingang', 'Vollständigkeit prüfen'],
    ['NL eingegangen', 'Vollständigkeit', 'Nachlieferung prüfen'],
    ['VN geprüft', 'Fachprüfung', 'Gutachten beginnen'],
    ['VN techn. geprüft', 'Fachprüfung', 'Gutachten beginnen'],
    ['techn geprüft', 'Fachprüfung', 'Gutachten beginnen'],
    ['kaufm geprüft', 'Fachprüfung', 'Gutachten beginnen'],
    ['Gutachten fertig', 'Fachprüfung', 'Gutachten freigeben'],
    ['bewilligungsreif', 'Fachprüfung', 'Bewilligung vorbereiten'],
    ['ablehnungsreif', 'Fachprüfung', 'Ablehnungsbescheid erstellen'],
    ['NF gestellt', 'Nachforderung', 'Nachforderung nachhalten'],
    ['keine weiteren NF', 'Nachforderung', 'Nachforderung nachhalten'],
  ];

  it.each(cases)('%s → %s → %s', (status, phase, aktion) => {
    expect(naechsterSchritt(status)).toEqual({ phase, aktion });
  });

  it('trimmt Whitespace vor dem Lookup', () => {
    expect(naechsterSchritt('  beantragt  ')).toEqual({ phase: 'Eingang', aktion: 'Vollständigkeit prüfen' });
  });
});

describe('naechsterSchritt — Fallback (nicht gemappt, aber gesetzt)', () => {
  it('nutzt getStatusLabel als Phase, aktion bleibt leer (keine erratene Aktion)', () => {
    // 'bewilligt' ist kein Bearbeitungs-Schritt, hat aber ein Status-Label.
    expect(naechsterSchritt('bewilligt')).toEqual({ phase: 'Bewilligt', aktion: '' });
  });

  it('völlig unbekannter Status → Roh-Wert als Phase, aktion leer', () => {
    expect(naechsterSchritt('irgendwas-neues')).toEqual({ phase: 'irgendwas-neues', aktion: '' });
  });
});

describe('naechsterSchritt — leerer/fehlender Status → null', () => {
  it('undefined → null', () => {
    expect(naechsterSchritt(undefined)).toBeNull();
  });
  it('null → null', () => {
    expect(naechsterSchritt(null)).toBeNull();
  });
  it('leerer String → null', () => {
    expect(naechsterSchritt('')).toBeNull();
  });
  it('nur Whitespace → null', () => {
    expect(naechsterSchritt('   ')).toBeNull();
  });
});
