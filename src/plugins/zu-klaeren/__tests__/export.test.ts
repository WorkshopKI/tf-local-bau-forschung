/**
 * Was diese Datei festnagelt:
 *
 * 1. Der Seed-Diff enthält NUR Codes, deren Konsens vom Auslieferungsschnitt
 *    abweicht — und Strittiges ausdrücklich nicht. Ein offener Streit ist kein
 *    Änderungsauftrag; wer ihn im Diff fände, übernähme ihn versehentlich.
 * 2. Der Wechsel auf „ohne Phase" ist kein Map-Eintrag, sondern eine Entfernung
 *    plus Marker-Eintrag — sonst schriebe jemand `[29, 'ohne-phase']` in eine Map,
 *    die diesen Wert nicht kennt.
 * 3. Jedes Blatt trägt seinen Erhebungs-Kontext (Stichtag + Bestandsstand).
 * 4. Die Kurzfassung schweigt nicht, wenn es nichts zu melden gibt.
 */
import { describe, it, expect } from 'vitest';
import {
  baueSeedDiff, baueBlaetter, baueKurzfassung, blattZuordnungen, type ExportEingabe,
} from '@/plugins/zu-klaeren/export';
import { falte } from '@/plugins/zu-klaeren/fold';
import { bauePunkte, PHASENSCHNITT } from '@/plugins/zu-klaeren/seed-phasenschnitt';
import type { KlaerungEintrag } from '@/plugins/zu-klaeren/typen';

const PUNKTE = bauePunkte();

function eingabe(eintraege: KlaerungEintrag[], autoren: string[]): ExportEingabe {
  return {
    klaerung: PHASENSCHNITT,
    punkte: PUNKTE,
    stand: falte(eintraege),
    autoren,
    vorkommen: new Map([[38, 222], [11, 3]]),
    bestandVom: '2026-08-03T22:10:00.000Z',
    jetztIso: '2026-08-04T09:00:00.000Z',
  };
}
const e = (x: Partial<KlaerungEintrag> & { autor: string; punktId: string }): KlaerungEintrag =>
  ({ ts: '2026-08-04T10:00:00.000Z', ...x });

describe('baueSeedDiff (nur was sich ändert)', () => {
  it('listet nur Codes, deren Konsens vom Seed abweicht', () => {
    const diff = baueSeedDiff(eingabe([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),   // bestätigt → nicht im Diff
    ], ['MUE', 'SCH']));
    expect(diff).toContain("[38, 'entscheidung'],");
    expect(diff).not.toContain('[11,');
  });

  it('strittige Punkte kommen nicht in den Diff', () => {
    const diff = baueSeedDiff(eingabe([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'entscheidung' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'begleitung' }),
    ], ['MUE', 'SCH']));
    expect(diff).not.toContain('[38,');
    expect(diff).toContain('Nichts zu ändern');
  });

  it('ein Wechsel zu ohne-phase erscheint als Entfernung, nicht als Map-Eintrag', () => {
    const diff = baueSeedDiff(eingabe([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'andere', zielWert: 'ohne-phase' }),
    ], ['MUE']));
    expect(diff).not.toContain("[38, 'ohne-phase']");
    expect(diff).toContain('SEED_MARKER_CODES');
  });

  it('die Zeilen sind nach Code sortiert und nennen den bisherigen Wert', () => {
    const diff = baueSeedDiff(eingabe([
      e({ autor: 'MUE', punktId: 'code-59', urteil: 'andere', zielWert: 'abgeschlossen' }),
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'andere', zielWert: 'pruefung' }),
    ], ['MUE']));
    expect(diff.indexOf('[11,')).toBeLessThan(diff.indexOf('[59,'));
    expect(diff).toContain('war: Eingang');
  });

  it('ohne Abweichung sagt der Diff das ausdrücklich', () => {
    expect(baueSeedDiff(eingabe([], []))).toContain('Nichts zu ändern');
  });

  it('der Kopf nennt die Zieldatei, damit niemand raten muss', () => {
    expect(baueSeedDiff(eingabe([], []))).toContain('zah-phasen.ts');
  });
});

describe('baueBlaetter (jedes Blatt trägt seinen Erhebungs-Kontext)', () => {
  const blaetter = baueBlaetter(eingabe([
    e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt', kommentar: 'stimmt so' }),
    e({ autor: 'SCH', punktId: 'frage-1', kommentar: 'Sehe ich anders.' }),
  ], ['MUE', 'SCH']));

  it('liefert Zuordnungen, Grundsatzfragen und Rohdaten', () => {
    expect(blaetter.map(b => b.name)).toEqual(['Zuordnungen', 'Grundsatzfragen', 'Rohdaten']);
  });

  it('jedes Blatt nennt Stichtag und Bestandsstand', () => {
    for (const b of blaetter) {
      expect(b.kopf.join(' ')).toContain('Export 04.08.2026');
      expect(b.kopf.join(' ')).toContain('Bestand vom 04.08.2026');
    }
  });

  it('die Zuordnungen führen je Person eine Spalte', () => {
    const z = blattZuordnungen(eingabe([], ['MUE', 'SCH']));
    expect(z.spalten).toContain('MUE');
    expect(z.spalten).toContain('SCH');
    expect(z.zeilen).toHaveLength(30);
  });

  it('die Vorkommen-Zahl steht in der Zeile', () => {
    const z = blattZuordnungen(eingabe([], []));
    const zeile38 = z.zeilen.find(r => r[1] === 38);
    expect(zeile38?.[3]).toBe(222);
  });

  it('das Rohdaten-Blatt führt Urteil UND Beitrag getrennt auf', () => {
    const roh = blaetter[2];
    const arten = new Set(roh?.zeilen.map(r => r[3]));
    expect(arten.has('Urteil')).toBe(true);
    expect(arten.has('Beitrag')).toBe(true);
  });
});

describe('baueKurzfassung (nur Abweichendes und Kommentiertes)', () => {
  it('nennt eine strittige Zeile mit beiden Stimmen', () => {
    const md = baueKurzfassung(eingabe([
      e({ autor: 'MUE', punktId: 'code-38', urteil: 'passt' }),
      e({ autor: 'SCH', punktId: 'code-38', urteil: 'andere', zielWert: 'begleitung' }),
    ], ['MUE', 'SCH']));
    expect(md).toContain('strittig');
    expect(md).toContain('MUE: passt');
    expect(md).toContain('SCH: → Begleitung');
  });

  it('lässt bestätigte Zuordnungen weg', () => {
    const md = baueKurzfassung(eingabe([
      e({ autor: 'MUE', punktId: 'code-11', urteil: 'passt' }),
    ], ['MUE']));
    expect(md).toContain('Keine — alle beantworteten Zuordnungen bestätigen');
  });

  it('führt kommentierte Grundsatzfragen mit Beitrag', () => {
    const md = baueKurzfassung(eingabe([
      e({ autor: 'SCH', punktId: 'frage-4', kommentar: 'Marker bitte so lassen.' }),
    ], ['SCH']));
    expect(md).toContain('Marker bitte so lassen.');
  });

  it('sagt auch, wenn keine Frage beantwortet wurde', () => {
    expect(baueKurzfassung(eingabe([], []))).toContain('Keine beantwortet.');
  });
});
