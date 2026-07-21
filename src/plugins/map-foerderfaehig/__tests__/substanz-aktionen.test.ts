/**
 * Präzisions-Nachforderungen, Zielkriterien und die Widerspruchs-Zuordnung.
 *
 * Schwerpunkt ist die Formulierungs-Leitplanke: eine Nachforderung, die nur
 * „erläutern Sie näher" verlangt, erzeugt die nächste Runde Prosa. Der Test hält
 * fest, dass jede erzeugte Frage nach einer Zahl UND nach dem Messverfahren
 * fragt — das ist die Zusage, die dieses Paket macht.
 */
import { describe, expect, it } from 'vitest';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { AspektMapping } from '@/plugins/antraege/aufbereitung/aspekte';
import type { MapChecklistenItem } from '../checkliste/typen';
import type { SdtDeltaZeile } from '../infografik/schema';
import type { UnschaerfeBegriff, Widerspruch } from '../infografik/substanz';
import { ergaenzeNf, nfAusDeltaZeile, nfAusUnschaerfe } from '../substanz/nf-praezision';
import {
  istUebernommen, schalte, waehleZielkriterien, zielkriteriumSchluessel,
} from '../substanz/zielkriterien';
import { findePassendesItem, widerspruchAlsBemerkung } from '../substanz/zuordnung';

const JETZT = '2026-07-21T09:00:00.000Z';

function delta(p: Partial<SdtDeltaZeile>): SdtDeltaZeile {
  return {
    parameter: 'Fehlalarmquote', sdtWert: '12 %', zielWert: '4 %',
    quantifizierung: 'quantifiziert', sektionIds: [], ...p,
  };
}

describe('Formulierungs-Leitplanke', () => {
  const faelle = [
    nfAusDeltaZeile(delta({ quantifizierung: 'fehlt', zielWert: '' }), JETZT),
    nfAusDeltaZeile(delta({ quantifizierung: 'qualitativ', zielWert: 'deutlich besser' }), JETZT),
    nfAusUnschaerfe({
      begriff: 'deutliche Effizienzsteigerung', kontext: '…',
      grund: 'nicht quantifiziert', sektionIds: [],
    }, JETZT),
    nfAusUnschaerfe({
      begriff: 'übliche Risiken', kontext: '…', grund: 'nicht definiert', sektionIds: [],
    }, JETZT),
  ];

  it('verlangt in JEDER Frage eine konkrete Angabe', () => {
    for (const n of faelle) {
      expect(n.frage).toMatch(/beziffern|geben Sie den .*Wert an|messbaren Kriteriums/i);
    }
  });

  it('verlangt in JEDER Frage Messverfahren und Bezugsgroesse', () => {
    for (const n of faelle) {
      expect(n.frage).toContain('Messverfahren');
      expect(n.frage).toContain('Bezugsgrösse');
    }
  });

  it('sagt NIEMALS „naeher erlaeutern"', () => {
    // Der Anti-Pattern-Test: genau diese Floskel erzeugt die naechste Textwand.
    for (const n of faelle) {
      expect(n.frage).not.toMatch(/näher (erläutern|beschreiben|ausführen)/i);
      expect(n.frage).not.toMatch(/bitte erläutern Sie/i);
    }
  });

  it('nennt den Ausloeser woertlich, damit die Frage zuordenbar bleibt', () => {
    expect(faelle[0]!.frage).toContain('Fehlalarmquote');
    expect(faelle[2]!.frage).toContain('deutliche Effizienzsteigerung');
  });
});

describe('Praezisions-NF: Identitaet und Dubletten', () => {
  it('erzeugt fuer denselben Ausloeser dieselbe ID', () => {
    const a = nfAusDeltaZeile(delta({ parameter: 'Fehlalarmquote' }), JETZT);
    const b = nfAusDeltaZeile(delta({ parameter: '  fehlalarmquote  ' }), '2027-01-01T00:00:00.000Z');
    expect(a.id).toBe(b.id);
  });

  it('trennt Delta- und Unschaerfe-Quelle', () => {
    const a = nfAusDeltaZeile(delta({ parameter: 'X' }), JETZT);
    const b = nfAusUnschaerfe(
      { begriff: 'X', kontext: '', grund: 'nicht definiert', sektionIds: [] }, JETZT,
    );
    expect(a.id).not.toBe(b.id);
  });

  it('ersetzt statt zu verdoppeln', () => {
    const erst = nfAusDeltaZeile(delta({ parameter: 'X', quantifizierung: 'fehlt' }), JETZT);
    const neu = nfAusDeltaZeile(delta({ parameter: 'X', quantifizierung: 'qualitativ' }), JETZT);
    const liste = ergaenzeNf(ergaenzeNf([], erst), neu);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.frage).toBe(neu.frage);
  });
});

