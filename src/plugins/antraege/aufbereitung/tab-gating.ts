/**
 * Reine Tab-Gating-Ableitung des Aufbereitungs-Cockpits (Paket 5, Phase 0).
 *
 * Solange ein KI-Lauf läuft (Minuten), sind die baustein-gebundenen Tabs so lange
 * nicht klickbar, bis IHR Baustein fertig ist (`ok`/`degradiert`/`fehler`) — sonst
 * öffnet der Prüfer eine leere Zwischenansicht. Deterministisch, UI-frei, testbar.
 *
 * Invarianten:
 *  - Wurde noch NIE ein Lauf gestartet (alle Bausteine `fehlt`), bleiben ALLE Tabs
 *    klickbar (jeder Tab hat seinen eigenen Leerzustand mit Start-Button).
 *  - Der gerade offene Tab (`activeTab`) wird NIE unter dem User weggesperrt.
 *  - `uebersicht`/`zeitplan`/`fragen`/`recherche`/`lesemodus` sind immer klickbar
 *    (deterministisch bzw. mit ehrlichen Leerzuständen).
 *  - `fehler` bleibt klickbar (der Tab zeigt den Retry).
 */
import type { AufbereitungTabId } from './AufbereitungTabs';
import type { BausteinUiStatus } from './useAufbereitung';

/** Baustein-Schlüssel (Lauf-Einheiten); `rechercheP rompt` ohne führendes Leerzeichen. */
export type BausteinKey = 'recherchePrompt' | 'aspekte' | 'steckbrief' | 'zahlen' | 'glossar' | 'verwertung';

export type TabZustand = 'aktiv' | 'inaktiv';

export interface TabZustandInfo {
  zustand: TabZustand;
  /** Native-Title bei `inaktiv` (warum nicht klickbar). */
  title?: string;
}

/** Baustein-gebundene Tabs → welcher Baustein-Status sie freischaltet. */
export const TAB_BAUSTEIN_BINDUNG: Partial<Record<AufbereitungTabId, Exclude<BausteinKey, 'recherchePrompt'>>> = {
  abdeckung: 'aspekte',
  steckbrief: 'steckbrief',
  zahlen: 'zahlen',
  glossar: 'glossar',
  verwertung: 'verwertung',
};

/** Immer klickbare Tabs (deterministisch oder mit ehrlichem Leerzustand). */
export const IMMER_AKTIVE_TABS: readonly AufbereitungTabId[] = [
  'uebersicht', 'zeitplan', 'fragen', 'recherche', 'lesemodus',
];

const ALLE_TABS: readonly AufbereitungTabId[] = [
  'uebersicht', 'steckbrief', 'abdeckung', 'zeitplan', 'zahlen',
  'verwertung', 'glossar', 'fragen', 'recherche', 'lesemodus',
];

/** Ein Baustein-Status gilt als „fertig" (schaltet seinen Tab frei). */
export function istBausteinFertig(status: BausteinUiStatus): boolean {
  return status === 'ok' || status === 'degradiert' || status === 'fehler';
}

export interface TabGatingEingang {
  /** Baustein-Status je gebundenem Tab (steckbrief/abdeckung/zahlen/glossar/verwertung). */
  gebundeneTabs: Partial<Record<AufbereitungTabId, BausteinUiStatus>>;
  /** Zusätzliche Baustein-Status ohne eigenen Tab-Gate (z. B. `recherche-prompt`),
   *  die nur für die „nie gelaufen"-Erkennung zählen. */
  weitereStatus?: BausteinUiStatus[];
  /** Aktuell offener Tab — nie sperren. */
  activeTab: AufbereitungTabId;
}

/**
 * Leitet den Klick-Zustand aller Tabs aus den Baustein-Status ab.
 * Vor dem ersten Lauf (alle `fehlt`) → alles klickbar; sonst greift das Gating.
 */
export function deriveTabZustaende(eingang: TabGatingEingang): Record<AufbereitungTabId, TabZustandInfo> {
  const { gebundeneTabs, weitereStatus = [], activeTab } = eingang;
  const alleStatus: BausteinUiStatus[] = [...Object.values(gebundeneTabs), ...weitereStatus];
  const irgendeinGestartet = alleStatus.some(s => s !== 'fehlt');

  const ergebnis = {} as Record<AufbereitungTabId, TabZustandInfo>;
  for (const tab of ALLE_TABS) {
    const status = gebundeneTabs[tab];
    const istGebunden = TAB_BAUSTEIN_BINDUNG[tab] != null && status != null;
    if (!istGebunden) {
      ergebnis[tab] = { zustand: 'aktiv' };
      continue;
    }
    if (!irgendeinGestartet || istBausteinFertig(status as BausteinUiStatus) || tab === activeTab) {
      ergebnis[tab] = { zustand: 'aktiv' };
      continue;
    }
    ergebnis[tab] = {
      zustand: 'inaktiv',
      title: status === 'laeuft' ? 'läuft …' : 'noch nicht aufbereitet',
    };
  }
  return ergebnis;
}
