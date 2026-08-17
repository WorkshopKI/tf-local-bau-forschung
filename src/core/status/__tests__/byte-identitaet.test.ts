/**
 * **Liefert die Ableitung über beide Pfade dasselbe?** — `getStatusCategory`
 * über den Katalog-Snapshot BITWEISE gleich wie über die eingebaute
 * `CATEGORY_MAP`. Baseline OHNE Snapshot erfassen, Seed-Snapshot setzen,
 * vergleichen.
 *
 * **Warum das trägt, und wofür.** Die eingebaute Map ist der einzige Pfad, den
 * prod/as haben: dort ist `statusCockpit` aus, `initStatusKatalog` läuft nie,
 * ein Snapshot existiert nicht. Weichen die Pfade ab, verhält sich dieselbe
 * App-Version je nach Variante anders — und niemand merkt es, weil beide für
 * sich plausibel aussehen.
 *
 * **Die wahrscheinlichste Art, das kaputtzumachen**, seit die Fassade aus dem
 * Code-Katalog gespeist wird: eine Schreibweise, die die eingebaute Map kennt,
 * fehlt im Seed. Der Katalog führt eine Zeile je Code und trägt die
 * Schreibweisen als `varianten`; vergisst der Snapshot sie, löst
 * „techn. geprüft" nur noch über die eingebaute Map auf. Deshalb prüft dieser
 * Test seit v2.383 **jede Variante einzeln** — nicht nur die kanonischen Werte.
 *
 * Setzt Modul-globalen Zustand (den Snapshot in status-canonical.ts) → läuft im
 * Projekt `isolated` und räumt in `afterAll` auf.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  getStatusCategory, getStatusValuesByCategory, getCanonicalStatusEntries,
  type StatusCategory,
} from '@/core/utils/status-canonical';
import { setStatusKatalogSnapshot } from '@/core/status/snapshot';
import { zahPhaseFuerStatusText } from '@/core/status/kategorie-ableitung';
import { baueSeedVersion } from '@/core/status/seed';
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';
import { SEED_MARKER_CODES } from '@/core/status/zah-phasen';

const ALLE_KATEGORIEN: StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

const KANON_WERTE = getCanonicalStatusEntries().map(([w]) => w);
/** Jede im Code-Katalog gepflegte Schreibweise — Text UND Varianten. */
const ALLE_SCHREIBWEISEN = STATUS_CODE_KATALOG.flatMap(e => [e.text, ...e.varianten]);
const RAND_WERTE = [
  'VN angefordert', 'ZB eingegangen', 'ZB.foo', 'Widerruf',
  'BEWILLIGT', 'Gutachten Fertig', 'schlussvermerk', 'abgelehnt/zurückgezogen',
  'unbekannt xyz', '', '   ', '  bewilligt  ',
];
const NICHT_STRINGS: unknown[] = [null, undefined, 42, {}, []];

afterAll(() => setStatusKatalogSnapshot(null));

