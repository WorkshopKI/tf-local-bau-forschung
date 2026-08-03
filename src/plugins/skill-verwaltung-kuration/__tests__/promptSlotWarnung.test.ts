/**
 * Der teure Fehlalarm wäre „meldet bei jedem Bestands-Skill" — deshalb prüft der
 * Test vor allem, WANN nicht gewarnt wird.
 */
import { describe, it, expect } from 'vitest';
import { pruefeSlotAenderung } from '../promptSlotWarnung';

const MIT_VB = 'Schreibe Abschnitt A.\n\n{{stammdaten}}\n\n{{vbMarkdown}}\n\nAntworte knapp.';

describe('pruefeSlotAenderung', () => {
  it('meldet den entfernten VB-Slot samt Folge', () => {
    const r = pruefeSlotAenderung(MIT_VB, MIT_VB.replace('{{vbMarkdown}}', ''));
    expect(r.entfernteSlots).toEqual(['vbMarkdown']);
    expect(r.vbVerloren).toBe(true);
  });

  it('behandelt {{vbRelevant}} als VB-tragend', () => {
    const vorher = 'x {{vbRelevant}} y';
    expect(pruefeSlotAenderung(vorher, 'x y').vbVerloren).toBe(true);
  });

  it('schweigt, wenn nur die Prosa geändert wurde', () => {
    const r = pruefeSlotAenderung(MIT_VB, MIT_VB.replace('Antworte knapp.', 'Antworte ausführlich.'));
    expect(r.entfernteSlots).toEqual([]);
    expect(r.vbVerloren).toBe(false);
    expect(r.kipptAufInhaltsfrei).toBe(false);
  });

  it('schweigt, wenn ein Slot HINZUKOMMT', () => {
    const r = pruefeSlotAenderung('x {{vbMarkdown}}', 'x {{vbMarkdown}} {{vorherigeAbschnitte}}');
    expect(r.entfernteSlots).toEqual([]);
  });

  it('meldet KEINE unbekannten Platzhalter (nur Inhalts-Slots zählen)', () => {
    // `{{ueberschrift}}` ist kein Inhalts-Slot der Transport-Policy — sein
    // Verschwinden ist eine Formatierungsfrage, keine Warnung.
    const r = pruefeSlotAenderung('{{ueberschrift}} {{vbMarkdown}}', '{{vbMarkdown}}');
    expect(r.entfernteSlots).toEqual([]);
  });

  it('kipptAufInhaltsfrei nur beim echten true→false-Wechsel', () => {
    // Vorher UND nachher inhaltsfrei → kein Wechsel.
    expect(pruefeSlotAenderung('nur Prosa', 'andere Prosa').kipptAufInhaltsfrei).toBe(false);
    // Ein weiterer Inhalts-Slot bleibt stehen → die Ableitung hält weiter.
    expect(pruefeSlotAenderung(MIT_VB, MIT_VB.replace('{{vbMarkdown}}', '')).kipptAufInhaltsfrei).toBe(false);
    // Letzter Inhalts-Slot weg → jetzt kippt sie.
    expect(pruefeSlotAenderung('{{vbMarkdown}} Text', 'Text').kipptAufInhaltsfrei).toBe(true);
  });

  it('zählt einen mehrfach genutzten Slot nur einmal', () => {
    const r = pruefeSlotAenderung('{{vbMarkdown}} … {{vbMarkdown}}', 'ohne');
    expect(r.entfernteSlots).toEqual(['vbMarkdown']);
  });

  it('ist bei identischen Texten still', () => {
    const r = pruefeSlotAenderung(MIT_VB, MIT_VB);
    expect(r).toEqual({ entfernteSlots: [], vbVerloren: false, kipptAufInhaltsfrei: false });
  });
});
