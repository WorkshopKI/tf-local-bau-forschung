import { describe, it, expect } from 'vitest';
import {
  ABDECKUNG_PAUSE_HINWEIS, FRAGEN_PAUSE_HINWEIS,
} from '../pausierte-module';
import { deriveTabZustaende } from '../tab-gating';
import type { BausteinUiStatus } from '../useAufbereitung';

const alleFehlt = (over: Partial<Record<'steckbrief' | 'abdeckung' | 'zahlen' | 'glossar' | 'verwertung', BausteinUiStatus>> = {}) => ({
  steckbrief: 'fehlt' as BausteinUiStatus,
  abdeckung: 'fehlt' as BausteinUiStatus,
  zahlen: 'fehlt' as BausteinUiStatus,
  glossar: 'fehlt' as BausteinUiStatus,
  verwertung: 'fehlt' as BausteinUiStatus,
  ...over,
});

/**
 * Die Lauf-Gating-Fälle laufen bewusst über `zahlen`/`steckbrief`/`glossar` —
 * `abdeckung` ist pausiert und würde die Aussage überdecken (die Pause schlägt
 * jeden Lauf-Zustand).
 */
describe('deriveTabZustaende', () => {
  it('lässt vor dem ersten Lauf (alle fehlt) ALLE nicht-pausierten Tabs klickbar', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'uebersicht' });
    for (const tab of ['uebersicht', 'steckbrief', 'zahlen', 'verwertung', 'glossar', 'recherche', 'lesemodus'] as const) {
      expect(z[tab].zustand).toBe('aktiv');
    }
  });

  it('immer-aktive Tabs bleiben klickbar, auch während ein Lauf läuft', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ zahlen: 'laeuft' }), activeTab: 'uebersicht' });
    for (const tab of ['uebersicht', 'recherche', 'lesemodus'] as const) {
      expect(z[tab].zustand).toBe('aktiv');
    }
  });

  it('sperrt gebundene Tabs, deren Baustein noch nicht fertig ist, sobald ein Lauf läuft', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ zahlen: 'laeuft' }), activeTab: 'uebersicht' });
    expect(z.zahlen.zustand).toBe('inaktiv');
    expect(z.zahlen.title).toBe('läuft …');
    expect(z.steckbrief.zustand).toBe('inaktiv');
    expect(z.steckbrief.title).toBe('noch nicht aufbereitet');
    expect(z.glossar.zustand).toBe('inaktiv');
  });

  it('schaltet einen gebundenen Tab frei, sobald sein Baustein ok/degradiert ist', () => {
    const z = deriveTabZustaende({
      gebundeneTabs: alleFehlt({ glossar: 'ok', steckbrief: 'degradiert', zahlen: 'laeuft' }),
      activeTab: 'uebersicht',
    });
    expect(z.glossar.zustand).toBe('aktiv');
    expect(z.steckbrief.zustand).toBe('aktiv');
    expect(z.zahlen.zustand).toBe('inaktiv');
    expect(z.verwertung.zustand).toBe('inaktiv'); // noch fehlt, aber Lauf hat begonnen
  });

  it('lässt fehler-Tabs klickbar (Retry sichtbar)', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ glossar: 'fehler', steckbrief: 'laeuft' }), activeTab: 'uebersicht' });
    expect(z.glossar.zustand).toBe('aktiv');
  });

  it('sperrt den aktiven Tab NIE unter dem User weg', () => {
    // steckbrief läuft, zahlen ist der offene Tab → bleibt aktiv
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ steckbrief: 'laeuft', zahlen: 'fehlt' }), activeTab: 'zahlen' });
    expect(z.zahlen.zustand).toBe('aktiv');
  });

  it('sperrt die pausierten Tabs dauerhaft — auch vor dem ersten Lauf', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'uebersicht' });
    expect(z.fragen.zustand).toBe('inaktiv');
    expect(z.fragen.title).toBe(FRAGEN_PAUSE_HINWEIS);
    expect(z.abdeckung.zustand).toBe('inaktiv');
    expect(z.abdeckung.title).toBe(ABDECKUNG_PAUSE_HINWEIS);
  });

  it('lässt die Pause den Baustein-Status überstimmen (fertige Abdeckung bleibt gesperrt)', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ abdeckung: 'ok' }), activeTab: 'uebersicht' });
    expect(z.abdeckung.zustand).toBe('inaktiv');
    expect(z.abdeckung.title).toBe(ABDECKUNG_PAUSE_HINWEIS);
  });

  it('lässt die activeTab-Ausnahme die Pausen NICHT aushebeln', () => {
    // Die Ausnahme schützt einen offenen Tab — ein pausierter ist gar nicht erst erreichbar.
    for (const tab of ['fragen', 'abdeckung'] as const) {
      const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: tab });
      expect(z[tab].zustand).toBe('inaktiv');
    }
  });

  it('hält den Zeitplan offen — ohne jede Bedingung (Pause aufgehoben, v6.29)', () => {
    // Er ist an keinen Baustein gebunden und trägt seinen eigenen Leerzustand, wenn der
    // Antrag keinen Arbeitsplan hergibt. Auch ein laufender Baustein sperrt ihn nicht.
    const leer = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'uebersicht' });
    expect(leer.zeitplan.zustand).toBe('aktiv');
    expect(leer.zeitplan.title).toBeUndefined();
    const waehrendLauf = deriveTabZustaende({ gebundeneTabs: alleFehlt({ steckbrief: 'laeuft' }), activeTab: 'uebersicht' });
    expect(waehrendLauf.zeitplan.zustand).toBe('aktiv');
  });

  /**
   * Nach dem Oeffnen einer Seite koennen einzelne Bausteine aus dem Cache
   * zurueckkommen und andere nicht (ein degradierter Lauf wird nicht gecacht).
   * Die nicht gefuellten Tabs muessen klickbar bleiben — ihr Leerzustand traegt
   * den Start-Button.
   */
  it('rehydrierte ok-Bausteine sperren die uebrigen Tabs NICHT', () => {
    const z = deriveTabZustaende({
      gebundeneTabs: alleFehlt({ steckbrief: 'ok', glossar: 'ok' }),
      activeTab: 'uebersicht',
    });
    expect(z.steckbrief.zustand).toBe('aktiv');
    expect(z.glossar.zustand).toBe('aktiv');
    expect(z.zahlen.zustand).toBe('aktiv');
    expect(z.verwertung.zustand).toBe('aktiv');
  });

  it('zählt weitereStatus (z. B. recherche-prompt) für die „nie gelaufen"-Erkennung mit', () => {
    // gebundene alle fehlt, aber recherche-prompt läuft → Gating greift bereits
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), weitereStatus: ['laeuft'], activeTab: 'uebersicht' });
    expect(z.steckbrief.zustand).toBe('inaktiv');
    expect(z.zahlen.zustand).toBe('inaktiv');
  });
});
