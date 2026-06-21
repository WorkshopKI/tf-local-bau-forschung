import { describe, it, expect } from 'vitest';
import { toJson, toCsv, toHtml, escapeHtml } from '../report';
import { aggregate } from '../aggregate';
import type { EvalRunResult, JudgeResult } from '../types';
import type { StepId } from '@/plugins/antraege/gutachten/types';

function run(abschnitt: StepId, modellId: string, finalerText: string): EvalRunResult {
  return {
    vbFile: 'f.md',
    modellId,
    abschnitt,
    skillId: 'gutachten-x',
    raw: finalerText,
    parsed: { quellenanalyse: '', entwurf: '', finalerText },
    checks: [{ id: 'c0', level: 'ok', label: 'ok', regelId: 'c0' }],
    dauerMs: 1,
  };
}

function judge(abschnitt: StepId, modellId: string, pv: string): JudgeResult {
  return {
    vbFile: 'f.md', modellId, abschnitt,
    fachliche_korrektheit: 4, vollstaendigkeit: 4, sprachqualitaet: 4, regeltreue: 4,
    begruendung: 'ok', prompt_verbesserung: pv,
  };
}

describe('toCsv', () => {
  it('Header + eine Zeile je Zelle', () => {
    const csv = toCsv(aggregate([run('A', 'm1', 'text')], []));
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toContain('abschnitt;modell;kontext;n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^A;m1;voll;1;/);
  });

  it('Quoting bei `;` im Wert', () => {
    const csv = toCsv(aggregate([run('A', 'a;b', 'text')], []));
    expect(csv).toContain('"a;b"');
  });

  it('Quoting bei Newline + verdoppeltes Anführungszeichen', () => {
    const nl = toCsv(aggregate([run('A', 'x\ny', 'text')], []));
    expect(nl).toContain('"x\ny"');
    const q = toCsv(aggregate([run('A', 'sag "hi"', 'text')], []));
    expect(q).toContain('"sag ""hi"""');
  });

  it('null-Judge-Werte → leere Felder (kein "null")', () => {
    const csv = toCsv(aggregate([run('A', 'm1', 'text')], [])); // keine Judges
    expect(csv).not.toContain('null');
    // judge_gesamt-Spalte ist leer:
    expect(csv.trimEnd().split('\n')[1]!.split(';').slice(-2, -1)[0]).toBe('');
  });

  it('kontext=both: je Zelle eine voll- und eine relevant-Zeile mit Kontext-Spalte', () => {
    const csv = toCsv(aggregate(
      [{ ...run('A', 'm1', 'voller text'), kontext: 'voll' }, { ...run('A', 'm1', 'kurz'), kontext: 'relevant' }],
      [],
    ));
    const lines = csv.trimEnd().split('\n');
    expect(lines).toHaveLength(3); // Header + 2 Zeilen
    expect(lines.some(l => /^A;m1;voll;/.test(l))).toBe(true);
    expect(lines.some(l => /^A;m1;relevant;/.test(l))).toBe(true);
  });
});

describe('toHtml', () => {
  it('escaped dynamischen Text (Prompt-Verbesserung)', () => {
    const html = toHtml(
      aggregate([run('A', 'm1', 'text')], [judge('A', 'm1', '<script>alert(1)</script>')]),
      [run('A', 'm1', 'text')],
    );
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escaped Beispiel-Ausgaben', () => {
    const results = [run('A', 'm1', 'Ergebnis mit <b>HTML</b> & Zeichen')];
    const html = toHtml(aggregate(results, []), results);
    expect(html).toContain('&lt;b&gt;HTML&lt;/b&gt; &amp; Zeichen');
  });

  it('standalone: kein externes Skript, kein Storage', () => {
    const html = toHtml(aggregate([run('A', 'm1', 'text')], []), [run('A', 'm1', 'text')]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('sessionStorage');
  });

  it('leere Matrix → Hinweis, kein Crash', () => {
    const html = toHtml(aggregate([], []), []);
    expect(html).toContain('leere Matrix');
  });

  it('kontext=both: Matrix zeigt voll und relevant nebeneinander (Labels in der Zelle)', () => {
    const results = [
      { ...run('A', 'm1', 'voll-text'), kontext: 'voll' as const },
      { ...run('A', 'm1', 'rel-text'), kontext: 'relevant' as const },
    ];
    const html = toHtml(aggregate(results, []), results);
    expect(html).toContain('class="kontext-label"');
    expect(html).toContain('>voll<');
    expect(html).toContain('>relevant<');
  });

  it('single-kontext: keine Kontext-Labels in der Matrix (unverändertes Bild)', () => {
    const results = [run('A', 'm1', 'text')];
    const html = toHtml(aggregate(results, []), results);
    expect(html).not.toContain('class="kontext-label"');
  });
});

describe('toJson', () => {
  it('round-trip-fähig', () => {
    const matrix = aggregate([run('A', 'm1', 'text')], [judge('A', 'm1', 'mehr Details')]);
    const parsed = JSON.parse(toJson(matrix, [run('A', 'm1', 'text')], [judge('A', 'm1', 'mehr Details')]));
    expect(parsed.matrix.cells).toHaveLength(1);
    expect(parsed.matrix.cells[0].abschnitt).toBe('A');
    expect(parsed.results).toHaveLength(1);
    expect(parsed.judges).toHaveLength(1);
  });
});

describe('escapeHtml', () => {
  it('escaped alle fünf Sonderzeichen', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});
