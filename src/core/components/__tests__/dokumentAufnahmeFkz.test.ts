import { describe, it, expect } from 'vitest';
import { classifyFkz, resolveAntragFkz } from '../dokumentAufnahmeFkz';

describe('classifyFkz — FKZ-Zuordnung der Aufnahmefläche', () => {
  const AZ = '16EP034512';

  it('(a) FKZ im Dateinamen == aktueller Antrag → match', () => {
    const r = classifyFkz('16EP034512_Vorhabensbeschreibung_v3.pdf', AZ);
    expect(r.detectedFkz).toBe('16EP034512');
    expect(r.fkzCase).toBe('match');
  });

  it('(b) FKZ erkannt, aber anderer Antrag → other', () => {
    const r = classifyFkz('16KN065210_Stellungnahme.pdf', AZ);
    expect(r.detectedFkz).toBe('16KN065210');
    expect(r.fkzCase).toBe('other');
  });

  it('(c) kein FKZ im Dateinamen → none', () => {
    const r = classifyFkz('Vorhabensbeschreibung_final.pdf', AZ);
    expect(r.detectedFkz).toBeNull();
    expect(r.fkzCase).toBe('none');
  });

  it('ungebundener Modus (kein Antrag): erkanntes FKZ gilt als match', () => {
    const r = classifyFkz('16DS112233_doc.pdf');
    expect(r.detectedFkz).toBe('16DS112233');
    expect(r.fkzCase).toBe('match');
  });

  it('resolveAntragFkz extrahiert das FKZ aus dem Aktenzeichen', () => {
    expect(resolveAntragFkz('16EP034512')).toBe('16EP034512');
    expect(resolveAntragFkz(undefined)).toBeNull();
  });
});
