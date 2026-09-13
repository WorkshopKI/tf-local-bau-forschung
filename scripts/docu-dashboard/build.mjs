#!/usr/bin/env node
/**
 * Doku-Dashboard bauen — `npm run docs:dashboard`.
 *
 * Liest die kuratierten Inhalte aus docs/docu-dashboard/data.json, misst die
 * harten Kennzahlen direkt im Repo (Version, Commits, Dateien, LOC, Stores,
 * Flags, Plugins, Guards, Skills, Pitfalls, Changelog-Kopf) und setzt beides
 * in docs/docu-dashboard/template.html ein. Ergebnis:
 *
 *   docs/docu-dashboard/dashboard.html   — das eine, downloadbare HTML
 *   docs/docu-dashboard/last-build.json  — Stand des letzten Laufs (Commit,
 *                                           Version, Kennzahlen) für den Skill
 *
 * Optionen:
 *   --artifact <pfad>   zusätzlich eine Fassung ohne <html>/<head>/<body>-
 *                       Hülle schreiben (für Hoster, die selbst ein Skelett
 *                       setzen — z. B. claude.ai-Artefakte)
 *   --out <pfad>        anderes Ziel für die Vollfassung
 *
 * Reine Node-Stdlib, keine Abhängigkeiten; alles außer git ist synchron.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCU_DIR = join(ROOT, 'docs', 'docu-dashboard');
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const git = (cmd, fallback = '') => {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- Dateien/LOC
function walk(dir, out, muster = /\.(ts|tsx)$/) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === 'node_modules' || e === 'generated') continue;
      walk(p, out, muster);
    } else if (muster.test(e)) {
      out.push(p);
    }
  }
  return out;
}

function countLines(p) {
  const s = readFileSync(p, 'utf8');
  if (s.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return s.endsWith('\n') ? n : n + 1;
}

function messenDateien() {
  const src = join(ROOT, 'src');
  const files = walk(src, []);
  const perFolder = {};
  let prodFiles = 0, testFiles = 0, prodLoc = 0, testLoc = 0;
  for (const f of files) {
    const rel = relative(src, f).replace(/\\/g, '/');
    const top = rel.includes('/') ? rel.split('/')[0] : '(root)';
    const isTest = /\.test\.tsx?$/.test(rel) || rel.split('/').includes('__tests__');
    const loc = countLines(f);
    const slot = (perFolder[top] ??= { files: 0, tests: 0, loc: 0 });
    slot.files++;
    slot.loc += loc;
    if (isTest) { slot.tests++; testFiles++; testLoc += loc; } else { prodFiles++; prodLoc += loc; }
  }
  const folders = Object.entries(perFolder)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.loc - a.loc);
  return { total: files.length, prodFiles, testFiles, prodLoc, testLoc, folders };
}

// ---------------------------------------------------------------- Kennzahlen
function zaehle(re, text) {
  return (text.match(re) ?? []).length;
}

function messenRepo() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const idb = readFileSync(join(ROOT, 'src/core/services/storage/idb-store.ts'), 'utf8');
  const schema = readFileSync(join(ROOT, 'scripts/config-schema.mjs'), 'utf8');
  const plugins = readFileSync(join(ROOT, 'src/plugins.config.ts'), 'utf8');
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const pitfallsMd = existsSync(join(ROOT, 'docs/architecture/pitfalls.md'))
    ? readFileSync(join(ROOT, 'docs/architecture/pitfalls.md'), 'utf8') : '';

  // IndexedDB: Version + Anzahl Object-Stores
  const idbVersion = Number(idb.match(/readonly version = (\d+)/)?.[1] ?? 0);
  const idbStores = zaehle(/createObjectStore\(/g, idb);

  // Feature-Flags: Schlüssel im `features: {`-Block von DEFAULT_CONFIG (2 Leerzeichen Einrückung)
  let featureFlags = 0;
  const fStart = schema.search(/^  features: \{/m);
  if (fStart >= 0) {
    const rest = schema.slice(fStart);
    const fEnd = rest.search(/^  \},?$/m);
    const block = rest.slice(0, fEnd > 0 ? fEnd : undefined);
    featureFlags = zaehle(/^\s{4}[a-zA-Z][\w]*:\s*(true|false)/gm, block);
  }

  // Plugins: Einträge des allPlugins-Arrays
  const pStart = plugins.indexOf('const allPlugins');
  const pEnd = plugins.indexOf('];', pStart);
  const pluginCount = pStart >= 0 ? zaehle(/^\s+\w+Plugin,/gm, plugins.slice(pStart, pEnd)) : 0;

  // Pitfalls: höchste Nummer `NN. **` in beiden Heimaten
  let pitfalls = 0;
  for (const m of (claude + '\n' + pitfallsMd).matchAll(/^(\d{1,3})\.\s+\*\*/gm)) pitfalls = Math.max(pitfalls, Number(m[1]));

  const countMd = (dir) => existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.md')).length : 0;
  const skillsDir = join(ROOT, '.claude/skills');
  const skills = existsSync(skillsDir) ? readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory()) : [];
  const guardDir = join(ROOT, 'src/__tests__');
  const guards = existsSync(guardDir) ? readdirSync(guardDir).filter(f => /\.test\.tsx?$/.test(f)).length : 0;

  // Git — gemessen wird der Code-Stand, auf dem die Doku aufsetzt: auf master
  // HEAD selbst, auf einem Doku-Branch die Abzweigstelle von master (sonst
  // stünde der Doku-Commit als „Stand des Codes“ im Dashboard).
  const base = git('merge-base HEAD origin/master', '') || git('merge-base HEAD master', '') || 'HEAD';
  const commits = Number(git(`rev-list --count ${base}`, '0'));
  const last = git(`log -1 "--format=%h|%cI|%s" ${base}`, '||').split('|');
  const first = git('log --max-parents=0 "--format=%cI"', '').split('\n').pop() ?? '';
  const last30 = Number(git(`rev-list --count --since=30.days ${base}`, '0'));
  const subjects = git(`log "--format=%s" ${base}`, '').split('\n');
  const typen = {};
  for (const s of subjects) {
    const t = s.match(/^([a-z]+)(\(|:)/)?.[1] ?? 'sonstige';
    typen[t] = (typen[t] ?? 0) + 1;
  }
  const commitTypes = Object.entries(typen).sort((a, b) => b[1] - a[1]).map(([typ, n]) => ({ typ, n }));

  return {
    version: pkg.version,
    dependencies: Object.keys(pkg.dependencies ?? {}).length,
    devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
    npmScripts: Object.keys(pkg.scripts ?? {}).length,
    idbVersion, idbStores, featureFlags, pluginCount, pitfalls, guards,
    skills: skills.length, skillNames: skills,
    docsArchitecture: countMd('docs/architecture'),
    docsAgents: countMd('docs/agents'),
    commits, lastCommit: { hash: last[0], date: last[1], subject: last[2] }, firstCommitDate: first, commitsLast30: last30,
    commitTypes,
  };
}

