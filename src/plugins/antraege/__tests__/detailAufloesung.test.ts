/**
 * Die Auflösung Schlüssel → Verbund-Container (siehe `detailAufloesung.ts`).
 *
 * Der vierte Fall ist der gemessene Defekt: `#/antraege/ZDS26026` (eine
 * Verbund-Nummer im Aktenzeichen-Slot) endete in „Antrag ZDS26026 nicht
 * gefunden."
 */
import { describe, it, expect } from 'vitest';
import { loeseDetailAuf, type DetailKandidat } from '../detailAufloesung';
import { pseudoVerbundIdFor } from '../pseudoVerbund';

const BESTAND: DetailKandidat[] = [
  { aktenzeichen: '16DS260261', verbund_id: 'ZDS26026' },
  { aktenzeichen: '16DS260262', verbund_id: 'ZDS26026' },
  { aktenzeichen: '16EP250023' }, // Standalone, kein Verbund
];

describe('loeseDetailAuf', () => {
  it('ohne Auswahl kein Detail', () => {
    expect(loeseDetailAuf(BESTAND, null, null)).toBeNull();
  });

  it('nimmt die Verbund-Auswahl direkt und klappt den genannten TV auf', () => {
    expect(loeseDetailAuf(BESTAND, '16DS260262', 'ZDS26026'))
      .toEqual({ verbundId: 'ZDS26026', expanded: '16DS260262' });
    expect(loeseDetailAuf(BESTAND, null, 'ZDS26026'))
      .toEqual({ verbundId: 'ZDS26026', expanded: undefined });
  });

  it('führt ein Teilvorhaben auf seinen Verbund', () => {
    expect(loeseDetailAuf(BESTAND, '16DS260261', null))
      .toEqual({ verbundId: 'ZDS26026', expanded: '16DS260261' });
  });

  it('rendert einen Standalone-Antrag als Pseudo-Verbund', () => {
    expect(loeseDetailAuf(BESTAND, '16EP250023', null))
      .toEqual({ verbundId: pseudoVerbundIdFor('16EP250023'), expanded: '16EP250023' });
  });

  it('heilt eine Verbund-Nummer im Aktenzeichen-Slot', () => {
    // Genau der gemessene Fall: kein Antrag heißt so, aber zwei führen ihn als
    // ihren Verbund. Kein `expanded` — der Schlüssel benennt den Verbund selbst.
    expect(loeseDetailAuf(BESTAND, 'ZDS26026', null))
      .toEqual({ verbundId: 'ZDS26026', expanded: undefined });
  });

  it('das Aktenzeichen gewinnt gegen eine gleichnamige Verbund-Nummer', () => {
    // Konstruiert: derselbe String ist Aktenzeichen des einen und Verbund des
    // anderen. Der direkte Treffer ist die spezifischere Aussage.
    const bestand: DetailKandidat[] = [
      { aktenzeichen: 'X1', verbund_id: 'X2' },
      { aktenzeichen: 'X2', verbund_id: 'ZKN1' },
    ];
    expect(loeseDetailAuf(bestand, 'X2', null))
      .toEqual({ verbundId: 'ZKN1', expanded: 'X2' });
  });

  it('bleibt bei einem unbekannten Schlüssel beim Pseudo-Verbund', () => {
    // Die Projektion kann hinter dem Voll-Store liegen — die Detailseite
    // versucht den IDB-Get und meldet erst danach „nicht gefunden".
    expect(loeseDetailAuf(BESTAND, '16ZZ999999', null))
      .toEqual({ verbundId: pseudoVerbundIdFor('16ZZ999999'), expanded: '16ZZ999999' });
    expect(loeseDetailAuf([], '16DS260261', null))
      .toEqual({ verbundId: pseudoVerbundIdFor('16DS260261'), expanded: '16DS260261' });
  });

  it('behandelt einen leeren Verbund-Eintrag wie keinen', () => {
    expect(loeseDetailAuf([{ aktenzeichen: '16A', verbund_id: '' }], '16A', null))
      .toEqual({ verbundId: pseudoVerbundIdFor('16A'), expanded: '16A' });
  });
});
