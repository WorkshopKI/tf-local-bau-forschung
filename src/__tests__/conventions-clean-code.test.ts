/**
 * Codebase-Conventions — Codequalitaet (die vierte Achse).
 *
 * Die Geschwister-Dateien pruefen FACHregeln: welcher Status wie verglichen wird,
 * welches Bauteil wo wohnt, welcher Transport welche Daten tragen darf. Diese
 * Datei prueft die Form des Codes selbst — Sichtbarkeit von Fehlern, Grenzen der
 * Typsicherheit, Schichtrichtung, Wiederholung.
 *
 * DER BEFUND, DER SIE BEGRUENDET: der Bestand ist sauber. Null leere catch-Bloecke,
 * null `@ts-ignore`, null `.only`, 25 `as any` auf 327.669 LOC. Was fehlte, war
 * nicht Disziplin, sondern ihre Festschreibung — vier der Regeln unten haben heute
 * NULL Verstoesse und kosten deshalb nichts. Sie halten einen Zustand, den bisher
 * nur Gewohnheit hielt.
 *
 * ZWEI FORMEN, und die Unterscheidung ist wichtig:
 *
 *   VERBOT   — Ist-Wert 0. Jeder Treffer ist neu und wird korrigiert, nicht
 *              gezaehlt. Die Fehlermeldung nennt die Alternative.
 *   RATSCHE  — Ist-Wert eingefroren, darf nur SINKEN. Der Altbestand muss nie in
 *              einem Rutsch geheilt werden; neu dazu kommt nichts.
 *
 * Warum Ratsche und nicht Drift-Warnung wie in health-baseline: die Historie des
 * Projekts beantwortet das. Ueber alle vier dortigen Schwellen hinweg stehen 70
 * Anhebungen gegen 5 Senkungen — der Fehlertext dort laedt selbst dazu ein
 * ("Schwelle bewusst anheben, wenn der Zuwachs gewollt ist"), und die Einladung
 * wurde 70-mal angenommen. Eine Zahl hier anzuheben ist deshalb kein Normalfall,
 * sondern der begruendungspflichtige Ausnahmefall.
 *
 * Inline-Whitelist wie bei den Geschwistern: `// allow-<rule>: <grund>`. Bei
 * blockweisen Regeln (findInContent) gehoert der Marker auf die ERSTE Zeile des
 * Treffers.
 *
 * Geschwister: conventions-status.test.ts, conventions-ui.test.ts,
 * conventions-daten.test.ts, health-baseline.test.ts. Datei-Walk und
 * Such-Primitive liegen gemeinsam in conventions-lib.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, ALL_TS_FILES, relPath, findInFile, findInContent, fmt, type Finding,
} from './conventions-lib';

// ------------------------------------------------------------------ Werkzeug

/**
 * Diese Datei selbst ist aus JEDEM Scan ausgenommen.
 *
 * Sie muss die verbotenen Muster im Klartext nennen — in ihrer Doku, in ihren
 * `it`-Namen und in ihren Fehlermeldungen. Ohne diesen Ausschluss findet der
 * `@ts-ignore`-Guard vier Treffer in seinem eigenen Erklaertext (so geschehen
 * beim ersten Lauf) und ist damit dauerhaft rot, ohne dass im Bestand irgendetwas
 * faul waere.
 *
 * Das ist keine Kleinigkeit, sondern eine Bugklasse mit Vorgeschichte: bis v4.5
 * mass `MAX_FILE_LOC` sieben Wochen lang die Guard-Datei selbst (3212 Zeilen)
 * statt den Produktionscode (846) — die Sperre war blind, waehrend darunter eine
 * Datei unbemerkt um 165 Zeilen wuchs. Ein Guard, der sich selbst misst, misst
 * das Falsche.
 */
const SELBST = 'src/__tests__/conventions-clean-code.test.ts';

const istTestdatei = (p: string): boolean => p.includes('__tests__') || p.includes('.test.');
const scanDateien = ALL_TS_FILES.filter(f => relPath(f) !== SELBST);
const prodDateien = scanDateien.filter(f => !istTestdatei(relPath(f)));

/**
 * Marker fuer Regeln, die BEWUSST keine Inline-Ausnahme kennen.
 *
 * `findInFile` verlangt einen Whitelist-Marker; ein NUL-Zeichen kann in einer
 * Quelldatei nicht vorkommen, die Bedingung ist also nie erfuellt. Genau das ist
 * hier gewollt: fuer `.only` gibt es keinen legitimen Commit-Grund, und eine
 * Ausnahmemoeglichkeit waere selbst das Risiko.
 */
const KEINE_AUSNAHME = '\u0000';

/**
 * Prosa erklaert eine Regel, sie fuehrt sie nicht aus.
 *
 * Ein Guard, der am Kommentar haengenbleibt, meldet seinen eigenen Erklaertext.
 * Genau das tat `zeitkonstante-hat-einen-namen` bis v6.45: zwei seiner neun
 * Treffer waren Fliesstext (einer davon die Datei, die die Konstante EINFUEHRT).
 * Das Geschwister `no-inline-frist-arithmetik` hat den Filter seit v3.6.
 */
const istKommentar = (l: string): boolean => /^\s*(?:\/\/|\/?\*)/.test(l);

/**
 * `export const STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000;` — eine benannte
 * Konstante in UPPER_SNAKE_CASE.
 *
 * Sie darf nicht als Treffer zaehlen, weil sie DER WEG RAUS ist, den die Regel
 * selbst nennt ("eine benannte Konstante am Modulkopf"). Fuenf der neun Treffer
 * von `zeitkonstante-hat-einen-namen` waren bis v6.45 genau diese Form: der
 * Guard zaehlte die Loesung als Problem und war damit nicht abarbeitbar — wer
 * ihm folgte, blieb rot.
 */
const istBenannteKonstante = (l: string): boolean =>
  /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*(?::[^=]+)?=/.test(l);

/** Fehlertext einer RATSCHE. Bewusst anders formuliert als `drift()` in
 *  health-baseline: dort ist Anheben der vorgesehene Weg, hier der Ausnahmefall. */
const ratsche = (regel: string, ist: number, deckel: number, warum: string, weg: string): string =>
  `${regel}: ${ist} Treffer, eingefroren waren ${deckel}.\n\n` +
  `${warum}\n\n` +
  `Diese Zahl darf nur SINKEN. Ist der Zuwachs unvermeidbar, dann mit ` +
  `\`// allow-${regel}: <grund>\` an der Fundstelle — nicht durch Anheben des ` +
  `Deckels. Wer den Deckel doch anhebt, ersetzt die Begruendung im Kommentar ` +
  `(nicht anhaengen) und nennt sie im Changelog.\n\n` +
  `Weg raus: ${weg}\n\nTreffer:\n`;

/**
 * Alle Suchmuster an EINER Stelle — damit sie am Ende der Datei gegen
 * Positiv- und Negativproben laufen koennen.
 *
 * Warum das noetig ist: 44 der 49 zeilenweise scannenden Guards dieses Projekts
 * haben KEINE solche Probe. Bricht ein Ausdruck im Bestand ueber zwei Zeilen um,
 * findet ein zeilenlokales Muster ihn nicht mehr — und der Guard wird dann nicht
 * rot, sondern GRUEN. Ein funktionierender und ein entwaffneter Guard sehen von
 * aussen gleich aus. Die Probe ist der einzige Unterschied.
 */
