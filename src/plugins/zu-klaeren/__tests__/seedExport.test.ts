/**
 * Was diese Datei festnagelt:
 *
 * 1. Der Export liest die FASSUNG, nicht die Antworten. Dieselbe Fassung ergibt
 *    denselben Text, egal was in der Klärung beschlossen wurde — genau der Fehler
 *    vom 05.08., als der Export fünf Änderungen nannte und der Baum dreizehn trug.
 * 2. Die Phasen kommen als GANZE Tabelle heraus, mit dem alten Wert als Kommentar
 *    und den Entfernungen darüber. Vier Einzelschritte wären vier Gelegenheiten,
 *    einen zu übersehen.
 * 3. Der Wechsel auf „ohne Phase" ist kein Map-Eintrag, sondern eine Entfernung
 *    plus Marker-Eintrag — sonst schriebe jemand `[29, 'ohne-phase']` in eine Map,
 *    die diesen Wert nicht kennt.
 * 4. Zieltage stehen abgesetzt und ausdrücklich NICHT einfügefertig: die
 *    Auslieferung hat dafür keine Struktur.
 * 5. „Nichts zu ändern" und „Fassung nicht geladen" sind zwei verschiedene
 *    Aussagen — die falsche davon beruhigt.
 */
import { describe, it, expect } from 'vitest';
import { baueSeedDiff } from '@/plugins/zu-klaeren/seedExport';
import type { ExportEingabe } from '@/plugins/zu-klaeren/export';
import { falte } from '@/plugins/zu-klaeren/fold';
import { bauePunkte, PHASENSCHNITT } from '@/plugins/zu-klaeren/seed-phasenschnitt';
import { baueSeedVersion, katalogDrift, leereKatalogDrift, SEED_ZAH_PHASEN } from '@/core/status';
import type { KatalogDrift, MappingVersion, ZahPhase, ZahPhaseId } from '@/core/status';
import type { KlaerungEintrag } from '@/plugins/zu-klaeren/typen';

const PUNKTE = bauePunkte();
const SEED = baueSeedVersion();

function eingabe(
  drift: KatalogDrift | null,
  fassungPhasen?: readonly ZahPhase[],
  eintraege: KlaerungEintrag[] = [],
): ExportEingabe {
  return {
    klaerung: PHASENSCHNITT,
    punkte: PUNKTE,
    stand: falte(eintraege),
    autoren: eintraege.length > 0 ? ['MUE'] : [],
    vorkommen: null,
    bestandVom: null,
    jetztIso: '2026-08-05T09:00:00.000Z',
    drift,
    ...(fassungPhasen !== undefined ? { fassungPhasen } : { fassungPhasen: undefined }),
  };
}

/**
 * Eine Fassung wie am 05.08.: „Vollständigkeit" entfernt, zwei Schritte
 * umbenannt, Codes umgehängt, ein Code zum Marker, ein Zieltag gepflegt.
 */
const FASSUNG_PHASEN: ZahPhase[] = SEED_ZAH_PHASEN
  .filter(p => p.id !== 'vollstaendigkeit')
  .map(p => {
    if (p.id === 'pruefung') return { ...p, label: 'In Prüfung' };
    if (p.id === 'entscheidung') return { ...p, label: 'Erstentscheidung' };
    return { ...p };
  });

function fassung(): MappingVersion {
  const umgehaengt = new Map<number, ZahPhaseId | null>([
    [33, 'pruefung'], [34, 'pruefung'], [90, 'begleitung'],
    [11, null],                                   // Eingang → Marker
  ]);
  return {
    ...SEED,
    zahPhasen: FASSUNG_PHASEN,
    werte: SEED.werte.map(w => {
      const mitZiel = w.code === 38 ? { ...w, zieltage: 21 } : w;
      if (w.code === undefined || !umgehaengt.has(w.code)) return mitZiel;
      return { ...mitZiel, zahPhaseId: umgehaengt.get(w.code) ?? null };
    }),
  };
}

const DRIFT = katalogDrift(fassung(), SEED);
const TEXT = baueSeedDiff(eingabe(DRIFT, FASSUNG_PHASEN));