describe('Zielkriterien', () => {
  const zeilen = [
    delta({ parameter: 'Fehlalarmquote', quantifizierung: 'quantifiziert' }),
    delta({ parameter: 'Robustheit', quantifizierung: 'qualitativ' }),
    delta({ parameter: 'Standzeit', quantifizierung: 'quantifiziert' }),
  ];

  it('uebernimmt quantifizierte Zeilen per Vorgabe', () => {
    expect(waehleZielkriterien(zeilen, []).map(z => z.parameter))
      .toEqual(['Fehlalarmquote', 'Standzeit']);
  });

  it('schliesst qualitative Zeilen immer aus', () => {
    expect(istUebernommen(zeilen[1]!, [])).toBe(false);
  });

  it('respektiert die Abwahl', () => {
    const aus = schalte([], 'Fehlalarmquote', false);
    expect(waehleZielkriterien(zeilen, aus).map(z => z.parameter)).toEqual(['Standzeit']);
  });

  it('macht die Abwahl rueckgaengig, ohne Dubletten zu hinterlassen', () => {
    const aus = schalte(schalte(schalte([], 'X', false), 'X', false), 'X', true);
    expect(aus).toEqual([]);
  });

  it('haelt die Abwahl ueber Schreibweisen-Drift hinweg', () => {
    // Ein neuer Lauf formuliert denselben Parameter leicht anders — die Abwahl
    // darf davon nicht abfallen.
    const aus = schalte([], 'Fehlalarmquote', false);
    expect(istUebernommen(delta({ parameter: '  FEHLALARMQUOTE ' }), aus)).toBe(false);
    expect(zielkriteriumSchluessel(' A  B ')).toBe('a b');
  });
});

describe('Widerspruchs-Zuordnung', () => {
  const gliederung = [
    { id: 'k-1', titel: 'Ausgangslage', start: 0, end: 20 },
    { id: 'k-2', titel: 'Arbeitsplan', start: 20, end: 40 },
  ] as unknown as VbSektion[];

  const markdown = '# Ausgangslage\nText eins.\n# Arbeitsplan\nText zwei.';

  const mapping: AspektMapping = {
    zuordnung: { A: ['k-1'], D: ['k-2'] },
    fehlend: {},
  };

  function item(id: string, aspekte: string[]): MapChecklistenItem {
    return {
      id, gruppe: 'G', kriterium: `Kriterium ${id}`, art: 'binaer',
      klasse: 'S', herkunft: 'app', aktiv: true, aspekte,
    };
  }

  const w: Widerspruch = {
    fakt: '16 PM', aussageImText: '18 PM', art: 'zahl', sektionIds: ['k-2'],
  };

  it('waehlt das Kriterium mit der Sektions-Ueberschneidung', () => {
    const treffer = findePassendesItem(
      w, [item('i1', ['A']), item('i2', ['D'])], mapping, gliederung, markdown,
    );
    expect(treffer?.itemId).toBe('i2');
  });

  it('liefert null ohne Ueberschneidung — statt beliebig zuzuordnen', () => {
    const treffer = findePassendesItem(
      w, [item('i1', ['A'])], mapping, gliederung, markdown,
    );
    expect(treffer).toBeNull();
  });

  it('liefert null ohne Aspekt-Mapping', () => {
    expect(findePassendesItem(w, [item('i1', ['D'])], null, gliederung, markdown)).toBeNull();
  });

  it('liefert null, wenn der Widerspruch keine Fundstelle nennt', () => {
    const ohne = { ...w, sektionIds: [] };
    expect(findePassendesItem(ohne, [item('i1', ['D'])], mapping, gliederung, markdown)).toBeNull();
  });

  it('bevorzugt das spezifischere Kriterium bei gleicher Ueberschneidung', () => {
    // `breit` zeigt auf beide Sektionen, `eng` nur auf die eine — der engere
    // Anker ist der bessere.
    const treffer = findePassendesItem(
      w, [item('breit', ['A', 'D']), item('eng', ['D'])], mapping, gliederung, markdown,
    );
    expect(treffer?.itemId).toBe('eng');
  });

  it('formuliert eine Bemerkung, die beide Seiten nennt', () => {
    const text = widerspruchAlsBemerkung(w);
    expect(text).toContain('16 PM');
    expect(text).toContain('18 PM');
  });
});

describe('Unschaerfe-Nachforderung', () => {
  it('unterscheidet die beiden Gruende in der Formulierung', () => {
    const basis: UnschaerfeBegriff = {
      begriff: 'X', kontext: '', grund: 'nicht quantifiziert', sektionIds: [],
    };
    const beziffern = nfAusUnschaerfe(basis, JETZT).frage;
    const definieren = nfAusUnschaerfe({ ...basis, grund: 'nicht definiert' }, JETZT).frage;
    expect(beziffern).not.toBe(definieren);
    expect(definieren).toContain('messbaren Kriteriums');
  });
});
