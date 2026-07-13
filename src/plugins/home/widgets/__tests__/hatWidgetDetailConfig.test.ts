/**
 * `hatWidgetDetailConfig` ist die EINZIGE Wahrheit dafür, ob ein Widget ein
 * Detail-Formular (Stift-Popover + aufklappbare Einstellungs-Zeile) hat. Nur
 * Kanban + Ampel; alle anderen Typen → kein Stift, keine Aufklapp-Zeile.
 *
 * Zusätzlich Source-Scan-Guards: WidgetShell zeigt den Stift NUR über dieses
 * Prädikat (kein „keine Einstellungen"-Platzhalter-Stift mehr), und die
 * Einstellungs-Sektion nutzt DIESELBE Funktion (eine Wahrheit).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hatWidgetDetailConfig, type WidgetSpezifischeConfig } from '../types';

const KANBAN_ANTRAEGE: WidgetSpezifischeConfig = {
  art: 'kanban', quelle: 'antraege', farbmodus: 'bunt', maxKartenProLane: 4, lanes: [],
};
const KANBAN_FEEDBACK: WidgetSpezifischeConfig = {
  art: 'kanban', quelle: 'feedback', farbmodus: 'monochrom', maxKartenProLane: 4, lanes: [],
};
const AMPEL: WidgetSpezifischeConfig = {
  art: 'ampel', warnschwelleTage: 30, kritischSchwelleTage: 90, zeilenKlickbar: true,
};
const OHNE: WidgetSpezifischeConfig[] = [
  { art: 'notizen' },
  { art: 'feedback-news', maxEintraege: 3 },
  { art: 'auslastung', sicht: 'auto', vergleichAnzeigen: true },
  { art: 'qs-freigaben', maxZeilen: 4 },
  { art: 'registry-aenderungen', maxEintraege: 3 },
  { art: 'keine' },
];

describe('hatWidgetDetailConfig', () => {
  it('true für Kanban (beide Quellen) und Ampel', () => {
    expect(hatWidgetDetailConfig(KANBAN_ANTRAEGE)).toBe(true);
    expect(hatWidgetDetailConfig(KANBAN_FEEDBACK)).toBe(true);
    expect(hatWidgetDetailConfig(AMPEL)).toBe(true);
  });

  it('false für alle Widgets ohne Regler', () => {
    for (const cfg of OHNE) {
      expect(hatWidgetDetailConfig(cfg)).toBe(false);
    }
  });
});

describe('Stift-Sichtbarkeit — eine Wahrheit', () => {
  const SRC = join(__dirname, '..', '..', '..', '..');

  it('WidgetShell gated den Stift über hatWidgetDetailConfig (kein Platzhalter-Stift)', () => {
    const shell = readFileSync(join(SRC, 'plugins', 'home', 'widgets', 'WidgetShell.tsx'), 'utf-8');
    expect(shell).toContain('hatWidgetDetailConfig(instanz.config)');
    // Kein disabled-Pencil-Platzhalter mehr (früher: immer ein Stift im Kopf).
    expect(shell).not.toContain('folgt in einer späteren Version');
  });

  it('WidgetsSettingsSection nutzt dieselbe Funktion aus ../types', () => {
    const settings = readFileSync(join(SRC, 'plugins', 'einstellungen', 'WidgetsSettingsSection.tsx'), 'utf-8');
    expect(settings).toContain('hatWidgetDetailConfig(instanz.config)');
    expect(settings).toContain("from '@/plugins/home/widgets/types'");
  });
});
