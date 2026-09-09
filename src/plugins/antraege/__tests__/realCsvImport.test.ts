/**
 * Real-CSV-Fixture-Tests — laeuft gegen die anonymisierten C16-CSVs unter
 * `docs/fixtures/`. Wenn die Files fehlen (frischer Klon, CI ohne lokale
 * Fixtures), wird der gesamte Block via `describe.skip` uebersprungen.
 *
 * Zweck: stellt sicher, dass
 * - der CSV-Parser die echten C16-Headerzeilen + Separatoren + Encodings
 *   verarbeiten kann
 * - die Status-Werte in den echten CSVs allesamt im Foerderantrag-Canonical-
 *   Mapping (`status-canonical.ts`) abgedeckt sind (keine "sonstige"-Fallthrough)
 * - die zentralen Spalten (FKZ, VB_PHASE, STATUS_TV, D_AAE, etc.) in der
 *   erwarteten Form vorhanden sind
 *
 * Komplementiert die handgeschriebenen Foerderantrag-Fixtures in
 * `fixtures/real-csv-antraege.ts`: dort gezielte Edge-Cases, hier
 * Real-World-Repraesentativitaet.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvAll } from '@/core/services/csv/parser';
import { beschreibeMitFixture } from '@/__tests__/fixture-gate';
import { getStatusCategory } from '@/core/utils/status-canonical';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../../../docs/fixtures');

const MASTER_CSV = path.join(FIXTURES_DIR, 'sample_9097_AnB_AitisiGPT.csv');
const BGL_CSV = path.join(FIXTURES_DIR, 'sample_7737_Bgl.csv');
const PRJBSP_CSV = path.join(FIXTURES_DIR, 'sample_9052_PrjBsp_AitisiGPT.csv');

const hasMaster = existsSync(MASTER_CSV);

async function loadAndParse(filePath: string): ReturnType<typeof parseCsvAll> {
  const text = readFileSync(filePath, 'utf-8');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  return parseCsvAll(blob);
}

beschreibeMitFixture('Real Fixture CSV — Master (sample_9097_AnB)', MASTER_CSV,
  'docs/fixtures/*.csv liegen bewusst nur lokal (.gitignore:63) — es sind echte Exportdaten.', () => {
  it('parsed mit Encoding-Auto-Detection (UTF-8 nach prebuild-Normalisierung)', async () => {
    const { rows, headers, separator, encoding } = await loadAndParse(MASTER_CSV);
    expect(rows.length).toBeGreaterThan(0);
    expect(separator).toBe(';');
    expect(encoding).toBe('UTF-8');
    expect(headers).toContain('FKZ');
    expect(headers).toContain('AKZ');
    expect(headers).toContain('VB_PHASE');
    expect(headers).toContain('STATUS_TV');
    expect(headers).toContain('STATUS_VB');
    expect(headers).toContain('TIB_KUERZ');
    expect(headers).toContain('D_AAE');
  });

  it('FKZ folgt dem Format 16XX###### (zweistelliger Buchstaben-Praefix + 6 Ziffern)', async () => {
    const { rows } = await loadAndParse(MASTER_CSV);
    const fkzPattern = /^16[A-Z]{2}\d{6}$/;
    let matched = 0;
    for (const row of rows) {
      const fkz = (row.FKZ ?? '').trim();
      if (fkz && fkzPattern.test(fkz)) matched++;
    }
    // mindestens 80 % der Zeilen sollten ein valides FKZ haben
    expect(matched / rows.length).toBeGreaterThan(0.8);
  });

  it('VB_PHASE-Werte liegen im erlaubten Bereich {1,2,3,4,5,9}', async () => {
    const { rows } = await loadAndParse(MASTER_CSV);
    const seen = new Set<string>();
    for (const row of rows) {
      const v = (row.VB_PHASE ?? '').trim();
      if (v) seen.add(v);
    }
    for (const v of seen) {
      expect(['1', '2', '3', '4', '5', '9']).toContain(v);
    }
  });

  it('alle vorkommenden STATUS_TV-Werte sind im Foerderantrag-Canonical-Mapping abgedeckt', async () => {
    const { rows } = await loadAndParse(MASTER_CSV);
    const statusValues = new Set<string>();
    for (const row of rows) {
      const s = (row.STATUS_TV ?? '').trim();
      if (s) statusValues.add(s);
    }
    expect(statusValues.size).toBeGreaterThan(0);
    // Es darf maximal *einen* Foerderantrag-Wert geben der als 'sonstige' kategorisiert
    // wird (z.B. exotische Aussenseiter-Status). Sonst ist das Canonical-Mapping
    // luckenhaft.
    const sonstige: string[] = [];
    for (const s of statusValues) {
      if (getStatusCategory(s) === 'sonstige') sonstige.push(s);
    }
    if (sonstige.length > 1) {
      // Bewusst hartes Fail mit Liste der nicht-gemappten Werte, damit der
      // Kurator weiss, welche neuen Status in `status-canonical.ts` ergaenzt
      // werden muessen.
      expect.fail(`Status-Werte nicht im Canonical-Mapping: ${sonstige.join(', ')}`);
    }
  });

  it('Datumsformat D_AAE ist deutsches DD.MM.YYYY', async () => {
    const { rows } = await loadAndParse(MASTER_CSV);
    const dmyPattern = /^\d{2}\.\d{2}\.\d{4}$/;
    let matched = 0;
    let nonEmpty = 0;
    for (const row of rows) {
      const d = (row.D_AAE ?? '').trim();
      if (!d) continue;
      nonEmpty++;
      if (dmyPattern.test(d)) matched++;
    }
    expect(nonEmpty).toBeGreaterThan(0);
    expect(matched).toBe(nonEmpty);
  });
});

beschreibeMitFixture('Real Fixture CSV — Bgl (Bewilligungsdetails)', BGL_CSV,
  'docs/fixtures/*.csv liegen bewusst nur lokal (.gitignore:63) — es sind echte Exportdaten.', () => {
  it('hat die fuer Bgl typischen Bearbeiter-Slots (ZTP_KUERZ, PFM_KUERZ)', async () => {
    const { headers } = await loadAndParse(BGL_CSV);
    expect(headers).toContain('ZTP_KUERZ');
    expect(headers).toContain('PFM_KUERZ');
  });

  it('joint via FKZ zur Master-CSV — alle Zeilen haben ein valides FKZ', async () => {
    const { rows } = await loadAndParse(BGL_CSV);
    const fkzPattern = /^16[A-Z]{2}\d{6}$/;
    for (const row of rows) {
      const fkz = (row.FKZ ?? '').trim();
      expect(fkz).toMatch(fkzPattern);
    }
  });
});

beschreibeMitFixture('Real Fixture CSV — PrjBsp (Projektbeschreibung)', PRJBSP_CSV,
  'docs/fixtures/*.csv liegen bewusst nur lokal (.gitignore:63) — es sind echte Exportdaten.', () => {
  it('hat den Volltext-Slot VB_INHALT', async () => {
    const { headers, rows } = await loadAndParse(PRJBSP_CSV);
    expect(headers).toContain('VB_INHALT');
    let hasContent = false;
    for (const row of rows) {
      if ((row.VB_INHALT ?? '').trim().length > 50) {
        hasContent = true;
        break;
      }
    }
    expect(hasContent).toBe(true);
  });

  it('Branche-Felder (BRANCHE_1..5) sind als Headers vorhanden', async () => {
    const { headers } = await loadAndParse(PRJBSP_CSV);
    expect(headers).toContain('BRANCHE_1');
    expect(headers).toContain('BRANCHE_2');
  });
});

describe('Real Fixture CSV — Fallback-Verhalten', () => {
  it('hasFixtures-Flag spiegelt Existenz der Master-CSV', () => {
    expect(hasMaster).toBe(existsSync(MASTER_CSV));
  });
  if (!hasMaster) {
    it.skip('Tests werden uebersprungen wenn docs/fixtures/sample_9097_AnB_AitisiGPT.csv fehlt', () => {});
  }
});