const MUSTER = {
  testOnly: /\b(it|test|describe)\.only\b/,
  leererCatch: /catch\s*(?:\([^)]*\))?\s*\{[\r\n\t ]*\}/g,
  tsUnterdrueckung: /@ts-(ignore|nocheck)\b/,
  eslintDisable: /eslint-disable(?:-next-line|-line)?\s+([@\w/-]+)/,
  asAny: /\bas any\b/,
  coreZuPlugins: /from\s+'(@\/plugins\/|(\.\.\/)+plugins\/)/,
  zeit: /\b(1000\s*\*\s*60|60\s*\*\s*60\s*\*\s*1000|86400000|3600000|604800000|900000|1800000|600000|300000|60000)\b/,
  vierParameter: /^\s*(export\s+)?(async\s+)?function\s+\w+\s*\(\s*[A-Za-z_$][^{)]*?(,[^,{)]*){3,}\)/,
  tiefeVerschachtelung: /^ {14,}(if|for|while|switch|try)\s*[({]/,
  exportFunktion: /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  cnPaket: /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]cn(?:\/[^'"]*)?['"]/,
  cnFremdeHerkunft: /import\s*\{[^}]*\bcn\b[^}]*\}\s*from\s*['"](?!@\/lib\/utils['"])[^'"]+['"]/g,
} as const;

/** Die Abhaengigkeits-Sektionen der package.json, in denen ein Paket stehen kann. */
const DEP_SEKTIONEN = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
const sektionenMitPaket = (pkg: Record<string, unknown>, name: string): string[] =>
  DEP_SEKTIONEN.filter(s => {
    const d = pkg[s];
    return typeof d === 'object' && d !== null && name in d;
  });

// ============================================================ VERBOTE (Ist 0)

describe('kein-test-only (der Suite-Killer)', () => {
  // 10.798 Tests laufen in gut 45 s. Ein vergessenes `.only` laesst davon EINEN
  // laufen — und meldet gruen. Der Bestand hat es nie getan; genau darum kostet
  // dieser Guard nichts und faengt trotzdem den teuersten Einzelfehler der Suite.
  // BEWUSST OHNE Inline-Whitelist: anders als bei `.skip` gibt es fuer `.only`
  // keinen legitimen Commit-Grund, eine Ausnahmemoeglichkeit waere selbst das Risiko.
  it('kein `.only` in irgendeiner Testdatei', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      if (!istTestdatei(relPath(file))) continue;
      treffer.push(...findInFile(file, l => MUSTER.testOnly.test(l), KEINE_AUSNAHME));
    }
    if (treffer.length > 0) {
      expect.fail(
        `\`.only\` in einer Testdatei — der Suite-Lauf meldet dann gruen ueber\n` +
        `alle uebrigen Tests, die gar nicht gelaufen sind.\n\n` +
        `Stattdessen einzeln laufen lassen: \`npx vitest run <pfad> -t "<name>"\`.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });
});

describe('kein-stiller-catch (die Begruendung IST die Regel)', () => {
  // Der Bestand macht das Richtige und hat es nur nie aufgeschrieben: 33 catch-
  // Bloecke tragen genau einen erklaerenden Satz, warum das Schlucken hier
  // stimmt — und NULL Bloecke sind leer. Ein leerer Block sagt nicht, ob der
  // Fehler egal ist oder ob ihn jemand vergessen hat; beides sieht gleich aus.
  it('kein catch-Block ohne Inhalt', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInContent(
        file, new RegExp(MUSTER.leererCatch), 'allow-stiller-catch',
      ));
    }
    if (treffer.length > 0) {
      expect.fail(
        `Leerer catch-Block: der Fehler verschwindet, ohne dass irgendwo steht,\n` +
        `warum das in Ordnung ist.\n\n` +
        `So macht es der Bestand an 33 Stellen — ein Satz genuegt:\n` +
        `  } catch {\n` +
        `    // Eine kaputte Zeile ist kein Grund, den ganzen Monat zu verwerfen —\n` +
        `    // append-only-Dateien koennen an einem abgebrochenen Write enden.\n` +
        `  }\n\n` +
        `Soll der Fehler NICHT geschluckt werden: werfen, oder in der Oberflaeche\n` +
        `ueber useAsyncAction fuehren (Pitfall #15).\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });
});

describe('keine-stumme-typunterdrueckung', () => {
  // `@ts-ignore` unterdrueckt JEDEN Fehler der Folgezeile, auch einen kuenftigen,
  // den niemand gemeint hat. `@ts-expect-error` wird rot, sobald der Fehler weg
  // ist — es altert also mit. Der Bestand nutzt ausschliesslich die zweite Form
  // (6 Stellen, alle mit Grund) und keine einzige der ersten.
  it('kein `@ts-ignore` / `@ts-nocheck` — nur `@ts-expect-error` mit Grund', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInFile(file, l => MUSTER.tsUnterdrueckung.test(l), 'allow-ts-unterdrueckung'));
    }
    if (treffer.length > 0) {
      expect.fail(
        `\`@ts-ignore\` / \`@ts-nocheck\` unterdrueckt jeden Fehler der Folgezeile —\n` +
        `auch einen, der erst spaeter entsteht und den niemand gemeint hat.\n\n` +
        `Stattdessen \`@ts-expect-error <grund>\`: das wird ROT, sobald der Fehler\n` +
        `verschwindet, und verrottet damit nicht still.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });
});

describe('eslint-disable-nur-fuer-inaktive-regel (die Stolperdrahtregel)', () => {
  // Die eigentuemlichste Regel dieser Datei, und die wichtigste.
  //
  // Alle 72 `eslint-disable`-Direktiven im Bestand unterdruecken Regeln, die
  // eslint.config.js GAR NICHT aktiviert (49x exhaustive-deps, 13x no-console).
  // Sie sind heute wirkungslos — aber sie sind eine geladene Falle: schaltet
  // jemand `exhaustive-deps` ein, greifen sie sofort, der Lauf meldet null
  // Treffer, und das liest sich wie ein sauberes Ergebnis. `reportUnusedDisable-
  // Directives` steht ausserdem auf 'off', ESLint sagt also auch nichts.
  //
  // Der Guard dreht die Falle in einen Stolperdraht: er ist heute gruen (0) und
  // wird in genau dem Moment rot, in dem eine Regel aktiviert wird, fuer die
  // Direktiven herumliegen. Dann muessen sie EINZELN angesehen werden — was der
  // richtige Zeitpunkt dafuer ist.
  const aktiveRegeln = (): Set<string> => {
    const p = join(ROOT, '..', 'eslint.config.js');
    if (!existsSync(p)) return new Set();
    const src = readFileSync(p, 'utf-8');
    const s = new Set<string>();
    for (const m of src.matchAll(/'([@\w/-]+)'\s*:\s*'(?:error|warn)'/g)) s.add(m[1]!);
    return s;
  };

  it('keine Direktive gegen eine Regel, die die Config aktiviert', () => {
    const aktiv = aktiveRegeln();
    expect(aktiv.size, 'eslint.config.js muss lesbar sein und mindestens eine aktive Regel haben')
      .toBeGreaterThan(0);

    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInFile(file, l => {
        const m = l.match(MUSTER.eslintDisable);
        return m !== null && aktiv.has(m[1]!);
      }, 'allow-eslint-disable'));
    }
    if (treffer.length > 0) {
      expect.fail(
        `Eine \`eslint-disable\`-Direktive unterdrueckt eine AKTIVE Regel.\n\n` +
        `Aktiv laut eslint.config.js: ${[...aktiv].sort().join(', ')}\n\n` +
        `Dieser Guard wird genau dann rot, wenn eine bisher inaktive Regel\n` +
        `eingeschaltet wird, fuer die noch Direktiven herumliegen — die greifen\n` +
        `dann sofort, und der erste Lauf meldet faelschlich null Treffer.\n` +
        `Die Fundstellen gehoeren jetzt EINZELN angesehen, nicht pauschal behalten.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });
});

describe('keine-steuerzeichen-im-quelltext', () => {
  // Steuerzeichen als Trenner sind hier eine RICHTIGE Idee — sie kommen in
  // Nutzdaten nicht vor, taugen also als Verbinder fuer zusammengesetzte
  // Schluessel (`aspekte.join('\\u0000')`, `${configId}\\u001f${mode}`).
  //
  // Falsch war nur die Schreibweise. Bis v6.41 standen sie als LITERALES BYTE in
  // sechs Quelldateien — und eine Datei mit einem NUL fuehrt git als BINAER.
  // Fuer fuenf dieser Dateien gab es dadurch monatelang kein Diff-Review, kein
  // textuelles Merge, kein `git log -S`, und `git blame` war entwertet. Das
  // komplette Gate lief daran vorbei, weil zur Laufzeit alles stimmte.
  //
  // Die Escape-Sequenz `\\u0000` ist derselbe Wert und bleibt Text.
  //
  // Ist 0 — und der Weg dorthin war eine Zeichen-fuer-Zeichen-Ersetzung ohne
  // jede Verhaltensaenderung.
  const STEUERZEICHEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

  it('kein literales Steuerzeichen — Escape-Sequenz schreiben', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInFile(file, l => STEUERZEICHEN.test(l), 'allow-steuerzeichen'));
    }
    if (treffer.length > 0) {
      expect.fail(
        `Literales Steuerzeichen im Quelltext. Enthaelt eine Datei ein NUL, fuehrt\n` +
        `git sie als BINAER: kein Diff, kein textuelles Merge, kein \`git log -S\`,\n` +
        `und \`git blame\` zeigt nichts Brauchbares mehr.\n\n` +
        `Der Wert ist richtig, nur die Schreibweise nicht — statt des Bytes die\n` +
        `Escape-Sequenz setzen:\n` +
        `  const TRENNER = '\\u0000';      statt eines literalen NUL\n` +
        `  \`\${a}\\u001f\${b}\`               statt eines literalen U+001F\n\n` +
        `Der Laufzeitwert ist derselbe.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });

  it('das Muster greift (Musterkontrolle)', () => {
    expect(STEUERZEICHEN.test(`const T = '${String.fromCharCode(0)}';`)).toBe(true);
    expect(STEUERZEICHEN.test(`const S = '${String.fromCharCode(31)}';`)).toBe(true);
    // Gegenproben: die Escape-SCHREIBWEISE ist der Weg raus und darf nie treffen,
    // ebenso Tabulator und normaler Text.
    expect(STEUERZEICHEN.test("const T = '\\u0000';")).toBe(false);
    expect(STEUERZEICHEN.test('\tconst x = 1;')).toBe(false);
    expect(STEUERZEICHEN.test('const s = "Grüße";')).toBe(false);
  });
});

describe('fixture-tore-melden-sich (ein stiller Skip ist schlimmer als ein fehlender Test)', () => {
  // Mehrere Testbloecke haengen an Dateien, die per .gitignore bewusst NICHT im
  // Repo liegen — echte CSV-Exporte, echte Outlook-Mails, eine echte Einreichung.
  // Bis v6.44 schaltete jeder von ihnen sich selbst ab und sagte nichts: auf
  // dieser Maschine liefen 16 Tests, auf einem frischen Klon verschwanden sie
  // wortlos, und der Lauf blieb in BEIDEN Faellen gruen. Zwei Entwickler fuehrten
  // aus demselben Commit unterschiedliche Testmengen aus, ohne dass die Ausgabe
  // das verriet.
  //
  // WARUM DIESER WAECHTER ROT WIRD statt zu warnen: gemessen, nicht vermutet.
  // Vitest 4 zeigt Konsolen-Ausgaben bestandener Tests im Standard-Reporter
  // nicht an — weder aus der Sammelphase noch aus einem laufenden Test (mit
  // einer Sonde geprueft: ein `console.warn` in einem gruenen Test erscheint
  // nirgends). Der einzige Kanal, den dieser Reporter zuverlaessig zeigt, ist
  // ein roter Test. „Laut" heisst hier also zwangslaeufig „rot".
  //
  // Damit ein Rechner ohne Fixtures nicht dauerhaft rot bleibt, gibt es eine
  // QUITTUNG: `TF_OHNE_FIXTURES=1`. Wer sie setzt, hat die Meldung gelesen und
  // weiss, dass sein Lauf einen Teil nicht prueft. Genau das war das Ziel.
  const TORE = [
    ['docs/fixtures/sample_9097_AnB_AitisiGPT.csv', 'Real-CSV Master (Antraege+Bewilligungen)'],
    ['docs/fixtures/sample_7737_Bgl.csv', 'Real-CSV Bgl (Bewilligungsdetails)'],
    ['docs/fixtures/sample_9052_PrjBsp_AitisiGPT.csv', 'Real-CSV PrjBsp (Projektbeschreibung)'],
    ['src/plugins/map-foerderfaehig/__tests__/fixtures-local/echtfall-2026.json', 'MAP-Echtfall-Einreichung'],
    ['src/core/services/msg/__tests__/fixtures-local', 'echte Outlook-.msg'],
  ] as const;

  it('jeder fixture-gebundene Block kann hier laufen — oder es ist quittiert', () => {
    const fehlend = TORE.filter(([p]) => !existsSync(join(ROOT, '..', p)));
    if (fehlend.length === 0) return;
    if (process.env.TF_OHNE_FIXTURES === '1') return;
    expect.fail(
      `${fehlend.length} von ${TORE.length} fixture-gebundenen Testbloecken koennen auf\n` +
      `dieser Maschine NICHT laufen. Der Rest der Suite ist gruen — er prueft diese\n` +
      `Teile aber nicht.\n\n` +
      fehlend.map(([p, was]) => `  fehlt: ${p}\n         → ${was}`).join('\n') + '\n\n' +
      `Diese Dateien liegen bewusst nicht im Repo: es sind echte Exportdaten, echte\n` +
      `Mails und eine echte Einreichung (.gitignore). Das ist richtig so — nur darf\n` +
      `es nicht stumm passieren.\n\n` +
      `Zwei Wege weiter:\n` +
      `  • Fixtures vom Daten-Share holen und hierher legen, dann laufen sie.\n` +
      `  • Oder quittieren: TF_OHNE_FIXTURES=1 setzen. Damit ist festgehalten,\n` +
      `    dass dieser Lauf einen Teil bewusst auslaesst.`,
    );
  });

  it('kein Testblock schaltet sich an einer Fixture vorbei selbst ab', () => {
    // Der Weg fuehrt ueber beschreibeMitFixture/beschreibeWenn aus fixture-gate.ts.
    // Ein handgeschriebenes `existsSync(...) ? describe : describe.skip` umgeht den
    // Waechter oben — dann steht der Block wieder in keiner Bilanz.
    const HANDGEMACHT = /existsSync\([^)]*\)\s*\?\s*describe\s*:\s*describe\.skip|describe\.skipIf\(/;
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      if (!istTestdatei(relPath(file))) continue;
      treffer.push(...findInFile(file, l => HANDGEMACHT.test(l), 'allow-eigenes-fixture-tor'));
    }
    if (treffer.length > 0) {
      expect.fail(
        `Ein Testblock schaltet sich selbst an einer Fixture ab, ohne den gemeinsamen\n` +
        `Waechter zu benutzen. Er faellt damit aus der Bilanz oben heraus und wird\n` +
        `wieder still uebersprungen.\n\n` +
        `Stattdessen:\n` +
        `  import { beschreibeMitFixture } from '@/__tests__/fixture-gate';\n` +
        `  beschreibeMitFixture('Name', PFAD, 'warum liegt das nicht im Repo', () => { … });\n\n` +
        `Und den Pfad in TORE (dieser Datei) eintragen.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });
});

describe('cn-kommt-aus-lib-utils (die shadcn-CLI loeste den Alias falsch auf)', () => {
  // v6.59.0: `npx shadcn@latest add dropdown-menu` (CLI 4.21.0) schrieb trotz
  // korrektem components.json (`aliases.utils: "@/lib/utils"`) in die neue
  // Komponente `import { cn } from "cn"` und trug das gleichnamige npm-Paket
  // `cn@0.2.6` in package.json + Lock ein. Typecheck und Lint blieben GRUEN —
  // das fremde Paket existiert ja und liefert etwas, das sich importieren laesst.
  // Aufgefallen ist es nur am `git diff package.json`.
  //
  // Unser `cn` ist `twMerge(clsx(…))` aus src/lib/utils.ts, und alle 23
  // Importstellen holen es von dort. Ist 0 auf allen drei Achsen — die Regel
  // haelt fest, was die CLI beim naechsten `add` wieder kaputtmachen kann.
  it('kein Import des npm-Pakets `cn`', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInFile(file, l => MUSTER.cnPaket.test(l), KEINE_AUSNAHME));
    }
    if (treffer.length > 0) {
      expect.fail(
        `Import des npm-Pakets \`cn\` — das ist NICHT unser Klassen-Helfer.\n\n` +
        `Unser \`cn\` ist \`twMerge(clsx(…))\` aus src/lib/utils.ts. Das gleichnamige\n` +
        `npm-Paket ist etwas Fremdes, das \`npx shadcn@latest add\` (CLI 4.21) trotz\n` +
        `korrektem components.json eingetragen hat — Typecheck und Lint bleiben dabei gruen.\n\n` +
        `Stattdessen: import { cn } from '@/lib/utils' — und \`npm uninstall cn\`.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });

  it('benannter Import `cn` nur aus @/lib/utils', () => {
    const treffer: Finding[] = [];
    for (const file of scanDateien) {
      treffer.push(...findInContent(
        file, new RegExp(MUSTER.cnFremdeHerkunft), 'allow-cn-kommt-aus-lib-utils',
      ));
    }
    if (treffer.length > 0) {
      expect.fail(
        `\`cn\` wird aus einer anderen Quelle als '@/lib/utils' importiert.\n\n` +
        `Es gibt genau EINEN Klassen-Helfer; jede andere Quelle ist entweder ein\n` +
        `falsch aufgeloester Alias (so schreibt ihn die shadcn-CLI, wenn sie\n` +
        `components.json nicht folgt) oder eine zweite Fassung mit anderem Verhalten.\n\n` +
        `Stattdessen: import { cn } from '@/lib/utils'.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });

  it('package.json fuehrt keine Abhaengigkeit `cn`', () => {
    // Das Lockfile bleibt bewusst aussen vor: dort darf `cn` als transitive
    // Abhaengigkeit eines legitimen Pakets auftauchen, und `npm uninstall`
    // bereinigt ohnehin beide Dateien.
    const pkg = JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf-8')) as Record<string, unknown>;
    // Positiv-Kontrolle: eine unlesbare oder falsch gelesene package.json saehe
    // genauso gruen aus wie eine saubere.
    expect(sektionenMitPaket(pkg, 'react'), 'package.json muss lesbar sein und react fuehren')
      .toEqual(['dependencies']);
    const fund = sektionenMitPaket(pkg, 'cn');
    if (fund.length > 0) {
      expect.fail(
        `package.json fuehrt das npm-Paket \`cn\` (${fund.join(', ')}).\n\n` +
        `Das hat \`npx shadcn@latest add\` eingetragen, nicht jemand mit Absicht —\n` +
        `unser \`cn\` kommt aus src/lib/utils.ts und braucht kein Paket.\n\n` +
        `Weg raus: \`npm uninstall cn\`, dann den Import in der neuen Komponente\n` +
        `auf '@/lib/utils' stellen.`,
      );
    }
  });
});

