/**
 * Reines Schritt-Modell des Übersicht-Tabs (Paket 5, Phase 0). Bildet die KI-Bausteine
 * in Lauf-Reihenfolge auf Stepper-Schritte ab (Name + Status + Ziel-Tab). UI-frei/testbar.
 *
 * Reihenfolge = die tatsächliche Lauf-Reihenfolge in `laufBausteine`
 * (`recherche-prompt` zuerst — folgt in Phase 1 — dann Aspekte → Steckbrief →
 * Zahlen → Glossar → Verwertung).
 */
import type { AufbereitungTabId } from './AufbereitungTabs';
import type { BausteinKey } from './tab-gating';
import type { BausteinUiState, BausteinUiStatus } from './useAufbereitung';

export interface StepperSchritt {
  key: BausteinKey;
  label: string;
  /** Ziel-Tab für „Tab öffnen" (null = kein eigener Tab). */
  tabId: AufbereitungTabId | null;
  status: BausteinUiStatus;
  begruendung?: string;
}

/** Baustein-UI-States, die das Cockpit für den Stepper braucht (nur die Statusfelder). */
export interface StepperEingang {
  recherchePrompt?: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
  aspekte: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
  steckbrief: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
  zahlen: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
  glossar: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
  verwertung: Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>;
}

interface SchrittDef {
  key: BausteinKey;
  label: string;
  tabId: AufbereitungTabId | null;
}

/** Lauf-Reihenfolge + Anzeige-Namen + Ziel-Tab. `recherche-prompt` optional (Phase 1). */
const SCHRITT_DEFS: SchrittDef[] = [
  { key: 'recherchePrompt', label: 'Recherche-Auftrag (Deep Research)', tabId: 'recherche' },
  { key: 'aspekte', label: 'Abdeckung (Prüfaspekte)', tabId: 'abdeckung' },
  { key: 'steckbrief', label: 'Steckbrief', tabId: 'steckbrief' },
  { key: 'zahlen', label: 'Zahlen-Inventar', tabId: 'zahlen' },
  { key: 'glossar', label: 'Glossar', tabId: 'glossar' },
  { key: 'verwertung', label: 'Verwertung / Markt', tabId: 'verwertung' },
];

export function baueStepper(eingang: StepperEingang): StepperSchritt[] {
  const states: Partial<Record<BausteinKey, Pick<BausteinUiState<unknown>, 'status' | 'begruendung'>>> = {
    recherchePrompt: eingang.recherchePrompt,
    aspekte: eingang.aspekte,
    steckbrief: eingang.steckbrief,
    zahlen: eingang.zahlen,
    glossar: eingang.glossar,
    verwertung: eingang.verwertung,
  };
  const schritte: StepperSchritt[] = [];
  for (const def of SCHRITT_DEFS) {
    const st = states[def.key];
    if (!st) continue; // recherche-prompt fehlt in Phase 0 → Schritt weglassen
    schritte.push({ key: def.key, label: def.label, tabId: def.tabId, status: st.status, begruendung: st.begruendung });
  }
  return schritte;
}
