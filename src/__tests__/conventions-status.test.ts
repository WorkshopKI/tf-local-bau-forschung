/**
 * Codebase-Conventions — Status, Kuerzel, Verlauf, Journal.
 *
 * Statt einer separaten ESLint-Konfiguration (Projekt nutzt nur tsc + vitest)
 * laufen die Pattern-Checks als Vitest-Tests. Schlaegt ein Check fehl, listet
 * die Fehlermeldung die Treffer mit Datei:Zeile + die zu nutzende Alternative.
 *
 * Inline-Whitelist: Zeilen mit Marker-Kommentar `// allow-<rule>: <reason>`
 * werden ignoriert. Bitte den Grund knapp dokumentieren — das macht die
 * Ausnahme review-bar.
 *
 * Geschwister-Dateien: conventions-ui.test.ts, conventions-daten.test.ts, health-baseline.test.ts. Der Schnitt ist thematisch;
 * Datei-Walk + Such-Primitive liegen gemeinsam in conventions-lib.ts.
 *
 * Geprueft:
 *   - no-direct-status-compare          → Pitfall #12 (Antrag-Status), Helper aus
 *     src/core/utils/status-canonical.ts nutzen.
 *   - verlauf-leitet-keinen-status-ab   → Pitfall #44 / Phase 1b: die Verlaufsableitung
 *     rekonstruiert die VERGANGENHEIT; der Pfad, der den GELTENDEN Status bestimmt
 *     (status-canonical, snapshot, kategorie-ableitung, zah-phasen, phasen-schnitt),
 *     darf sie nicht importieren. Sonst entsteht die zweite Ableitung wieder, die
 *     mit v2.385 zurueckgebaut wurde. Die Richtung ist verlauf/ → status, nie zurueck.
 *   - trigger-regeln-nur-im-verlauf     → Phase 1b: KUERZEL_TRIGGER_REGELN sind
 *     ausnahmslos `aktiv: false` (erfasst, nicht wirksam). Gelesen werden sie nur in
 *     src/core/status/verlauf/; ein zweiter Konsument waere der Weg, sie versehentlich
 *     scharf zu schalten.
 *   - no-inline-frist-arithmetik        → v3.6, keine literale 90/84 in Frist-Naehe
 *     ausserhalb von csv/frist.ts + csv/frist-ergebnis.ts. Die Konstante
 *     ANTRAG_SLA_DAYS zu benutzen ist ausdruecklich erwuenscht; sie zu
 *     ABSCHREIBEN war der Fehler (drei Achsen mit eigenen Literalen).
 *   - status-kurzlabel-single-source   → die Kurzform eines Rohstatus hat EINE
 *     Quelle (StatusCodeEintrag.kurz + kuratiertes StatusWertEintrag.kurzLabel),
 *     gelesen ueber statusKurzLabel()/statusLabel() in core/utils/
 *     status-wert-labels.ts. Bis v3.15 waren es drei Kopien — eine mit
 *     Tippfehler, eine auf eine Schreibweise geschluesselt, die im Bestand nicht
 *     vorkommt. Geprueft wird die Herkunft (kein STATUS_LABEL_OVERRIDES/
 *     shortStatus, kein Import der entfernten Symbole, status-mappings.ts
 *     beschriftet nicht mehr) plus eine kuratierte Literal-Sperre.
 *   - zah-phasen-snapshot-single-writer → ZAH-Phasen sind seit v2.409 kuratierbare
 *     Daten; welcher Schnitt GILT, steht in zwei Modul-Registern in
 *     core/status/zah-phasen.ts. Gesetzt werden sie NUR von
 *     setStatusKatalogSnapshot() in core/status/snapshot.ts (Tests:
 *     resetZahPhasenSnapshotFuerTests). Zweiter Teil: zahPhasenVon() liefert nie
 *     eine leere Liste — ein '?? []' daneben ist ein Missverstaendnis.
 *   - zah-phase-single-source           → und niemand haelt eine KOPIE des Schnitts:
 *     keine feste Phasen-Id und keine Phasen-Beschriftung als Literal (Vorfilter:
 *     Datei nennt zahPhase). Bis v4.3 fehlte er, und genau deshalb standen
 *     „Fachpruefung"/„Nachforderung" in der Handlungs-Formel (in KEINER Fassung
 *     ein Phasenlabel) und vier eingetippte Ids im Fristlauf des Vorgangs-Boards.
 *   - chronik-zwei-wirte-ein-vokabular  → v4.61: die chronologische Chronik rendert
 *     an zwei Stellen (Detailseite + Tabellen-Ausklapp). Jeder Wirt reicht
 *     `tvNummern` herein, und die Karte kommt aus `tvAchse` — sonst heisst
 *     dieselbe Zeile hier „TV 1" und dort „…430", und „TV 2" meint je nach Wirt
 *     ein anderes Teilvorhaben.
 *   - kuerzel-genau-ein-speicherort     → Pitfall #44 / v2.376: die vier kanonisch
 *     belegten Kuerzel (AAE/ABB/AZ1/VBE) duerfen im Vorgangssystem-Scope kein
 *     zweites `D_<code>`-Feld bekommen — das kanonische Feld gewinnt den Wert,
 *     das Code-Feld bleibt leer, und alles was am Code haengt antwortet „nie
 *     gesetzt". Spaltenname immer ueber todoFeld()/feld().
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { KANONISCHE_CODE_FELDER } from '../core/status/seed-kanonisch';
import { ebenenKonflikte } from '../core/status/seed-codes';
import { baueSeedVersion } from '../core/status/seed';
import { JOURNAL_AUSGESCHLOSSEN } from '../core/status/journal/felder';
import {
  ROOT, ALL_TS_FILES, relPath, findInFile, fmt, type Finding,
} from './conventions-lib';

describe('no-direct-status-compare (CLAUDE.md Pitfall #12)', () => {
  // Antrag-Status-Werte die im gesamten Projekt EINDEUTIG zur Antrag-/Vorgang-
  // Domain gehoeren (also nicht zugleich Zuweisung-, Sync-, Comment-, Klassi-
  // fizierungs-Status sein koennen). Diese Liste ist bewusst kleiner als der
  // volle Werte-Satz aus status-canonical.ts — generische Tokens wie 'neu',
  // 'abgelehnt', 'in_bearbeitung', 'eingereicht', 'abgeschlossen', 'beantragt'
  // werden auch in anderen Domains genutzt und wuerden hier nur false-positives
  // erzeugen. Falls so ein generischer Token fuer eine Antrag-Variable wirklich
  // problematisch ist, hilft hier nur ein gezielter Refactor; den Test deshalb
  // konservativ halten.
  const ANTRAG_STATUS_VALUES = [
    // Foerderantrag-Domain (eindeutig)
    'bewilligt', 'bewilligungsreif', 'ablehnungsreif',
    'bewilligungsentwurf vdi/vde-it',
    'NF gestellt', 'keine weiteren NF',
    'Schlussvermerk', 'Widerruf',
    'abgelehnt/zurückgezogen',
    'bearbeitungsreif', 'nl eingegangen',
    'techn geprüft', 'kaufm geprüft', 'gutachten fertig',
    'VN geprüft', 'VN techn. geprüft',
  ];

  // Files die das Pattern legitim nutzen duerfen (Status-Canonical-Modul +
  // Tests + Type-Definitionen mit Doku-Beispielen).
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}utils${sep}status-canonical.ts`,
    `${sep}utils${sep}status-mappings.ts`,
    `${sep}plugins${sep}antraege${sep}filter${sep}statusGroups.ts`,
    `${sep}core${sep}services${sep}csv${sep}types.ts`,
  ];

  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // Regex: irgendein `.status === 'WERT'` mit WERT aus der Liste oben. Wir
  // matchen tolerant gegen `==` und `!=` (mit/ohne strict) und gegen Tab/Space.
  const valueAlternatives = ANTRAG_STATUS_VALUES
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(
    `\\.status\\s*[!=]==?\\s*['"](${valueAlternatives})['"]`,
  );

  it('keine direkten Antrag-Status-Literal-Vergleiche ausserhalb des Status-Canonical-Moduls', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-status-literal'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter Antrag-Status-Vergleich verboten (CLAUDE.md Pitfall #12).\n` +
        `Nutze stattdessen die Helper aus src/core/utils/status-canonical.ts:\n` +
        `  isOpenStatus / isBewilligtStatus / isBegleitungStatus / ...\n` +
        `Wenn diese Fundstelle wirklich nur ein einzelnes Literal will (z.B.\n` +
        `Badge-Count fuer "neu"), Zeile mit '// allow-status-literal: <grund>'\n` +
        `markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('kuerzel-nie-flach (v3.13 — Kürzel × Projektform)', () => {
  // Dieselbe Abkuerzung bedeutet je nach Projektform etwas anderes: `AB` ist in
  // DL die „Bewilligungsempfehlung durch Haushaltsbeauftragte", sonst
  // „bewilligungsreif/Akte an Euronorm". Gemessen am Produktivbestand tragen
  // 11 216 von 14 222 Antraegen (78,9 %) mindestens ein Kuerzel, dessen flach
  // nachgeschlagener Klartext fuer ihre Projektform falsch ist.
  //
  // Die Rohtabelle darf deshalb nur ihre eigene Tuer kennen: wer sie direkt
  // importiert, kann `formen` nach Belieben anfassen und baut den flachen
  // Zugriff nach.
  const rohImport = /from\s+['"](?:[^'"]*\/)?kuerzel-katalog\.data['"]/;
  const HEIMAT = `${sep}core${sep}status${sep}kuerzel-katalog.ts`;

  it('KUERZEL_KATALOG wird nur von kuerzel-katalog.ts importiert', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.endsWith(HEIMAT)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(file, l => rohImport.test(l), 'allow-kuerzel-flach'));
    }

    if (findings.length > 0) {
      const msg =
        `Der Kuerzel-Katalog wird nur ueber seine Tuer nachgeschlagen (v3.13).\n` +
        `Stattdessen:\n` +
        `  import { kuerzelAuskunft, projektformVonVbPhase } from '@/core/status';\n` +
        `  const pf = projektformVonVbPhase(antrag.vb_phase);   // null = unbekannt\n` +
        `  const a = kuerzelAuskunft(code, pf);\n` +
        `  if (!a.eindeutig) { /* Kuerzel zeigen, keine geratene Bedeutung */ }\n` +
        `Flach nachgeschlagen zeigt die App fuer 78,9 % der Antraege den falschen\n` +
        `Klartext — das war der Zustand bis v3.13.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('kuerzel-text-folgt-der-kuration (v4.45 — eine Seite, ein Wortlaut)', () => {
  // Die Chronik zeigt `feld.label` aus der kuratierten Fassung, die
  // Verlaufs-Spur `kuerzelAuskunft` aus den einkompilierten Fremddaten. Zwei
  // Reiter DERSELBEN Sektion, und auf dem echten Bestand (Fassung 18, 505
  // Kuerzel) liefen 111 davon auseinander: `ALQ` las sich links „NF von PL
  // gelesen", rechts „NF von QS gelesen".
  //
  // Wo ein kuratiertes Feld zur Hand ist, gehoert die Auskunft deshalb durch
  // `ueberlagereKuration`. Die Funktion haelt selbst fest, wo der Katalog
  // gewinnt (form-divergente Kuerzel); dieser Guard haelt nur fest, DASS sie
  // aufgerufen wird.
  const HEIMAT = `${sep}core${sep}status${sep}verlauf${sep}uebergaenge.ts`;

  it('uebergaenge.ts legt die Fassung ueber den Katalog', () => {
    const datei = ALL_TS_FILES.find(f => f.endsWith(HEIMAT));
    expect(datei, 'uebergaenge.ts nicht gefunden — Guard umbenannt?').toBeDefined();
    const quelle = readFileSync(datei!, 'utf8');

    if (!quelle.includes('ueberlagereKuration')) {
      expect.fail(
        `Die Verlaufs-Spur schlaegt wieder flach nach (v4.45).\n` +
        `Stattdessen:\n` +
        `  const auskunft = ueberlagereKuration(\n` +
        `    kuerzelAuskunft(roh, e.projektform), eintrag.feld.label,\n` +
        `  );\n` +
        `Ohne die Ueberlagerung zeigen Chronik und Zeitstrahl fuer dasselbe\n` +
        `Kuerzel verschiedene Texte — auf Fassung 18 bei 111 von 505.\n` +
        `Belegt in src/core/status/__tests__/kuerzel-overlay.test.ts.`,
      );
    }
  });
});