// ========================================================== RATSCHEN (Ist > 0)

describe('as-any-bleibt-die-ausnahme', () => {
  // Ist 25 im Produktionscode, alle an einer Bibliotheks- oder Browser-Grenze.
  // Der Guard versucht bewusst NICHT zu erkennen, ob eine Stelle "an der Grenze"
  // liegt — das ist nicht deterministisch entscheidbar. Er zaehlt.
  const DECKEL = 25;
  it(`hoechstens ${DECKEL} \`as any\` im Produktionscode`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(file, l => MUSTER.asAny.test(l), 'allow-as-any-bleibt-die-ausnahme'));
    }
    if (treffer.length > DECKEL) {
      expect.fail(ratsche(
        'as-any-bleibt-die-ausnahme', treffer.length, DECKEL,
        'Jedes `as any` schaltet den Typcheck fuer diesen Ausdruck ab. Der Bestand\n' +
        'haelt sie an Bibliotheksgrenzen; dort sind sie legitim und bleiben.',
        'einen engeren Typ schreiben, `as unknown as X` mit begruendetem Zwischenschritt,\n' +
        'oder eine Typdeklaration fuer die fremde API.',
      ) + fmt(treffer, 30));
    }
  });
});

describe('core-kennt-keine-plugins (Schichtrichtung)', () => {
  // Ist 52 Importzeilen. `src/core/` ist die Basisschicht — sie soll die Features
  // tragen, nicht von ihnen abhaengen. Die 52 sind bewusst entstanden (skill-eval
  // ist eine CLI, die den Gutachten-Workflow braucht), deshalb Ratsche statt Verbot.
  const DECKEL = 52;
  it(`hoechstens ${DECKEL} Importe aus src/core/ nach src/plugins/`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      if (!relPath(file).startsWith('src/core/')) continue;
      treffer.push(...findInFile(
        file,
        l => /from\s+'(@\/plugins\/|(\.\.\/)+plugins\/)/.test(l),
        'allow-core-kennt-keine-plugins',
      ));
    }
    if (treffer.length > DECKEL) {
      expect.fail(ratsche(
        'core-kennt-keine-plugins', treffer.length, DECKEL,
        'Der Kern zieht an einem Feature. Damit haengt die Basisschicht an dem, was\n' +
        'auf ihr steht — und ein Plugin laesst sich nicht mehr entfernen, ohne core\n' +
        'anzufassen.',
        'das gebrauchte Symbol nach src/core/ ziehen (wenn es dorthin gehoert), oder\n' +
        'den Bedarf als Parameter/Registrierung von aussen hereingeben.',
      ) + fmt(treffer, 30));
    }
  });
});

