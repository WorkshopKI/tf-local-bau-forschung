import { describe, it, expect } from 'vitest';
import { classifyFkz, resolveFkz } from '../dokumentAufnahmeFkz';

describe('classifyFkz — FKZ-Zuordnung der Aufnahmefläche (Verbund-Ebene)', () => {
  // Verbund mit zwei Teilvorhaben.
  const KNOWN = ['16EP034512', '16EP034513'];

  it('(a) FKZ im Dateinamen gehört zu einem TV des Verbundes → match', () => {
    const r = classifyFkz('16EP034512_Vorhabensbeschreibung_v3.pdf', KNOWN);
    expect(r.detectedFkz).toBe('16EP034512');
    expect(r.fkzCase).toBe('match');
  });

  it('(a) auch ein anderes TV-FKZ desselben Verbundes zählt als match', () => {
    expect(classifyFkz('16EP034513_VB.pdf', KNOWN).fkzCase).toBe('match');
  });

  it('(b) FKZ erkannt, gehört zu keinem TV des Verbundes → other', () => {
    const r = classifyFkz('16KN065210_Stellungnahme.pdf', KNOWN);
    expect(r.detectedFkz).toBe('16KN065210');
    expect(r.fkzCase).toBe('other');
  });

  it('(c) kein FKZ im Dateinamen → none', () => {
    const r = classifyFkz('Vorhabensbeschreibung_final.pdf', KNOWN);
    expect(r.detectedFkz).toBeNull();
    expect(r.fkzCase).toBe('none');
  });

  it('ungebundener Modus (leere Liste): jedes erkannte FKZ gilt als match', () => {
    expect(classifyFkz('16DS112233_doc.pdf', []).fkzCase).toBe('match');
  });

  it('resolveFkz kanonisiert ein Aktenzeichen zur FKZ-Form', () => {
    expect(resolveFkz('16EP034512')).toBe('16EP034512');
  });
});