describe('verlauf-leitet-keinen-status-ab (Phase 1b — Pitfall #44)', () => {
  // Die Verlaufsableitung rekonstruiert die VERGANGENHEIT aus den `D_`-Spalten.
  // Der GELTENDE Status kommt weiter aus dem Export und wird nie berechnet —
  // genau das war die Ableitungs-Engine, die mit v2.385 zurueckgebaut wurde
  // (485 von 7 534 Verbuenden sagten etwas anderes als das Fachsystem).
  //
  // Der Guard haelt die Trennung an der einzigen Stelle, an der sie mechanisch
  // pruefbar ist: der Pfad, der den geltenden Status bestimmt, darf das
  // Verlaufs-Modul nicht kennen. Umgekehrt ist erlaubt.
  const verlaufImport = /from\s+['"][^'"]*(?:core\/status\/verlauf|\.\/verlauf|\.\.\/verlauf)['"]/;
  const STATUS_PFAD = [
    `${sep}core${sep}utils${sep}status-canonical.ts`,
    `${sep}core${sep}status${sep}snapshot.ts`,
    `${sep}core${sep}status${sep}kategorie-ableitung.ts`,
    `${sep}core${sep}status${sep}zah-phasen.ts`,
    `${sep}core${sep}status${sep}phasen-schnitt.ts`,
  ];

  it('der Status-Pfad kennt das Verlaufs-Modul nicht', () => {
    const findings: Finding[] = [];
    let gescannt = 0;
    for (const file of ALL_TS_FILES) {
      if (!STATUS_PFAD.some(p => file.endsWith(p))) continue;
      gescannt++;
      findings.push(...findInFile(file, l => verlaufImport.test(l), 'allow-verlauf-im-status-pfad'));
    }
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toBe(STATUS_PFAD.length);

    if (findings.length > 0) {
      const msg =
        `Die App leitet keinen geltenden Status ab (Pitfall #44).\n` +
        `src/core/status/verlauf/ rekonstruiert die Vergangenheit; wer den\n` +
        `AKTUELLEN Status bestimmt, darf davon nichts wissen — sonst entsteht\n` +
        `die zweite Ableitung wieder, die mit v2.385 zurueckgebaut wurde.\n` +
        `Die Abhaengigkeit laeuft nur in eine Richtung: verlauf/ → status.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('status-ebene-folgt-x-praefix (Phase 2a)', () => {
  // Die SETZEBENE eines Statusfeldes steht nicht frei: das Fachsystem erzwingt
  // sie ueber das Kuerzel selbst — `X` am Anfang heisst Verbund, alles andere
  // Teilvorhaben. `ebeneVonCode` leitet das beim Katalogbau ab; wer die `ebene`
  // eines Seed-Eintrags spaeter von Hand setzt, haengt den Termin an die falsche
  // Bahn und die Verlaufsableitung rechnet ihn dem falschen Objekt zu.
  //
  // Hier bricht der Build, weil der Seed UNSERE Daten sind. Eine kuratierte
  // Fassung meldet sich stattdessen zur Laufzeit laut (`snapshot.ts`): ein Wurf
  // beim Aktivieren naehme dem Team die ganze App statt ihm den Datenfehler zu
  // zeigen — dieselbe Abwaegung wie in `programmNummer.ts`.
  //
  // NICHT zu verwechseln mit der WIRKUNGSEBENE: `ABB` traegt kein `X`, wird am
  // Teilvorhaben gesetzt und kippt ueber seine C16-Zeile trotzdem den
  // Verbundstatus. Zwei Felder, nie eines.
  it('kein Seed-Statusfeld widerspricht seinem Code', () => {
    const konflikte = ebenenKonflikte(baueSeedVersion().felder);
    const felder = baueSeedVersion().felder.filter(f => f.code).length;
    expect(felder, 'Seed traegt keine Code-Felder — der Guard prueft nichts')
      .toBeGreaterThan(400);
    expect(
      konflikte.map(k => `${k.feldId} (${k.code}: ist ${k.ist}, soll ${k.soll})`),
      'X am Codeanfang heisst Verbund-Ebene, alles andere Teilvorhaben',
    ).toEqual([]);
  });
});

describe('trigger-regeln-nur-im-verlauf (Phase 1b)', () => {
  // `KUERZEL_TRIGGER_REGELN` sind ausnahmslos `aktiv: false`: importiert heisst
  // erfasst und pruefbar, nicht wirksam. Seit v3.23 sind sie ueberhaupt keine
  // Regelquelle mehr (die Verlaufsableitung rechnet gegen C16) — der Guard
  // bleibt trotzdem scharf: er verhindert, dass sie ueber eine Hintertuer
  // zurueckkommen.
  //
  // Seit v3.21 OHNE Ausnahme: `verlauf/fuer-vorgang.ts` haelt die Regeln fuer
  // alle Aufrufer, der Cockpit-Hook reicht sie nicht mehr durch. Wer eine neue
  // Ausnahme braucht, ruft stattdessen `baueVerlaufFuerVorgang`.
  const rohImport = /from\s+['"](?:[^'"]*\/)?kuerzel-trigger\.data['"]/;
  const ERLAUBT = `${sep}core${sep}status${sep}verlauf${sep}`;

  it('die Regeln der Zuarbeit werden nur im Verlaufs-Modul gelesen', () => {
    const findings: Finding[] = [];
    let gescannt = 0;
    for (const file of ALL_TS_FILES) {
      if (file.includes(ERLAUBT)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      gescannt++;
      findings.push(...findInFile(file, l => rohImport.test(l), 'allow-trigger-regeln'));
    }
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toBeGreaterThan(100);

    if (findings.length > 0) {
      const msg =
        `KUERZEL_TRIGGER_REGELN sind alle aktiv:false — erfasst, nicht wirksam.\n` +
        `Gelesen werden sie nur in src/core/status/verlauf/, und dort nur fuer\n` +
        `die Rekonstruktion der Vergangenheit. Wer sie anderswo auswertet, baut\n` +
        `die Status-Ableitung nach, die Pitfall #44 ausschliesst.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-inline-frist-arithmetik (v3.6 — die Uhr hat EINE Heimat)', () => {
  // Die 90-Tage-Bearbeitungsfrist rechnete bis v3.6 fuer JEDEN Antrag weiter,
  // auch fuer einen 2018 abgelehnten („seit 2 760 T"). Der Fix sitzt in der
  // BERECHNUNG (`frist-ergebnis.ts`), nicht im Renderer — sonst bliebe die
  // falsche Zahl in Export, Board und Widgets stehen, waehrend die Tabelle
  // stimmt. Genau das war der Zustand davor: drei Achsen mit eigenen Literalen.
  //
  // Der Guard trifft BEWUSST NICHT jede Tages-Differenz — es gibt ~30 legitime
  // (Liegezeiten, Journal-Alter, Meilenstein-Abstaende). Er trifft die LITERALE
  // 90 (und ihre Woche-davor-Schwester 84) in Frist-Naehe.
  //
  // `ANTRAG_SLA_DAYS` ist ausdruecklich NICHT verboten — die Konstante ist
  // exportiert, damit man sie benutzt. Die Regel lautet „schreib die Zahl
  // nicht", nicht „fass die Frist nicht an": eine 90 im Tooltip luegt beim
  // naechsten Wechsel, die Konstante nicht.
  const zahl = /(?<![\w.])(?:90|84)(?![\w.])/;
  const fristNah = /frist|sla|ueberfaellig|überfällig|faellig|fällig|deadline/i;

  const HEIMAT = [
    `${sep}core${sep}services${sep}csv${sep}frist.ts`,
    `${sep}core${sep}services${sep}csv${sep}frist-ergebnis.ts`,
  ];

  /** Prosa erklaert die Regel, sie fuehrt sie nicht aus — ein Guard gegen
   *  RECHNEN darf nicht am Kommentar haengenbleiben, der sie begruendet. */
  const istKommentar = (l: string): boolean => /^\s*(?:\/\/|\/?\*)/.test(l);

  it('keine 90-Tage-Rechnung ausserhalb des Fristmoduls', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (HEIMAT.some(h => file.endsWith(h))) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      // `src/generated/` traegt das inline-gzippte ORT-WASM als base64-Zeile
      // (~19 MB). Jede Ziffernfolge kommt darin vor; ohne diesen Ausschluss
      // meldet der Guard sie und die Fehlermeldung sprengt jede Konsole.
      if (file.includes(`${sep}src${sep}generated${sep}`)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && zahl.test(l) && fristNah.test(l),
        'allow-inline-frist-arithmetik',
      ));
    }

    if (findings.length > 0) {
      const msg =
        `Frist-Arithmetik gehoert in src/core/services/csv/frist-ergebnis.ts (v3.6).\n` +
        `Stattdessen:\n` +
        `  import { berechneFrist } from '@/core/services/csv/frist-ergebnis';\n` +
        `  // in den Antraegen: fristErgebnisVon(a) / fristTageVon(a) / fristAnzeige(a)\n` +
        `Ein Renderer, der selbst rechnet, ist die zweite Ableitung — und die lief\n` +
        `bisher jedes Mal auseinander (Tab-Zaehler 84/90 vs. Frist-Spalte).\n` +
        `Misst die Stelle etwas ANDERES als die Bearbeitungsfrist (Eingangsalter,\n` +
        `Liegezeit, Meilenstein-Soll), Zeile mit\n` +
        `'// allow-inline-frist-arithmetik: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  // v3.31: derselbe Gedanke eine Ebene höher. Die 90 stand nie zweimal da, die
  // RECHNUNG schon: `useZeilenVerlauf` rief `fristFuerVorkommen`, und der
  // Frist-Reiter rief es gleich darauf noch einmal mit denselben Eingaben. Das
  // fiel niemandem auf, solange beide dasselbe Ergebnis lieferten — und genau
  // das endete, als die eine Seite die Verlaufsquelle fürs Haltedatum bekam und
  // die andere nicht. Wer die Frist braucht, nimmt sie aus dem Hook.
  const RECHNER = [
    `${sep}core${sep}status${sep}frist-bezug.ts`,
    `${sep}plugins${sep}antraege${sep}ausklapp${sep}useZeilenVerlauf.ts`,
    `${sep}plugins${sep}status-cockpit${sep}useFristErhebung.ts`,
  ];

  it('fristFuerVorkommen wird nicht in einer Komponente aufgerufen', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (RECHNER.some(h => file.endsWith(h))) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && /\bfristFuerVorkommen\s*\(/.test(l),
        'allow-zweite-fristrechnung',
      ));
    }

    if (findings.length > 0) {
      expect.fail(
        `Die Frist wird EINMAL gerechnet (v3.31).\n`
        + `Stattdessen: den fertigen \`FristBezug\` aus \`useZeilenVerlauf\` lesen\n`
        + `(\`daten.frist\`) — er trägt die Verlaufsquelle fürs Haltedatum bereits.\n`
        + `Ein zweiter Aufruf mit denselben Eingaben ist die zweite Ableitung.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('status-achsen (Arbeitsliste fest, Verfahrensschritt beweglich)', () => {
  // Die beiden Achsen des Status-Systems sind bewusst verschieden gebaut: der
  // Verfahrensschnitt (ZAH-Phasen) steht seit v2.409 in der Katalog-Fassung, die
  // Arbeitsliste (StatusCategory) bleibt im Code — sonst koennte eine Iteration
  // am Phasenschnitt nebenbei die taegliche Arbeitsliste der ABs leeren.
  const LABEL_QUELLE = `${sep}core${sep}utils${sep}status-category-labels.ts`;

  it('status-category-not-curated: KEIN Feld der Fassung entscheidet ueber eine Arbeitsliste', () => {
    // Bis v4.86 war dieser Wachter halb offen: er verbot der Fassung eine LISTE
    // von StatusCategory, erlaubte aber EINEN Wert je Phase
    // (`ZahPhase.kategorieVorgabe`). Genau durch diese Tuer verschob
    // Katalog-Fassung 19 im August 2026 448 Antraege zwischen Arbeitslisten —
    // die bewegliche Achse steuerte die feste. Seither ist die Tuer zu, und
    // dieser Test misst das: in `typen.ts` darf `StatusCategory` in KEINEM
    // Fassungs-Typ mehr als Feldtyp vorkommen, weder einzeln noch als Liste.
    //
    // Strukturell geprueft an den Typen selbst statt per Tree-Grep: nur hier
    // entstuende so ein Feld.
    const typen = readFileSync(join(ROOT, 'core', 'status', 'typen.ts'), 'utf8');
    const treffer: string[] = [];
    for (const iface of ['MappingVersion', 'ZahPhase', 'StatusFeldEintrag']) {
      const start = typen.indexOf(`export interface ${iface}`);
      if (start < 0) continue;
      const block = typen.slice(start);
      const felder = block.slice(0, block.indexOf('\n}'));
      for (const zeile of felder.split('\n')) {
        // Nur Feld-Deklarationen (`name?: StatusCategory`), nicht Kommentare.
        if (/^\s*\w+\??\s*:\s*StatusCategory/.test(zeile)) treffer.push(`${iface}: ${zeile.trim()}`);
      }
    }
    if (treffer.length > 0) {
      expect.fail(
        `Ein Fassungs-Typ traegt wieder eine Arbeitsliste:\n${treffer.join('\n')}\n\n` +
        `Die Arbeitslisten-Achse (StatusCategory) bleibt im Code —\n` +
        ``+`CODE_ZU_ARBEITSLISTE in core/status/kategorie-ableitung.ts, gekeyt am\n` +
        `Statuscode. Was in der Fassung steht, ist kuratierbar; was kuratierbar\n` +
        `ist, aendert sich — und dann wandern Antraege zwischen Reitern, ohne\n` +
        `dass es jemand beschlossen hat. Siehe docs/architecture/status-achsen.md.`,
      );
    }
  });

  it('status-labels-single-source: keine Kategoriebezeichnung als Literal daneben', () => {
    // Die neun Bezeichnungen leben in status-category-labels.ts. Gesucht wird
    // die Zuweisungs-Form (`offen: 'Zu bearbeiten'`), nicht der blosse Text.
    //
    // Nur die SECHS umbenannten Paare: „Bewilligt", „Begleitung" und
    // „Abgelehnt" sind blosse Gross-Schreibungen ihres Schluessels und kommen
    // zu Recht in fremden Domaenen vor (FeedbackStatus, Roh-Status-Labels) —
    // ein Guard, der die mitfaengt, meldet fuer immer Fehlalarm.
    const paare: [string, string][] = [
      ['offen', 'Zu bearbeiten'], ['in_pruefung', 'In Arbeit'],
      ['nachforderung', 'Nachforderung läuft'], ['entscheidung', 'Zu entscheiden'],
      ['abgeschlossen', 'Erledigt'], ['sonstige', 'Ohne Zuordnung'],
    ];
    const muster = paare.map(([k, v]) => new RegExp(`\\b${k}\\s*:\\s*['"\`]${v}['"\`]`));
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(LABEL_QUELLE)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts')) continue;
      findings.push(...findInFile(
        file, l => muster.some(m => m.test(l)), 'allow-kategorie-label',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Kategoriebezeichnung ausserhalb der Einzelquelle.\n` +
        `Vier Module fuehrten bis v2.409 eigene Vokabulare fuer dieselben neun\n` +
        `Werte — sie liefen auseinander, sobald eines angefasst wurde.\n` +
        `Stattdessen: getStatusCategoryLabel() / getStatusCategoryLabelKurz().\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('status-label-namensraeume-disjunkt: kein Name auf beiden Ebenen', async () => {
    // Ein Reiter „Zu bearbeiten", der drei Kategorien meint, von denen eine
    // ebenfalls so heisst, waere die Verwechslung eine Ebene hoeher — also
    // genau das, was A3 beseitigt hat. Aggregatnamen muessen eigen sein.
    const { KATEGORIE_TEXTE, AGGREGAT_TEXTE } =
      await import('@/core/utils/status-category-labels');
    const kategorieNamen = new Set(
      Object.values(KATEGORIE_TEXTE).flatMap(b => [b.lang, b.kurz]),
    );
    const kollision = Object.entries(AGGREGAT_TEXTE)
      .flatMap(([id, b]) => [[id, b.lang], [id, b.kurz]] as [string, string][])
      .filter(([, name]) => kategorieNamen.has(name));
    if (kollision.length > 0) {
      expect.fail(
        `Aggregatname deckt sich mit einer Kategoriebezeichnung:\n` +
        kollision.map(([id, name]) => `  ${id} → „${name}"`).join('\n') +
        `\n\nZusammenfassungen brauchen einen EIGENEN Namen — sonst heisst der\n` +
        `Reiter wie eine der Kategorien darin.`,
      );
    }
  });
});

describe('status-kurzlabel-single-source (Rohstatus-Beschriftung: eine Quelle)', () => {
  // Bis v3.15 fuehrten DREI Module ihre eigene Kurzform desselben Statuswerts:
  // STATUS_LABELS in core/utils/status-mappings.ts, STATUS_LABEL_OVERRIDES in
  // plugins/suche/columns.tsx (abweichende Schreibweise, Tippfehler
  // „Wiederspr.") und ein Literal in plugins/antraege/arbeitsvorrat.ts.
  // Derselbe Status sah je nach Ansicht anders aus; die STATUS_LABELS-Fassung
  // fuer Code 72 war zudem auf eine Schreibweise geschluesselt, die im
  // Produktivbestand gar nicht vorkommt, und griff deshalb nie.
  //
  // Die Quelle ist jetzt StatusCodeEintrag.kurz (Auslieferung) +
  // StatusWertEintrag.kurzLabel (Kuration), gelesen ueber statusKurzLabel() /
  // statusLabel() in core/utils/status-wert-labels.ts.
  //
  // Bewusst NICHT ueber eine Pfad-Allowlist fuer die gleichnamige
  // Feedback-Map: `STATUS_LABELS` aus components/feedback/constants.ts wird in
  // 16 Dateien genutzt, vier davon ausserhalb von feedback/ — eine
  // `${sep}feedback`-Allowlist meldete Fehlalarme und deckte zugleich ganze
  // Plugin-Baeume ab. Geprueft wird stattdessen die HERKUNFT.
  const KURZLABEL_QUELLE = `${sep}core${sep}status${sep}status-codes.ts`;
  const istTest = (file: string): boolean =>
    file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts');
  // Kommentarzeilen bleiben aussen vor: die Begruendungen, WARUM es die eine
  // Quelle gibt, nennen die alten Namen und die Kurzformen zwangslaeufig beim
  // Wort. Ein Guard, der seine eigene Dokumentation anmeckert, wird abgeschaltet.
  const istKommentar = (l: string): boolean => /^\s*(\/\/|\/\*|\*)/.test(l);
  // Generierte Fremddaten der Kuerzel-Zuarbeit (Pitfall #43): dort steht
  // „techn. geprüft" als Teil einer amtlichen Kuerzel-Bezeichnung, nicht als
  // unsere Beschriftung. Von Hand wird da ohnehin nichts eingetragen.
  const istGeneriert = (file: string): boolean => file.endsWith('.data.ts');

  it('kein zweiter Kurzform-Lookup (STATUS_LABEL_OVERRIDES / shortStatus)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l)
          && (l.includes('STATUS_LABEL_OVERRIDES') || /\bshortStatus\b/.test(l)),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Zweiter Kurzform-Lookup fuer Antragsstatus verboten.\n` +
        `Genau eine Quelle: StatusCodeEintrag.kurz (+ kuratiertes kurzLabel),\n` +
        `gelesen ueber statusKurzLabel() aus core/utils/status-wert-labels.ts.\n` +
        `Echte Ausnahme: '// allow-status-kurzlabel: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('status-mappings.ts fuehrt keine Beschriftung mehr, nur noch die Farbe', () => {
    // Strukturell an der Datei geprueft (Muster: status-category-not-curated):
    // nur hier entstuende die Map erneut, und ein Grep nach `STATUS_LABELS`
    // kollidierte mit der gleichnamigen Feedback-Map.
    const src = readFileSync(join(ROOT, 'core', 'utils', 'status-mappings.ts'), 'utf8');
    const treffer = [
      /export\s+const\s+STATUS_LABELS\b/,
      /export\s+function\s+getStatusLabel\b/,
    ].filter(m => m.test(src)).map(m => m.source);
    if (treffer.length > 0) {
      expect.fail(
        `status-mappings.ts beschriftet wieder Status:\n  ${treffer.join('\n  ')}\n\n` +
        `Die Datei haelt seit v3.15 nur noch STATUS_VARIANTS (Pillenfarbe).\n` +
        `Wie ein Status heisst, beantwortet core/utils/status-wert-labels.ts.`,
      );
    }
  });

  it('niemand importiert die entfernten Symbole aus status-mappings', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file)) continue;
      findings.push(...findInFile(
        file,
        l => /from\s+['"]@\/core\/utils\/status-mappings['"]/.test(l)
          && /\b(getStatusLabel|STATUS_LABELS)\b/.test(l),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `getStatusLabel/STATUS_LABELS gibt es nicht mehr.\n` +
        `Kurzform: statusKurzLabel() · voller Bezeichner: statusLabel()\n` +
        `(beide aus @/core/utils/status-wert-labels).\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  /**
   * Die echten ABKUERZUNGEN — kuratiert, nicht abgeleitet.
   *
   * Ein programmatisch aus STATUS_CODE_KATALOG gezogener Satz meldete dauerhaft
   * Fehlalarm: „Bewilligt"/„Beendet"/„Abgebrochen" sind blosse Gross-
   * Schreibungen ihres Rohwerts und stehen zu Recht in fremden Domaenen
   * (status-category-labels.ts, batch-indexer.ts), „Ablehnung" und
   * „Bewilligungsentwurf" sind amtliche Varianten. Dieselbe Entscheidung wie
   * bei status-labels-single-source oben. Der Test darunter haelt die Liste
   * vollstaendig.
   */
  const ABKUERZUNGEN = [
    'Skizze eing.', 'techn. geprüft', 'kaufm. geprüft', 'Bewilligungsentw.',
    'Rücknahmeempf.', 'Stelln. zur RNE', 'abgel./zurückgez.', 'Widerspruch Abl.',
    'Anhörung Widerruf', 'Assoz. Partner', 'Intl. Partner', 'VN techn. gepr.',
  ];
  // Als GANZES String-Literal, nicht als Teilkette: „Rücknahmeempf." steckt in
  // der amtlichen Variante „Stellungnahme zur Rücknahmeempf." (Code 72), und die
  // ist ein legitimer Rohwert — u.a. im Meilenstein-Seed als Bedingung.
  const ALS_LITERAL = ABKUERZUNGEN.map(a => new RegExp(
    `(['"\`])${a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\1`,
  ));

  it('keine Kurzform als Literal ausserhalb des Katalogs', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file) || istGeneriert(file) || file.includes(KURZLABEL_QUELLE)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && ALS_LITERAL.some(m => m.test(l)),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Status-Kurzform als Literal ausserhalb von status-codes.ts.\n` +
        `Das ist die vierte Kopie — genau die Klasse, die v3.15 aufgeloest hat.\n` +
        `Stattdessen: statusKurzLabel(rohwert).\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  it('die Liste bleibt vollstaendig: jede abgekuerzte Kurzform steht drin', async () => {
    // Maschinelle Untergrenze, damit die Handliste nicht verwaist: eine
    // Kurzform mit Punkt IST eine Abkuerzung. Kapitalisierungen ohne Punkt
    // („Bewilligt") bleiben bewusst draussen, siehe oben.
    const { STATUS_CODE_KATALOG } = await import('@/core/status/status-codes');
    const fehlend = STATUS_CODE_KATALOG
      .filter(e => e.kurz.includes('.') && !ABKUERZUNGEN.includes(e.kurz))
      .map(e => `${e.code}: „${e.kurz}"`);
    if (fehlend.length > 0) {
      expect.fail(
        `Neue Kurzform, die der Guard noch nicht schuetzt:\n  ${fehlend.join('\n  ')}\n\n` +
        `In ABKUERZUNGEN aufnehmen (conventions-status.test.ts) — sonst kann\n` +
        `sie unbemerkt ein zweites Mal getippt werden.`,
      );
    }
  });
});

describe('zah-phasen-snapshot-single-writer (ZAH-Phasen: genau ein Setzweg)', () => {
  // Seit v2.409 ist der Phasenschnitt kuratierbar; welcher Schnitt GILT, steht in
  // zwei Modul-Registern in core/status/zah-phasen.ts. Weil die Modul-global sind,
  // gewinnt bei zwei Schreibwegen die Import-Reihenfolge — also gibt es genau
  // einen: setStatusKatalogSnapshot in core/status/snapshot.ts, dieselbe Stelle
  // wie die Kategorien-Map. Tests raeumen ueber resetZahPhasenSnapshotFuerTests().
  const SETZER = ['setZahPhasenSnapshot', 'setCodePhasenSnapshot'];
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}core${sep}status${sep}zah-phasen.ts`,   // Heimat der Register
    `${sep}core${sep}status${sep}snapshot.ts`,     // der EINE Aufrufer
    `${sep}__tests__${sep}`,
    `.test.ts`,
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('die Phasen-Register werden nur aus snapshot.ts gesetzt', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(
        file, l => SETZER.some(s => l.includes(s)), 'allow-zah-phasen-setter',
      ));
    }
    if (findings.length > 0) {
      const msg =
        `Zweiter Schreibweg auf die ZAH-Phasen-Register verboten.\n` +
        `Wer die geltenden Phasen setzt, entscheidet fuer die ganze App —\n` +
        `Sidebar-Gruppierung, Verfahrensleiste, Zieltage, Kategorie-Ableitung.\n` +
        `Genau ein Aufrufer: setStatusKatalogSnapshot() in core/status/snapshot.ts.\n` +
        `In Tests: resetZahPhasenSnapshotFuerTests().\n` +
        `Echte Ausnahme: '// allow-zah-phasen-setter: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  it('kein Leser faellt auf eine leere Phasenliste zurueck', () => {
    // `zahPhasenVon()` liefert IMMER mindestens den Seed. Ein `?? []` daneben
    // waere die stille Rueckkehr zu „keine Phasen" — und damit zu einer Leiste
    // ohne Stationen und einer Sidebar ohne Gruppen.
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts')) continue;
      findings.push(...findInFile(
        file, l => /zahPhasenVon\([^)]*\)\s*\?\?\s*\[\]/.test(l), 'allow-leere-phasen',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `zahPhasenVon() liefert nie eine leere Liste — ein '?? []' daneben ist\n` +
        `entweder toter Code oder ein Missverstaendnis.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('zah-phase-single-source (Verfahrensschritt: eine Quelle, keine Kopien)', () => {
  // Gegenstueck zu status-labels-single-source, eine Achse daneben. Der
  // Phasenschnitt ist kuratierbar (v2.409): Anzahl, Beschriftung und die
  // Code-Zuordnung entscheidet die PL im Baum-Editor. Jede Kopie im Code haelt
  // beim naechsten Zuschnitt still den alten Stand — genau so standen bis v4.3
  // „Fachpruefung" und „Nachforderung" in der Handlungs-Formel, obwohl sie in
  // KEINER Fassung ein Phasenlabel waren, und das Vorgangs-Board mass die Frist
  // an vier fest eingetippten Ids.
  //
  // Der Vorfilter (Datei nennt ueberhaupt `zahPhase`) macht den Guard
  // treffsicher: dieselben Woerter sind anderswo legitime Fremd-Domaenen — die
  // Eval-Dimension `vollstaendigkeit`, der MAP-Schritt `pruefung`, der
  // Artefakt-Typ `Nachforderung`.
  const PHASEN_DATEIEN = ALL_TS_FILES.filter(f =>
    !f.includes(`${sep}__tests__${sep}`)
    && !f.endsWith('.test.ts')
    && /zahPhase|ZahPhase/.test(readFileSync(f, 'utf-8')));

  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}core${sep}status${sep}zah-phasen.ts`,      // Heimat des Seeds
    `${sep}core${sep}status${sep}seed-codes.ts`,      // Auslieferungs-Kuration je Code
    `${sep}core${sep}status${sep}seed-kanonisch.ts`,  // Auslieferung der kanonischen Felder
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  const HINWEIS =
    `Statt einer Kopie die Register-Leser aus core/status/zah-phasen.ts:\n` +
    `  zahPhaseLabel()       — Beschriftung des geltenden Schnitts\n` +
    `  phaseFuerCode()       — Code -> Phase, kuratiert\n` +
    `  fristLaeuftVon()      — laeuft in dieser Phase die Antragsfrist?\n` +
    `  phasenFuerKategorie() — Rueckrichtung: welche Schritte tragen diese Arbeitsliste\n` +
    `Der Verfahrensschritt ist beweglich, die Arbeitsliste steht still — und\n` +
    `seit v4.87 haengt sie am Code statt an der Phase\n` +
    `(docs/architecture/status-achsen.md).\n`;

  it('keine Phasen-ID als Literal', () => {
    // Bewusst OHNE entscheidung|begleitung|abgeschlossen: die drei sind wortgleich
    // StatusCategory-Schluessel und meldeten dauerhaft Fehlalarm — dieselbe
    // Abwaegung wie bei status-labels-single-source.
    const RE = /(['"])(eingang|vollstaendigkeit|pruefung)\1/;
    const findings: Finding[] = [];
    for (const file of PHASEN_DATEIEN) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => RE.test(l), 'allow-zah-phase-literal'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Feste ZAH-Phasen-ID im Code.\n${HINWEIS}` +
        `Echte Ausnahme: '// allow-zah-phase-literal: <grund>' in DERSELBEN Zeile.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('keine Phasen-BESCHRIFTUNG als Literal', () => {
    // Als GANZES Literal, nicht als Teilkette: die Aktion „Vollstaendigkeit
    // pruefen" ist eine Handlung und bleibt erlaubt.
    const RE = /(['"])(Eingang|Vollständigkeit|Prüfung|Entscheidung|Begleitung|Abgeschlossen|Fachprüfung)\1/;
    const findings: Finding[] = [];
    for (const file of PHASEN_DATEIEN) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => RE.test(l), 'allow-zah-phase-literal'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Phasen-Beschriftung als Literal — sie gehoert der Fassung, nicht dem Code.\n${HINWEIS}` +
        `Echte Ausnahme: '// allow-zah-phase-literal: <grund>' in DERSELBEN Zeile.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('status-event-log-local-only (Event-Log verlaesst das Geraet nie)', () => {
  // Das Status-Event-Log haelt fest, wann DIESE Installation eine Aenderung
  // beobachtet hat (`erfasstAm` = Importzeitpunkt auf diesem Geraet, Backfill-
  // Marke je Programm). Zwei Rechner, die an verschiedenen Tagen importieren,
  // schreiben fuer denselben Vorgang verschiedene Zeitstempel — zusammengefuehrt
  // ergaebe das eine widerspruechliche Historie. Es bleibt deshalb geraetelokal,
  // auch seit der KATALOG (v2.332) team-weit auf dem Daten-Share liegt.
  const EVENT_LOG_MODULE = [
    'event-store.ts', 'event-typen.ts', 'event-sort.ts', 'reconcile.ts', 'timeline.ts',
  ];
  const SHARE_WRITER = [
    'atomicWrite', 'appendToFile', 'writeProgrammSnapshot',
    'getDatenShareHandle', 'mirrorJsonToPersonal', 'savePersonalSettings',
  ];
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  it('die Event-Log-Module referenzieren keinerlei Share-/Snapshot-/Personal-Writer', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith('src/core/status/') || p.includes('__tests__')) continue;
      if (!EVENT_LOG_MODULE.some(m => p.endsWith(`/${m}`))) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of SHARE_WRITER) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(
      treffer,
      `Das Status-Event-Log ist geraetespezifisch (Beobachtungszeitpunkte dieses Rechners) `
      + `und darf das Geraet nie verlassen.\nVerbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Snapshot-Allowlist (snapshot.ts) kennt keine Status-Stores', () => {
    const snapshot = readFileSync(join(ROOT, 'core', 'services', 'csv', 'snapshot.ts'), 'utf-8');
    for (const key of ['status_katalog', 'status_event', 'status-katalog', 'status-timeline']) {
      expect(
        snapshot.includes(key),
        `snapshot.ts darf '${key}' nicht kennen — der Status-Katalog hat seine EIGENE Sidecar `
        + `(katalog-share.ts), das Event-Log bleibt geraetelokal. Beides gehoert strukturell `
        + `ausserhalb von SNAPSHOT_FILES.`,
      ).toBe(false);
    }
  });
});

describe('status-katalog-share-only (Katalog: genau EIN Weg auf den Share)', () => {
  // Der Status-Katalog ist seit v2.332 Team-Daten und liegt als Sidecar
  // `_intern/status-katalog.json`. Genau ein Modul fasst dafuer den Share an —
  // sonst entstuende ein zweiter Schreibweg mit eigener Konflikt-Semantik.
  // Registry, SMB-Snapshot und Personal-Mirror bleiben tabu.
  //
  // Seit dem Vorgangssystem gibt es ZWEI Sidecars (Katalog + Trigger-Tabelle),
  // aber weiterhin nur EINE Mechanik: `sidecar-datei.ts`. Der Guard wandert
  // deshalb von `katalog-share.ts` dorthin — und wird dabei strenger, weil jetzt
  // auch die Katalog-Datei nicht mehr selbst auf den Share greift.
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  // Das Klärungs-Modul wohnt im Plugin (ein Konsument, ein Blatt), legt seine
  // Antworten aber auf denselben Share. Damit es dadurch nicht aus der Aufsicht
  // faellt, gilt der Guard hier mit: auch `zu-klaeren` geht ueber sidecar-datei.ts.
  const SHARE_AUFSICHT = ['src/core/status/', 'src/plugins/zu-klaeren/'];

  it('nur sidecar-datei.ts fasst den Daten-Share an', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!SHARE_AUFSICHT.some(d => p.startsWith(d)) || p.includes('__tests__')) continue;
      if (p.endsWith('/sidecar-datei.ts')) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of ['atomicWrite', 'getDatenShareHandle']) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(
      treffer,
      `Der Share-Zugriff des Status-Systems gehoert ausschliesslich in sidecar-datei.ts.\n`
      + `Verbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('kein Status-Modul schreibt in registry.json oder den Personal-Mirror', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith('src/core/status/') || p.includes('__tests__')) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of ['registry.json', 'mirrorJsonToPersonal', 'savePersonalSettings', 'writeProgrammSnapshot']) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(treffer, `Verbotene Referenz(en): ${treffer.join(', ')}`).toEqual([]);
  });

  it('jeder Sidecar-Pfad steht genau einmal im Code', () => {
    // Ein Pfad, der an zwei Stellen steht, driftet beim ersten Umbenennen
    // auseinander — und die zweite Stelle schreibt dann leise ins Nirgendwo.
    const pfade: [string, string][] = [
      ['_intern/status-katalog.json', 'src/core/status/katalog-share.ts'],
      ['_intern/status-trigger.json', 'src/core/status/trigger-share.ts'],
      // Das Journal ist die dritte Sidecar. Stand und Monatsdateien leiten sich
      // beide aus DIESER Wurzel ab — stünde sie zweimal, schriebe die zweite
      // Stelle beim ersten Umbenennen leise ins Nirgendwo.
      ['_intern/vorgangssystem/journal', 'src/core/status/journal/pfade.ts'],
      // Die Klaerungs-Ablage ist die vierte. Verzeichnis UND Autor-Dateiname
      // leiten sich aus dieser Wurzel ab — stuende sie zweimal, schriebe die
      // zweite Stelle beim ersten Umbenennen leise ins Nirgendwo.
      ['_intern/klaerung', 'src/plugins/zu-klaeren/pfade.ts'],
    ];
    for (const [pfad, heimat] of pfade) {
      // Nur CODE zaehlt: ein Modulkopf, der den Nachbar-Sidecar erklaert, ist
      // Dokumentation und kein zweiter Schreibweg.
      const treffer = ALL_TS_FILES.filter(f =>
        !relPath(f).includes('__tests__')
        && readFileSync(f, 'utf-8').split(/\r?\n/).some(l => istCode(l) && l.includes(pfad)),
      ).map(relPath);
      expect(treffer, `Sidecar-Pfad ${pfad} gehoert nur nach ${heimat}.`).toEqual([heimat]);
    }
  });
});

describe('status-kategorie-nur-aus-katalog (Ordnerbaum ist Daten, kein Code)', () => {
  // Der Ordnerbaum des Fachsystems ist kuratierbare Team-Kuration: die PL legt
  // Ordner an und haengt Felder um, ohne dass ein Build noetig waere. Genau
  // deshalb darf der Baum NUR an zwei Stellen im Code stehen — im Seed (als
  // Vorbelegung) und in den Tests. Ein zweites Ordner-Mapping (z.B. eine
  // hartkodierte Kategorie-Liste in einer UI) waere ein stiller Fork, der bei
  // der ersten Umbenennung durch die PL auseinanderlaeuft.
  const KATEGORIE_ID = /['"](?:vb|tv)\.[a-z0-9-]+(?:\.[a-z0-9-]+)*['"]/;
  const ERLAUBT = [
    'src/core/status/seed-kategorien.ts',
    'src/core/status/seed-codes.ts',
    'src/core/status/seed.ts',                 // kanonische Felder haengen im Baum
    'src/core/status/seed-kanonisch.ts',       // ebendiese, seit dem Zyklenschnitt hier
    'src/core/status/kategorien.ts',           // NICHT_ZUGEORDNET_ID (Sammelordner)
  ];

  it('Kategorie-Ids stehen nur im Seed und in den Sammelordner-Konstanten', () => {
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__') || ERLAUBT.includes(p)) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return KATEGORIE_ID.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Kategorie-Ids (`vb.…`/`tv.…`) gehoeren in den Seed, nicht in die Anwendung. '
      + 'Wer einen Ordner braucht, liest ihn aus `version.kategorien` — die PL kann ihn '
      + `jederzeit umbenennen oder umhaengen. Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('bereich-nie-im-daten-layer (Pitfall #46)', () => {
  // Der Betrachtungsbereich ist ein EXPLIZITER Parameter jedes Konsumenten —
  // Arbeitsvorrat folgt ihm, Evidenz nicht. Zöge ihn stattdessen der Daten-Layer
  // (IDB-Leser, CSV-Dienste, Suchkorpus), gäbe es keine Stelle mehr, an der man
  // ihn abschalten könnte: die Suche fände dann nur noch, was ohnehin sichtbar
  // ist, und ein Deep-Link auf ein Altprogramm liefe ins Leere.
  // `useSuchRichtlinien` steht mit in der Liste: die Suche hat seit v4.91 eine
  // eigene, gemerkte Richtlinien-Auswahl. Sie ist derselbe Fall — ein
  // Konsumenten-Filter mit Chip, kein stiller Schnitt im Daten-Layer.
  const VERBOTEN = /\bistImBereich\b|useBereich\b|useSuchRichtlinien\b/;
  const TABU = [
    'src/core/services/csv/',        // IDB-Leser + Projektionen
    'src/core/services/search/',     // Suchkorpus + Orama
    'src/plugins/antraege/services/', // Antrags-Suchkorpus
  ];

  it('kein Bereichs-Filter in Daten-Layer oder Suchkorpus', () => {
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__')) return false;
      if (!TABU.some(t => p.startsWith(t))) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return VERBOTEN.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Der Betrachtungsbereich gehört an den Konsumenten, nicht in den Daten-Layer. '
      + 'Die globale Suche bleibt am Vollbestand, und ein Antrag muss per Deep-Link '
      + `immer erreichbar sein (Pitfall #46). Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Sicht-Zaehler kommen aus EINER Grundmenge', () => {
    // Gegenprobe zum Obigen: der Bereich gehoert an den Konsumenten — aber dann
    // muss auch JEDE Oberflaeche, die Sicht-Zahlen zeigt, denselben Konsumenten
    // benutzen. Solange die Chips in der Filter-Sidebar selbst zaehlten, liessen
    // sie den Bereich aus: Chip 555, Tab 541, dieselbe Sicht. Zaehlen darf
    // deshalb nur die Pipeline, die auch die Liste erzeugt; alle anderen lesen
    // `useFilteredAntraege().counts`.
    const ERLAUBT = [
      'src/plugins/antraege/views.ts',              // Definition
      'src/plugins/antraege/useFilteredAntraege.ts', // einzige Zaehlstelle
    ];
    // Positiv-Kontrolle: greift der Pfad-Filter nicht, liefe der Guard ins Leere
    // und meldete fuer immer „alles gut".
    const gescannt = ALL_TS_FILES.map(relPath).filter(p => p.startsWith('src/plugins/antraege/'));
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts').toContain(ERLAUBT[1]);
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__') || ERLAUBT.includes(p)) return false;
      if (!p.startsWith('src/plugins/antraege/')) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return /\bviewCounts?\s*\(/.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Sicht-Zahlen kommen aus `useFilteredAntraege().counts` — dieselbe Grundmenge '
      + 'wie die Liste (Bereich, Inaktiv-Ausschluss, Irrlaeufer-Schalter). Eine eigene '
      + `Zaehlung driftet still von der Liste darunter weg (Pitfall #46). Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Facetten-Zahlen rechnen nicht auf der rohen Store-Liste', () => {
    // Derselbe Fehler eine Etage tiefer, und er hielt sich laenger: die
    // Filterleiste bekam `useAntraegeStore(s => s.antraege)` hereingereicht und
    // zaehlte damit ueber den VOLLBESTAND, waehrend die Liste darunter ueber
    // Bereich → Sicht → Irrlaeufer → Kuerzel → Inaktiv lief. Im Reiter
    // „Antragsphase" bot sie „Richtlinie 36 (1.373)" an — der Klick lieferte
    // null Zeilen; 11 von 16 Werten liefen so ins Leere (v4.122).
    //
    // Wer Facetten zaehlt, nimmt `useFilteredAntraege().countBase` — dieselbe
    // Menge, aus der die Liste entsteht. Die Filterleiste ist ein ZAEHLER, kein
    // Bestandsbrowser.
    const gescannt = ALL_TS_FILES.map(relPath)
      .filter(p => p.startsWith('src/plugins/antraege/filter/'));
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toContain('src/plugins/antraege/filter/FilterSidebar.tsx');
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__')) return false;
      if (!p.startsWith('src/plugins/antraege/filter/')) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        if (t.includes('allow-facetten-vollbestand')) return false;
        return /useAntraegeStore\s*\(\s*s\s*=>\s*s\.antraege\b/.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Die Filterleiste zaehlt ueber `useFilteredAntraege().countBase`, nicht ueber '
      + 'die rohe Store-Liste — sonst verspricht eine Facetten-Zahl Treffer, die die '
      + `Liste darunter nicht hat (Pitfall #46). Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('ruhe-nur-sichtbarkeit (Pitfall #53)', () => {
  // Ein ruhendes Kuerzel verschwindet aus Tabelle, Auswahlliste und Fragebogen —
  // NICHT aus dem, was am Antrag steht. Filterte die Ableitung mit, verloere ein
  // Altantrag von 2017 seinen D_INFOB-Eintrag in Chronik und Zeitstrahl, und der
  // Import schriebe das Event gar nicht erst. Genau diese Vermischung ist der
  // Unterschied zu `aktiv`, das Datenwirkung HAT.
  const TABU = [
    'src/core/status/verlauf/',
    'src/core/status/reconcile.ts',
    'src/core/status/navigator.ts',
    'src/core/status/waechter.ts',
    'src/core/status/herleitung.ts',
    'src/core/status/snapshot.ts',
    'src/core/status/feld-aufloesung.ts',
    'src/plugins/antraege/status/',
  ];
  const VERBOTEN = /\bruht\b|\bruhende(Codes|FeldIds)\b|\bruhtFeld\b|\bruheGrund\b/;

  it('Chronik, Navigator, Waechter und Import lesen die Ruhe nicht', () => {
    // Positiv-Kontrolle: greift der Pfad-Filter nicht, meldete der Guard fuer
    // immer „alles gut".
    const gescannt = ALL_TS_FILES.map(relPath);
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toContain('src/core/status/reconcile.ts');

    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__')) return false;
      if (!TABU.some(t => p.startsWith(t))) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        if (l.includes('allow-ruhe-nur-sichtbarkeit:')) return false;
        return VERBOTEN.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Ruhe ist Sichtbarkeit, nicht Wahrheit (Pitfall #53): sie steuert Kuerzel-Tabelle, '
      + 'Regel-Auswahl und Klaerfragen. Was am Antrag steht, bleibt sichtbar — sonst '
      + `verliert eine Altchronik ihre Eintraege. Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('der Pruefbegriff der Bedingungen schrumpft nicht mit', () => {
    // `referenzierbareFelder` entscheidet, was der Share-IMPORT akzeptiert. Zoege
    // die Ruhe dort ein, wiese er bestehende Regeln zurueck — der Editor bietet
    // weniger an (`baueTodoFeldVorrat`), erlaubt aber weiterhin alles.
    const quelle = readFileSync(
      join(process.cwd(), 'src/core/status/bedingung.ts'), 'utf-8',
    );
    expect(
      VERBOTEN.test(quelle),
      'bedingung.ts darf die Ruhe nicht kennen: der Editor blendet aus, die '
      + 'Validierung nicht (sonst kippen bestehende Regeln beim Import).',
    ).toBe(false);
  });
});

describe('journal-ohne-personen-achse (Pitfall #48)', () => {
  // Das Import-Diff-Journal beantwortet „was hat sich geaendert", nicht „wer war
  // das". Mit Bearbeiter-Spalte plus Datumsverlauf entstuende ein
  // personenbezogenes Aktivitaetsprotokoll — Leistungs- und
  // Verhaltenskontrolle, mitbestimmungspflichtig. Das ist eine bewusste
  // Gestaltungsentscheidung und keine Auslassung; deshalb steht sie hier.
  //
  // **Was ERLAUBT ist (v4.134): der app-weite Bearbeiter-Ausschnitt.** Das
  // Nachtlauf-Widget waehlt ueber `useBearbeiterSicht` aus, an WELCHEN
  // Vorgaengen es Aenderungen zeigt — dieselbe Sicht wie „Meine Antraege", das
  // Kanban und die Liste. Das ist eine Aussage ueber Antraege, nicht ueber
  // Personen: die gezeigten Aenderungen koennen von AB, QS oder Juristen
  // stammen, und das Journal weiss ohnehin nicht, wer sie gemacht hat. Verboten
  // bleibt, was die Regel meint — eine Zeile, die einen HANDELNDEN nennt, und
  // jede Gruppierung nach Kuerzel. Der Ausschnitt ersetzt sie nicht, er waehlt
  // nur die Grundmenge; deshalb steht er in der Kopfzeile des Widgets.
  const JOURNAL = 'src/core/status/journal/';
  const ANSICHTEN = [
    'src/plugins/home/widgets/NachtlaufWidget.tsx',
    // Das Anzeige-Modell der Karte: es faltet die Einträge zu Zeilen und
    // entscheidet damit, wonach gruppiert wird. Eine Personen-Achse entstünde
    // hier, nicht erst in der Komponente.
    'src/plugins/home/widgets/nachtlaufGruppen.ts',
    'src/plugins/antraege/status/JournalVerlauf.tsx',
    // Dieselbe Quelle eine Ebene höher: die Historie am Verbund faltet die
    // Chroniken seiner Teilvorhaben. Sie steht hier, weil die Regel sonst genau
    // die Ansicht nicht prüfte, die am meisten auf einmal zeigt.
    'src/plugins/antraege/VerbundHistorie.tsx',
    // Der geteilte Wortlaut aller Journal-Ansichten — formuliert Einträge und
    // ist damit die Stelle, an der eine Personen-Angabe zuerst auftauchte.
    'src/plugins/antraege/status/journalTexte.ts',
    // Die Chronik legt das Journal zurück auf die Zeitachse (§12.10). Sie ist
    // die Ansicht, bei der eine Personen-Achse am nächsten läge: „wer hat das
    // zurückgenommen" ist genau die Frage, die sie NICHT beantwortet.
    'src/core/status/chronik-zurueckgenommen.ts',
    'src/plugins/antraege/status/JournalNullpunkt.tsx',
    'src/plugins/antraege/status/useJournalChroniken.ts',
    // Die Frische-Diagnose im Status-Cockpit: sie beantwortet „laeuft das
    // Journal noch", nie „wer war das". Deshalb steht sie in einer EIGENEN
    // Datei — an eine Sammel-Sektion gehaengt liesse sich die Regel nicht mehr
    // pruefen, ohne deren uebrige Diagnosen mitzufangen.
    'src/plugins/status-cockpit/JournalFrische.tsx',
  ];
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  it('JOURNAL_AUSGESCHLOSSEN nennt jede bekannte Bearbeiterspalte', () => {
    expect([...JOURNAL_AUSGESCHLOSSEN].sort())
      .toEqual(['BFM_KUERZ', 'BIB_KUERZ', 'PFM_KUERZ', 'TIB_KUERZ', 'ZTP_KUERZ']);
  });

  it('kein Journal-Modul und keine Journal-Ansicht liest ein Bearbeiter-Kuerzel', () => {
    const VERBOTEN = /\b\w*_kuerz\b|\bbearbeiter_kuerzel\b|\buseMeinKuerzel\b/i;
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (p.includes('__tests__')) continue;
      if (!p.startsWith(JOURNAL) && !ANSICHTEN.includes(p)) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        // Die Ausschluss-Liste selbst DARF die Namen nennen — sie ist der Ort,
        // an dem die Entscheidung nachlesbar steht.
        if (p.endsWith('/felder.ts')) continue;
        if (istCode(l) && VERBOTEN.test(l)) treffer.push(`${p}: ${l.trim().slice(0, 70)}`);
      }
    }
    expect(
      treffer,
      'Das Journal fuehrt keine Personen-Achse: keine Bearbeiterspalte in der Projektion, '
      + 'keine Gruppierung/Sortierung/Filterung nach Bearbeiter in einer Journal-Ansicht '
      + `(Pitfall #48).\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });

  it('das Journal schreibt nie in IndexedDB — eine geraetelokale Historie divergiert', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith(JOURNAL) || p.includes('__tests__')) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        if (istCode(l) && /\bidb\.(set|delete|append)\b/.test(l)) treffer.push(`${p}: ${l.trim()}`);
      }
    }
    expect(
      treffer,
      'Der Journal-Stand liegt auf dem Share. Gerätelokal gefuehrt erzeugte er genau die '
      + `Divergenz, die das Vorgangssystem beseitigt hat.\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });

  it('der Journal-Bereich kommt aus der TEAM-Kuration, nie aus der persoenlichen Auswahl', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith(JOURNAL) || p.includes('__tests__')) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        if (istCode(l) && /useBereich|useBetrachtungsbereich/.test(l)) treffer.push(`${p}: ${l.trim()}`);
      }
    }
    expect(
      treffer,
      'Der Bereich des Journals kommt aus `bereichsProgramme(getAktiveVersion())`. Aus der '
      + 'persoenlichen Auswahl gespeist entschiede die Einstellung EINES Rechners ueber den '
      + `Inhalt einer geteilten Datei.\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });
});

describe('kuerzel-genau-ein-speicherort (Regression des v2.376-Doppelfelds)', () => {
  // Vier Kürzel des Fachsystems hängen an einem KANONISCHEN Feld (`AAE` →
  // antragsdatum, `ABB` → bewilligung_datum, `AZ1` → erstentscheidung, `VBE` →
  // vn_eingang_datum). Sie dürfen NICHT zusätzlich als `D_<code>`-Feld geführt
  // werden: die Kollisionsregel der Feld-Auflösung gibt dem kanonischen Feld den
  // Wert, das `D_`-Feld bleibt für immer leer. Solange `ABB` doppelt hing, galt
  // es überall als „nie gesetzt" — und fast jede Trigger-Bedingung lautet „TV
  // hat kein ABB" (Pitfall #44).
  //
  // Die Liste wird AUS `KANONISCHE_CODE_FELDER` gebaut, nie von Hand gepflegt:
  // ein fünftes kanonisches Feld ist damit ab dem ersten Tag mit bewacht.
  const CODES = [...KANONISCHE_CODE_FELDER.keys()];
  // `D_AAE` als ganzer String/Bezeichner — `D_AZ1_1` (die echte CSV-Spalte, per
  // Alias kanonisch gemappt) endet nicht hier und bleibt erlaubt.
  const LITERAL = new RegExp(`['"\`]D_(?:${CODES.join('|')})['"\`]`);
  // Scope: die Module, in denen ein `D_<code>` einen KATALOG-FELD-Eintrag meint.
  // Außerhalb (z.B. die CSV-Label-Tabelle der Auslastung) ist `D_AAE` schlicht
  // der Name einer Export-Spalte — den gibt es wirklich, und ihn zu benennen ist
  // richtig. Der Fehler entsteht erst dort, wo daraus ein Feld des Katalogs wird.
  const SCOPE = [
    'src/core/status/',
    'src/plugins/status-cockpit/',
    'src/plugins/vorgangs-board/',
    'src/plugins/antraege/status/',
  ];

  it('LITERAL trifft das Code-Feld, nicht die CSV-Spalte', () => {
    expect(LITERAL.test("feld('D_ABB')")).toBe(true);
    expect(LITERAL.test('"D_AAE"')).toBe(true);
    expect(LITERAL.test("'D_AZ1_1'")).toBe(false);   // CSV-Spalte, kanonisch gemappt
    expect(LITERAL.test("'D_ABLZ'")).toBe(false);    // fremdes Kürzel
  });

  it('kein kanonisch belegtes Kürzel wird als D_-Feld geschrieben', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      if (!SCOPE.some(s => relPath(file).startsWith(s))) continue;
      findings.push(...findInFile(
        file,
        l => !/^\s*(?:\/\/|\*|\/\*)/.test(l) && LITERAL.test(l),
        'allow-kanonisches-doppelfeld',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Ein kanonisch belegtes Kürzel darf kein zweites \`D_\`-Feld bekommen.\n`
        + `Den Spaltennamen über todoFeld()/feld() aus KANONISCHE_CODE_FELDER holen —\n`
        + `dort steht, wie das Feld im Katalog wirklich heißt. Ein hart geschriebenes\n`
        + `\`D_<code>\` findet für diese vier Kürzel NIE einen Wert und schweigt für immer.\n`
        + `\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('kein-nullpunkt-als-letzte-aenderung (Wächter, v3.43.2)', () => {
  // `journalAb` (Nullpunkt, EINE Zahl für den ganzen Bestand) und
  // `letzteAenderung` (belegte Änderung DIESES Antrags) sind beide
  // `string | null` — der Typ konnte ihre Verwechslung nicht fangen. Vertauscht
  // meldeten 1 056 von 1 057 hängenden Vorgängen „läuft", während das Board mit
  // der richtigen Quelle „hängt fest" sagte (v3.31–v3.43.1). Hergang + Messung:
  // docs/architecture/vorgangssystem.md §12.2.
  const istNullpunktAlsAenderung = (line: string): boolean =>
    /journalAenderung\s*:\s*[^,;]*\bjournalAb\b/.test(line);

  it('`journalAenderung` wird nie aus einem Nullpunkt gespeist', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, istNullpunktAlsAenderung, 'allow-nullpunkt-aenderung'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Der Nullpunkt des Journals ist keine Änderungsmeldung (v3.43.2).\n`
        + `\`journalAb\` ist für JEDEN Antrag derselbe Tag; als \`journalAenderung\`\n`
        + `übergeben setzt er \`belegt: true\` und ersetzt die Liegezeit durch das\n`
        + `Alter des Journals — jeder Vorgang sieht frisch aus.\n`
        + `Stattdessen: \`ZeilenVerlauf.journalAenderung\` bzw. im Board\n`
        + `\`letzteAenderungJeAntrag()\`. Nichts Belegtes? Dann \`null\`.\n`
        + `\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  // Ein Guard ohne Zahn-Beweis nickt nur: hier steht die Zeile, die zwischen
  // v3.31 und v3.42 in drei Bauteilen stand, samt einer, die gültig bleiben muss.
  it('erkennt die historische Fundstelle und verschont die richtige', () => {
    expect(istNullpunktAlsAenderung('    journalAenderung: daten.journalAb,')).toBe(true);
    expect(istNullpunktAlsAenderung('  journalAenderung: chronik?.journalAb ?? null,')).toBe(true);
    expect(istNullpunktAlsAenderung('    journalAenderung: daten.journalAenderung,')).toBe(false);
    expect(istNullpunktAlsAenderung('  journalAb={daten.journalAb}')).toBe(false);
  });
});

describe('chronik-zwei-wirte-ein-vokabular (v4.61)', () => {
  // Die chronologische Chronik rendert an ZWEI Stellen dieselbe Komponente —
  // Verbund-Detailseite und Tabellen-Ausklapp. Sie sah trotzdem verschieden
  // aus: die Detailseite reichte `tvNummern` herein („TV 1", „alle 4"), der
  // Ausklapp nicht, und dort standen Aktenzeichen-Endungen („…430"). Zwei
  // Vokabulare für dieselbe Auskunft, weil ein Wirt eine Prop vergaß.
  //
  // Der Guard hält zwei Zusagen fest: JEDER Wirt beschriftet seine Träger, und
  // die Nummer kommt aus `tvAchse` — nicht aus einer zweiten Sortierung, die
  // beim ersten Sonderfall auseinanderliefe.

  it('jeder Wirt der StatusChronik reicht tvNummern herein', () => {
    const ohne: string[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      const text = readFileSync(file, 'utf8');
      if (!/<StatusChronik\b/.test(text)) continue;
      if (!/tvNummern/.test(text)) ohne.push(relPath(file));
    }
    if (ohne.length > 0) {
      expect.fail(
        `Die Chronik beschriftet ihre Träger überall gleich (v4.61).\n`
        + `Ohne \`tvNummern\` fällt \`TraegerBadges\` auf die Endung des\n`
        + `Aktenzeichens zurück („…430") — dieselbe Zeile liest sich dann in der\n`
        + `Tabelle anders als auf der Detailseite.\n`
        + `Stattdessen: \`tvAchse(quelle.jeTeilvorhaben)\` und die Karte durchreichen.\n`
        + `\nWirte ohne tvNummern:\n${ohne.join('\n')}`,
      );
    }
  });

  const EIGENE_NUMMERN = /\.map\(\s*\(?\s*\w+\s*,\s*i\s*\)?\s*=>\s*\[\s*\w+\s*,\s*i\s*\+\s*1/;

  it('kein Wirt baut sich seine eigene TV-Nummerierung', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.endsWith(`${sep}core${sep}status${sep}chronik-matrix.ts`)) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(
        file, l => EIGENE_NUMMERN.test(l), 'allow-eigene-tv-nummern',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Aktenzeichen → laufende Nummer kommt aus \`tvAchse\` (v4.61).\n`
        + `Eine zweite Karte ist eine zweite Sortierregel: „TV 2" hieße dann in\n`
        + `einem Wirt ein anderes Teilvorhaben als im nächsten — und zitieren\n`
        + `lässt sich die Nummer schon heute nicht.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  it('erkennt die historische Fundstelle und verschont die richtige', () => {
    // So stand die Karte bis v4.60 in StatusDetailSection.
    expect(EIGENE_NUMMERN.test('    () => new Map(tvIds.map((id, i) => [id, i + 1] as const)),'))
      .toBe(true);
    expect(EIGENE_NUMMERN.test('  const spalten = baueSpalten(tvIds);')).toBe(false);
  });
});

describe('entwurf-liest-keinen-snapshot (v4.120)', () => {
  // Das Cockpit bearbeitet einen ENTWURF; der Modul-Snapshot in zah-phasen.ts
  // traegt die AKTIVE Fassung und wird nur von snapshot.ts gesetzt. Wer beides
  // in einer Ansicht mischt, beschreibt einen Stand, den niemand bearbeitet.
  //
  // Genau das tat der Reiter „Ebenen" bis v4.120: die Zeilen kamen aus
  // `zahPhasenVon(v.zahPhasen)` (Entwurf), die Code-Zuordnung aus
  // `phaseFuerCode` (Snapshot). Ein umgehaengter, noch nicht gespeicherter Code
  // blieb am alten Schritt stehen; zeigte er auf eine Phase, die der Entwurf
  // gar nicht fuehrt, verschwand er aus JEDER Zeile — und die Summe war
  // kleiner als die Zahl in der Zeile „Status", ohne dass die Seite es sagte.
  //
  // Der entwurfsbezogene Weg heisst `schnittVon(version)` und lag die ganze
  // Zeit daneben (`useStatusCockpit.ts` benutzt ihn fuer die Feld-Phasen).
  const SNAPSHOT_LESER = /\b(phaseFuerCode|geltenderSchnitt|istMarkerCode)\s*[(),]/;

  it('kein Snapshot-Leser im Status-Cockpit', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.includes(`${sep}plugins${sep}status-cockpit${sep}`)) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, l => SNAPSHOT_LESER.test(l), 'allow-snapshot-im-entwurf'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Snapshot-Leser in einer Ansicht, die den ENTWURF zeigt (v4.120).\n`
        + `  phaseFuerCode()/geltenderSchnitt()/istMarkerCode() lesen die AKTIVE\n`
        + `  Fassung — im Cockpit ist das der falsche Stand.\n`
        + `Stattdessen:\n`
        + `  schnittVon(entwurf)          — Code -> Phase, entwurfsbezogen\n`
        + `  SEED_CODE_ZU_ZAH_PHASE       — wenn ausdruecklich die AUSLIEFERUNG gemeint ist\n`
        + `  w.zahPhaseId ?? Auslieferung — je Eintrag (siehe katalogZeilen.phaseVon)\n`
        + `Echte Ausnahme: '// allow-snapshot-im-entwurf: <grund>' in DERSELBEN Zeile.\n\n`
        + `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('erkennt die historische Fundstelle und verschont die richtige', () => {
    // So stand es bis v4.120 in ebenenModell.ts …
    expect(SNAPSHOT_LESER.test('    const phase = phaseFuerCode(code);')).toBe(true);
    expect(SNAPSHOT_LESER.test('      ? bauePhasenBaum(entwurf, api.vorkommen, wertId, phaseFuerCode)')).toBe(true);
    // … und so sieht der entwurfsbezogene Weg aus.
    expect(SNAPSHOT_LESER.test('  const schnitt = schnittVon(v);')).toBe(false);
    expect(SNAPSHOT_LESER.test('        code => SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null)')).toBe(false);
  });
});
