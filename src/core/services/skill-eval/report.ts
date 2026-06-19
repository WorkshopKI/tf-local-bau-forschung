/**
 * Report-Ausgabe der Eval-Matrix: JSON (maschinell), CSV (Tabellen-Tools) und
 * ein EIGENSTÄNDIGES statisches HTML (Tabelle + aufklappbare Details). Reine
 * String-Erzeugung — keine App-Imports, kein localStorage/sessionStorage, keine
 * externen Skripte (läuft per Doppelklick unter `file://`; Muster wie die
 * vorhandenen Standalone-Tool-HTMLs).
 */
import type { StepId } from '@/plugins/antraege/gutachten/types';
import type { EvalMatrix, MatrixCell } from './aggregate';
import { cellAt, JUDGE_DIMENSIONS } from './aggregate';
import type { EvalRunResult, JudgeResult } from './types';

/* --------------------------------- JSON ---------------------------------- */

export function toJson(matrix: EvalMatrix, results: EvalRunResult[], judges: JudgeResult[] = []): string {
  return JSON.stringify({ matrix, results, judges }, null, 2);
}

/* ---------------------------------- CSV ----------------------------------- */

/** RFC-4180-Quoting (Delimiter `;`): bei `"`, `;`, CR oder LF in Anführungszeichen, `"` verdoppelt. */
function csvCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function numCell(value: number | null): string {
  return value === null ? '' : String(value);
}

const CSV_HEADER = [
  'abschnitt', 'modell', 'n', 'laeufe_mit_fehler',
  'check_ok_rate', 'check_hinweis_rate', 'check_fehler_rate',
  'judge_fachliche_korrektheit', 'judge_vollstaendigkeit', 'judge_sprachqualitaet',
  'judge_regeltreue', 'judge_gesamt', 'judge_n',
];

export function toCsv(matrix: EvalMatrix): string {
  const rows = [CSV_HEADER.join(';')];
  for (const c of matrix.cells) {
    rows.push([
      csvCell(c.abschnitt),
      csvCell(c.modellId),
      String(c.n),
      String(c.laeufeMitFehler),
      numCell(c.checkOkRate),
      numCell(c.checkHinweisRate),
      numCell(c.checkFehlerRate),
      numCell(c.judge.fachliche_korrektheit),
      numCell(c.judge.vollstaendigkeit),
      numCell(c.judge.sprachqualitaet),
      numCell(c.judge.regeltreue),
      numCell(c.judge.gesamt),
      String(c.judgeN),
    ].join(';'));
  }
  return rows.join('\n') + '\n';
}

/* ---------------------------------- HTML ---------------------------------- */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pct(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}

function score(value: number | null): string {
  return value === null ? '–' : value.toFixed(1);
}

/** Bis zu `max` finale-Text-Auszüge der Zelle (für die Beispiel-Ausgaben). */
function sampleOutputs(results: EvalRunResult[], abschnitt: StepId, modellId: string, max = 2): string[] {
  return results
    .filter(r => r.abschnitt === abschnitt && r.modellId === modellId && r.parsed?.finalerText)
    .slice(0, max)
    .map(r => r.parsed!.finalerText);
}

function cellSummaryHtml(cell: MatrixCell | undefined): string {
  if (!cell) return '<td class="empty">–</td>';
  const okClass = cell.checkOkRate === null ? '' : cell.checkOkRate >= 0.8 ? 'good' : cell.checkOkRate >= 0.5 ? 'warn' : 'bad';
  return (
    `<td>` +
    `<div class="metric ${okClass}">Checks ok: <b>${pct(cell.checkOkRate)}</b></div>` +
    `<div class="metric">Judge ⌀: <b>${score(cell.judge.gesamt)}</b></div>` +
    `<div class="muted">n=${cell.n}${cell.laeufeMitFehler > 0 ? `, ${cell.laeufeMitFehler}× Fehler` : ''}</div>` +
    `</td>`
  );
}