describe('zeitkonstante-hat-einen-namen', () => {
  // Ist 2. Eine nackte Millisekunden-Zahl sagt ihre Einheit nicht.
  //
  // Von 21 auf 2 in v6.45, und die Differenz teilt sich in zwei sehr
  // verschiedene Haelften — die Unterscheidung ist der Grund, warum hier
  // ueberhaupt etwas steht:
  //
  //   12 waren ECHT. Ein Tag in Millisekunden stand 13-mal im Produktionscode,
  //   unter vier Namen (MS_TAG 9x, TAG_MS 2x, DAY_MS 1x, MS_PER_DAY 1x) und in
  //   drei Schreibweisen, dazu 15 nackte Literale. Alle zeigen jetzt auf
  //   `MS_TAG` aus core/utils/zeitEinheiten.
  //
  //   7 waren ES NIE. Zwei Treffer waren Fliesstext, fuenf waren die DEFINITION
  //   einer benannten Konstante (`STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000`) —
  //   also genau der Weg raus, den die Fehlermeldung nennt. Der Guard zaehlte
  //   seine eigene Loesung als Verstoss und war damit nicht abarbeitbar: wer ihm
  //   folgte, blieb rot. Das fangen jetzt `istKommentar` + `istBenannteKonstante`.
  //
  // Wer die Zahl senken will, hat noch zwei nackte Minuten-Literale vor sich
  // (checkpoint.ts, relativeZeit.ts). Der Rest ist sauber.
  const DECKEL = 2;
  // (Muster steht in MUSTER.zeit — dort laeuft es gegen seine Proben.)
  it(`hoechstens ${DECKEL} nackte Zeitkonstanten im Produktionscode`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(
        file,
        l => !istKommentar(l) && !istBenannteKonstante(l) && MUSTER.zeit.test(l),
        'allow-zeitkonstante-hat-einen-namen',
      ));
    }
    if (treffer.length > DECKEL) {
      expect.fail(ratsche(
        'zeitkonstante-hat-einen-namen', treffer.length, DECKEL,
        'Eine nackte Millisekunden-Zahl im Ausdruck sagt ihre Einheit nicht — und\n' +
        'dieselbe Groesse laeuft im Bestand bereits unter vier verschiedenen Namen.',
        'eine benannte Konstante am Modulkopf, oder die vorhandene wiederverwenden.',
      ) + fmt(treffer, 30));
    }
  });
});

