import { describe, it, expect } from 'vitest';
import { parseSchemaJsonl } from '../services/schemaRecovery';

/** Minimaler gültiger Schema-Record (Form wie CsvSchema). */
function schemaLine(id: string, programmId: string): string {
  return JSON.stringify({
    id,
    programm_id: programmId,
    csv_source_name: id,
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: { AKZ: 'aktenzeichen' },
    encoding: 'windows-1252',
    separator: ';',
    created_at: '2026-05-12T14:03:00.123Z',
  });
}

describe('parseSchemaJsonl', () => {
  it('behält gültige Nicht-Fixture-Records des Ziel-Programms', () => {
    const text = [
      schemaLine('7737-bgl', 'default-programm'),
      schemaLine('9052-prjbsp', 'default-programm'),
    ].join('\n') + '\n';

    const r = parseSchemaJsonl(text, 'default-programm');
    expect(r.schemas.map(s => s.id)).toEqual(['7737-bgl', '9052-prjbsp']);
    expect(r.totalLines).toBe(2);
    expect(r.parseErrors).toBe(0);
    expect(r.skippedFixtures).toBe(0);
    expect(r.skippedOtherProgramm).toBe(0);
  });

  it('sondert Fixture-IDs aus (keine Re-Kontamination)', () => {
    const text = [
      schemaLine('7737-bgl', 'default-programm'),
      schemaLine('fixture-real-bgl', 'default-programm'),
    ].join('\n');

    const r = parseSchemaJsonl(text, 'default-programm');
    expect(r.schemas.map(s => s.id)).toEqual(['7737-bgl']);
    expect(r.skippedFixtures).toBe(1);
  });

  it('sondert Records eines anderen Programms aus (nur wenn programmId gesetzt)', () => {
    const text = [
      schemaLine('7737-bgl', 'default-programm'),
      schemaLine('fremd', 'anderes-programm'),
    ].join('\n');

    expect(parseSchemaJsonl(text, 'default-programm').schemas.map(s => s.id)).toEqual(['7737-bgl']);
    expect(parseSchemaJsonl(text, 'default-programm').skippedOtherProgramm).toBe(1);
    // Ohne programmId: alle gültigen Records behalten.
    expect(parseSchemaJsonl(text, null).schemas.map(s => s.id)).toEqual(['7737-bgl', 'fremd']);
  });

  it('zählt kaputte / formfremde Zeilen als parseErrors, ignoriert Leerzeilen', () => {
    const text = [
      schemaLine('7737-bgl', 'default-programm'),
      '{ kaputtes json',
      JSON.stringify({ id: 'ohne-mapping', programm_id: 'default-programm' }), // fehlt column_mapping
      '',
      '   ',
    ].join('\n');

    const r = parseSchemaJsonl(text, 'default-programm');
    expect(r.schemas.map(s => s.id)).toEqual(['7737-bgl']);
    expect(r.totalLines).toBe(3); // Leerzeilen zählen nicht
    expect(r.parseErrors).toBe(2);
  });

  it('leere Datei → leeres Ergebnis', () => {
    const r = parseSchemaJsonl('\n  \n', 'default-programm');
    expect(r.schemas).toEqual([]);
    expect(r.totalLines).toBe(0);
    expect(r.parseErrors).toBe(0);
  });
});
