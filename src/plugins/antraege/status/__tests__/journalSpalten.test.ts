/**
 * Vier Wege zum Klartext einer Journal-Spalte — und die Projektform, die
 * entscheidet, WELCHER Klartext gilt.
 *
 * Gemessen am echten Bestand (260 journalfähige Spalten, Fassung 25): 257 trafen
 * direkt, drei nicht — `D_AAE`, `D_ABB`, `D_AZ1_1`. Genau die standen in der
 * Karte „Änderungen der letzten Nacht" ohne Beschreibung da.
 */
import { describe, expect, it } from 'vitest';
import type { StatusFeldEintrag } from '@/core/status/typen';
import { baueSpaltenAufloesung, feldFuerSpalte, spaltenAuskunft } from '../journalSpalten';

function feld(p: Partial<StatusFeldEintrag> & { feldId: string; label: string }): StatusFeldEintrag {
  return {
    typ: 'datum', ebene: 'tv', rollen: [],
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
    ...p,
  };
}

/** Ein Ausschnitt der Fassung, der alle vier Wege abdeckt. */
const FELDER: StatusFeldEintrag[] = [
  feld({ feldId: 'status', label: 'TV-Status', typ: 'wert' }),
  feld({ feldId: 'verbund_status', label: 'Verbund-Status', typ: 'wert', ebene: 'verbund', quelleKey: 'status' }),
  feld({ feldId: 'D_AB', label: 'Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche', code: 'AB' }),
  feld({ feldId: 'bewilligung_datum', label: 'Bewilligung', code: 'ABB' }),
  feld({ feldId: 'erstentscheidung', label: 'Vorläufige Erstentscheidung', code: 'AZ1' }),
];

const AUF = baueSpaltenAufloesung(FELDER);

/** `vb_phase`-Werte: 3 = FuE, 4 = DL, 9 = Irrläufer (keine Projektform). */
const FUE = 3;
const DL = 4;
const IRRLAEUFER = 9;

describe('feldFuerSpalte — die vier Wege', () => {
  it('kanonische Status-Spalte → das kanonische Feld', () => {
    expect(feldFuerSpalte(AUF, 'STATUS_TV')?.feldId).toBe('status');
    expect(feldFuerSpalte(AUF, 'STATUS_VB')?.feldId).toBe('verbund_status');
  });

  it('rohe Spalte, die als feldId im Katalog steht', () => {
    expect(feldFuerSpalte(AUF, 'D_AB')?.feldId).toBe('D_AB');
  });

  it('Kürzel-Code, wo die Spalte kanonisch angebunden ist (D_ABB)', () => {
    // `D_ABB` ist bewusst KEIN eigener Katalog-Eintrag — sonst stünden zwei
    // Felder auf derselben Spalte (KANONISCHE_CODE_FELDER).
    expect(feldFuerSpalte(AUF, 'D_ABB')?.feldId).toBe('bewilligung_datum');
  });

  it('app-weiter Spalten-Alias, wo auch der Code danebengeht (D_AZ1_1)', () => {
    // Der Code heißt `AZ1`, die Exportspalte `D_AZ1_1` — der D_<code>-Griff
    // geht ins Leere, der Alias trifft.
    expect(feldFuerSpalte(AUF, 'D_AZ1_1')?.feldId).toBe('erstentscheidung');
  });

  it('unbekannte Spalte bleibt unbekannt — geraten wird nicht', () => {
    expect(feldFuerSpalte(AUF, 'D_GIBTESNICHT')).toBeUndefined();
  });
});

describe('spaltenAuskunft — die Projektform entscheidet', () => {
  it('divergentes Kürzel: FuE und DL bekommen verschiedene Bezeichnungen', () => {
    const fue = spaltenAuskunft(AUF, 'D_AB', FUE);
    const dl = spaltenAuskunft(AUF, 'D_AB', DL);
    expect(fue.bezeichnung).not.toBe(dl.bezeichnung);
    expect(fue.eindeutig).toBe(true);
    expect(dl.eindeutig).toBe(true);
  });

  it('divergentes Kürzel ohne Projektform gilt nicht sicher', () => {
    // Irrläufer sind gar keine Projektform; hier gibt es nichts nachzuliefern.
    expect(spaltenAuskunft(AUF, 'D_AB', IRRLAEUFER).eindeutig).toBe(false);
  });

  it('einiges Kürzel: die kuratierte Fassung gewinnt', () => {
    const a = spaltenAuskunft(AUF, 'D_AZ1_1', FUE);
    expect(a.bezeichnung).toBe('Vorläufige Erstentscheidung');
    expect(a.eindeutig).toBe(true);
  });

  it('Status-Spalten tragen das Label der Fassung, ohne Projektform-Frage', () => {
    expect(spaltenAuskunft(AUF, 'STATUS_VB', undefined))
      .toEqual({ bezeichnung: 'Verbund-Status', eindeutig: true });
  });

  it('unbekannte Spalte: keine Bezeichnung, aber auch keine Warnung', () => {
    // `null` heißt „wir wissen es nicht" — die Anzeige zeigt dann den Code.
    expect(spaltenAuskunft(AUF, 'D_GIBTESNICHT', FUE))
      .toEqual({ bezeichnung: null, eindeutig: true });
  });

  it('Spalte ohne Katalog-Feld, aber mit bekanntem Kürzel', () => {
    // Ein Kürzel, das die Fassung (noch) nicht führt: der Katalog antwortet
    // trotzdem — der Nachtlauf zeigt Spalten, die erst im Export auftauchen.
    const leer = baueSpaltenAufloesung([]);
    expect(spaltenAuskunft(leer, 'D_ABB', FUE).bezeichnung).toBe('Bewilligung');
  });
});