describe('vier-parameter-sind-ein-objekt', () => {
  // Ist 18. Ab vier Positionsparametern kann der Aufrufer die Reihenfolge nicht
  // mehr im Kopf halten, und zwei gleiche Typen nebeneinander vertauschen sich
  // lautlos. Destrukturierte Props-Objekte zaehlen NICHT (das `{` schliesst sie aus).
  //
  // REICHWEITE, ehrlich benannt: dieses Muster sieht nur EINZEILIGE
  // `function`-Deklarationen. Eine AST-Messung findet im selben Bestand 375
  // Signaturen mit >= 4 Parametern — Arrow-Funktionen, Methoden und mehrzeilige
  // Signaturen bleiben unsichtbar. Die 18 sind also kein Gesamtbestand, sondern
  // ein Ausschnitt.
  //
  // Das ist Absicht und kein Versehen: 88 % aller 8.255 Signaturen des Repos sind
  // niladisch bis dyadisch (Schnitt 1,61 Parameter), und ein Ratchet auf 375
  // zaehlte massenhaft legitime Muster mit. Der schmale Ausschnitt haelt die
  // haeufigste und am leichtesten vermeidbare Form fest.
  //
  // Wer die Zahl spaeter weiten will, weitet sie mit einem AST-Schritt — nicht
  // mit einem laengeren Regex. Und er nennt die neue Reichweite hier, damit
  // niemand 18 fuer den Gesamtbestand haelt (genau diese Verwechslung machte
  // `no-raw-async-onclick` monatelang zu einem Guard ohne Reichweite).
  const DECKEL = 18;
  // (Muster steht in MUSTER.vierParameter — dort laeuft es gegen seine Proben.)
  it(`hoechstens ${DECKEL} Funktionen mit >= 4 Positionsparametern`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(file, l => MUSTER.vierParameter.test(l), 'allow-vier-parameter-sind-ein-objekt'));
    }
    if (treffer.length > DECKEL) {
      expect.fail(ratsche(
        'vier-parameter-sind-ein-objekt', treffer.length, DECKEL,
        'Vier Positionsparameter sind an der Aufrufstelle nicht mehr lesbar, und\n' +
        'gleichtypige Nachbarn vertauschen sich ohne Typfehler.',
        'ein benanntes Options-Objekt — der Bestand nutzt dieses Muster breit.',
      ) + fmt(treffer, 30));
    }
  });
});

describe('verschachtelung-vierzehn', () => {
  // Ist 12. WAS DIESE ZAHL IST UND WAS NICHT: sie misst Einrueckung, nicht
  // Kontrollfluss-Tiefe. Eine AST-Messung ueber alle 21.417 Funktionen findet als
  // maximale echte Verschachtelung SECHS Ebenen, erreicht von genau fuenf
  // Funktionen — der Bestand ist in dieser Hinsicht also gesund, und ein
  // Verschachtelungs-Problem gibt es nicht.
  //
  // Was die Einrueckung trotzdem taugt: sie faengt lange Ketten aus Einrueckung
  // UND Zeilenlaenge, also Stellen, die beim Lesen teuer sind, ohne formal tief
  // zu sein. Als Ratsche auf 12 haelt sie den Ist-Stand; als Aussage ueber
  // Verschachtelung waere sie falsch.
  //
  // Gemessen als Einrueckung, nicht als echte Tiefe — deshalb NUR .ts:
  // JSX erreicht 14 Zeichen Einzug routinemaessig, ohne dass irgendetwas
  // verschachtelt waere. Die Schwelle ist gemessen, nicht gerundet: bei >= 10
  // waeren es 150 Treffer (der Guard waere am Tag eins tot), bei >= 16 nur 2
  // (er truege zu fast keinem Urteil bei).
  const DECKEL = 12;
  // (Muster steht in MUSTER.tiefeVerschachtelung — dort laeuft es gegen seine Proben.)
  it(`hoechstens ${DECKEL} tief verschachtelte Kontrollstrukturen in .ts`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      if (!relPath(file).endsWith('.ts')) continue;
      treffer.push(...findInFile(file, l => MUSTER.tiefeVerschachtelung.test(l), 'allow-verschachtelung-vierzehn'));
    }
    if (treffer.length > DECKEL) {
      expect.fail(ratsche(
        'verschachtelung-vierzehn', treffer.length, DECKEL,
        'Sieben Ebenen tief steht eine Kontrollstruktur. Ab dort haelt niemand mehr\n' +
        'die Vorbedingungen im Kopf, unter denen die Zeile ueberhaupt laeuft.',
        'frueher zurueckkehren (Guard Clauses), oder den inneren Block als benannte\n' +
        'Funktion herausziehen.',
      ) + fmt(treffer, 30));
    }
  });
});

