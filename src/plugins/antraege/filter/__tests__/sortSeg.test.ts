/**
 * Der Defekt, den diese Tests festnageln (v2.372.4): die „Sortiert nach"-Pille
 * führte eine zweite Options-Liste. Ihr fehlten drei Schlüssel, darunter der
 * Sicht-Standard von „Bewilligt" — die Pille zeigte dort „Neueste zuerst",
 * während nach Bewilligungsdatum sortiert wurde, und der wirksame Schlüssel war
 * nicht mehr anwählbar.
 *
 * Die tragende Zusage ist die Invariante: `aktuellesLabel` steht IMMER in
 * `items` — sonst wirkt kein Eintrag aktiv und die Anzeige erfindet eine
 * Sortierung, die nicht läuft.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sortSegModell, sortKeyFuerLabel } from '../sortSeg';
import { DEFAULT_SORT_BY_VIEW, SORT_OPTIONS, type SortKey } from '../../sort';
import { VIEWS, type ViewKey } from '../../views';

const ALLE_VIEWS = VIEWS.map(v => v.key);

describe('sortSegModell — Anzeige und Wirkung können nicht auseinanderlaufen', () => {
  it('zeigt in JEDER Sicht die Sicht-Vorgabe als wählbaren Eintrag', () => {
    for (const view of ALLE_VIEWS) {
      const vorgabe = DEFAULT_SORT_BY_VIEW[view];
      const modell = sortSegModell(view, vorgabe);
      expect(modell.items.map(i => i.label), `Sicht ${view}`).toContain(modell.aktuellesLabel);
      expect(sortKeyFuerLabel(view, modell.aktuellesLabel), `Sicht ${view}`).toBe(vorgabe);
    }
  });

  it('„Bewilligt" nennt das Bewilligungsdatum statt „Neueste zuerst"', () => {
    const modell = sortSegModell('bewilligt_jahr', DEFAULT_SORT_BY_VIEW.bewilligt_jahr);
    expect(modell.aktuellesLabel).toBe('Bewilligung (neueste)');
    expect(modell.defaultLabel).toBe('Bewilligung (neueste)');
  });

  it('hält die Invariante auch für jeden einzeln gesetzten Schlüssel', () => {
    for (const view of ALLE_VIEWS) {
      for (const option of SORT_OPTIONS) {
        const modell = sortSegModell(view, option.key);
        expect(modell.items.map(i => i.label), `${view}/${option.key}`).toContain(modell.aktuellesLabel);
      }
    }
  });

  it('blendet Bewilligungs-Sortierungen außerhalb von „Bewilligt"/„Alle" aus', () => {
    const labels = sortSegModell('meine_offenen', 'frist_asc').items.map(i => i.label);
    expect(labels).not.toContain('Bewilligung (neueste)');
    expect(labels).not.toContain('Bewilligung (älteste)');
    expect(labels).toContain('Frist (kürzeste)');
  });

  it('fällt bei einem für die Sicht gesperrten Schlüssel auf die Vorgabe zurück', () => {
    // So kann kein Altzustand aus localStorage eine Beschriftung erzeugen, die
    // in der Liste gar nicht steht.
    const modell = sortSegModell('meine_offenen', 'bewilligung_desc');
    expect(modell.aktuellesLabel).toBe(modell.defaultLabel);
    expect(modell.items.map(i => i.label)).toContain(modell.aktuellesLabel);
  });

  it('macht jeden Sortier-Schlüssel in mindestens einer Sicht erreichbar', () => {
    const erreichbar = new Set<SortKey>();
    for (const view of ALLE_VIEWS) {
      for (const item of sortSegModell(view, DEFAULT_SORT_BY_VIEW[view]).items) {
        const key = sortKeyFuerLabel(view, item.label);
        if (key) erreichbar.add(key);
      }
    }
    expect([...erreichbar].sort()).toEqual(SORT_OPTIONS.map(o => o.key).sort());
  });
});

describe('sortKeyFuerLabel', () => {
  it('gibt null für ein Label, das nicht zur Sicht gehört', () => {
    expect(sortKeyFuerLabel('meine_offenen', 'Bewilligung (neueste)')).toBeNull();
    expect(sortKeyFuerLabel('meine_offenen', 'Frei erfunden')).toBeNull();
  });

  it('ist der Rückweg zu sortSegModell', () => {
    const view: ViewKey = 'alle';
    for (const item of sortSegModell(view, 'antrag_desc').items) {
      const key = sortKeyFuerLabel(view, item.label);
      expect(key).not.toBeNull();
      expect(sortSegModell(view, key!).aktuellesLabel).toBe(item.label);
    }
  });
});

describe('Beschriftungen beschreiben, was der Vergleich tut', () => {
  it('„frist_asc" nennt die Frist, nicht das Eingangsalter', () => {
    // Der Vergleich liest `daysUntilFrist`. Die alte Beschriftung „Älteste
    // Eingänge zuerst" beschrieb `antrag_asc` — zwei verschiedene Felder.
    const option = SORT_OPTIONS.find(o => o.key === 'frist_asc')!;
    expect(option.label).toContain('Frist');
    expect(option.label).not.toMatch(/Eingang|Eingänge/);
  });

  it('unterscheidet Eingangs- und Bewilligungsdatum in der Beschriftung', () => {
    const label = (key: SortKey): string => SORT_OPTIONS.find(o => o.key === key)!.label;
    expect(label('antrag_desc')).toContain('Eingang');
    expect(label('bewilligung_desc')).toContain('Bewilligung');
  });

  it('vergibt jede Beschriftung nur einmal (Label ist der Rückweg-Schlüssel)', () => {
    const labels = SORT_OPTIONS.map(o => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('no-parallel-sort-options — die Toolbar führt keine eigene Liste', () => {
  // Der Defekt entstand nicht durch einen falschen Wert, sondern dadurch, dass
  // eine zweite Liste ÜBERHAUPT existierte: sie driftete still von `sort.ts` weg
  // und niemand merkte es, weil beide Seiten für sich stimmig aussahen. Die
  // Tests oben können das nicht fangen — sie prüfen `sortSeg.ts`, nicht die
  // Komponente. Ausnahme bewusst per `// allow-no-parallel-sort-options: <grund>`.
  const quelle = readFileSync(
    join(process.cwd(), 'src/plugins/antraege/filter/QuickfilterToolbar.tsx'),
    'utf-8',
  );

  it('definiert keine eigenen Sortier-Optionen', () => {
    if (quelle.includes('allow-no-parallel-sort-options:')) return;
    const eigeneListe = SORT_OPTIONS.some(o => new RegExp(`key:\\s*'${o.key}'`).test(quelle));
    expect(eigeneListe, 'QuickfilterToolbar.tsx bindet einen SortKey selbst an ein Label').toBe(false);
  });

  it('bezieht Einträge und Beschriftungen aus sortSeg', () => {
    expect(quelle).toMatch(/from '\.\/sortSeg'/);
    expect(quelle).toContain('sortSegModell');
    expect(quelle).toContain('sortKeyFuerLabel');
  });
});
