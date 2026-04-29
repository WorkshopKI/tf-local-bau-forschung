import { describe, it, expect } from 'vitest';
import { runStage0 } from '../triage/stage0-dms-lookup';
import { parseDmsCsv } from '../dms-csv/loader';
import { buildEffectiveMapping } from '../dms-csv/aktenplan-mapping';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const samplePath = path.resolve(__dirname, '../../../docs/phase-2/dms-sample.csv');
const csv = readFileSync(samplePath, 'utf-8');
const dmsMap = parseDmsCsv(csv);
const aktenplan = buildEffectiveMapping();

describe('runStage0', () => {
  it('matcht Datei mit DMS-Eintrag → relevant', () => {
    const r = runStage0({ filename: 'GLE0P701.PDF', dmsMap, aktenplan });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.result.triage_state).toBe('relevant');
      expect(r.result.doc_type).toBe('gutachten_qs');     // 6.2 QS zur Betreuung
      expect(r.result.extracted_fkz).toBe('16KN093323');
      expect(r.result.creator_kuerzel).toBe('FFDN');
      expect(r.result.source).toBe('dms_csv');
      expect(r.result.triage_stage).toBe(0);
    }
  });

  it('matcht "7 Irrelevante Unterlagen" → irrelevant', () => {
    const r = runStage0({ filename: 'GLE0P601.docx', dmsMap, aktenplan });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.result.triage_state).toBe('irrelevant');
      expect(r.result.doc_type).toBe('irrelevant');
    }
  });

  it('matcht De-minimis-Bescheid → relevant, doc_type=de_minimis', () => {
    const r = runStage0({ filename: 'GLEYL101.msg', dmsMap, aktenplan });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.result.doc_type).toBe('de_minimis');
      expect(r.result.triage_state).toBe('relevant');
    }
  });

  it('case-insensitive Lookup für UPPER-DocIDs', () => {
    const r = runStage0({ filename: 'gleyl401.xlsm', dmsMap, aktenplan });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.result.doc_type).toBe('checkliste');
      expect(r.result.triage_state).toBe('irrelevant');
    }
  });

  it('liefert no_dms_entry bei unbekannter DocID', () => {
    const r = runStage0({ filename: 'UNBEKANNT.pdf', dmsMap, aktenplan });
    expect(r.matched).toBe(false);
    if (!r.matched) {
      expect(r.reason).toBe('no_dms_entry');
    }
  });

  it('Sample-Coverage: ≥ 9 von 10 Zeilen werden korrekt klassifiziert', () => {
    // Eval-Schwelle: alle 10 DMS-Sample-Zeilen ergeben einen DocType
    const docIds = [
      'GLE0P201.MSG', 'GLE0P301.PDF', 'GLE0P401.pdf', 'GLE0P501.DOCX',
      'GLE0P601.docx', 'GLE0P701.PDF', 'GLEYL101.msg', 'GLEYL201.pdf',
      'GLEYL301.pdf', 'GLEYL401.XLSM',
    ];
    let ok = 0;
    for (const id of docIds) {
      const r = runStage0({ filename: id, dmsMap, aktenplan });
      if (r.matched && r.result.doc_type !== 'sonstiges') ok++;
    }
    // 9 / 10 ist die Plan-Schwelle
    expect(ok).toBeGreaterThanOrEqual(9);
  });
});
