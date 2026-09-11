/**
 * Codebase-Conventions — die Bestands-Generation: EIN Schreiber, alle Leser folgen.
 *
 * Die Generation zählt hoch, wenn der Antrags-/Verbund-Bestand ersetzt wurde
 * (CSV-Import, Snapshot-Sync, Spalten-Nachzug). Zwei Hälften derselben Zusage:
 *   - bestand-generation-am-choke-point → genau eine Stelle zählt hoch
 *     (`refreshAntraegeStoreAfterSync`); ein zweiter Schreiber machte den
 *     Zähler zur Vermutung.
 *   - journal-leser-folgt-dem-bestand   → wer das Import-Diff-Journal in einem
 *     React-Effekt liest, folgt ihr (`useBestandGeneration`) — sonst zeigt die
 *     Karte bis zum Reload den Nachtlauf von davor (v6.57.2).
 *
 * Aus conventions-daten.test.ts herausgelöst (v6.57.2), als die zweite Hälfte
 * dazukam und die Datei über die Drift-Schwelle der Gesundheits-Baseline hob.
 * Geschwister: conventions-daten/-status/-ui/-clean-code.test.ts; Datei-Walk +
 * Such-Primitive in conventions-lib.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bestandGeneration, markiereBestandGeaendert } from '../core/services/bestand-generation';
import { ALL_SOURCE_FILES, relPath } from './conventions-lib';

/**
 * Die Bestands-Generation ist das Signal, an dem die Sitzungs-Caches von
 * Vorgangs-Board und Vorgangs-Regeln haengen. Ihr Wert steht und faellt damit,
 * dass genau EINE Stelle sie hochzaehlt: streute man `markiereBestandGeaendert()`
 * ueber die Aufrufer, waere der erste vergessene Aufruf ein Cache, der
 * schweigend veraltete Zahlen zeigt — und das fiele niemandem auf, weil nichts
 * fehlschlaegt.
 */
describe('bestand-generation', () => {
  it('zaehlt monoton hoch', () => {
    const vorher = bestandGeneration();
    markiereBestandGeaendert();
    expect(bestandGeneration()).toBe(vorher + 1);
    markiereBestandGeaendert();
    expect(bestandGeneration()).toBe(vorher + 2);
  });
});

describe('bestand-generation-am-choke-point', () => {
  // `relPath` liefert Vorwaertsschraegstriche — auf Windows waere `path.sep`
  // hier genau der Grund, warum der Guard nichts faende.
  const DEFINITION = 'core/services/bestand-generation.ts';
  const CHOKE_POINT = 'plugins/antraege/snapshot-refresh.ts';

  /** Alle Nicht-Test-Quellen, die den Marker AUFRUFEN (nicht nur importieren). */
  function aufrufer(): string[] {
    const out: string[] = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file);
      if (rel.includes('/__tests__/') || rel.endsWith('.test.ts')) continue;
      if (rel.includes(DEFINITION)) continue;
      if (readFileSync(file, 'utf-8').includes('markiereBestandGeaendert(')) out.push(rel);
    }
    return out;
  }

  it('der Choke-Point ruft ihn', () => {
    const treffer = aufrufer();
    // Positiv-Kontrolle zuerst: findet der Scan ueberhaupt etwas? Ohne sie ginge
    // der Test auch dann durch, wenn ALL_SOURCE_FILES leer waere.
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer.some(f => f.includes(CHOKE_POINT))).toBe(true);
  });

  it('und sonst niemand', () => {
    const fremde = aufrufer().filter(f => !f.includes(CHOKE_POINT));
    if (fremde.length > 0) {
      expect.fail(
        `markiereBestandGeaendert() darf NUR in ${CHOKE_POINT} gerufen werden — dort\n`
        + `laeuft jeder Bestandswechsel ohnehin durch (Snapshot-Watcher, beide Phasen der\n`
        + `Datenaktualisierung, die Kurations-Dialoge). Ein zweiter Schreiber macht den\n`
        + `Zaehler zur Vermutung: welcher Aufruf fehlt, sieht man erst an falschen Zahlen\n`
        + `in einem Cache.\n\nFremde Aufrufer:\n  ${fremde.join('\n  ')}`,
      );
    }
  });
});

describe('journal-leser-folgt-dem-bestand', () => {
  // Ein Import schreibt einen neuen Nachtlauf ins Journal. Wer ihn in einem
  // React-Effekt liest, muss danach NEU lesen — sonst zeigt die Karte bis zum
  // Reload den Lauf von davor. So standen die Karte „Änderungen der letzten
  // Nacht" und der Nachtlauf-Satz des Tagesbriefs bis v6.57.1 (gemessen
  // 11.09.2026: nach dem Bestandswechsel kein einziger Journal-Read).
  //
  // Grob, aber grep-bar: eine .tsx- oder use*.ts-Datei, die `letzterNachtLauf(`
  // oder `nachtLaeufeSeit(` ruft, nennt auch `useBestandGeneration`. Reine
  // Module (Assembler, Services) bleiben aussen vor — sie laufen in dem Moment,
  // in dem sie gerufen werden.
  const LESER = /\b(letzterNachtLauf|nachtLaeufeSeit)\(/;
  const MARKER = 'allow-journal-ohne-generation';

  /** Die Regel als reine Funktion — Probe und Gegenprobe prüfen sie selbst. */
  function verletzt(src: string): boolean {
    return LESER.test(src) && !src.includes('useBestandGeneration') && !src.includes(MARKER);
  }

  function reactLeser(): Array<{ rel: string; src: string }> {
    const out: Array<{ rel: string; src: string }> = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file);
      if (rel.includes('/__tests__/') || rel.endsWith('.test.ts')) continue;
      const name = rel.split('/').pop() ?? '';
      if (!rel.endsWith('.tsx') && !/^use[A-Z]/.test(name)) continue;
      const src = readFileSync(file, 'utf-8');
      if (LESER.test(src)) out.push({ rel, src });
    }
    return out;
  }

  it('Probe und Gegenprobe', () => {
    expect(verletzt('useEffect(() => { void letzterNachtLauf(idb); }, [idb]);')).toBe(true);
    expect(verletzt(
      'const g = useBestandGeneration(); useEffect(() => { void letzterNachtLauf(idb); }, [idb, g]);',
    )).toBe(false);
    expect(verletzt(`await nachtLaeufeSeit(idb, 3, heute); // ${MARKER}: einmaliger Export`)).toBe(false);
  });

  it('findet die Leser überhaupt (Positiv-Kontrolle)', () => {
    expect(reactLeser().length).toBeGreaterThan(0);
  });

  it('jeder React-Leser des Journals folgt der Bestands-Generation', () => {
    const verstoesse = reactLeser().filter(l => verletzt(l.src)).map(l => l.rel);
    if (verstoesse.length > 0) {
      expect.fail(
        'Diese Dateien lesen das Journal, folgen aber keinem Import — nach einer\n'
        + 'Datenaktualisierung zeigen sie bis zum Reload den Nachtlauf von davor.\n'
        + '`const generation = useBestandGeneration()` in die Effekt-Abhängigkeiten\n'
        + `nehmen (oder begründet \`// ${MARKER}: <grund>\`):\n  ${verstoesse.join('\n  ')}`,
      );
    }
  });
});
