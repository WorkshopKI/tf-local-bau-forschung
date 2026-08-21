/**
 * `hatWidgetDetailConfig` ist die EINZIGE Wahrheit dafür, ob ein Widget ein
 * Detail-Formular (Menü-Eintrag „Widget-Einstellungen" + aufklappbare
 * Einstellungs-Zeile) hat. Nur Kanban, Ampel und „Änderungen der letzten Nacht"
 * (v4.135); alle anderen Typen bekommen beides nicht.
 *
 * Zusätzlich Source-Scan-Guards: das Widget-Menü zeigt den Eintrag NUR über
 * dieses Prädikat, und die Einstellungs-Sektion nutzt DIESELBE Funktion. Bis
 * v4.5 hing die Schnellanpassung an einem Stift in der `WidgetShell` — der ist
 * mit v4.6 dem `⋯`-Menü gewichen, das Prädikat blieb dasselbe.
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
const NACHTLAUF: WidgetSpezifischeConfig = {
  art: 'nachtlauf', maxZeilen: 10, rueckblickTage: 0, maxKuerzel: 3,
  sortierung: 'anzahl', fusszeilen: true, ausschnitt: 'chip',
};
const OHNE: WidgetSpezifischeConfig[] = [
  { art: 'notizen' },
  { art: 'feedback-news', maxEintraege: 3 },
  { art: 'auslastung', sicht: 'auto' },
  { art: 'qs-freigaben', maxZeilen: 4 },
  { art: 'registry-aenderungen', maxEintraege: 3 },
  { art: 'keine' },
];

describe('hatWidgetDetailConfig', () => {
  it('true für Kanban (beide Quellen), Ampel und Nachtlauf', () => {
    expect(hatWidgetDetailConfig(KANBAN_ANTRAEGE)).toBe(true);
    expect(hatWidgetDetailConfig(KANBAN_FEEDBACK)).toBe(true);
    expect(hatWidgetDetailConfig(AMPEL)).toBe(true);
    expect(hatWidgetDetailConfig(NACHTLAUF)).toBe(true);
  });

  it('false für alle Widgets ohne Regler', () => {
    for (const cfg of OHNE) {
      expect(hatWidgetDetailConfig(cfg)).toBe(false);
    }
  });
});

describe('Einstellungs-Eintrag — eine Wahrheit', () => {
  const SRC = join(__dirname, '..', '..', '..', '..');

  it('Das Widget-Menü gated „Widget-Einstellungen" über hatWidgetDetailConfig', () => {
    const menue = readFileSync(join(SRC, 'plugins', 'home', 'anpassen', 'WidgetMenue.tsx'), 'utf-8');
    expect(menue).toContain('hatWidgetDetailConfig(instanz.config)');
    // Kein Platzhalter-Eintrag, der ein „keine Einstellungen"-Panel öffnet.
    expect(menue).not.toContain('folgt in einer späteren Version');
  });

  // Die Einstellungs-Seite heisst seit v4.30 `darstellung/WidgetsGruppe.tsx`
  // (Redesign `einstellungen-zweispaltig`) — vorher WidgetsSettingsSection.tsx.
  it('Die Widget-Gruppe der Einstellungen nutzt dieselbe Funktion aus ../types', () => {
    const settings = readFileSync(join(SRC, 'plugins', 'einstellungen', 'darstellung', 'WidgetsGruppe.tsx'), 'utf-8');
    expect(settings).toContain('hatWidgetDetailConfig(instanz.config)');
    expect(settings).toContain("from '@/plugins/home/widgets/types'");
  });
});