// ---------------------------------------------------------------- Flags je Variante
/**
 * Effektive Feature-Flags je Build-Config, gerechnet mit dem Deep-Merge des
 * Repos selbst (buildBasis ← _shared.json ← Variant-Config). Fällt der Import
 * von config-schema.mjs aus (Export umbenannt), bleibt die Liste leer und die
 * Seite zeigt die kuratierten Angaben aus data.json.
 */
async function messenFlags() {
  try {
    const mod = await import(pathToFileURL(join(ROOT, 'scripts/config-schema.mjs')).href);
    const shared = existsSync(join(ROOT, 'configs/_shared.json')) ? JSON.parse(readFileSync(join(ROOT, 'configs/_shared.json'), 'utf8')) : {};
    const keys = Object.keys(mod.buildBasis().features ?? {});
    const out = [];
    for (const f of readdirSync(join(ROOT, 'configs')).filter(f => /\.config\.json$/.test(f) && !f.startsWith('_')).sort()) {
      const cfg = mod.deepMerge(mod.deepMerge(mod.buildBasis(), shared), JSON.parse(readFileSync(join(ROOT, 'configs', f), 'utf8')));
      const on = keys.filter(k => cfg.features?.[k] === true);
      out.push({ id: f.replace(/\.config\.json$/, ''), on: on.length, total: keys.length, onNames: on, off: keys.filter(k => cfg.features?.[k] !== true) });
    }
    return { total: keys.length, variants: out };
  } catch (e) {
    console.log('[docu-dashboard] Flags je Variante nicht messbar: ' + (e?.message ?? e));
    return { total: 0, variants: [] };
  }
}