describe('vi-mock-braucht-isolation (F.I.R.S.T. — Independent)', () => {
  // Ist 11 von 55. `ISOLATED_TESTS` in vitest.config.mts wuchs monoton von 0 auf
  // 51 und ist die EINZIGE Struktur-Kennzahl des Projekts ohne Sperre — dabei
  // ist ihre Entstehung die schmerzhafteste: 44 der 55 Dateien mussten dort
  // NACHTRAEGLICH eingetragen werden, nachdem sie im Suite-Lauf rot wurden.
  // Der Fehler zeigt sich nur im Suite-Lauf, nie beim Einzeltest ("einzeln gruen"
  // ist in diesem Repo das Symptom, nicht der Beweis). Diese 11 sind damit die
  // vorhergesagten naechsten Ausfaelle.
  const DECKEL = 11;
  it(`hoechstens ${DECKEL} Testdateien mit vi.mock ausserhalb von ISOLATED_TESTS`, () => {
    const vc = join(ROOT, '..', 'vitest.config.mts');
    expect(existsSync(vc), 'vitest.config.mts muss gefunden werden').toBe(true);
    const isoliert = new Set<string>();
    for (const m of readFileSync(vc, 'utf-8').matchAll(/'(src\/[^']+\.test\.tsx?)'/g)) {
      isoliert.add(m[1]!);
    }
    expect(isoliert.size, 'ISOLATED_TESTS muss lesbar sein').toBeGreaterThan(10);

    const offen: string[] = [];
    for (const file of scanDateien) {
      const rel = relPath(file);
      if (!istTestdatei(rel)) continue;
      if (!/^\s*vi\.mock\(/m.test(readFileSync(file, 'utf-8'))) continue;
      if (!isoliert.has(rel)) offen.push(rel);
    }
    if (offen.length > DECKEL) {
      expect.fail(
        `vi-mock-braucht-isolation: ${offen.length} Dateien, eingefroren waren ${DECKEL}.\n\n` +
        `Ein modulweiter \`vi.mock\` wirkt bei \`isolate: false\` in das gemeinsame\n` +
        `Modul-Register hinein: die zuerst registrierte Fabrik bedient auch fremde\n` +
        `Dateien. Der Fehler zeigt sich NUR im Suite-Lauf — einzeln bleibt alles gruen.\n\n` +
        `Diese Zahl darf nur SINKEN. Weg raus: die Datei in ISOLATED_TESTS\n` +
        `(vitest.config.mts, alphabetisch) aufnehmen, mit einer Zeile Begruendung —\n` +
        `oder den Mock durch eine Einspeisung ersetzen, die keinen Modulzustand braucht.\n\n` +
        `Offen:\n${offen.map(f => `  ${f}`).join('\n')}`,
      );
    }
  });
});

describe('ein-name-eine-implementierung', () => {
  // Ist 57 doppelt vergebene Namen exportierter Funktionen. Etwa die Haelfte sind
  // Homonyme in getrennten Domaenen (`TYP_LABEL` steht dreimal fuer drei
  // Vokabulare) — deshalb RATSCHE und nicht Verbot: die Regel lautet "es duerfen
  // nicht mehr werden", nicht "jeder dieser 57 ist ein Fehler".
  // Die teuren Faelle sind die anderen: `hashText` gibt es dreimal mit DREI
  // verschiedenen Algorithmen, und einer davon traegt persistierte Werte.
  const DECKEL = 56;
  it(`hoechstens ${DECKEL} mehrfach vergebene Namen exportierter Funktionen`, () => {
    const jeName = new Map<string, string[]>();
    for (const file of prodDateien) {
      const rel = relPath(file);
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        const m = l.match(MUSTER.exportFunktion);
        if (!m) continue;
        if (!jeName.has(m[1]!)) jeName.set(m[1]!, []);
        jeName.get(m[1]!)!.push(rel);
      }
    }
    const doppelt = [...jeName.entries()]
      .filter(([, orte]) => new Set(orte).size >= 2)
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
    if (doppelt.length > DECKEL) {
      expect.fail(
        `ein-name-eine-implementierung: ${doppelt.length} Namen, eingefroren waren ${DECKEL}.\n\n` +
        `Derselbe Name an zwei Stellen zwingt jeden Leser zur Rueckfrage, welche\n` +
        `Fassung gemeint ist — und beim Suchen findet man beide.\n\n` +
        `Diese Zahl darf nur SINKEN. Weg raus: zusammenlegen, wenn es dieselbe Sache\n` +
        `ist; UMBENENNEN, wenn es zwei Sachen sind (dann sagt der Name, welche).\n` +
        `Vor dem Zusammenlegen die Koerper vergleichen, nicht die Signaturen.\n\n` +
        `Namen:\n` +
        doppelt.slice(0, 25).map(([n, orte]) => `  ${n}  (${orte.length}x)\n` +
          orte.map(o => `      ${o}`).join('\n')).join('\n'),
      );
    }
  });
});

