import { describe, it, expect } from 'vitest';
import { ZEITPLAN_PAUSE_HINWEIS } from '../pausierte-module';
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

describe('deriveTabZustaende', () => {
  it('lässt vor dem ersten Lauf (alle fehlt) ALLE nicht-pausierten Tabs klickbar', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'uebersicht' });
    for (const tab of ['uebersicht', 'steckbrief', 'abdeckung', 'zahlen', 'verwertung', 'glossar', 'fragen', 'recherche', 'lesemodus'] as const) {
      expect(z[tab].zustand).toBe('aktiv');
    }
  });

  it('immer-aktive Tabs bleiben klickbar, auch während ein Lauf läuft', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ abdeckung: 'laeuft' }), activeTab: 'uebersicht' });
    for (const tab of ['uebersicht', 'fragen', 'recherche', 'lesemodus'] as const) {
      expect(z[tab].zustand).toBe('aktiv');
    }
  });

  it('sperrt gebundene Tabs, deren Baustein noch nicht fertig ist, sobald ein Lauf läuft', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ abdeckung: 'laeuft' }), activeTab: 'uebersicht' });
    // abdeckung läuft → inaktiv; die noch ausstehenden gebundenen Tabs → inaktiv
    expect(z.abdeckung.zustand).toBe('inaktiv');
    expect(z.abdeckung.title).toBe('läuft …');
    expect(z.steckbrief.zustand).toBe('inaktiv');
    expect(z.steckbrief.title).toBe('noch nicht aufbereitet');
    expect(z.zahlen.zustand).toBe('inaktiv');
  });

  it('schaltet einen gebundenen Tab frei, sobald sein Baustein ok/degradiert ist', () => {
    const z = deriveTabZustaende({
      gebundeneTabs: alleFehlt({ abdeckung: 'ok', steckbrief: 'degradiert', zahlen: 'laeuft' }),
      activeTab: 'uebersicht',
    });
    expect(z.abdeckung.zustand).toBe('aktiv');
    expect(z.steckbrief.zustand).toBe('aktiv');
    expect(z.zahlen.zustand).toBe('inaktiv');
    expect(z.glossar.zustand).toBe('inaktiv'); // noch fehlt, aber Lauf hat begonnen
  });

  it('lässt fehler-Tabs klickbar (Retry sichtbar)', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ abdeckung: 'fehler', steckbrief: 'laeuft' }), activeTab: 'uebersicht' });
    expect(z.abdeckung.zustand).toBe('aktiv');
  });

  it('sperrt den aktiven Tab NIE unter dem User weg', () => {
    // zahlen läuft und ist gleichzeitig der offene Tab → bleibt aktiv
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt({ steckbrief: 'laeuft', zahlen: 'fehlt' }), activeTab: 'zahlen' });
    expect(z.zahlen.zustand).toBe('aktiv');
  });

  it('sperrt den pausierten Zeitplan-Tab dauerhaft — auch vor dem ersten Lauf', () => {
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'uebersicht' });
    expect(z.zeitplan.zustand).toBe('inaktiv');
    expect(z.zeitplan.title).toBe(ZEITPLAN_PAUSE_HINWEIS);
  });

  it('lässt die activeTab-Ausnahme die Zeitplan-Pause NICHT aushebeln', () => {
    // Die Ausnahme schützt einen offenen Tab — ein pausierter ist gar nicht erst erreichbar.
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), activeTab: 'zeitplan' });
    expect(z.zeitplan.zustand).toBe('inaktiv');
  });

  it('zählt weitereStatus (z. B. recherche-prompt) für die „nie gelaufen"-Erkennung mit', () => {
    // gebundene alle fehlt, aber recherche-prompt läuft → Gating greift bereits
    const z = deriveTabZustaende({ gebundeneTabs: alleFehlt(), weitereStatus: ['laeuft'], activeTab: 'uebersicht' });
    expect(z.steckbrief.zustand).toBe('inaktiv');
    expect(z.abdeckung.zustand).toBe('inaktiv');
  });
});