describe('baueSeedDiff — Quelle ist die Fassung', () => {
  it('der Kopf benennt die Quelle und die Zieldatei', () => {
    expect(TEXT).toContain('STATUS-KATALOG');
    expect(TEXT).toContain('nicht die Antworten dieser Seite');
    expect(TEXT).toContain('zah-phasen.ts');
  });

  it('die Antworten der Klärung ändern den Text NICHT', () => {
    const mitAntworten = baueSeedDiff(eingabe(DRIFT, FASSUNG_PHASEN, [
      { ts: '2026-08-05T08:00:00.000Z', autor: 'MUE', punktId: 'code-59', urteil: 'andere', zielWert: 'eingang' },
    ]));
    expect(mitAntworten, 'beschlossen wird hier, vollzogen im Baum').toBe(TEXT);
  });

  it('ohne geladene Fassung sagt der Text das, statt „nichts zu ändern"', () => {
    const ohne = baueSeedDiff(eingabe(null));
    expect(ohne).toContain('nicht geladen');
    expect(ohne).not.toContain('Nichts zu ändern');
  });

  it('eine Fassung ohne Drift sagt ausdrücklich, dass nichts zu tun ist', () => {
    expect(baueSeedDiff(eingabe(leereKatalogDrift()))).toContain('Nichts zu ändern');
  });
});

describe('baueSeedDiff — Verfahrensschritte', () => {
  it('gibt die ganze Tabelle aus, nicht nur die Unterschiede', () => {
    expect(TEXT).toContain('export const SEED_ZAH_PHASEN');
    for (const p of FASSUNG_PHASEN) expect(TEXT).toContain(`id: '${p.id}'`);
    expect(TEXT, 'die entfallene Phase steht nicht mehr in der Liste')
      .not.toContain("id: 'vollstaendigkeit'");
  });

  it('nennt die entfallene Phase als Kommentar darüber', () => {
    expect(TEXT).toContain("// entfallen: 'vollstaendigkeit' (Vollständigkeit)");
  });

  it('trägt den alten Namen an der umbenannten Zeile', () => {
    expect(TEXT).toContain("label: 'In Prüfung'");
    expect(TEXT).toContain("war label: 'Prüfung'");
  });

  it('die Zeilen sind gültige Literale mit allen Feldern', () => {
    const zeile = TEXT.split('\n').find(z => z.includes("id: 'eingang'"));
    expect(zeile).toContain('reihenfolge: 10');
    expect(zeile).toContain('zieltageRelevant: true');
    expect(zeile).toContain('fristLaeuft: true');
  });
});

describe('baueSeedDiff — Zuordnungen', () => {
  it('nennt je umgehängtem Code die Zeile und den alten Wert', () => {
    expect(TEXT).toContain("[33, 'pruefung'],");
    expect(TEXT).toContain('war: vollstaendigkeit');
    expect(TEXT).toContain("[90, 'begleitung'],");
  });

  it('ein Wechsel zu „ohne Phase" ist eine Entfernung, kein Map-Eintrag', () => {
    expect(TEXT).not.toContain("[11, 'ohne-phase']");
    expect(TEXT).toContain('11 zu SEED_MARKER_CODES hinzufügen');
  });

  it('die Zeilen stehen in Code-Reihenfolge', () => {
    expect(TEXT.indexOf('[33,')).toBeLessThan(TEXT.indexOf('[34,'));
    expect(TEXT.indexOf('[34,')).toBeLessThan(TEXT.indexOf('[90,'));
  });
});

describe('baueSeedDiff — Zieltage', () => {
  it('stehen abgesetzt und ausdrücklich nicht einfügefertig', () => {
    expect(TEXT).toContain('ZIELTAGE — NICHT einfügefertig');
    expect(TEXT).toContain('noch keine Struktur');
  });

  it('erscheinen als Kommentar, nie als Code', () => {
    const zeile = TEXT.split('\n').find(z => z.includes('21 Tage'));
    expect(zeile?.trimStart().startsWith('//'), 'sonst setzt jemand sie ein').toBe(true);
  });

  it('ein Statuswert steht zweimal im Katalog — die Aufstellung nennt ihn einmal', () => {
    expect(TEXT.split('\n').filter(z => z.includes('21 Tage'))).toHaveLength(1);
  });
});
