/**
 * Mess-Modul für Codequalitäts-Kennzahlen — MESSEN, nicht urteilen.
 *
 * Reine Funktionen über dem Dateibaum: jede liefert Zahlen plus die Fundstellen,
 * die sie erzeugt haben. Was daraus eine Schwelle wird, entscheidet der Guard in
 * `src/__tests__/`, nicht dieses Modul — „messen" und „verbieten" sind bewusst
 * zwei Dinge.
 *
 * Zwei Konsumenten:
 *   - `scripts/code-quality-metrics.mjs` → docs/architecture/code-quality-baseline.md
 *   - später der Ratchet-Guard, der frisch nachmisst und gegen die Baseline hält
 *
 * Der Guard ruft NIE den Generator und liest NIE die erzeugte Markdown — sonst
 * baut er seine Fixture aus der geprüften Sache und kann nie rot werden.
 *
 * Reine Node-Stdlib, keine Dependencies (wie `check-cycles.mjs` und
 * `generate-code-map.mjs`). Deterministisch: jede Liste ist stabil sortiert.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

/**
 * `src/generated/` trägt das inline-gzippte ORT-WASM als base64: 7,34 MB in EINER
 * Zeile. Das sind 27,5 % von allem, was ein Datei-Scanner hier liest, und es
 * enthält keine einzige Konvention. Ohne diesen Ausschluss kostet jeder Voll-Scan
 * ein Vielfaches, und jede Zahlen-Heuristik trifft dort tausendfach.
 */
export const GENERATED = 'src/generated/';

/** Zählt Codezeilen newline-basiert — EINE Zählweise fürs ganze Projekt.
 *  (Bis v6.38 zählte health-baseline `split(/\r?\n/).length`, code-map die
 *  Newlines: bei SuchSeite.tsx 1233 gegen 1232. Zwei Zähler, zwei Wahrheiten.) */
export function countLoc(content) {
  if (content.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  if (content.charCodeAt(content.length - 1) === 10) lines--;
  return lines;
}

const posix = (p) => p.split('\\').join('/');

/** Alle .ts/.tsx unter src/, mit Inhalt. `src/generated/` bleibt draußen. */
export function collectSourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('dist') || e.name === '.vite') continue;
        walk(abs);
      } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
        const rel = posix(relative(root, abs));
        if (rel.startsWith(GENERATED)) continue;
        const content = readFileSync(abs, 'utf8');
        out.push({ rel, content, loc: countLoc(content), lines: content.split(/\r?\n/) });
      }
    }
  };
  walk(join(root, 'src'));
  return out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

export const istTest = (rel) =>
  rel.split('/').includes('__tests__') || /\.(test|spec)\.tsx?$/.test(basename(rel));
export const istProduktion = (rel) => !istTest(rel) && !rel.endsWith('.d.ts');

const perzentil = (sorted, p) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];

