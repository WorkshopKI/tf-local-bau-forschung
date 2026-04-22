/**
 * Vorgefertigte Szenarien für schnellen Zustands-Aufbau im Dev-Build.
 */

import type { StorageService } from '@/core/services/storage';
import { resetAll, ensureSmbHandle, ensureKuratorSession } from './helpers';
import { importTestCsv } from './import';
import { maybeReloadAfterDestructive } from './reloadToast';

export type ScenarioKey =
  | 'frisch'
  | 'kurator-bereit'
  | 'mit-testdaten'
  | 'voll-populiert'
  | 'encoding-tests'
  | 'unterprogramm-vielfalt';

export interface ScenarioDescriptor {
  key: ScenarioKey;
  label: string;
  description: string;
  group: 'basis' | 'spezial';
}

export const SCENARIOS: ScenarioDescriptor[] = [
  {
    key: 'frisch',
    label: 'Frisch',
    description: 'Alle IDB-Stores leeren (SMB-Handle bleibt). Wie erste App-Nutzung nach Setup.',
    group: 'basis',
  },
  {
    key: 'kurator-bereit',
    label: 'Kurator bereit',
    description: 'Reset + SMB-Handle + aktive Kurator-Session (Default-Passwort). Noch keine Daten.',
    group: 'basis',
  },
  {
    key: 'mit-testdaten',
    label: 'Mit Testdaten',
    description: 'Kurator bereit + 3 Mini-CSVs (Stammdaten, Zusammenfassung, Status) — ~20 Anträge.',
    group: 'basis',
  },
  {
    key: 'voll-populiert',
    label: 'Voll populiert',
    description: 'Kurator bereit + Big-Korpus (5000 Anträge + 3000 Deskriptoren) für Performance-Tests.',
    group: 'basis',
  },
  {
    key: 'encoding-tests',
    label: 'Encoding-Tests',
    description: 'DE-Format-CSVs (Windows-1252 + Semikolon, Umlaute, €). Für Encoding-Auto-Detection-Tests.',
    group: 'spezial',
  },
  {
    key: 'unterprogramm-vielfalt',
    label: 'Unterprogramm-Vielfalt',
    description: 'Master-CSV mit 4 Unterprogrammen (40 Anträge). Für Unterprogramm-Wizard- und Filter-Tests.',
    group: 'spezial',
  },
];

export async function applyScenario(storage: StorageService, key: ScenarioKey): Promise<void> {
  const idb = storage.idb;
  const descriptor = SCENARIOS.find(s => s.key === key);
  switch (key) {
    case 'frisch':
      await resetAll(idb);
      break;
    case 'kurator-bereit':
      await resetAll(idb);
      await ensureSmbHandle(idb);
      await ensureKuratorSession(idb);
      break;
    case 'mit-testdaten':
      await resetAll(idb);
      await ensureSmbHandle(idb);
      await ensureKuratorSession(idb);
      await importTestCsv(idb, 'stammdaten-mini');
      await importTestCsv(idb, 'projektzusammenfassung-mini');
      await importTestCsv(idb, 'status-aktive-mini');
      break;
    case 'voll-populiert':
      await resetAll(idb);
      await ensureSmbHandle(idb);
      await ensureKuratorSession(idb);
      await importTestCsv(idb, 'stammdaten-big');
      await importTestCsv(idb, 'deskriptoren-big');
      break;
    case 'encoding-tests':
      await resetAll(idb);
      await ensureSmbHandle(idb);
      await ensureKuratorSession(idb);
      await importTestCsv(idb, 'stammdaten-mini-de');
      await importTestCsv(idb, 'projektzusammenfassung-mini-de');
      await importTestCsv(idb, 'status-aktive-mini-de');
      break;
    case 'unterprogramm-vielfalt':
      await resetAll(idb);
      await ensureSmbHandle(idb);
      await ensureKuratorSession(idb);
      await importTestCsv(idb, 'stammdaten-mit-up');
      break;
    default: {
      const exhaustive: never = key;
      throw new Error(`Unbekanntes Szenario: ${String(exhaustive)}`);
    }
  }
  await maybeReloadAfterDestructive(`Szenario „${descriptor?.label ?? key}" angewendet`);
}
