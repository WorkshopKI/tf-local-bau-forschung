import { describe, it, expect } from 'vitest';
import { baueKiCta, baueStepper, NEU_AUFBEREITEN_TITEL } from '../uebersicht';
import type { BausteinUiStatus } from '../useAufbereitung';

const st = (status: BausteinUiStatus) => ({ status });

describe('baueKiCta', () => {
  it('nichts gelaufen → voller Lauf angeboten', () => {
    const cta = baueKiCta(['fehlt', 'fehlt', 'fehlt'], { agentisch: false });
    expect(cta.offen).toBe(3);
    expect(cta.label).toBe('Mit KI aufbereiten');
    expect(cta.titel).toContain('alle KI-Abschnitte');
    expect(cta.titel).toContain('Standard-KI');
  });

  it('teilweise gelaufen → benennt die Zahl der fehlenden Abschnitte', () => {
    const cta = baueKiCta(['fehlt', 'ok', 'ok', 'degradiert', 'ok', 'fehler'], { agentisch: false });
    expect(cta.offen).toBe(1);
    expect(cta.label).toBe('Fehlende KI-Abschnitte starten (1)');
    // Der Kern des Missverständnisses: fertige Abschnitte laufen NICHT erneut.
    expect(cta.titel).toContain('Zwischenspeicher');
  });

  it('alles gelaufen → verweist auf „neu berechnen" statt einen Leerlauf zu versprechen', () => {
    const cta = baueKiCta(['ok', 'ok', 'degradiert'], { agentisch: false });
    expect(cta.offen).toBe(0);
    expect(cta.label).toBe('Mit KI aufbereiten');
    expect(cta.titel).toContain('neu berechnen');
  });

  it('laufende Bausteine zählen nicht als offen (der Lauf holt sie gerade)', () => {
    expect(baueKiCta(['laeuft', 'ok', 'ok'], { agentisch: false }).offen).toBe(0);
  });

  it('agentisches Ziel wird im Tooltip benannt', () => {
    expect(baueKiCta(['fehlt', 'fehlt'], { agentisch: true }).titel).toContain('agentische KI');
  });

  it('leere Liste (Stepper noch ohne Schritte) → kein Sonderfall-Absturz', () => {
    const cta = baueKiCta([], { agentisch: false });
    expect(cta.offen).toBe(0);
    expect(cta.label).toBe('Mit KI aufbereiten');
  });
});

describe('NEU_AUFBEREITEN_TITEL', () => {
  it('sagt ausdrücklich, dass keine KI läuft', () => {
    expect(NEU_AUFBEREITEN_TITEL).toContain('ohne KI');
  });
});

describe('baueStepper', () => {
  it('hält die Lauf-Reihenfolge (Recherche-Auftrag zuerst)', () => {
    const schritte = baueStepper({
      recherchePrompt: st('fehlt'), aspekte: st('ok'), steckbrief: st('ok'),
      zahlen: st('ok'), glossar: st('ok'), verwertung: st('ok'),
    });
    expect(schritte.map(s => s.key)).toEqual([
      'recherchePrompt', 'aspekte', 'steckbrief', 'zahlen', 'glossar', 'verwertung',
    ]);
    expect(schritte[0]?.tabId).toBe('recherche');
  });

  it('ohne Recherche-Baustein entfällt der Schritt (statt leer zu erscheinen)', () => {
    const schritte = baueStepper({
      aspekte: st('ok'), steckbrief: st('ok'), zahlen: st('ok'), glossar: st('ok'), verwertung: st('ok'),
    });
    expect(schritte).toHaveLength(5);
    expect(schritte.some(s => s.key === 'recherchePrompt')).toBe(false);
  });
});