describe('ausweg-heisst-wie-die-regel', () => {
  // WAS HIER SCHIEFGING (v6.40 bis v6.45, gefunden beim ersten roten Lauf einer
  // Ratsche): `ratsche()` baut den Ausweg aus dem Regelnamen — die Meldung sagt
  // also „markiere die Zeile mit allow-zeitkonstante-hat-einen-namen". Der Code
  // daneben akzeptierte aber den kuerzeren Marker allow-zeitkonstante. Fuenf von
  // fuenf Ratschen hatten diese Abweichung.
  //
  // Die Folge ist kein Fehlalarm, sondern etwas Schlimmeres: wer der Meldung
  // GENAU folgt, bleibt rot und sieht nicht warum. Das Ventil, das den Druck von
  // der Ratsche nehmen soll, war zugeschraubt — und weil im Bestand kein
  // einziger dieser Marker stand, hatte es das nie jemand bemerkt.
  //
  // Diese Pruefung liest die Guard-Datei als TEXT. Sie ist damit die eine
  // Stelle, die vom SELBST-Ausschluss ausgenommen sein muss: sie misst
  // absichtlich sich selbst.
  it('jede Ratsche akzeptiert genau den Marker, den ihre Meldung nennt', () => {
    const quelle = readFileSync(join(ROOT, '__tests__', 'conventions-clean-code.test.ts'), 'utf-8');
    const regeln = [...new Set(
      [...quelle.matchAll(/ratsche\(\s*'([a-z0-9-]+)'/g)].map(m => m[1]!),
    )];

    // Positiv-Kontrolle: findet das Muster nichts, prueft der Guard nichts —
    // und saehe dabei genauso gruen aus wie ein bestandener Lauf.
    expect(regeln.length, 'keine ratsche()-Aufrufe gefunden — der Guard ist blind')
      .toBeGreaterThanOrEqual(5);

    const fehlend = regeln.filter(r => !quelle.includes(`'allow-${r}'`));
    if (fehlend.length > 0) {
      expect.fail(
        `${fehlend.length} Ratsche(n) nennen einen Ausweg, den ihr eigener Code nicht\n` +
        `annimmt. Die Fehlermeldung entsteht aus dem Regelnamen, der Marker im\n` +
        `findInFile-Aufruf ist von Hand geschrieben — sie laufen auseinander, sobald\n` +
        `eine Regel umbenannt wird.\n\n` +
        `Betroffen:\n${fehlend.map(r => `  ${r}`).join('\n')}\n\n` +
        `Weg raus: im findInFile-Aufruf denselben Namen verwenden wie im\n` +
        `ratsche()-Aufruf. Der Marker heisst immer wie die Regel.`,
      );
    }
  });
});

// ====================================================== MUSTERKONTROLLEN

describe('musterkontrollen (jedes Muster beweist, dass es noch greift)', () => {
  // WARUM DIESER BLOCK EXISTIERT — er ist die Antwort auf den teuersten Befund
  // der Bestandsaufnahme: von den 49 zeilenweise scannenden Guards dieses
  // Projekts tragen nur 5 eine solche Kontrolle.
  //
  // Ein zeilenlokales Muster verliert seinen Griff lautlos. Bricht ein Ausdruck
  // im Bestand ueber zwei Zeilen um — durch einen Formatter, durch eine laenger
  // gewordene Zeile —, findet das Muster ihn nicht mehr. Der Guard wird dann
  // nicht rot, sondern GRUEN: ein funktionierender und ein entwaffneter Guard
  // sehen von aussen identisch aus.
  //
  // Die vier VERBOTE oben stehen alle bei null Treffern. Ohne diesen Block waere
  // "null Treffer" nicht von "Muster kaputt" zu unterscheiden.
  //
  // Die Proben sind bewusst LITERALE, keine Ableitungen aus den Konstanten: ein
  // Test, der seine Fixture aus der geprueften Sache baut, kann nie rot werden.

  const trifft = (re: RegExp, s: string): boolean => new RegExp(re.source, re.flags.replace('g', '')).test(s);

  it('testOnly trifft die drei Formen und nichts sonst', () => {
    expect(trifft(MUSTER.testOnly, "  it.only('rechnet richtig', () => {")).toBe(true);
    expect(trifft(MUSTER.testOnly, '  describe.only(\'Gruppe\', () => {')).toBe(true);
    expect(trifft(MUSTER.testOnly, '  test.only(\'x\', fn);')).toBe(true);
    // Gegenproben: das Wort "only" ist haeufig und darf nicht ausloesen.
    expect(trifft(MUSTER.testOnly, "  it('zeigt only den Kopf', () => {")).toBe(false);
    expect(trifft(MUSTER.testOnly, '  const readonly = true;')).toBe(false);
    expect(trifft(MUSTER.testOnly, '  // nur .only ist verboten')).toBe(false);
  });

  it('leererCatch trifft leere Bloecke, aber nicht begruendete', () => {
    expect(trifft(MUSTER.leererCatch, 'try { x(); } catch {}')).toBe(true);
    expect(trifft(MUSTER.leererCatch, 'try { x(); } catch (e) {}')).toBe(true);
    expect(trifft(MUSTER.leererCatch, 'try {\n  x();\n} catch {\n}')).toBe(true);
    // Gegenprobe: GENAU die Form, die der Bestand 33-mal richtig macht.
    expect(trifft(MUSTER.leererCatch, 'try { x(); } catch {\n  // Datei fehlt beim Erstlauf.\n}')).toBe(false);
    expect(trifft(MUSTER.leererCatch, 'try { x(); } catch (e) { melde(e); }')).toBe(false);
  });

  it('tsUnterdrueckung trifft ignore/nocheck, nicht expect-error', () => {
    expect(trifft(MUSTER.tsUnterdrueckung, '// @ts-ignore')).toBe(true);
    expect(trifft(MUSTER.tsUnterdrueckung, '/* @ts-nocheck */')).toBe(true);
    // Gegenprobe: die erlaubte Form altert mit und darf nicht ausloesen.
    expect(trifft(MUSTER.tsUnterdrueckung, '// @ts-expect-error reines Node-ESM ohne Typen')).toBe(false);
  });

  it('eslintDisable liest den Regelnamen heraus', () => {
    expect('// eslint-disable-next-line react-hooks/exhaustive-deps'.match(MUSTER.eslintDisable)?.[1])
      .toBe('react-hooks/exhaustive-deps');
    expect('/* eslint-disable no-console */'.match(MUSTER.eslintDisable)?.[1]).toBe('no-console');
    expect('  // eslint-disable-line @typescript-eslint/no-explicit-any'.match(MUSTER.eslintDisable)?.[1])
      .toBe('@typescript-eslint/no-explicit-any');
    // Gegenprobe: ohne Regelnamen greift die Regel bewusst nicht (Datei-weites
    // Ausschalten ist eine andere Sache und hat im Bestand null Vorkommen).
    expect('const s = "eslint-disable";'.match(MUSTER.eslintDisable)).toBe(null);
  });

  it('asAny trifft nur die Wortform', () => {
    expect(trifft(MUSTER.asAny, 'const x = roh as any;')).toBe(true);
    expect(trifft(MUSTER.asAny, 'foo(bar as any, baz)')).toBe(true);
    // Gegenproben: Teilwoerter und der doppelte Cast mit Zwischenschritt.
    expect(trifft(MUSTER.asAny, 'const anyway = 1;')).toBe(false);
    expect(trifft(MUSTER.asAny, 'const x = hasAnyEntry(v);')).toBe(false);
  });

  it('coreZuPlugins trifft beide Importformen', () => {
    expect(trifft(MUSTER.coreZuPlugins, "import { x } from '@/plugins/antraege/store';")).toBe(true);
    expect(trifft(MUSTER.coreZuPlugins, "import type { Y } from '../../plugins/suche/typen';")).toBe(true);
    // Gegenproben: die erlaubte Richtung und ein aehnlich aussehender Pfad.
    expect(trifft(MUSTER.coreZuPlugins, "import { z } from '@/core/status/typen';")).toBe(false);
    expect(trifft(MUSTER.coreZuPlugins, "import { p } from '@/components/pluginsHelfer';")).toBe(false);
  });

  it('zeit trifft die Millisekunden-Formen, nicht beliebige Zahlen', () => {
    expect(trifft(MUSTER.zeit, 'const ttl = 86400000;')).toBe(true);
    expect(trifft(MUSTER.zeit, 'setTimeout(fn, 1000 * 60);')).toBe(true);
    expect(trifft(MUSTER.zeit, 'const w = 60 * 60 * 1000;')).toBe(true);
    // Gegenproben: benannte Konstanten sind der Weg raus und duerfen nicht treffen.
    expect(trifft(MUSTER.zeit, 'const ttl = MS_PRO_TAG;')).toBe(false);
    expect(trifft(MUSTER.zeit, 'const n = 8640000012;')).toBe(false);
  });

  it('istKommentar haelt Prosa vom Muster fern', () => {
    expect(istKommentar('// 86400000 ist ein Tag')).toBe(true);
    expect(istKommentar(' * `24 * 60 * 60 * 1000` stand hier 13-mal')).toBe(true);
    expect(istKommentar('/** Ein Tag in Millisekunden. */')).toBe(true);
    // Gegenproben: Code bleibt Code, auch mit angehaengtem Kommentar.
    expect(istKommentar('const ttl = 86400000; // ein Tag')).toBe(false);
    expect(istKommentar('  return ms / 86400000;')).toBe(false);
  });

  it('istBenannteKonstante erkennt genau den Weg raus, den die Regel nennt', () => {
    expect(istBenannteKonstante('export const STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000;')).toBe(true);
    expect(istBenannteKonstante('const MS_TAG = 86_400_000;')).toBe(true);
    expect(istBenannteKonstante('export const TTL_MS: number = 60000;')).toBe(true);
    // Gegenproben: die Ausnahme gilt der DEFINITION, nicht dem Rechnen damit.
    // Ein kleingeschriebener Name ist keine Konstante nach Projekt-Konvention,
    // und eine Zuweisung in eine Variable ist keine Definition am Modulkopf.
    expect(istBenannteKonstante('const ttlMs = tage * 86400000;')).toBe(false);
    expect(istBenannteKonstante('  return (jetzt - t) / 86400000;')).toBe(false);
    expect(istBenannteKonstante('let MAX_MS = 60000;')).toBe(false);
  });

  it('vierParameter trifft ab vier Positionsparametern, nicht Props-Objekte', () => {
    expect(trifft(MUSTER.vierParameter, 'export function f(a: string, b: number, c: boolean, d: Date) {')).toBe(true);
    expect(trifft(MUSTER.vierParameter, '  function g(a, b, c, d) {')).toBe(true);
    // Gegenproben: drei Parameter sind erlaubt, und ein destrukturiertes
    // Props-Objekt ist genau der empfohlene Weg — es darf nie treffen.
    expect(trifft(MUSTER.vierParameter, 'export function h(a: string, b: number, c: boolean) {')).toBe(false);
    expect(trifft(MUSTER.vierParameter, 'export function k({ a, b, c, d }: Props) {')).toBe(false);
  });

  it('tiefeVerschachtelung misst Einrueckung ab 14 Zeichen', () => {
    expect(trifft(MUSTER.tiefeVerschachtelung, ' '.repeat(14) + 'if (x) {')).toBe(true);
    expect(trifft(MUSTER.tiefeVerschachtelung, ' '.repeat(16) + 'for (const a of b) {')).toBe(true);
    // Gegenproben: 12 Zeichen liegen unter der gemessenen Schwelle, und eine
    // Zuweisung ist keine Kontrollstruktur.
    expect(trifft(MUSTER.tiefeVerschachtelung, ' '.repeat(12) + 'if (x) {')).toBe(false);
    expect(trifft(MUSTER.tiefeVerschachtelung, ' '.repeat(20) + 'const y = 1;')).toBe(false);
  });

  it('exportFunktion liest den Namen heraus', () => {
    expect('export function baueListe(x: A): B {'.match(MUSTER.exportFunktion)?.[1]).toBe('baueListe');
    expect('export async function ladeAlles(): Promise<void> {'.match(MUSTER.exportFunktion)?.[1]).toBe('ladeAlles');
    // Gegenproben: nicht exportiert, und const-Arrows zaehlen bewusst nicht mit
    // (sonst wuerde jede lokale Hilfsfunktion als Namensdublette gelten).
    expect('function intern(): void {'.match(MUSTER.exportFunktion)).toBe(null);
    expect('export const baueListe = (x: A): B => {'.match(MUSTER.exportFunktion)).toBe(null);
  });

  it('cnPaket trifft jede Importform des npm-Pakets, nicht unseren Helfer', () => {
    expect(trifft(MUSTER.cnPaket, 'import { cn } from "cn"')).toBe(true);
    expect(trifft(MUSTER.cnPaket, "import cnPaket from 'cn';")).toBe(true);
    expect(trifft(MUSTER.cnPaket, "const { cn } = require('cn');")).toBe(true);
    // Gegenproben: der richtige Weg, und Pakete, deren Name nur mit cn beginnt.
    expect(trifft(MUSTER.cnPaket, 'import { cn } from "@/lib/utils"')).toBe(false);
    expect(trifft(MUSTER.cnPaket, "import x from 'cn-utils';")).toBe(false);
    expect(trifft(MUSTER.cnPaket, "import { clsx } from 'clsx';")).toBe(false);
  });

  it('cnFremdeHerkunft trifft `cn` aus jeder Quelle ausser @/lib/utils, auch mehrzeilig', () => {
    expect(trifft(MUSTER.cnFremdeHerkunft, 'import { cn } from "cn"')).toBe(true);
    expect(trifft(MUSTER.cnFremdeHerkunft, "import { cn } from 'lib/utils';")).toBe(true);
    expect(trifft(MUSTER.cnFremdeHerkunft, "import {\n  cva,\n  cn,\n} from '@/components/lib/utils';")).toBe(true);
    // Gegenproben: der richtige Weg in beiden Anfuehrungszeichen, und ein Name,
    // der nur mit cn beginnt.
    expect(trifft(MUSTER.cnFremdeHerkunft, 'import { cn } from "@/lib/utils"')).toBe(false);
    expect(trifft(MUSTER.cnFremdeHerkunft, "import { cn } from '@/lib/utils'")).toBe(false);
    expect(trifft(MUSTER.cnFremdeHerkunft, "import { cnVarianten } from './stil';")).toBe(false);
  });

  it('sektionenMitPaket findet das Paket in jeder Sektion, nicht als Namensteil', () => {
    expect(sektionenMitPaket({ dependencies: { cn: '^0.2.6' } }, 'cn')).toEqual(['dependencies']);
    expect(sektionenMitPaket({ devDependencies: { cn: '^0.2.6' } }, 'cn')).toEqual(['devDependencies']);
    // Gegenproben: ein Paket, das nur mit cn beginnt, und eine fehlende Sektion.
    expect(sektionenMitPaket({ dependencies: { 'cn-utils': '1.0.0', clsx: '2.1.1' } }, 'cn')).toEqual([]);
    expect(sektionenMitPaket({}, 'cn')).toEqual([]);
  });

  it('die Scan-Menge ist nicht leer und schliesst diese Datei aus', () => {
    // Faengt den Fall, dass ein geaenderter Datei-Walk alle Guards stumm schaltet:
    // ohne Dateien meldet jeder von ihnen null Treffer und damit gruen.
    expect(scanDateien.length).toBeGreaterThan(2000);
    expect(prodDateien.length).toBeGreaterThan(1500);
    expect(scanDateien.some(f => relPath(f) === SELBST)).toBe(false);
  });
});
