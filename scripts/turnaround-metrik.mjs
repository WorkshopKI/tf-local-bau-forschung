#!/usr/bin/env node
/**
 * Durchlaufzeit je Commit — aus den Claude-Code-Sitzungsprotokollen.
 *
 * Wo geht die Zeit zwischen Anlass und Commit hin: Modell, Gates, Abnahme,
 * Warten auf den Nutzer? Die Frage „seit den Checks wieder langsam" ließ sich
 * nur aus den Protokollen beantworten — und die Gates waren es nicht. Dieses
 * Script macht die Messung wiederholbar, damit ein Prozess-Experiment
 * (Doku-Agent, Plan-Modus ab Schwelle) nachgemessen wird statt behauptet.
 * Befund und Einordnung: docs/architecture/entwicklungsprozess.md §4.
 *
 * Quelle: `~/.claude/projects/<projekt-slug>*` — die JSONL-Protokolle des
 * Hauptlaufs (Subagenten-Zeilen mit `isSidechain` zählen nicht). Rein lesend.
 *
 * Zeitmodell: jede Lücke zwischen zwei Protokollzeilen gehört der SPÄTEREN
 * Zeile — Assistent-Zeile = Modellzeit, Tool-Ergebnis = Zeit dieses Tools,
 * Rückfrage, Plan-Freigabe und Nutzer-Nachricht = Nutzer-Warten. Lücken über
 * 15 Minuten gelten als Leerlauf und zählen nirgends. Eine Sitzung gehört
 * der Periode, in der sie begann.
 *
 * Aufruf:
 *   npm run turnaround                                  # letzte 7 Tage gegen die 7 davor
 *   npm run turnaround -- --seit 2026-09-06             # ab Datum bis heute, gegen gleich lange Periode davor
 *   npm run turnaround -- --seit 2026-09-06 --bis 2026-09-12   # --bis exklusiv
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MS_PRO_MINUTE = 60_000;
const MS_PRO_TAG = 24 * 60 * MS_PRO_MINUTE;
const LEERLAUF_MS = 15 * MS_PRO_MINUTE;
const STANDARD_TAGE = 7;
const NUTZER = 'nutzer';

// ---------------------------------------------------------------- Einordnung

/** Claude Code legt Protokolle unter dem Projektpfad ab, jedes Sonderzeichen → `-`. */
function projektSlug(pfad) {
  return pfad.replace(/[^A-Za-z0-9]/g, '-');
}

function toolKategorie(name, input) {
  if (name === 'Bash' || name === 'PowerShell') {
    const cmd = String(input?.command ?? '');
    if (/build:|build-with-config/.test(cmd)) return 'build';
    if (/npm run (check|test|lint|typecheck|cycles)|vitest|\btsc\b|eslint/.test(cmd)) return 'gate';
    if (/(^|&&\s*|;\s*)git\s/.test(cmd)) return 'git';
    return 'shell';
  }
  if (name === 'Agent' || name === 'Task') return 'agent';
  if (/^mcp__(Claude_Browser|claude-in-chrome)__/.test(name)) return 'browser';
  if (/^(Read|Grep|Glob|LSP)$/.test(name)) return 'lesen';
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) return 'schreiben';
  if (name === 'AskUserQuestion' || name === 'ExitPlanMode') return NUTZER;
  return 'sonst';
}

