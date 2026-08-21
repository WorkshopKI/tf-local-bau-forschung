import { describe, it, expect } from 'vitest';
import { baueKiCta, baueStepper, kiVerbindungsHinweis, zeigtTabLink, NEU_AUFBEREITEN_TITEL } from '../uebersicht';
import type { BausteinUiStatus } from '../useAufbereitung';

const st = (status: BausteinUiStatus) => ({ status });

describe('baueKiCta', () => {
  it('nichts gelaufen → voller Lauf angeboten', () => {
    const cta = baueKiCta(['fehlt', 'fehlt', 'fehlt'], { stark: false });
    expect(cta.offen).toBe(3);
    expect(cta.label).toBe('Mit KI aufbereiten');
    expect(cta.titel).toContain('alle KI-Abschnitte');
    expect(cta.titel).toContain('gpt-oss-120b');
  });

  it('teilweise gelaufen → benennt die Zahl der fehlenden Abschnitte', () => {
    const cta = baueKiCta(['fehlt', 'ok', 'ok', 'degradiert', 'ok', 'fehler'], { stark: false });
    expect(cta.offen).toBe(1);
    expect(cta.label).toBe('Fehlende KI-Abschnitte starten (1)');
    // Der Kern des Missverständnisses: fertige Abschnitte laufen NICHT erneut.
    expect(cta.titel).toContain('Zwischenspeicher');
  });

  it('alles gelaufen → verweist auf „neu berechnen" statt einen Leerlauf zu versprechen', () => {
    const cta = baueKiCta(['ok', 'ok', 'degradiert'], { stark: false });
    expect(cta.offen).toBe(0);
    expect(cta.label).toBe('Mit KI aufbereiten');
    expect(cta.titel).toContain('neu berechnen');
  });

  it('laufende Bausteine zählen nicht als offen (der Lauf holt sie gerade)', () => {
    expect(baueKiCta(['laeuft', 'ok', 'ok'], { stark: false }).offen).toBe(0);
  });

  it('agentisches Ziel wird im Tooltip benannt', () => {
    expect(baueKiCta(['fehlt', 'fehlt'], { stark: true }).titel).toContain('Qwen3.6-35B');
  });

  it('leere Liste (Stepper noch ohne Schritte) → kein Sonderfall-Absturz', () => {
    const cta = baueKiCta([], { stark: false });
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

describe('kiVerbindungsHinweis', () => {
  it('verbunden → kein Hinweis', () => {
    expect(kiVerbindungsHinweis({ status: 'connected', bridgeAktiv: true })).toBeNull();
  });

  it('getrennt → benennt den Zustand VOR dem Klick und verspricht das Verbinden', () => {
    const h = kiVerbindungsHinweis({ status: 'disconnected', bridgeAktiv: true });
    expect(h).toContain('getrennt');
    expect(h).toContain('Verbinden');
  });

  it('noch nie verbunden → eigener Wortlaut (kein falsches „getrennt")', () => {
    expect(kiVerbindungsHinweis({ status: 'unknown', bridgeAktiv: true })).toContain('noch nicht verbunden');
  });

  it('Lauf geht nicht über die Bridge → Bridge-Zustand ist belanglos', () => {
    expect(kiVerbindungsHinweis({ status: 'disconnected', bridgeAktiv: false })).toBeNull();
  });
});

describe('zeigtTabLink', () => {
  it('Ergebnis vorhanden → Link zum Tab', () => {
    expect(zeigtTabLink('ok')).toBe(true);
    expect(zeigtTabLink('degradiert')).toBe(true);
  });

  it('Fehler → KEIN Link: dort steht kein Ergebnis, nur dieselbe Wiederholen-Seite', () => {
    expect(zeigtTabLink('fehler')).toBe(false);
  });

  it('noch nicht gelaufen / läuft → kein Link', () => {
    expect(zeigtTabLink('fehlt')).toBe(false);
    expect(zeigtTabLink('laeuft')).toBe(false);
  });
});
