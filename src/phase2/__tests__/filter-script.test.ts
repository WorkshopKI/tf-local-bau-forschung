import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const scriptPath = path.join(repoRoot, 'scripts', 'filter-dms-csv.mjs');
const sampleCsv = path.join(repoRoot, 'docs', 'phase-2', 'dms-sample.csv');

describe('scripts/filter-dms-csv.mjs', () => {
  it('filtert die Sample-CSV auf 6 erlaubte FKZ-Zeilen', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'fkz-filter-'));
    const out = path.join(tmpDir, 'filtered.csv');
    const r = spawnSync('node', [scriptPath, sampleCsv, out], {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(r.status, `stderr: ${r.stderr}\nstdout: ${r.stdout}`).toBe(0);
    expect(existsSync(out)).toBe(true);

    const filtered = readFileSync(out, 'utf-8');
    const dataLines = filtered.split('\n').slice(1).filter(l => l.trim().length > 0);
    // 6 von 10 Zeilen haben einen 16(EP|KN|DS|DL)\d{6}-Treffer
    expect(dataLines.length).toBe(6);

    // Output muss die Zusatzspalte extracted_fkz haben
    expect(filtered.split('\n')[0]).toContain('extracted_fkz');

    // Summary muss sinnvoll sein
    expect(r.stdout).toMatch(/rows_kept:\s*6/);
    expect(r.stdout).toMatch(/16KN: 6/);
  });

  it('ehrt --prefixes-Parameter', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'fkz-filter-'));
    const out = path.join(tmpDir, 'filtered.csv');
    // Nur 16EP erlauben → 0 Treffer in der Sample-CSV
    const r = spawnSync('node', [scriptPath, sampleCsv, out, '--prefixes', '16EP'], {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/rows_kept:\s*0/);
  });

  it('exit code != 0 bei fehlender Eingabe', () => {
    const r = spawnSync('node', [scriptPath, '/nonexistent/input.csv', '/tmp/out.csv'], {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    expect(r.status).not.toBe(0);
  });
});