function detailsHtml(matrix: EvalMatrix, results: EvalRunResult[]): string {
  const blocks: string[] = [];
  for (const cell of matrix.cells) {
    const dims = JUDGE_DIMENSIONS
      .map(d => `<li>${d}: <b>${score(cell.judge[d])}</b></li>`)
      .join('');
    const verbesserungen = cell.promptVerbesserungen.length === 0
      ? '<p class="muted">keine Vorschläge</p>'
      : `<ul>${cell.promptVerbesserungen.map(v => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`;
    const samples = sampleOutputs(results, cell.abschnitt, cell.modellId);
    const samplesHtml = samples.length === 0
      ? '<p class="muted">keine Ausgaben</p>'
      : samples.map(s => `<pre>${escapeHtml(s.length > 1200 ? `${s.slice(0, 1200)}…` : s)}</pre>`).join('');
    blocks.push(
      `<details>` +
      `<summary>Abschnitt ${escapeHtml(cell.abschnitt)} · ${escapeHtml(cell.modellId)} ` +
      `<span class="muted">(n=${cell.n}, Judge n=${cell.judgeN})</span></summary>` +
      `<div class="detail-body">` +
      `<div class="cols">` +
      `<div><h3>Judge-Mittel</h3><ul class="dims">${dims}<li>Gesamt: <b>${score(cell.judge.gesamt)}</b></li></ul></div>` +
      `<div><h3>Check-Summen</h3><ul class="dims">` +
      `<li>ok: <b>${cell.checkSummen.ok}</b></li><li>hinweis: <b>${cell.checkSummen.hinweis}</b></li>` +
      `<li>fehler: <b>${cell.checkSummen.fehler}</b></li></ul></div>` +
      `</div>` +
      `<h3>Prompt-Verbesserungen</h3>${verbesserungen}` +
      `<h3>Beispiel-Ausgaben</h3>${samplesHtml}` +
      `</div></details>`,
    );
  }
  return blocks.join('\n');
}

export function toHtml(matrix: EvalMatrix, results: EvalRunResult[]): string {
  const head = matrix.modelle.map(m => `<th>${escapeHtml(m)}</th>`).join('');
  const body = matrix.abschnitte.map(ab => {
    const cells = matrix.modelle.map(m => cellSummaryHtml(cellAt(matrix, ab, m))).join('');
    return `<tr><th class="rowhead">${escapeHtml(ab)}</th>${cells}</tr>`;
  }).join('');

  const empty = matrix.cells.length === 0
    ? '<p class="muted">Keine Ergebnisse — leere Matrix.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skill-Eval-Report</title>
<style>
:root {
  --bg:#fafafa; --bg2:#f3f4f6; --fg:#111827; --fg2:#4b5563; --fg3:#9ca3af;
  --border:#e5e7eb; --primary:#1e40af; --success:#16a34a; --warning:#d97706; --danger:#dc2626; --radius:10px;
}
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg); font-size:14px; line-height:1.5; }
.container { max-width:1100px; margin:0 auto; padding:24px 20px 80px; }
h1 { font-size:22px; font-weight:600; margin:0 0 4px; }
h2 { font-size:16px; font-weight:600; margin:28px 0 10px; }
h3 { font-size:13px; font-weight:600; margin:12px 0 4px; color:var(--fg2); }
p { color:var(--fg2); margin:0 0 14px; }
.muted { color:var(--fg3); font-size:12px; }
table { border-collapse:collapse; width:100%; background:white; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
th, td { border:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
thead th { background:var(--bg2); font-weight:600; }
.rowhead { background:var(--bg2); font-weight:600; width:48px; text-align:center; }
td.empty { color:var(--fg3); text-align:center; }
.metric { font-size:12px; }
.metric.good b { color:var(--success); }
.metric.warn b { color:var(--warning); }
.metric.bad b { color:var(--danger); }
details { background:white; border:1px solid var(--border); border-radius:8px; margin:8px 0; padding:4px 12px; }
summary { cursor:pointer; font-weight:500; padding:6px 0; }
.detail-body { padding:8px 0 12px; }
.cols { display:flex; gap:32px; flex-wrap:wrap; }
ul.dims { margin:4px 0; padding-left:18px; }
ul.dims li, ul li { font-size:13px; }
pre { background:var(--bg2); border:1px solid var(--border); border-radius:6px; padding:10px; white-space:pre-wrap; word-break:break-word; font-size:12px; max-height:320px; overflow:auto; }
</style>
</head>
<body>
<div class="container">
<h1>Skill-Eval-Report</h1>
<p class="muted">${results.length} Läufe · ${matrix.modelle.length} Modell(e) · ${matrix.abschnitte.length} Abschnitt(e)</p>
${empty}
<h2>Skill × Modell-Matrix</h2>
<p class="muted">„Checks ok" = Anteil bestandener deterministischer Checks · „Judge ⌀" = Gesamt-Mittel der LLM-Bewertung (1–5).</p>
<table>
<thead><tr><th class="rowhead">A–G</th>${head}</tr></thead>
<tbody>${body}</tbody>
</table>
<h2>Details je Zelle</h2>
${detailsHtml(matrix, results)}
</div>
</body>
</html>
`;
}