/** Zeile ist reiner Kommentar (grobe, aber stabile Näherung). */
const istKommentar = (l) => {
  const t = l.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

// ---------------------------------------------------------------- Kennzahlen

/** K1 — Größenverteilung, getrennt nach Produktion und Test. */
export function loc(files) {
  const teil = (pred) => {
    const f = files.filter((x) => pred(x.rel));
    const s = f.map((x) => x.loc).sort((a, b) => a - b);
    return {
      dateien: f.length,
      summe: s.reduce((a, b) => a + b, 0),
      p50: perzentil(s, 0.5), p90: perzentil(s, 0.9), p99: perzentil(s, 0.99),
      max: s.length ? s[s.length - 1] : 0,
      ueber400: f.filter((x) => x.loc > 400).length,
      ueber500: f.filter((x) => x.loc > 500).length,
      ueber800: f.filter((x) => x.loc > 800).length,
      ueber1000: f.filter((x) => x.loc > 1000).length,
      groesste: f.slice().sort((a, b) => b.loc - a.loc || (a.rel < b.rel ? -1 : 1))
        .slice(0, 10).map((x) => ({ rel: x.rel, loc: x.loc })),
    };
  };
  return { produktion: teil(istProduktion), test: teil(istTest) };
}

/** K2 — Typ-Löcher. `eslint-disable` getrennt nach WIRKSAM und INERT:
 *  eine Direktive gegen eine Regel, die die Config gar nicht aktiviert, ist eine
 *  Vorab-Stummschaltung — wer die Regel je einschaltet, bekommt null Treffer und
 *  hält das fälschlich für ein sauberes Ergebnis. */
export function typLoecher(files, aktiveRegeln) {
  const prod = files.filter((f) => istProduktion(f.rel));
  const zaehle = (re, menge) => {
    const treffer = [];
    for (const f of menge) {
      f.lines.forEach((l, i) => { if (re.test(l)) treffer.push(`${f.rel}:${i + 1}`); });
    }
    return treffer;
  };
  const disable = [];
  for (const f of files) {
    f.lines.forEach((l, i) => {
      const m = l.match(/eslint-disable(?:-next-line|-line)?\s+([@\w/-]+)/);
      if (m) disable.push({ ort: `${f.rel}:${i + 1}`, regel: m[1], aktiv: aktiveRegeln.has(m[1]) });
    });
  }
  return {
    asAny: zaehle(/\bas any\b/, prod),
    doppelpunktAny: zaehle(/:\s*any\b/, prod),
    tsIgnore: zaehle(/@ts-(ignore|nocheck)\b/, files),
    tsExpectError: zaehle(/@ts-expect-error\b/, files),
    disableGesamt: disable.length,
    disableWirksam: disable.filter((d) => d.aktiv),
    disableInert: disable.filter((d) => !d.aktiv),
  };
}

/** Aktive ESLint-Regeln aus der Flat-Config lesen (Textscan, kein Import:
 *  das Modul soll ohne ESLint-Laufzeit auskommen). */
export function aktiveEslintRegeln(root) {
  const p = join(root, 'eslint.config.js');
  if (!existsSync(p)) return new Set();
  const src = readFileSync(p, 'utf8');
  const set = new Set();
  for (const m of src.matchAll(/'([@\w/-]+)'\s*:\s*'(error|warn)'/g)) set.add(m[1]);
  return set;
}

/** K3 — Fehlerbehandlung. Ein LEERER catch ist etwas anderes als ein bewusst
 *  kommentierter: er sagt nicht, ob der Fehler egal ist oder ob ihn jemand
 *  vergessen hat. */
export function fehlerbehandlung(files) {
  const prod = files.filter((f) => istProduktion(f.rel));
  const leer = [];
  let mitBegruendung = 0;
  let catchGesamt = 0;
  for (const f of prod) {
    catchGesamt += (f.content.match(/\bcatch\s*(\([^)]*\))?\s*\{/g) || []).length;
    for (const m of f.content.matchAll(/catch\s*(?:\([^)]*\))?\s*\{[\r\n\t ]*\}/g)) {
      leer.push(`${f.rel}:${f.content.slice(0, m.index).split(/\r?\n/).length}`);
    }
    for (const m of f.content.matchAll(/catch\s*(?:\([^)]*\))?\s*\{[\r\n\t ]*\/\/[^\r\n]*[\r\n\t ]*\}/g)) {
      if (m) mitBegruendung++;
    }
  }
  return { catchGesamt, leer, mitBegruendung };
}

/** K4 — Schulden-Marker. `TODO(refactor …)` wird getrennt geführt: dieser Vermerk
 *  hat im Projekt eine Geschichte (7 Köpfe aus v2.3, bei v6.38 unverändert). */
