import { describe, it, expect } from 'vitest';
import { naechsterSchritt, normalisierePrecheck } from '../naechsterSchritt';

describe('naechsterSchritt — gemappte Roh-Stati (Kern-Tabelle)', () => {
  const cases: Array<[string, string, string]> = [
    // status, phase, aktion
    ['beantragt', 'Eingang', 'Vollständigkeit prüfen'],
    ['bearbeitungsreif', 'Eingang', 'Vollständigkeit prüfen'],
    ['NL eingegangen', 'Vollständigkeit', 'Nachlieferung prüfen'],
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

  it('Begleitphase bekommt KEINE Antragsphasen-Aktion', () => {
    // Ein geprüfter Verwendungsnachweis löst kein Gutachten aus. Der Ablauf
    // nach der Bewilligung ist nicht abgebildet — also nur die Phase.
    for (const status of ['VN geprüft', 'VN techn. geprüft']) {
      expect(naechsterSchritt(status)?.aktion).toBe('');
    }
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

describe('naechsterSchritt — Abwärtskompatibilität des 2. Arguments', () => {
  it('OHNE 2. Argument bleibt das Legacy-Verhalten erhalten (kein „PreCheck durchführen")', () => {
    // Kein PreCheck-Kontext ⇒ Status-Regel greift unverändert.
    expect(naechsterSchritt('beantragt')).toEqual({ phase: 'Eingang', aktion: 'Vollständigkeit prüfen' });
  });
});

describe('naechsterSchritt — PreCheck-Regeln (2. Argument gesetzt)', () => {
  // PreCheck fehlt/ausstehend UND früher Status ⇒ „PreCheck durchführen".
  const durchfuehren: Array<[string, string | null]> = [
    ['beantragt', ''],                    // ohne
    ['beantragt', null],                  // ohne (explizit null)
    ['beantragt', 'PreCheck ausstehend'], // offen/pending
    ['bearbeitungsreif', ''],
  ];
  it.each(durchfuehren)('%s + precheck=%o → PreCheck durchführen', (status, pc) => {
    expect(naechsterSchritt(status, pc)).toEqual({ phase: 'Eingang', aktion: 'PreCheck durchführen' });
  });

  it('positiver PreCheck fällt auf die Status-Regel zurück (Eingang → Vollständigkeit prüfen)', () => {
    // Mockup: AIRES (Eingang, PreCheck positiv) → „Vollständigkeit prüfen".
    expect(naechsterSchritt('beantragt', 'PreCheck positiv - Verbund'))
      .toEqual({ phase: 'Eingang', aktion: 'Vollständigkeit prüfen' });
  });

  it('negativer PreCheck (nicht-terminal) → PreCheck-Ergebnis klären', () => {
    expect(naechsterSchritt('beantragt', 'PreCheck negativ'))
      .toEqual({ phase: 'Eingang', aktion: 'PreCheck-Ergebnis klären' });
  });

  it('negativer PreCheck greift auch bei fortgeschrittenem, nicht-terminalem Status', () => {
    expect(naechsterSchritt('Gutachten fertig', 'PreCheck negativ'))
      .toEqual({ phase: 'Eingang', aktion: 'PreCheck-Ergebnis klären' });
  });

  it('„durchführen" NUR in der Eingangs-Phase — fortgeschrittener Status ohne PreCheck fällt auf die Status-Regel zurück', () => {
    // 'Gutachten fertig' ist Kategorie in_pruefung, nicht 'offen' ⇒ keine durchführen-Regel.
    expect(naechsterSchritt('Gutachten fertig', ''))
      .toEqual({ phase: 'Fachprüfung', aktion: 'Gutachten freigeben' });
  });

  it('Terminal-Status unterdrückt die PreCheck-Regeln (Fallback auf Status-Regel)', () => {
    const negTerminal = naechsterSchritt('Schlussvermerk', 'PreCheck negativ');
    expect(negTerminal?.aktion).toBe('');
    expect(negTerminal?.phase).toBeTruthy();
    const ohneTerminal = naechsterSchritt('abgelehnt/zurückgezogen', '');
    expect(ohneTerminal?.aktion).toBe('');
  });
});

describe('normalisierePrecheck', () => {
  const cases: Array<[string | null | undefined, ReturnType<typeof normalisierePrecheck>]> = [
    ['', 'ohne'],
    [undefined, 'ohne'],
    [null, 'ohne'],
    ['   ', 'ohne'],
    ['PreCheck positiv - Verbund', 'positiv'], // Bindestrich im Label darf NICHT als negativ zählen
    ['pre-check positiv', 'positiv'],
    ['PreCheck negativ', 'negativ'],
    ['PreCheck ausstehend', 'offen'],
    ['D_PC+', 'positiv'],
    ['D_PC-', 'negativ'],
    ['D_PC?', 'offen'],
  ];
  it.each(cases)('%o → %s', (label, expected) => {
    expect(normalisierePrecheck(label)).toBe(expected);
  });
});
