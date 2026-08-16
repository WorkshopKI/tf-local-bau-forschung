/**
 * Der Betrachtungsbereich — woraus seine Menge folgt, die Reihenfolge seiner
 * beiden Quellen und die eine Prüffunktion, die alle Konsumenten teilen.
 *
 * Kernzusage (Pitfall #46): der Seed steht im Code und gilt flag-unabhängig;
 * eine gepflegte Fassung überschreibt ihn. Weicht sie ab, muss man das sehen —
 * sonst zeigen dev/pl andere Zahlen als prod, ohne dass jemand merkt, warum.
 *
 * Zweite Zusage, seit dem Nachzug der Generation 2015: die Menge folgt der
 * **Richtlinien-Generation**, und die Beschriftung wird daraus abgeleitet. Die
 * `bereichsLabel`-Tests sind die einzige Absicherung des Chip-Texts überhaupt —
 * die Suite kennt nur `__tests__/*.test.ts`, eine `.tsx` läuft nie.
 */
import { describe, it, expect } from 'vitest';
import {
  BETRACHTUNGSBEREICH_SEED, BEREICH_GENERATIONEN, RICHTLINIEN_GENERATIONEN,
  bereichsProgramme, bereichsMenge, istImBereich, bereichWeichtVomSeedAb,
  generationVon, generationenVon, gruppiereNachGeneration, bereichsLabel,
} from '@/core/status/betrachtungsbereich';
import type { MappingVersion } from '@/core/status/typen';

const fassung = (programme?: string[]): MappingVersion => ({
  version: 1, autor: null, zeitstempel: 'x', felder: [], werte: [],
  ...(programme ? { betrachtungsbereich: { programme } } : {}),
});

/** Ein Code, den keine Generation kennt — für die „nichts behaupten"-Fälle. */
const UNBEKANNT = '999';

describe('Richtlinien-Generationen und der abgeleitete Seed', () => {
  it('der Bereich folgt der Richtlinien-Generation, nicht der Trigger-Abdeckung', () => {
    // Die Trigger-Zuarbeit deckt neun Programme ab (2020 + 2025). Danach war der
    // Bereich einmal geschnitten — und hieß trotzdem „letzte 3 Richtlinien".
    // Maßstab sind die drei jüngsten GENERATIONEN, Trigger hin oder her.
    expect(RICHTLINIEN_GENERATIONEN.slice(-BEREICH_GENERATIONEN).map(g => g.jahr))
      .toEqual([2015, 2020, 2025]);
    expect([...BETRACHTUNGSBEREICH_SEED].sort()).toEqual(
      ['131', '136', '137', '138', '139', '46', '47', '48', '76', '77', '78', '79'],
    );
  });

  it('die Generationen stehen aufsteigend nach Jahr', () => {
    // Load-bearing: `slice(-N)` liest „die N jüngsten". Wer eine neue Richtlinie
    // OBEN einfügt, macht daraus die N ältesten — im Diff unsichtbar, und
    // `juengste` lügt danach in jedem Modus.
    const jahre = RICHTLINIEN_GENERATIONEN.map(g => g.jahr);
    expect([...jahre].sort((a, b) => a - b)).toEqual(jahre);
  });

  it('jedes Programm gehört zu genau einer Generation', () => {
    const alle = RICHTLINIEN_GENERATIONEN.flatMap(g => g.programme);
    expect(alle.length, 'ein Code in zwei Generationen').toBe(new Set(alle).size);
    for (const code of BETRACHTUNGSBEREICH_SEED) {
      expect(generationVon(code), code).not.toBeNull();
    }
    expect(generationVon(UNBEKANNT)).toBeNull();
    expect(generationVon('')).toBeNull();
  });
});

describe('bereichsProgramme', () => {
  it('nimmt den Code-Seed, wenn keine Fassung geladen ist (prod/as)', () => {
    expect(bereichsProgramme(null)).toEqual(BETRACHTUNGSBEREICH_SEED);
    expect(bereichsProgramme(undefined)).toEqual(BETRACHTUNGSBEREICH_SEED);
  });

  it('nimmt den Code-Seed, wenn die Fassung nichts pflegt', () => {
    expect(bereichsProgramme(fassung())).toEqual(BETRACHTUNGSBEREICH_SEED);
  });

  it('die gepflegte Liste schlägt den Seed', () => {
    expect(bereichsProgramme(fassung(['138']))).toEqual(['138']);
  });

  it('eine LEERE gepflegte Liste ist kein Bereich ohne Inhalt, sondern „nicht gepflegt"', () => {
    expect(bereichsProgramme(fassung([]))).toEqual(BETRACHTUNGSBEREICH_SEED);
  });
});

