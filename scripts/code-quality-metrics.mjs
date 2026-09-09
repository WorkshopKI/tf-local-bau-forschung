#!/usr/bin/env node
/**
 * TeamFlow Codequalitäts-Baseline.
 *
 * Erzeugt `docs/architecture/code-quality-baseline.md` aus dem Mess-Modul
 * `scripts/lib/quality-metrics.mjs`. Zweck: die Kennzahlen, an denen technische
 * Schuld in diesem Repo sichtbar wird, an EINER Stelle und mit Fundstellen —
 * damit ein Abbau am Ist ansetzt und nicht an einer Vermutung.
 *
 * Bewusst NICHT im `precheck`-Hook: der Report beschreibt, er verbietet nichts.
 * Was durchsetzt, ist der Ratchet-Guard in `src/__tests__/` — und der misst
 * selbst nach, statt diese Datei zu lesen.
 *
 * Die Ausgabe ist VERSIONIERT und trägt bewusst KEIN Lauf-Datum: ein Diff soll
 * genau dann entstehen, wenn sich eine Kennzahl bewegt hat, nicht bei jedem Lauf.
 * (Vorbild: die generierten `src/core/status/*.data.ts` sind committet und
 * datumsfrei; nur `code-map.md` ist wegen seines Stand-Datums gitignored.)
 *
 * Deterministisch, reine Node-Stdlib, keine Dependencies.
 *
 * Aufruf:
 *   node scripts/code-quality-metrics.mjs
 *   npm run qualitaet
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { messeAlles } from './lib/quality-metrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'docs', 'architecture', 'code-quality-baseline.md');

const de = (n) => n.toLocaleString('de-DE');
const pct = (a, b) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)} %`);

function render(m) {
  const o = [];
  const p = m.loc.produktion;
  const t = m.loc.test;

  o.push('# Codequalitäts-Baseline — TeamFlow (GENERIERT)');
  o.push('');
  o.push('> **GENERIERT — nicht von Hand editieren.** Aktualisieren: `npm run qualitaet`.');
  o.push('> Quelle: `scripts/code-quality-metrics.mjs` · versioniert, ohne Lauf-Datum.');
  o.push('>');
  o.push('> Diese Datei **misst**, sie verbietet nichts. Eine Zahl wird erst dadurch zur Regel,');
  o.push('> dass ein Guard unter `src/__tests__/` sie einfriert — und der misst selbst nach,');
  o.push('> statt diese Datei zu lesen.');
  o.push('');
  o.push(`**Umfang:** ${de(m.dateien)} Dateien unter \`src/\` ` +
    `(${de(p.dateien)} Produktion / ${de(p.summe)} LOC · ${de(t.dateien)} Test / ${de(t.summe)} LOC). ` +
    '`src/generated/` ist ausgeschlossen.');
  o.push('');

  // ---- Größe
  o.push('## Größe');
  o.push('');
  o.push('| | Dateien | LOC | p50 | p90 | p99 | max | >400 | >500 | >800 | >1000 |');
  o.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const [name, s] of [['Produktion', p], ['Test', t]]) {
    o.push(`| ${name} | ${de(s.dateien)} | ${de(s.summe)} | ${s.p50} | ${s.p90} | ${s.p99} | ` +
      `${de(s.max)} | ${s.ueber400} | ${s.ueber500} | ${s.ueber800} | ${s.ueber1000} |`);
  }
  o.push('');
  o.push('Größte Produktionsdateien:');
  o.push('');
  p.groesste.forEach((f, i) => o.push(`${i + 1}. \`${f.rel}\` — ${de(f.loc)} LOC`));
  o.push('');

  // ---- Typ-Löcher
  const tl = m.typLoecher;
  o.push('## Typsicherheit');
  o.push('');
  o.push('| Kennzahl | Ist |');
  o.push('|---|--:|');
  o.push(`| \`as any\` (Produktion) | ${tl.asAny.length} |`);
  o.push(`| \`: any\` (Produktion) | ${tl.doppelpunktAny.length} |`);
  o.push(`| \`@ts-ignore\` / \`@ts-nocheck\` | ${tl.tsIgnore.length} |`);
  o.push(`| \`@ts-expect-error\` | ${tl.tsExpectError.length} |`);
  o.push(`| \`eslint-disable\` gesamt | ${tl.disableGesamt} |`);
  o.push(`| davon **wirksam** (Regel ist aktiv) | ${tl.disableWirksam.length} |`);
  o.push(`| davon **inert** (Regel gar nicht aktiv) | ${tl.disableInert.length} |`);
  o.push('');
  if (tl.disableInert.length > 0) {
    const jeRegel = new Map();
    for (const d of tl.disableInert) jeRegel.set(d.regel, (jeRegel.get(d.regel) || 0) + 1);
    o.push('**Inerte Direktiven sind Vorab-Stummschaltung.** Sie unterdrücken eine Regel, die');
    o.push('`eslint.config.js` nicht aktiviert — wer die Regel je einschaltet, bekommt null Treffer');
    o.push('und hält das für ein sauberes Ergebnis. Verteilung:');
    o.push('');
    [...jeRegel.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([r, n]) => o.push(`- \`${r}\` — ${n}×`));
    o.push('');
  }

  // ---- Fehlerbehandlung
  const fb = m.fehlerbehandlung;
  o.push('## Fehlerbehandlung');
  o.push('');
  o.push(`\`catch\`-Blöcke im Produktionscode: **${de(fb.catchGesamt)}**, davon ` +
    `**${fb.leer.length}** vollständig leer und **${fb.mitBegruendung}** mit genau einem ` +
    'erklärenden Kommentar als Rumpf.');
  o.push('');
  if (fb.leer.length > 0) {
    o.push('Leer, also ohne Aussage darüber, ob der Fehler egal ist oder vergessen wurde:');
    o.push('');
    fb.leer.slice(0, 20).forEach((x) => o.push(`- \`${x}\``));
    o.push('');
  }

  // ---- Marker
  o.push('## Schulden-Marker');
  o.push('');
  o.push(`\`TODO\`/\`FIXME\`/\`HACK\`/\`XXX\`: **${m.marker.allgemein.length}** · ` +
    `\`TODO(refactor …)\`: **${m.marker.refactor.length}**`);
  o.push('');
  if (m.marker.refactor.length > 0) {
    o.push('Die `TODO(refactor …)`-Köpfe werden getrennt geführt, weil sie im Projekt eine');
    o.push('Geschichte haben: gesetzt in v2.3 an die damalige Top-10-Liste, seither mehrfach');
    o.push('angefasst, ohne dass die vorgeschlagene Aufteilung kam.');
    o.push('');
    m.marker.refactor.forEach((x) => o.push(`- \`${x}\``));
    o.push('');
  }

  // ---- allow-Marker
  const am = m.allowMarker;
  o.push('## Guard-Ausnahmen (`// allow-…`)');
  o.push('');
  o.push(`**${am.gesamt}** Ausnahmen über **${am.regeln}** Regeln, außerhalb der Guard-Dateien` +
    ' selbst (dort sind gleichlautende Vorkommen Fehlermeldungs-Text und Fixtures).');
  o.push('');
  o.push('| Regel | Ausnahmen | ohne Begründung |');
  o.push('|---|--:|--:|');
  am.eintraege.slice(0, 12).forEach((e) =>
    o.push(`| \`${e.regel}\` | ${e.anzahl} | ${e.ohneGrund} |`));
  o.push('');

  // ---- Kopplung
  const k = m.kopplung;
  o.push('## Kopplung');
  o.push('');
  o.push(`Importe aus \`src/core/\` zurück nach \`src/plugins/\` — eine Schichtumkehr, weil der` +
    ` Kern seine Features nicht kennen soll: **${k.coreZuPlugins.length}**`);
  o.push('');
  o.push('Plugin greift auf ein fremdes Plugin (Top 10):');
  o.push('');
  o.push('| Kante | Importzeilen |');
  o.push('|---|--:|');
  k.pluginPaare.slice(0, 10).forEach((x) => o.push(`| ${x.paar} | ${x.n} |`));
  o.push('');
  o.push('Höchster Fan-out (Importzeilen je Datei):');
  o.push('');
  k.fanOutTop.slice(0, 5).forEach((x) => o.push(`- \`${x.rel}\` — ${x.n}`));
  o.push('');

  // ---- Duplikate
  const d = m.duplikate;
  o.push('## Duplikate');
  o.push('');
  o.push(`Wörtlich geteilte Blöcke von **${d.fenster}** bedeutsamen Zeilen (ohne Leerzeilen,` +
    ' Kommentare und Zeilen unter 12 Zeichen). Die Fenstergröße ist die entscheidende' +
    ' Stellschraube: bei 6 Zeilen dominieren absichtlich parallele Familien das Bild.');
  o.push('');
  o.push(`Dateipaare mit mindestens einem geteilten Fenster: **${d.paare.length}**`);
  o.push('');
  if (d.paare.length > 0) {
    o.push('| Paar | geteilte Fenster |');
    o.push('|---|--:|');
    d.paare.slice(0, 12).forEach((x) => o.push(`| ${x.paar.replace(/\|/g, '\\|')} | ${x.n} |`));
    o.push('');
  }

  // ---- Tests
  const tb = m.testbezug;
  o.push('## Testbezug');
  o.push('');
  o.push(`**${tb.ohneBezugAnzahl}** von ${de(tb.module)} reinen \`.ts\`-Modulen ` +
    `(${pct(tb.ohneBezugAnzahl, tb.module)}) werden in keiner Testdatei auch nur genannt.`);
  o.push('');
  o.push('> Bewusst kein Abdeckungsmaß: ein Modul ohne Erwähnung ist sicher ungetestet — eines');
  o.push('> mit Erwähnung ist damit noch nicht geprüft. Für die `.tsx`-Schicht existiert gar');
  o.push('> keine Zahl: `vitest.config.mts` fährt `environment: \'node\'`, es gibt keine');
  o.push('> `.test.tsx`. Diese Lücke ist durch die manuelle `dev:local`-Abnahme ersetzt.');
  o.push('');
  o.push('| Bereich | Produktion | Test | Test/Produktion |');
  o.push('|---|--:|--:|--:|');
  tb.bereiche.slice(0, 12).forEach((b) =>
    o.push(`| \`${b.bereich}\` | ${de(b.prod)} | ${de(b.test)} | ${b.quote.toFixed(2)} |`));
  o.push('');
  o.push('Größte Module ohne jeden Testbezug:');
  o.push('');
  tb.ohneBezug.slice(0, 10).forEach((f) => o.push(`- \`${f.rel}\` — ${de(f.loc)} LOC`));
  o.push('');

  // ---- Tote Exporte
  const te = m.toteExporte;
  o.push('## Exporte ohne Nutzer');
  o.push('');
  o.push(`**${te.ohneFremdnutzer}** von ${de(te.exporteGesamt)} exportierten Werten ` +
    `(${pct(te.ohneFremdnutzer, te.exporteGesamt)}) kommen im ganzen Baum nur in ihrer eigenen ` +
    'Datei vor. Die Menge zerfällt in zwei Fälle, die verschiedene Antworten verlangen:');
  o.push('');
  o.push('| | Anzahl | Was zu tun wäre |');
  o.push('|---|--:|---|');
  o.push(`| **überexportiert** — lebt intern, nur der Export hat keinen Abnehmer | ${te.uebermaessig} | \`export\` streichen |`);
  o.push(`| **tot** — kommt auch in der eigenen Datei kein zweites Mal vor | ${te.tot} | erst hier ist Löschen die Frage |`);
  o.push('');
  o.push('> Näherung per Token-Index. Sie ist genau deshalb ergiebig, weil `noUnusedLocals` alles');
  o.push('> *unterhalb* der Export-Grenze sauber hält — das hier ist der Blindfleck, den der');
  o.push('> Compiler nicht sehen kann.');
  o.push('>');
  o.push('> **Die Trennung ist nicht kosmetisch.** `isAppGateRequired` hat keinen Fremdnutzer, wird');
  o.push('> aber eine Zeile tiefer verwendet — als „toter Code" gelesen wäre es ein Fehlschluss.');
  o.push('>');
  o.push('> Ein wirklich ungenutztes `is…Enabled()` kann dagegen heißen, dass ein Modul **gar nicht**');
  o.push('> gated ist — ein fachlicher Befund, kein Aufräumfall. Die toten Flag-Zugriffe in');
  o.push('> `feature-flags.ts` sind v6.45 einzeln nachgeprüft; sie ergaben **drei verschiedene**');
  o.push('> Antworten, und das ist der Grund, warum diese Menge keine Sammelbehandlung verträgt:');
  o.push('>');
  o.push('> - **redundant** (`isDokumenteEnabled`, `isMapFoerderfaehigEnabled`) — beide Module hängen');
  o.push('>   am `featureFlag` ihres Plugin-Manifests; der Zugriff ist ein zweiter Weg zur selben');
  o.push('>   Frage. Löschen ist gefahrlos.');
  o.push('> - **tot, aber der Schalter lebt** (`isLocalLlamaEnabled`) — `ki.localLlama.enabled` wirkt');
  o.push('>   zur Bauzeit (`config-schema.mjs` verlangt mindestens einen Anbieter); zur Laufzeit');
  o.push('>   kommt der Endpunkt aus den KI-Einstellungen des Nutzers, nicht aus der Build-Config.');
  o.push('> - **noch nicht gebaut** — ein Flag kann angelegt und in Varianten geschaltet sein, bevor');
  o.push('>   die erste Zeile Code ihn liest. Diese Messung hat genau das einmal erwischt und');
  o.push('>   beinahe als „Feature existiert nicht" berichtet, während es nebenan entstand.');
  o.push('>   **Ein Befund aus dieser Liste braucht vor dem Urteil einen Blick auf `git status`:**');
  o.push('>   der Baum ist geteilt, und die Messung sieht nur den Augenblick.');
  o.push('');
  if (te.nester.length > 0) {
    o.push('Dichteste Nester unter den **toten**:');
    o.push('');
    te.nester.forEach((n) => o.push(`- \`${n.rel}\` — ${n.n}`));
    o.push('');
  }

  // ---- Guard-Suite
  const g = m.guardSuite;
  o.push('## Die Guard-Suite über sich selbst');
  o.push('');
  o.push('| Kennzahl | Ist |');
  o.push('|---|--:|');
  o.push(`| Guard-Dateien unter \`src/__tests__/\` | ${g.dateien} |`);
  o.push(`| \`describe\`-Blöcke | ${g.describes} |`);
  o.push(`| davon zeilenweise scannend | ${g.zeilenScan} |`);
  o.push(`| mit Positiv-/Musterkontrolle | ${g.mitKontrolle} |`);
  o.push(`| **ohne Kontrolle** | ${g.ohneKontrolle} |`);
  o.push(`| Dateien in \`ISOLATED_TESTS\` | ${g.isolated} |`);
  o.push(`| Testdateien mit \`vi.mock\` | ${g.viMockGesamt} |`);
  o.push(`| davon **ohne** Isolationseintrag | ${g.viMockOhneIsolation.length} |`);
  o.push('');
  o.push('> Ein zeilenweise scannender Guard ohne Kontrolle ist die stillste Fehlerquelle der');
  o.push('> Suite: bricht ein Ausdruck über zwei Zeilen um, wird er nicht rot, sondern grün —');
  o.push('> ein funktionierender und ein entwaffneter Guard sehen dann gleich aus.');
  o.push('');
  if (g.viMockOhneIsolation.length > 0) {
    o.push('`vi.mock` auf Modulebene ohne Eintrag in `ISOLATED_TESTS` — die vorhergesagten');
    o.push('nächsten Ausfälle im Suite-Lauf:');
    o.push('');
    g.viMockOhneIsolation.forEach((f) => o.push(`- \`${f}\``));
    o.push('');
  }

  return o.join('\n') + '\n';
}

function main() {
  let m;
  try {
    m = messeAlles(ROOT);
  } catch (err) {
    console.error(`❌ Messung fehlgeschlagen: ${err.message}`);
    process.exit(1);
  }
  const markdown = render(m);
  writeFileSync(OUT, markdown, 'utf8');
  console.log(
    `✓ code-quality-baseline.md: ${de(m.dateien)} Dateien gemessen, ` +
      `${de(Math.round(Buffer.byteLength(markdown, 'utf8') / 1024))} KB → ` +
      `${relative(ROOT, OUT).split('\\').join('/')}`,
  );
}

main();
