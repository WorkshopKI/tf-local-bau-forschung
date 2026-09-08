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
} as const;

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

// ========================================================== RATSCHEN (Ist > 0)

describe('as-any-bleibt-die-ausnahme', () => {
  // Ist 25 im Produktionscode, alle an einer Bibliotheks- oder Browser-Grenze.
  // Der Guard versucht bewusst NICHT zu erkennen, ob eine Stelle "an der Grenze"
  // liegt — das ist nicht deterministisch entscheidbar. Er zaehlt.
  const DECKEL = 25;
  it(`hoechstens ${DECKEL} \`as any\` im Produktionscode`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(file, l => MUSTER.asAny.test(l), 'allow-as-any'));
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
        'allow-core-kennt-plugins',
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
  // Ist 21. Eine nackte 86400000 sagt nicht, ob Tage, Stunden oder Millisekunden
  // gemeint sind — und dieselbe Zahl steht im Bestand unter VIER Namen
  // (MS_TAG, TAG_MS, DAY_MS, MS_PER_DAY). Wer sie aendert, findet nicht alle.
  const DECKEL = 21;
  // (Muster steht in MUSTER.zeit — dort laeuft es gegen seine Proben.)
  it(`hoechstens ${DECKEL} nackte Zeitkonstanten im Produktionscode`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(file, l => MUSTER.zeit.test(l), 'allow-zeitkonstante'));
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
  const DECKEL = 18;
  // (Muster steht in MUSTER.vierParameter — dort laeuft es gegen seine Proben.)
  it(`hoechstens ${DECKEL} Funktionen mit >= 4 Positionsparametern`, () => {
    const treffer: Finding[] = [];
    for (const file of prodDateien) {
      treffer.push(...findInFile(file, l => MUSTER.vierParameter.test(l), 'allow-vier-parameter'));
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
  // Ist 12. Gemessen als Einrueckung, nicht als echte Tiefe — deshalb NUR .ts:
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
      treffer.push(...findInFile(file, l => MUSTER.tiefeVerschachtelung.test(l), 'allow-verschachtelung'));
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

  it('die Scan-Menge ist nicht leer und schliesst diese Datei aus', () => {
    // Faengt den Fall, dass ein geaenderter Datei-Walk alle Guards stumm schaltet:
    // ohne Dateien meldet jeder von ihnen null Treffer und damit gruen.
    expect(scanDateien.length).toBeGreaterThan(2000);
    expect(prodDateien.length).toBeGreaterThan(1500);
    expect(scanDateien.some(f => relPath(f) === SELBST)).toBe(false);
  });
});
