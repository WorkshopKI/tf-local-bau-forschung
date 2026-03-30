import type { EvalReport } from './eval-types';

export function evalToMarkdown(report: EvalReport): string {
  const s = report.summary;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;

  const lines: string[] = [
    '# Search Eval Report',
    '',
    `**Datum**: ${new Date(report.timestamp).toLocaleString('de-DE')}`,
    `**Modell**: ${report.model}`,
    `**Chunks**: ${report.totalChunks} | **Dokumente**: ${report.totalDocs}`,
    `**Dauer**: ${report.duration} ms`,
    '',
    '## Zusammenfassung',
    '',
    '| Metrik | Wert |',
    '|---|---|',
    `| Bestanden | ${s.passed}/${s.total} (${pct(s.passed / s.total)}) |`,
    `| Avg Precision@3 | ${pct(s.avgPrecision3)} |`,
    `| Avg Precision@5 | ${pct(s.avgPrecision5)} |`,
    `| Top-1 Accuracy | ${pct(s.top1Accuracy)} |`,
    '',
    '## Nach Kategorie',
    '',
    '| Kategorie | Bestanden |',
    '|---|---|',
  ];

  for (const [cat, data] of Object.entries(s.byCategory)) {
    lines.push(`| ${cat} | ${data.passed}/${data.total} |`);
  }

  lines.push('', '## Nach Schwierigkeit', '', '| Schwierigkeit | Bestanden |', '|---|---|');
  for (const [diff, data] of Object.entries(s.byDifficulty)) {
    lines.push(`| ${diff} | ${data.passed}/${data.total} |`);
  }

  lines.push('', '## Einzelergebnisse', '',
    '| # | Query | Erwartet | Top-1 | Top-1 OK | In Top5 | Pass |',
    '|---|---|---|---|---|---|---|');

  for (const r of report.results) {
    const tc = r.testCase;
    const top1 = r.results[0]?.source ?? '-';
    const top1Ok = tc.expectedTop1 ? (r.top1Match ? 'ja' : 'nein') : '-';
    const inTop5 = `${r.expectedInTop5.length}/${tc.expectedDocs.length}`;
    const pass = r.pass ? 'ja' : 'NEIN';
    lines.push(`| ${tc.id} | ${tc.query} | ${tc.expectedDocs.length} docs | ${top1} | ${top1Ok} | ${inTop5} | ${pass} |`);
  }

  const failed = report.results.filter(r => !r.pass);
  if (failed.length > 0) {
    lines.push('', '## Fehlgeschlagene Tests (Details)', '');
    for (const r of failed) {
      lines.push(`### ${r.testCase.id}: ${r.testCase.query}`, '');
      lines.push(`**Erwartet**: ${r.testCase.expectedDocs.join(', ')}`, '');
      lines.push('**Top-5 Ergebnisse**:', '');
      r.results.slice(0, 5).forEach((res, i) => {
        lines.push(`${i + 1}. ${res.source} (score: ${res.score.toFixed(4)}, method: ${res.method})`);
      });
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function evalToJSON(report: EvalReport): string {
  return JSON.stringify(report, null, 2);
}

export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
