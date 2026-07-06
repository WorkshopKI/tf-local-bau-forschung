/**
 * Amtlicher-Status → Stepper-Position (Journey-Paket 2 Phase 6).
 *
 * Deckt alle kanonischen Kategorien (Förderantrag- UND Bauantrag-Domäne) inkl.
 * Terminal-negativ und unbekannter/leerer Eingaben ab. Die Position kommt aus
 * dem amtlichen Status (nicht aus einem WorkflowRun) — Kern-Fix für die frühere
 * `STATUS_TO_STEP`-Lücke, die jeden Förderantrag auf Station 1 fallen ließ.
 */
import { describe, it, expect } from 'vitest';
import { statusZuStepperPosition, STEPPER_STATIONS } from '../statusZuStepperPosition';

describe('statusZuStepperPosition', () => {
  it('Eingang (Station 1): beantragt, neu, eingereicht', () => {
    for (const s of ['beantragt', 'neu', 'eingereicht']) {
      expect(statusZuStepperPosition(s)).toEqual({ station: 1 });
    }
  });

  it('Vollständigkeit (Station 2): bearbeitungsreif, NL eingegangen', () => {
    expect(statusZuStepperPosition('bearbeitungsreif')).toEqual({ station: 2 });
    expect(statusZuStepperPosition('NL eingegangen')).toEqual({ station: 2 });
    // case-insensitive
    expect(statusZuStepperPosition('nl eingegangen')).toEqual({ station: 2 });
  });

  it('Fachprüfung (Station 3): Prüfung / Nachforderung / Entscheidung', () => {
    for (const s of [
      'techn geprüft', 'kaufm geprüft', 'Gutachten fertig', // in_pruefung
      'in_pruefung', 'in_begutachtung', 'in_bearbeitung',    // Bauantrag → in_pruefung
      'NF gestellt', 'keine weiteren NF',                     // nachforderung
      'bewilligungsreif', 'ablehnungsreif', 'Ablehnung',      // entscheidung
    ]) {
      expect(statusZuStepperPosition(s)).toEqual({ station: 3 });
    }
  });

  it('Bewilligung (Station 4): bewilligt/genehmigt + Begleitphase (VN/ZB/Widerruf)', () => {
    // Widerruf/Anhörung sind Post-Bewilligungs-Verfahren → Kategorie begleitung.
    for (const s of ['bewilligt', 'genehmigt', 'VN geprüft', 'VN techn. geprüft', 'ZB eingegangen', 'Widerruf', 'Anhörung zum Widerruf']) {
      expect(statusZuStepperPosition(s)).toEqual({ station: 4 });
    }
  });

  it('Schluss (Station 5): Schlussvermerk, beendet, abgebrochen, archiviert', () => {
    for (const s of ['Schlussvermerk', 'beendet', 'abgebrochen', 'archiviert', 'abgeschlossen']) {
      expect(statusZuStepperPosition(s)).toEqual({ station: 5 });
    }
  });

  it('Terminal-negativ: Abbruch an Station 3 mit terminal-Flag', () => {
    // Bauantrag-Domäne: eigener `abgelehnt`-Endzustand
    expect(statusZuStepperPosition('abgelehnt')).toEqual({ station: 3, terminal: 'abgelehnt' });
    // Förderantrag-Domäne: `abgelehnt/zurückgezogen` (Kategorie abgeschlossen)
    expect(statusZuStepperPosition('abgelehnt/zurückgezogen')).toEqual({ station: 3, terminal: 'zurueckgezogen' });
  });

  it('abgelehnt/zurückgezogen schlägt das abgeschlossen→5-Mapping (Terminal-Check zuerst)', () => {
    const pos = statusZuStepperPosition('abgelehnt/zurückgezogen');
    expect(pos.station).toBe(3);
    expect(pos.terminal).toBeDefined();
  });

  it('Unbekannt / leer / null → Station 1 (Fallback), kein terminal', () => {
    for (const s of ['Irrläufer', 'unvollständig', 'völlig unbekannt', '', '   ', null, undefined, 42]) {
      expect(statusZuStepperPosition(s as unknown)).toEqual({ station: 1 });
    }
  });

  it('jede Station bleibt im gültigen 1..STEPPER_STATIONS-Bereich', () => {
    for (const s of ['beantragt', 'bearbeitungsreif', 'NF gestellt', 'bewilligt', 'Schlussvermerk', 'abgelehnt']) {
      const { station } = statusZuStepperPosition(s);
      expect(station).toBeGreaterThanOrEqual(1);
      expect(station).toBeLessThanOrEqual(STEPPER_STATIONS.length);
    }
  });
});