describe('bereichWeichtVomSeedAb', () => {
  it('schweigt, solange nichts gepflegt ist', () => {
    expect(bereichWeichtVomSeedAb(null)).toBe(false);
    expect(bereichWeichtVomSeedAb(fassung())).toBe(false);
  });

  it('schweigt bei gleicher Menge in anderer Reihenfolge', () => {
    expect(bereichWeichtVomSeedAb(fassung([...BETRACHTUNGSBEREICH_SEED].reverse()))).toBe(false);
  });

  it('meldet jede echte Abweichung — sie wirkt in prod erst mit dem Release', () => {
    expect(bereichWeichtVomSeedAb(fassung(['138']))).toBe(true);
    // Ein Programm der Generation 2012: außerhalb des Seeds, also eine echte
    // Abweichung. (Vorher stand hier '47' — seit dem Nachzug der Generation
    // 2015 liegt das IM Seed, und der Fall prüfte nur noch ein Duplikat.)
    expect(bereichWeichtVomSeedAb(fassung([...BETRACHTUNGSBEREICH_SEED, '34']))).toBe(true);
  });
});

describe('istImBereich', () => {
  const menge = bereichsMenge(['76', '138']);

  it('`null` heißt kein Filter — jeder Antrag zählt', () => {
    expect(istImBereich('47', null)).toBe(true);
    expect(istImBereich(undefined, null)).toBe(true);
  });

  it('trifft über den normalisierten Schlüssel', () => {
    expect(istImBereich('76', menge)).toBe(true);
    expect(istImBereich('  138 ', menge)).toBe(true);
    expect(istImBereich('47', menge)).toBe(false);
  });

  it('ein Antrag ohne Programm-Nummer fällt heraus, statt geraten zu werden', () => {
    expect(istImBereich(undefined, menge)).toBe(false);
    expect(istImBereich('', menge)).toBe(false);
    expect(istImBereich(null, menge)).toBe(false);
    expect(istImBereich(76, menge), 'kein impliziter Zahl-String-Cast').toBe(false);
  });
});

describe('generationenVon', () => {
  it('der Seed sind die drei jüngsten Generationen, vollständig', () => {
    expect(generationenVon(BETRACHTUNGSBEREICH_SEED))
      .toEqual({ jahre: [2015, 2020, 2025], exakt: true, juengste: true });
  });

  it('eine einzelne jüngste Generation zählt als „letzte"', () => {
    expect(generationenVon(['136', '137', '138', '139']))
      .toEqual({ jahre: [2025], exakt: true, juengste: true });
  });

  it('eine ALTE Generation ist exakt, aber nicht die jüngste', () => {
    // Sonst hieße „['46','47','48']" im Chip „letzte Richtlinie" — und damit
    // stünde Altbestand unter dem Etikett „aktuell".
    expect(generationenVon(['46', '47', '48']))
      .toEqual({ jahre: [2015], exakt: true, juengste: false });
    expect(generationenVon(['34', '35', '36', '37', '46', '47', '48']))
      .toEqual({ jahre: [2012, 2015], exakt: true, juengste: false });
  });

  it('eine TEILWEISE enthaltene Generation zählt nicht mit', () => {
    // Der gefährlichere Fall: lauter bekannte Codes, und trotzdem wäre jede
    // Generationsaussage falsch.
    expect(generationenVon(['136', '137'])).toEqual({ jahre: [], exakt: false, juengste: false });
    expect(generationenVon(['46', '76', '136'])).toEqual({ jahre: [], exakt: false, juengste: false });
    expect(generationenVon(['136', '137', '138', '139', '46']))
      .toEqual({ jahre: [2025], exakt: false, juengste: false });
  });

  it('ein Code außerhalb jeder Generation macht die Aussage unexakt', () => {
    expect(generationenVon([...BETRACHTUNGSBEREICH_SEED, UNBEKANNT]).exakt).toBe(false);
  });

  it('normalisiert wie jeder Join; ein Duplikat kippt `exakt` nicht', () => {
    expect(generationenVon(['  138 ', '138', '136', '137', '139']))
      .toEqual({ jahre: [2025], exakt: true, juengste: true });
  });

  it('eine leere Liste behauptet nichts', () => {
    expect(generationenVon([])).toEqual({ jahre: [], exakt: false, juengste: false });
  });
});