export function marker(files) {
  const prod = files.filter((f) => istProduktion(f.rel));
  const allgemein = [];
  const refactor = [];
  for (const f of prod) {
    f.lines.forEach((l, i) => {
      if (/TODO\(refactor/.test(l)) refactor.push(`${f.rel}:${i + 1}`);
      else if (/(\/\/|\*)\s*(TODO|FIXME|HACK|XXX)\b/.test(l)) allgemein.push(`${f.rel}:${i + 1}`);
    });
  }
  return { allgemein, refactor };
}

/** K5 — Zensus der Guard-Ausnahmen. Marker INNERHALB der Guard-Dateien sind
 *  Fehlermeldungs-Text und Fixtures, keine echten Ausnahmen — sie bleiben
 *  draußen, sonst überzählt die Statistik um Faktor zwei. */
export function allowMarker(files) {
  const jeRegel = new Map();
  for (const f of files) {
    if (f.rel.startsWith('src/__tests__/')) continue;
    f.lines.forEach((l, i) => {
      const m = l.match(/\/\/\s*allow-([a-z0-9-]+)\s*:?\s*(.*)$/);
      if (!m) return;
      if (!jeRegel.has(m[1])) jeRegel.set(m[1], []);
      jeRegel.get(m[1]).push({ ort: `${f.rel}:${i + 1}`, grund: m[2].trim() });
    });
  }
  const eintraege = [...jeRegel.entries()]
    .map(([regel, orte]) => ({ regel, anzahl: orte.length, ohneGrund: orte.filter((o) => !o.grund).length }))
    .sort((a, b) => b.anzahl - a.anzahl || (a.regel < b.regel ? -1 : 1));
  return { gesamt: eintraege.reduce((s, e) => s + e.anzahl, 0), regeln: eintraege.length, eintraege };
}

const pluginVon = (rel) => {
  const m = rel.match(/^src\/plugins\/([^/]+)\//);
  return m ? m[1] : null;
};

/** K6 — Kopplung. Zwei Richtungsverstöße, die das Projekt selbst als Architektur
 *  zusagt: der Kern darf die Features nicht kennen, und ein Plugin greift nicht
 *  ins Innenleben eines fremden. */
export function kopplung(files) {
  const prod = files.filter((f) => istProduktion(f.rel));
  const coreZuPlugins = [];
  const pluginPaare = new Map();
  const fanOut = [];
  for (const f of prod) {
    let n = 0;
    const eigen = pluginVon(f.rel);
    f.lines.forEach((l, i) => {
      const m = l.match(/^\s*import\s.*from\s+'([^']+)'/) || l.match(/^\s*import\s+'([^']+)'/);
      if (!m) return;
      n++;
      const ziel = m[1];
      if (f.rel.startsWith('src/core/') && /(^@\/plugins\/|(\.\.\/)+plugins\/)/.test(ziel)) {
        coreZuPlugins.push(`${f.rel}:${i + 1}`);
      }
      const zm = ziel.match(/@\/plugins\/([^/']+)/);
      if (eigen && zm && zm[1] !== eigen) {
        const k = `${eigen} → ${zm[1]}`;
        pluginPaare.set(k, (pluginPaare.get(k) || 0) + 1);
      }
    });
    if (n > 0) fanOut.push({ rel: f.rel, n });
  }
  return {
    coreZuPlugins,
    pluginPaare: [...pluginPaare.entries()].map(([paar, n]) => ({ paar, n }))
      .sort((a, b) => b.n - a.n || (a.paar < b.paar ? -1 : 1)),
    fanOutTop: fanOut.sort((a, b) => b.n - a.n || (a.rel < b.rel ? -1 : 1)).slice(0, 10),
  };
}

/** K7 — Duplikate über Fingerprint-Fenster. Fenstergröße ist die entscheidende
 *  Stellschraube: bei 6 Zeilen dominieren absichtlich parallele Familien
 *  (Seeds, Erhebungs-Hooks) das Bild; bei 15 bleiben die echten Kandidaten. */
export function duplikate(files, fenster = 15) {
  const prod = files.filter((f) => istProduktion(f.rel));
  const gesehen = new Map();
  for (const f of prod) {
    const bedeutsam = [];
    f.lines.forEach((l, i) => {
      const t = l.trim();
      if (t.length >= 12 && !istKommentar(t)) bedeutsam.push({ t, nr: i + 1 });
    });
    for (let i = 0; i + fenster <= bedeutsam.length; i++) {
      const key = bedeutsam.slice(i, i + fenster).map((x) => x.t).join('\n');
      if (!gesehen.has(key)) gesehen.set(key, []);
      gesehen.get(key).push({ rel: f.rel, nr: bedeutsam[i].nr });
    }
  }
  const paare = new Map();
  for (const orte of gesehen.values()) {
    const dateien = [...new Set(orte.map((o) => o.rel))];
    if (dateien.length < 2) continue;
    for (let a = 0; a < dateien.length; a++) {
      for (let b = a + 1; b < dateien.length; b++) {
        const k = [dateien[a], dateien[b]].sort().join('  ⇄  ');
        paare.set(k, (paare.get(k) || 0) + 1);
      }
    }
  }
  return {
    fenster,
    paare: [...paare.entries()].map(([paar, n]) => ({ paar, n }))
      .sort((a, b) => b.n - a.n || (a.paar < b.paar ? -1 : 1)),
  };
}

/** K8 — Testbezug. Bewusst KEIN Abdeckungsmaß: gezählt wird, ob ein Modul in
 *  irgendeiner Testdatei überhaupt vorkommt. Ein Modul ohne Erwähnung ist sicher
 *  ungetestet; eines mit Erwähnung ist damit noch nicht geprüft. */
export function testbezug(files) {
  const tests = files.filter((f) => istTest(f.rel));
  const testText = tests.map((f) => f.content).join('\n');
  const ohne = [];
  for (const f of files) {
    if (!istProduktion(f.rel) || f.rel.endsWith('.tsx')) continue;
    const name = basename(f.rel).replace(/\.tsx?$/, '');
    if (!testText.includes(name)) ohne.push({ rel: f.rel, loc: f.loc });
  }
  const bereiche = new Map();
  for (const f of files) {
    const m = f.rel.match(/^src\/(core\/[^/]+|plugins\/[^/]+|components|config|lib)/);
    if (!m) continue;
    if (!bereiche.has(m[1])) bereiche.set(m[1], { prod: 0, test: 0 });
    bereiche.get(m[1])[istTest(f.rel) ? 'test' : 'prod'] += f.loc;
  }
  return {
    ohneBezug: ohne.sort((a, b) => b.loc - a.loc).slice(0, 15),
    ohneBezugAnzahl: ohne.length,
    module: files.filter((f) => istProduktion(f.rel) && !f.rel.endsWith('.tsx')).length,
    bereiche: [...bereiche.entries()]
      .map(([b, v]) => ({ bereich: b, ...v, quote: v.prod ? v.test / v.prod : 0 }))
      .filter((b) => b.prod > 3000)
      .sort((a, b) => a.quote - b.quote),
  };
}

/** K9 — Exporte ohne Nutzer außerhalb ihrer Datei. Näherung per Token-Index:
 *  `noUnusedLocals` hält alles UNTERHALB der Export-Grenze sauber, diese Zahl ist
 *  genau der Blindfleck, den der Compiler nicht sehen kann. */
export function toteExporte(files) {
  const decl = [];
  for (const f of files) {
    if (!istProduktion(f.rel)) continue;
    f.lines.forEach((l, i) => {
      const m = l.match(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/);
      if (m) decl.push({ name: m[1], rel: f.rel, nr: i + 1 });
    });
  }
  const vorkommen = new Map();
  for (const f of files) {
    for (const m of f.content.matchAll(/[A-Za-z_$][\w$]*/g)) {
      const k = m[0];
      if (!vorkommen.has(k)) vorkommen.set(k, new Set());
      vorkommen.get(k).add(f.rel);
    }
  }
  const tot = decl.filter((d) => {
    const dateien = vorkommen.get(d.name);
    return dateien && dateien.size === 1 && dateien.has(d.rel);
  });
  const jeDatei = new Map();
  for (const t of tot) jeDatei.set(t.rel, (jeDatei.get(t.rel) || 0) + 1);
  return {
    exporteGesamt: decl.length,
    tot: tot.length,
    nester: [...jeDatei.entries()].map(([rel, n]) => ({ rel, n }))
      .sort((a, b) => b.n - a.n || (a.rel < b.rel ? -1 : 1)).slice(0, 10),
    beispiele: tot.slice(0, 20).map((t) => `${t.rel}:${t.nr} ${t.name}`),
  };
}

/** K10 — Die Guard-Suite über sich selbst. Ein Zeilen-Guard OHNE Positivkontrolle
 *  ist nach einem Umbruch nicht rot, sondern still grün: ein funktionierender und
 *  ein entwaffneter Guard sehen dann gleich aus. */
export function guardSuite(files, root) {
  const guards = files.filter((f) => f.rel.startsWith('src/__tests__/') && f.rel.endsWith('.test.ts'));
  let describes = 0, zeilenScan = 0, mitKontrolle = 0;
  for (const f of guards) {
    const bloecke = f.content.split(/^describe\(/m).slice(1);
    describes += bloecke.length;
    for (const b of bloecke) {
      if (/findInFile\(|findFilesViolating\(|findInContent\(/.test(b)) zeilenScan++;
      if (/\.test\(['"`]|toBe\(true\)|toBe\(false\)/.test(b)) mitKontrolle++;
    }
  }
  // Die Eintrags-Pfade GEZIELT lesen, nicht „alles in Anführungszeichen": die Liste
  // ist dicht kommentiert, und ein Regex über beliebige Quotes verklebt ein
  // schliessendes Zeichen aus einem Kommentar mit dem nächsten Eintrag (52 rohe
  // „Treffer", davon 23 echte Pfade — der Rest Müll über Zeilengrenzen hinweg).
  const isoliert = new Set();
  const vc = join(root, 'vitest.config.mts');
  if (existsSync(vc)) {
    for (const m of readFileSync(vc, 'utf8').matchAll(/'(src\/[^']+\.test\.tsx?)'/g)) {
      isoliert.add(m[1]);
    }
  }
  const viMock = files.filter((f) => istTest(f.rel) && /^\s*vi\.mock\(/m.test(f.content));
  const viMockOhneIsolation = viMock.filter((f) => !isoliert.has(f.rel)).map((f) => f.rel);
  return { dateien: guards.length, describes, zeilenScan, mitKontrolle,
    ohneKontrolle: describes - mitKontrolle, isolated: isoliert.size,
    viMockGesamt: viMock.length, viMockOhneIsolation };
}

/** Alle Kennzahlen in einem Lauf. */
export function messeAlles(root) {
  const files = collectSourceFiles(root);
  const regeln = aktiveEslintRegeln(root);
  return {
    dateien: files.length,
    loc: loc(files),
    typLoecher: typLoecher(files, regeln),
    fehlerbehandlung: fehlerbehandlung(files),
    marker: marker(files),
    allowMarker: allowMarker(files),
    kopplung: kopplung(files),
    duplikate: duplikate(files),
    testbezug: testbezug(files),
    toteExporte: toteExporte(files),
    guardSuite: guardSuite(files, root),
  };
}