describe('Byte-Identität Katalog-Snapshot vs. eingebaute CATEGORY_MAP', () => {
  it('getStatusCategory ist für alle Roh- und Randwerte identisch', () => {
    const werte = [...KANON_WERTE, ...ALLE_SCHREIBWEISEN, ...RAND_WERTE];
    // Baseline OHNE Snapshot.
    const baseline = new Map(werte.map(w => [w, getStatusCategory(w)]));
    const baselineNichtStrings = NICHT_STRINGS.map(w => getStatusCategory(w));

    setStatusKatalogSnapshot(baueSeedVersion());

    for (const w of werte) {
      expect(getStatusCategory(w)).toBe(baseline.get(w));
    }
    NICHT_STRINGS.forEach((w, i) => {
      expect(getStatusCategory(w)).toBe(baselineNichtStrings[i]);
    });
  });

  it('getStatusValuesByCategory ist je Kategorie identisch (inkl. Reihenfolge)', () => {
    const baseline = new Map(ALLE_KATEGORIEN.map(c => [c, getStatusValuesByCategory(c)]));

    setStatusKatalogSnapshot(baueSeedVersion());

    for (const c of ALLE_KATEGORIEN) {
      expect(getStatusValuesByCategory(c)).toEqual(baseline.get(c));
    }
  });

  it('nach Snapshot-Reset greift wieder die eingebaute Map', () => {
    const vorher = getStatusCategory('gutachten fertig');
    setStatusKatalogSnapshot(baueSeedVersion());
    setStatusKatalogSnapshot(null);
    expect(getStatusCategory('gutachten fertig')).toBe(vorher);
  });

  it('JEDE gepflegte Variante löst über den Snapshot auf — nicht nur der amtliche Text', () => {
    // Die Lücke, die dieser Guard seit v2.383 vor allem fängt: der Katalog führt
    // eine Zeile je Code, die Schreibweisen des Exports hängen als `varianten`
    // daran. Fehlten sie im Snapshot, verhielte sich prod (eingebaute Map)
    // anders als pl (Snapshot) — in derselben Version.
    setStatusKatalogSnapshot(baueSeedVersion());
    for (const e of STATUS_CODE_KATALOG) {
      // Marker sind `sonstige` — dort ist es die Aussage, nicht die Lücke.
      if (SEED_MARKER_CODES.has(e.code)) continue;
      for (const s of [e.text, ...e.varianten]) {
        expect(getStatusCategory(s), `${e.code}: „${s}"`).not.toBe('sonstige');
      }
    }
  });

  it('Marker bleiben `sonstige` — auch über den Snapshot', () => {
    setStatusKatalogSnapshot(baueSeedVersion());
    for (const s of ['Irrläufer', 'Sonderstatus', 'assoziierter Partner', 'internationaler Partner']) {
      expect(getStatusCategory(s), s).toBe('sonstige');
    }
  });

  it('eine ALTE Fassung schleppt ihre Kategorien nicht mit', () => {
    // Beobachtet an Fassung v7: sie führte `NL eingegangen` mit einer anderen
    // Kategorie als die eingebaute Map. Konsumenten, die beim Modul-Laden
    // fragten, sahen das eine, Render-Zeit-Konsumenten das andere — auf
    // derselben Seite, mit verschiedenen Zahlen. Der Test setzt deshalb eine
    // Fassung, in der ALLE Werte `sonstige` tragen: durchschlagen darf davon
    // nichts, gerechnet wird aus Code + ZAH-Phase.
    const alt = baueSeedVersion();
    const veraltet = {
      ...alt,
      werte: alt.werte.map(w => ({ ...w, kategorie: 'sonstige' as const })),
    };
    setStatusKatalogSnapshot(veraltet);
    // Die Kategorie kommt aus Code + ZAH-Phase, nicht aus dem gepflegten Feld.
    expect(getStatusCategory('NL eingegangen')).toBe('offen');
    expect(getStatusCategory('NF gestellt')).toBe('nachforderung');
    expect(getStatusCategory('bewilligt')).toBe('bewilligt');
    expect(getStatusCategory('Schlussvermerk')).toBe('abgeschlossen');
  });

  it('eine PL-Umhängung bewegt den Verfahrensschritt — und NUR ihn', () => {
    // Bis v4.86 zog die Umhängung die Arbeitsliste mit. Das las sich wie die
    // Zusage des Vorgangssystems („umhängen ist eine Katalog-Zeile, kein
    // Deployment") und war zugleich der Weg, auf dem Katalog-Fassung 19
    // unbemerkt 448 Anträge zwischen Reitern verschob. Die Zusage gilt weiter
    // für alles, was die Phase trägt — Verfahrensleiste, Gruppierung, Zieltage,
    // Fristlauf. Die Arbeitsliste gehört seit v4.87 nicht mehr dazu.
    const alt = baueSeedVersion();
    const umgehaengt = {
      ...alt,
      werte: alt.werte.map(w => (w.code === 40 ? { ...w, zahPhaseId: 'entscheidung' as const } : w)),
    };
    setStatusKatalogSnapshot(umgehaengt);
    expect(zahPhaseFuerStatusText('Gutachten fertig'), 'der Schritt folgt').toBe('entscheidung');
    expect(getStatusCategory('Gutachten fertig'), 'die Arbeitsliste nicht').toBe('in_pruefung');

    setStatusKatalogSnapshot(baueSeedVersion());
    expect(zahPhaseFuerStatusText('Gutachten fertig')).toBe('pruefung');
    expect(getStatusCategory('Gutachten fertig')).toBe('in_pruefung');
  });
});