// ---------------------------------------------------------------- Changelog-Kopf
function leseChangelog(max = 12) {
  const p = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf8').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length && out.length < max; i++) {
    const m = lines[i].match(/^### (v\d+\.\d+\.\d+)\s+—\s+(.+?)\s*(?:\(([^)]+)\))?\s*$/);
    if (!m) continue;
    let body = '';
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.startsWith('### ')) break;
      if (t) { body = t; break; }
    }
    const art = body.match(/^(MAJOR|MINOR|PATCH)\b/)?.[1] ?? '';
    body = body.replace(/^(MAJOR|MINOR|PATCH)\s*—\s*/, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    if (body.length > 260) body = body.slice(0, 257).replace(/\s+\S*$/, '') + ' …';
    out.push({ version: m[1], title: m[2].replace(/\*\*/g, ''), when: m[3] ?? '', art, body });
  }
  return out;
}

// ---------------------------------------------------------------- Dateiverweise
/**
 * Sammelt alle String-Werte unter einem Schlüssel (`file`, `fn`) aus data.json,
 * mit lesbarer Fundstelle: Array-Einträge mit `id` heißen nach ihr, sonst nach
 * ihrer Position (`#3`).
 */
function sammleFelder(knoten, schluessel, pfad = [], out = []) {
  if (Array.isArray(knoten)) {
    knoten.forEach((k, i) => sammleFelder(k, schluessel,
      [...pfad, k && typeof k === 'object' && typeof k.id === 'string' ? k.id : `#${i + 1}`], out));
  } else if (knoten && typeof knoten === 'object') {
    for (const [k, v] of Object.entries(knoten)) {
      if (k === schluessel && typeof v === 'string') out.push({ wo: pfad.join(' › '), wert: v });
      else sammleFelder(v, schluessel, [...pfad, k], out);
    }
  }
  return out;
}

/**
 * Kurzformen, die eindeutig unter src/ wohnen (`core/status/waechter.ts`).
 * `components/` gehört nicht dazu: es gibt src/components, src/core/components
 * und je Plugin einen components-Ordner.
 */
const KURZ_UNTER_SRC = /^(core|plugins|config)\//;

/**
 * Prüft **jede** `file`-Angabe in data.json gegen das Repo — Abläufe,
 * Status-Kette, Zusammenspiel, Fehlersuche. Geprüft wird nur, was als Repo-Pfad
 * lesbar ist (beginnt mit src/, scripts/, docs/, configs/ oder ist index.html;
 * core/…, plugins/…, config/… werden unter src/ gesucht); andere Kurzformen wie
 * `transports/streamlit.ts` bleiben unbeanstandet.
 * Rückgabe: Liste „Fundstelle: Pfad“.
 */
