/**
 * `isFixtureSchemaId` erkennt Dev-Seed-Fixture-Schemas (docs/fixtures/schema-*.ts)
 * am gemeinsamen ID-Präfix `fixture-real-`. Genutzt vom Auto-Refresh-Gate in
 * csv-source-handle.ts, damit Fixtures nie als Update-Kandidat gegen eine echte
 * Share-CSV vorgeschlagen werden (würde sonst das 14-Zeilen-Sample mit ~42k
 * Echt-Zeilen überschreiben).
 */
import { describe, it, expect } from 'vitest';
import { isFixtureSchemaId, FIXTURE_SCHEMA_ID_PREFIX } from '../fixture-ids';

describe('isFixtureSchemaId', () => {
  it('erkennt die drei Seed-Fixture-Schemas', () => {
    expect(isFixtureSchemaId('fixture-real-anb')).toBe(true);
    expect(isFixtureSchemaId('fixture-real-bgl')).toBe(true);
    expect(isFixtureSchemaId('fixture-real-prjbsp')).toBe(true);
  });

  it('ignoriert echte importierte Quellen (slugifizierte Real-Namen)', () => {
    expect(isFixtureSchemaId('9052-prjbsp-aitisigpt')).toBe(false);
    expect(isFixtureSchemaId('9097-anb-aitisigpt')).toBe(false);
    expect(isFixtureSchemaId('7737-bg1')).toBe(false);
  });

  it('das Präfix ist die Konvention', () => {
    expect(FIXTURE_SCHEMA_ID_PREFIX).toBe('fixture-real-');
    expect(isFixtureSchemaId(`${FIXTURE_SCHEMA_ID_PREFIX}xyz`)).toBe(true);
    expect(isFixtureSchemaId('')).toBe(false);
  });
});
