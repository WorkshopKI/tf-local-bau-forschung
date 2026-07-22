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

/** Beschriftung + Tooltip des KI-CTA (Kopfleiste + Cockpit — eine Quelle). */
export interface KiCta {
  label: string;
  titel: string;
  /** Anzahl noch nicht gelaufener Bausteine (Status `fehlt`). */
  offen: number;
}

/**
 * Was der KI-Knopf tut, hängt am Zustand: mit gefüllten Caches läuft nur der REST.
 * Ohne diese Beschriftung liest sich „Mit KI aufbereiten" bei 5/6 fertigen Bausteinen
 * wie ein minutenlanger Komplettlauf — und der eine fehlende bleibt liegen, weil
 * niemand den Knopf noch einmal drückt. „Neu aufbereiten" hilft dort nicht: es rechnet
 * nur den deterministischen Teil.
 */
export function baueKiCta(status: readonly BausteinUiStatus[], opts: { agentisch: boolean }): KiCta {
  const kiName = opts.agentisch ? 'agentische KI' : 'Standard-KI';
  const offen = status.filter(s => s === 'fehlt').length;
  if (offen > 0 && offen < status.length) {
    return {
      offen,
      label: `Fehlende KI-Abschnitte starten (${offen})`,
      titel: `Startet nur die ${offen} noch nicht gelaufenen Abschnitte über die ${kiName}. Fertige Abschnitte kommen aus dem Zwischenspeicher und laufen NICHT erneut.`,
    };
  }
  if (offen === 0 && status.length > 0) {
    return {
      offen,
      label: 'Mit KI aufbereiten',
      titel: 'Alle KI-Abschnitte liegen vor — ein erneuter Lauf nutzt den Zwischenspeicher. Zum echten Neuberechnen „KI-Bausteine neu berechnen".',
    };
  }
  return {
    offen,
    label: 'Mit KI aufbereiten',
    titel: `Erzeugt alle KI-Abschnitte der Aufbereitung (Recherche-Auftrag, Abdeckung, Steckbrief, Zahlen, Glossar, Verwertung) auf einmal — kein Abschnitt muss einzeln gestartet werden. Läuft über die ${kiName}.`,
  };
}

/**
 * Trägt der Schritt einen „Tab öffnen"-Link? Nur wenn dort auch etwas steht.
 *
 * Bei `fehler` gibt es kein Ergebnis — der Tab zeigt lediglich eine Fehlerseite mit
 * demselben Wiederholen-Knopf, den der Kopf ohnehin hat. Der Link versprach also
 * Inhalt, wo keiner ist; die Ursache steht jetzt als `begruendung` direkt im Schritt.
 */
export function zeigtTabLink(status: BausteinUiStatus): boolean {
  return status === 'ok' || status === 'degradiert';
}

/**
 * Hinweis auf den Verbindungszustand der internen KI — **vor** dem Klick.
 *
 * Der KI-Knopf bleibt bewusst klickbar, auch wenn die interne KI getrennt ist: der
 * Klick ist der Weg zum Verbinden (`kiVerbindungBereit` öffnet den Verbinden-Dialog).
 * Ein deaktivierter Knopf wäre eine Sackgasse — er sagt „geht nicht" und bietet
 * nichts an. Was fehlte, ist die Ansage VOR dem Klick; nur der Sidebar-Punkt trug
 * die Information. `null` = nichts anzeigen (verbunden, oder der Lauf geht gar nicht
 * über die Bridge, dann ist ihr Zustand belanglos).
 */
export function kiVerbindungsHinweis(
  eingabe: { status: 'connected' | 'disconnected' | 'unknown'; bridgeAktiv: boolean },
): string | null {
  if (!eingabe.bridgeAktiv || eingabe.status === 'connected') return null;
  const lage = eingabe.status === 'disconnected' ? 'ist getrennt' : 'ist noch nicht verbunden';
  return `● Interne KI ${lage} — der Klick auf „Mit KI aufbereiten" bietet zuerst das Verbinden an.`;
}

/** Tooltip des deterministischen Knopfs — er ruft ausdrücklich KEINE KI. */
export const NEU_AUFBEREITEN_TITEL =
  'Liest die Dokumente neu ein und rechnet den deterministischen Teil neu (Gliederung, Tabellen, Plausibilität) — ohne KI. Startet keinen KI-Abschnitt und keinen Recherche-Auftrag.';

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
