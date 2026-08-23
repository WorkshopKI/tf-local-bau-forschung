import { describe, it, expect } from 'vitest';
import { uebernimmKategorieReferenzen, beschreibeReferenzErgebnis } from '../kategorie-referenzen';
import type { UeberKategorie } from '../../../types';

function kat(id: string, referenz?: number[]): UeberKategorie {
  return { id, name: id, farbe: 'slate', deskriptorenMapping: [], referenzEmbedding: referenz } as UeberKategorie;
}

describe('uebernimmKategorieReferenzen', () => {
  it('schreibt die Zentren an die Kategorien', () => {
    const erg = uebernimmKategorieReferenzen(
      [kat('IT'), kat('LS')],
      new Map([['IT', [0.1, 0.2]], ['LS', [0.3, 0.4]]]),
    );
    expect(erg.unveraendert).toBe(false);
    expect(erg.uebernommen).toBe(2);
    expect(erg.kategorien.map(k => k.referenzEmbedding)).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('laesst bei LEEREN Zentren alles unangetastet — sonst loescht ein kalter Rechner die Referenzen des Teams', () => {
    const vorher = [kat('IT', [0.1, 0.2]), kat('LS', [0.3, 0.4])];
    const erg = uebernimmKategorieReferenzen(vorher, new Map());
    expect(erg.unveraendert).toBe(true);
    expect(erg.kategorien).toBe(vorher);
    expect(erg.kategorien.map(k => k.referenzEmbedding)).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    // Gezaehlt wird, was danach GILT — nicht, was dieser Lauf beigetragen hat.
    expect(erg.uebernommen).toBe(2);
  });

  it('nimmt einer einzelnen Kategorie ohne neues Zentrum die alte Referenz', () => {
    const erg = uebernimmKategorieReferenzen(
      [kat('IT', [0.1, 0.2]), kat('LS', [0.3, 0.4])],
      new Map([['IT', [0.5, 0.6]]]),
    );
    expect(erg.kategorien.map(k => k.referenzEmbedding)).toEqual([[0.5, 0.6], undefined]);
    expect(erg.uebernommen).toBe(1);
  });

  it('zaehlt leere Vektoren nicht als Referenz', () => {
    const erg = uebernimmKategorieReferenzen([kat('IT')], new Map([['LS', [0.1]]]));
    expect(erg.uebernommen).toBe(0);
    expect(erg.unveraendert).toBe(false);
  });
});

describe('beschreibeReferenzErgebnis', () => {
  it('behauptet bei einem leeren Lauf KEINE Neuberechnung', () => {
    const satz = beschreibeReferenzErgebnis({ art: 'leer', vorhanden: 3 });
    expect(satz).toContain('nicht neu berechnen');
    expect(satz).toContain('bleiben unverändert');
  });

  it('sagt beim gescheiterten Schreiben, dass die Referenzen trotzdem GELTEN', () => {
    const satz = beschreibeReferenzErgebnis({
      art: 'nicht-gespeichert', uebernommen: 5, grund: 'Kein Schreibrecht',
    });
    // Der Unterschied, auf den es ankommt: gerechnet ja, gespeichert nein.
    expect(satz).toContain('nicht speichern');
    expect(satz).toContain('Kein Schreibrecht');
    expect(satz).toContain('bis zum Neuladen der Seite');
  });

  it('nennt beim Erfolg beide Zahlen', () => {
    expect(beschreibeReferenzErgebnis({ art: 'geschrieben', uebernommen: 4, gesamt: 5 }))
      .toContain('4 von 5');
  });
});