function schreibKategorie(pfad) {
  const p = String(pfad ?? '').replaceAll('\\', '/');
  if (/\.claude\/projects\/.*\/memory\//.test(p)) return 'memory';
  if (/\.claude\/plans\//.test(p)) return 'plan';
  if (/docs\/superpowers\//.test(p)) return 'spec';
  if (/CHANGELOG|changelog-user/.test(p)) return 'changelog';
  if (/\.md$/.test(p)) return 'doku';
  if (/__tests__\/|\.test\.tsx?$/.test(p)) return 'tests';
  if (/\/src\/.*\.(tsx?|css)$/.test(p)) return 'code';
  return 'sonst';
}

function geschriebeneZeichen(name, input) {
  if (name === 'Write') return String(input?.content ?? '').length;
  if (name === 'Edit') return String(input?.new_string ?? '').length;
  if (name === 'MultiEdit') return (input?.edits ?? []).reduce((s, e) => s + String(e?.new_string ?? '').length, 0);
  return 0;
}

function ergebnisText(block) {
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) return block.content.map(c => c?.text ?? '').join('');
  return '';
}

function addiere(ziel, schluessel, wert) {
  ziel[schluessel] = (ziel[schluessel] ?? 0) + wert;
}

// ---------------------------------------------------------------- Auswertung

function leereSumme() {
  return {
    sitzungen: 0, commits: 0, modell: 0, warten: 0, aufrufe: 0, output: 0,
    gates: 0, rot: 0, tools: {}, geschrieben: {},
  };
}

function leseZeilen(datei) {
  const zeilen = [];
  for (const roh of readFileSync(datei, 'utf8').split('\n')) {
    if (!roh) continue;
    let e;
    try { e = JSON.parse(roh); } catch { continue; }
    if (e.timestamp && !e.isSidechain) zeilen.push(e);
  }
  return zeilen;
}

function werteAssistentAus(e, summe, tools, gesehen) {
  const m = e.message ?? {};
  if (m.id && !gesehen.has(m.id)) {
    gesehen.add(m.id);
    summe.aufrufe++;
    summe.output += m.usage?.output_tokens ?? 0;
  }
  for (const b of Array.isArray(m.content) ? m.content : []) {
    if (b.type !== 'tool_use') continue;
    const kategorie = toolKategorie(b.name, b.input);
    const commit = /git commit/.test(String(b.input?.command ?? ''));
    tools.set(b.id, { kategorie, commit });
    const zeichen = geschriebeneZeichen(b.name, b.input);
    if (zeichen > 0) addiere(summe.geschrieben, schreibKategorie(b.input?.file_path), zeichen);
  }
  return 'modell';
}

function werteNutzerAus(e, summe, tools) {
  const m = e.message ?? {};
  const inhalt = Array.isArray(m.content) ? m.content : [];
  const ergebnisse = inhalt.filter(b => b.type === 'tool_result');
  if (ergebnisse.length === 0) {
    const text = typeof m.content === 'string' ? m.content : '';
    // Meldung eines Hintergrund-Laufs (Build, Agent): gewartet hat Claude, nicht der Nutzer.
    return /task-notification/.test(text) ? 'hintergrund' : NUTZER;
  }
  for (const b of ergebnisse) {
    const t = tools.get(b.tool_use_id);
    if (t === undefined) continue;
    if (t.commit && !b.is_error) summe.commits++;
    if (t.kategorie === 'gate') {
      summe.gates++;
      if (b.is_error || /FAIL |failed \(|Tests\s+\d+ failed/.test(ergebnisText(b))) summe.rot++;
    }
  }
  return tools.get(ergebnisse[0].tool_use_id)?.kategorie ?? 'sonst';
}

function werteSitzungAus(zeilen, summe) {
  summe.sitzungen++;
  const tools = new Map();
  const gesehen = new Set();
  let vorher = null;
  for (const e of zeilen) {
    const t = Date.parse(e.timestamp);
    let art = null;
    if (e.type === 'assistant') art = werteAssistentAus(e, summe, tools, gesehen);
    else if (e.type === 'user' && !e.isMeta && !e.isCompactSummary) art = werteNutzerAus(e, summe, tools);
    if (art !== null && vorher !== null) {
      const luecke = t - vorher;
      if (luecke <= LEERLAUF_MS) {
        if (art === 'modell') summe.modell += luecke;
        else if (art === NUTZER) summe.warten += luecke;
        else addiere(summe.tools, art, luecke);
      }
    }
    vorher = t;
  }
}

// ---------------------------------------------------------------- Perioden

function isoTag(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function verschiebe(tag, tage) {
  const d = new Date(`${tag}T00:00:00`);
  d.setDate(d.getDate() + tage);
  return isoTag(d);
}

function argument(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function perioden() {
  const bis = argument('--bis') ?? verschiebe(isoTag(new Date()), 1);
  const seit = argument('--seit') ?? verschiebe(bis, -STANDARD_TAGE);
  const tage = Math.round((Date.parse(`${bis}T00:00:00`) - Date.parse(`${seit}T00:00:00`)) / MS_PRO_TAG);
  return [
    { von: verschiebe(seit, -tage), bis: seit, summe: leereSumme() },
    { von: seit, bis, summe: leereSumme() },
  ];
}

// ---------------------------------------------------------------- Ausgabe

const de = (n, stellen = 1) => n.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

function jeCommit(summe, wert, teiler = 1, stellen = 1) {
  return summe.commits === 0 ? '—' : de(wert / teiler / summe.commits, stellen);
}

function zeile(titel, werte) {
  return `${titel.padEnd(34)}${werte.map(w => String(w).padStart(24)).join('')}`;
}

function ausgabe(ps, quelle) {
  const summen = ps.map(p => p.summe);
  const toolMin = s => Object.values(s.tools).reduce((a, b) => a + b, 0);
  const alleTools = [...new Set(summen.flatMap(s => Object.keys(s.tools)))]
    .sort((a, b) => summen.reduce((x, s) => x + (s.tools[b] ?? 0) - (s.tools[a] ?? 0), 0));
  const alleSchreib = [...new Set(summen.flatMap(s => Object.keys(s.geschrieben)))].sort();
  const gesamtSchreib = s => Object.values(s.geschrieben).reduce((a, b) => a + b, 0);

  const o = [];
  o.push(`Durchlaufzeit je Commit — ${quelle}`);
  o.push('');
  o.push(zeile('', ps.map(p => `${p.von} … ${verschiebe(p.bis, -1)}`)));
  o.push(zeile('Sitzungen / Commits', summen.map(s => `${s.sitzungen} / ${s.commits}`)));
  o.push(zeile('Claude-aktiv je Commit (min)', summen.map(s => jeCommit(s, s.modell + toolMin(s), MS_PRO_MINUTE))));
  o.push(zeile('  Modell (min)', summen.map(s => jeCommit(s, s.modell, MS_PRO_MINUTE))));
  o.push(zeile('  Tools (min)', summen.map(s => jeCommit(s, toolMin(s), MS_PRO_MINUTE))));
  for (const k of alleTools) o.push(zeile(`    ${k}`, summen.map(s => jeCommit(s, s.tools[k] ?? 0, MS_PRO_MINUTE, 2))));
  o.push(zeile('Nutzer-Warten je Commit (min)', summen.map(s => jeCommit(s, s.warten, MS_PRO_MINUTE))));
  o.push(zeile('API-Aufrufe je Commit', summen.map(s => jeCommit(s, s.aufrufe, 1, 0))));
  o.push(zeile('Output-Tokens je Commit (Tsd.)', summen.map(s => jeCommit(s, s.output, 1000, 0))));
  o.push(zeile('Gate-Läufe / davon rot je Commit', summen.map(s => `${jeCommit(s, s.gates)} / ${jeCommit(s, s.rot)}`)));
  o.push(zeile('Geschrieben je Commit (Tsd. Zeichen)', summen.map(s => jeCommit(s, gesamtSchreib(s), 1000, 0))));
  for (const k of alleSchreib) {
    o.push(zeile(`    ${k} (%)`, summen.map(s => (gesamtSchreib(s) === 0 ? '—' : de((100 * (s.geschrieben[k] ?? 0)) / gesamtSchreib(s), 0)))));
  }
  o.push('');
  o.push('Zeitmodell: Lücke zwischen zwei Protokollzeilen gehört der späteren; Lücken > 15 min = Leerlauf.');
  return o.join('\n');
}

// ---------------------------------------------------------------- Lauf

function main() {
  const basis = join(homedir(), '.claude', 'projects');
  const slug = projektSlug(ROOT);
  if (!existsSync(basis)) {
    console.error(`Keine Sitzungsprotokolle unter ${basis}.`);
    process.exit(1);
  }
  const ordner = readdirSync(basis).filter(d => d.toLowerCase().startsWith(slug.toLowerCase()));
  if (ordner.length === 0) {
    console.error(`Kein Protokollordner für ${slug} unter ${basis}.`);
    process.exit(1);
  }
  const ps = perioden();
  for (const o of ordner) {
    const dir = join(basis, o);
    for (const f of readdirSync(dir).filter(n => n.endsWith('.jsonl'))) {
      const zeilen = leseZeilen(join(dir, f));
      if (zeilen.length === 0) continue;
      const start = isoTag(new Date(zeilen[0].timestamp));
      const p = ps.find(x => start >= x.von && start < x.bis);
      if (p) werteSitzungAus(zeilen, p.summe);
    }
  }
  console.log(ausgabe(ps, `${ordner.length} Protokollordner unter ~/.claude/projects/${slug}*`));
}

main();