function pruefeDateiVerweise(data) {
  const fehlend = [];
  for (const { wo, wert } of sammleFelder(data, 'file')) {
    for (let tok of wert.split('·')) {
      tok = tok.trim().replace(/\s*\(.*?\)\s*$/, '').replace(/:\d+(-\d+)?$/, '').trim();
      if (!tok) continue;
      if (KURZ_UNTER_SRC.test(tok)) tok = `src/${tok}`;
      if (!(/^(src|scripts|docs|configs)\//.test(tok) || tok === 'index.html')) continue;
      if (!existsSync(join(ROOT, tok))) fehlend.push(`${wo}: ${tok}`);
    }
  }
  return fehlend;
}

// ---------------------------------------------------------------- Aufrufe
/**
 * Prüft die Aufrufe in allen `fn`-Angaben (`name(`) gegen den Produktionscode
 * unter src/ und scripts/. Ein umbenannter oder entfernter Aufruf fällt so beim
 * nächsten Bau auf, statt im Dashboard weiterzuleben. Bewusst grob: gesucht wird
 * der Name als Wort irgendwo im Code, nicht seine Definition — Tests zählen
 * nicht, sonst hielte ein alter Test einen gelöschten Namen am Leben.
 */
function pruefeAufrufe(data) {
  const namen = new Map();
  for (const { wo, wert } of sammleFelder(data, 'fn')) {
    for (const m of wert.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!namen.has(m[1])) namen.set(m[1], wo);
    }
  }
  if (namen.size === 0) return [];
  const woerter = new Set();
  const dateien = [
    ...walk(join(ROOT, 'src'), []),
    ...walk(join(ROOT, 'scripts'), [], /\.(mjs|js|ts)$/),
  ].filter(f => !/\.test\.tsx?$/.test(f) && !/[\\/]__tests__[\\/]/.test(f));
  for (const f of dateien) {
    for (const w of readFileSync(f, 'utf8').match(/[A-Za-z_$][\w$]*/g) ?? []) woerter.add(w);
  }
  return [...namen].filter(([n]) => !woerter.has(n)).map(([n, wo]) => `${wo}: ${n}()`);
}

// ---------------------------------------------------------------- Bauen
async function main() {
  const data = JSON.parse(readFileSync(join(DOCU_DIR, 'data.json'), 'utf8'));
  const template = readFileSync(join(DOCU_DIR, 'template.html'), 'utf8');
  const dateien = messenDateien();
  const repo = messenRepo();
  const flags = await messenFlags();
  const changelog = leseChangelog();
  const builtAt = new Date().toISOString();

  const payload = {
    ...data,
    metrics: { ...repo, files: dateien, flags, buildConfigs: flags.variants.length },
    changelog,
    build: { builtAt, commit: repo.lastCommit.hash, commitDate: repo.lastCommit.date, version: repo.version },
  };
  // `</script>` darf im eingebetteten JSON nicht vorkommen — dasselbe gilt für
  // den Artefakt-Hoster; escapen kostet nichts.
  const json = JSON.stringify(payload).replace(/<\//g, '<\\/');

  const gefuellt = template
    .replace('/*__TF_DOCU_DATA__*/', `window.__TF_DOCU__ = ${json};`)
    .replaceAll('__TF_DOCU_VERSION__', repo.version)
    .replaceAll('__TF_DOCU_BUILT__', builtAt.slice(0, 10))
    .replaceAll('__TF_DOCU_COMMIT__', repo.lastCommit.hash);

  const outPath = resolve(ROOT, argValue('--out') ?? join(DOCU_DIR, 'dashboard.html'));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, gefuellt, 'utf8');

  const artifact = argValue('--artifact');
  if (artifact) {
    const head = gefuellt.match(/<!--tf:head-start-->([\s\S]*?)<!--tf:head-end-->/)?.[1] ?? '';
    const body = gefuellt.match(/<!--tf:body-start-->([\s\S]*?)<!--tf:body-end-->/)?.[1] ?? '';
    writeFileSync(resolve(ROOT, artifact), head.trim() + '\n' + body.trim() + '\n', 'utf8');
  }

  const lastBuild = {
    builtAt, version: repo.version, commit: repo.lastCommit.hash, commitDate: repo.lastCommit.date,
    curatedFor: data.meta?.curatedFor ?? '', curatedAt: data.meta?.curatedAt ?? '',
    kennzahlen: {
      commits: repo.commits, pluginCount: repo.pluginCount, featureFlags: repo.featureFlags, idbStores: repo.idbStores,
      idbVersion: repo.idbVersion, pitfalls: repo.pitfalls, skills: repo.skills, guards: repo.guards,
      files: dateien.total, prodLoc: dateien.prodLoc, testLoc: dateien.testLoc, docsArchitecture: repo.docsArchitecture,
    },
    flows: (data.flows ?? []).map(f => ({ id: f.id, steps: f.steps.length })),
  };
  writeFileSync(join(DOCU_DIR, 'last-build.json'), JSON.stringify(lastBuild, null, 2) + '\n', 'utf8');

  const fehlend = pruefeDateiVerweise(data);
  if (fehlend.length) {
    console.log(`[docu-dashboard] ${fehlend.length} Dateiverweis(e) in data.json zeigen ins Leere — im Skill docu-dashboard nachziehen:`);
    for (const z of fehlend) console.log('  - ' + z);
  } else {
    console.log('[docu-dashboard] Dateiverweise in data.json: alle vorhanden.');
  }
  const unbekannt = pruefeAufrufe(data);
  if (unbekannt.length) {
    console.log(`[docu-dashboard] ${unbekannt.length} Aufruf(e) in data.json kommen im Code nicht vor — im Skill docu-dashboard nachziehen:`);
    for (const z of unbekannt) console.log('  - ' + z);
  } else {
    console.log('[docu-dashboard] Aufrufe in data.json: alle im Code gefunden.');
  }

  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(`[docu-dashboard] ${relative(ROOT, outPath)} geschrieben (${kb} KB) — v${repo.version} @ ${repo.lastCommit.hash}, ` +
    `${dateien.total} Dateien, ${repo.pluginCount} Plugins, ${repo.featureFlags} Flags, ${repo.idbStores} Stores, ${repo.pitfalls} Pitfalls, ${changelog.length} Changelog-Einträge`);
  if (data.meta?.curatedFor && data.meta.curatedFor !== `v${repo.version}`) {
    console.log(`[docu-dashboard] Hinweis: data.json ist für ${data.meta.curatedFor} kuratiert, Repo steht auf v${repo.version} — Skill docu-dashboard sichtet die Änderungen.`);
  }
}

await main();
