/**
 * Rückweg von der Antrags-Detailseite (v3.50).
 *
 * Der Klick auf einen Suchtreffer führte auf dieselbe Route wie ein Klick in der
 * Förderanträge-Liste — und damit auch auf denselben (einzigen) Rückweg: in die
 * Liste. Wer aus der Suche kam, landete in einer Ansicht, die er nie geöffnet
 * hatte. Die Ableitung ist bewusst rein, damit sie ohne Router prüfbar ist.
 */
import { describe, it, expect } from 'vitest';
import {
  ANTRAEGE_ROUTE,
  SUCHE_ROUTE,
  VON_SUCHE_STATE_KEY,
  detailSchliessenZiel,
  kamAusDerSuche,
} from '../herkunft';

describe('kamAusDerSuche', () => {
  it('erkennt den gesetzten Vermerk', () => {
    expect(kamAusDerSuche({ [VON_SUCHE_STATE_KEY]: true })).toBe(true);
  });

  it('ist tolerant gegenüber allem anderen — nichts davon heißt „aus der Suche"', () => {
    // `location.state` ist `null`, sobald die Seite neu geladen oder direkt
    // adressiert wurde; fremde States kommen von anderen Aufrufern.
    expect(kamAusDerSuche(null)).toBe(false);
    expect(kamAusDerSuche(undefined)).toBe(false);
    expect(kamAusDerSuche({})).toBe(false);
    expect(kamAusDerSuche({ vonSuche: 'ja' })).toBe(false);
    expect(kamAusDerSuche({ vonSuche: 1 })).toBe(false);
    expect(kamAusDerSuche('vonSuche')).toBe(false);
    expect(kamAusDerSuche(42)).toBe(false);
  });
});

describe('detailSchliessenZiel', () => {
  it('führt aus der Suche zurück in die Suche', () => {
    expect(detailSchliessenZiel({ [VON_SUCHE_STATE_KEY]: true })).toBe(SUCHE_ROUTE);
  });

  it('bleibt sonst beim bisherigen Ziel (Förderanträge-Liste)', () => {
    expect(detailSchliessenZiel(null)).toBe(ANTRAEGE_ROUTE);
    expect(detailSchliessenZiel({ irgendwas: true })).toBe(ANTRAEGE_ROUTE);
  });
});