describe('gruppiereNachGeneration', () => {
  it('gruppiert den Seed jüngste-zuerst', () => {
    expect(gruppiereNachGeneration(BETRACHTUNGSBEREICH_SEED)).toEqual([
      { jahr: 2025, titel: 'Richtlinie 2025', programme: ['136', '137', '138', '139'] },
      { jahr: 2020, titel: 'Richtlinie 2020', programme: ['76', '77', '78', '79', '131'] },
      { jahr: 2015, titel: 'Richtlinie 2015', programme: ['46', '47', '48'] },
    ]);
  });

  it('führt Unbekanntes in einer eigenen Gruppe zuletzt — nie stilles Weglassen', () => {
    const gruppen = gruppiereNachGeneration(['138', UNBEKANNT]);
    expect(gruppen.map(g => g.titel)).toEqual(['Richtlinie 2025', 'Andere Programme']);
    expect(gruppen[1]).toEqual({ jahr: null, titel: 'Andere Programme', programme: [UNBEKANNT] });
  });

  it('zeigt Teilmengen als Teilmengen und lässt leere Gruppen weg', () => {
    expect(gruppiereNachGeneration(['47', '136'])).toEqual([
      { jahr: 2025, titel: 'Richtlinie 2025', programme: ['136'] },
      { jahr: 2015, titel: 'Richtlinie 2015', programme: ['47'] },
    ]);
    expect(gruppiereNachGeneration([])).toEqual([]);
  });
});

describe('bereichsLabel', () => {
  it('wo Generationen benannt sind, steht keine Programm-Zahl daneben', () => {
    // Die Generationen beschreiben die Menge bereits vollständig (`exakt`);
    // „(12 Programme)" wiederholte das nur und kostete im Kopf Platz.
    expect(bereichsLabel('standard', BETRACHTUNGSBEREICH_SEED))
      .toBe('Anzeige: letzte 3 Richtlinien');
  });

  it('Singular, wo eine Zahl 1 ist', () => {
    // „letzte 1 Richtlinien" ist der Fehler, den man ein Jahr später im
    // Screenshot findet.
    expect(bereichsLabel('standard', ['136', '137', '138', '139']))
      .toBe('Anzeige: letzte Richtlinie');
    expect(bereichsLabel('auswahl', ['76'])).toBe('Anzeige: eigene Auswahl (1 Programm)');
    expect(bereichsLabel('standard', [UNBEKANNT])).toBe('Anzeige: 1 Programm');
  });

  it('exakte, aber nicht die jüngsten Generationen werden benannt', () => {
    expect(bereichsLabel('standard', ['46', '47', '48']))
      .toBe('Anzeige: Richtlinie 2015');
    expect(bereichsLabel('standard', ['34', '35', '36', '37', '46', '47', '48']))
      .toBe('Anzeige: Richtlinien 2012 + 2015');
  });

  it('wo sich keine Generation belegen lässt, nennt der Chip die Programm-Zahl', () => {
    expect(bereichsLabel('standard', [...BETRACHTUNGSBEREICH_SEED, UNBEKANNT]))
      .toBe('Anzeige: 13 Programme');
    expect(bereichsLabel('standard', ['136', '137'])).toBe('Anzeige: 2 Programme');
  });

  it('eine eigene Auswahl nennt bewusst keine Generation', () => {
    // Die Information, auf die es ankommt, ist „das ist nicht der Standard" —
    // nicht, dass es zufällig drei Richtlinien sind.
    expect(bereichsLabel('auswahl', BETRACHTUNGSBEREICH_SEED))
      .toBe('Anzeige: eigene Auswahl (12 Programme)');
  });

  it('„alle" nennt keine Zahl — es gibt keine Grenze zu melden', () => {
    expect(bereichsLabel('alle', [])).toBe('Anzeige: alle Richtlinien');
    expect(bereichsLabel('alle', BETRACHTUNGSBEREICH_SEED)).toBe('Anzeige: alle Richtlinien');
  });
});
