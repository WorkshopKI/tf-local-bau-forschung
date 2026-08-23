/**
 * Die Bau-Dauer am Knopf: gemessen oder gar nicht.
 *
 * Vorher stand dort `Neu aufbauen (~48 min)`, gerechnet aus dem Literal 0,2 s je
 * Vorhaben. Die Zahl war nie an einem Lauf geprüft und hing an Dingen, die der
 * Code nicht kennt (WebGPU oder WASM, Maschine, Textlänge). Eine Zusage aus
 * einer erfundenen Konstante ist schlechter als eine Anzahl.
 */
import { describe, it, expect } from 'vitest';
import {
  berechneBauRate, schaetzeVollbauSekunden, MESSUNG_MINDEST_ITEMS,
} from '../korpus-messung';

const JETZT = '2026-08-23T09:00:00.000Z';

describe('berechneBauRate', () => {
  it('rechnet über beide Phasen zusammen', () => {
    const r = berechneBauRate(300_000, 12_000, 3_000, JETZT);
    expect(r).not.toBeNull();
    expect(r?.items).toBe(15_000);
    expect(r?.sekProItem).toBeCloseTo(0.02, 5);
    expect(r?.vorhabenItems).toBe(12_000);
    expect(r?.verbundItems).toBe(3_000);
  });

  it('schweigt bei zu kleinen Läufen', () => {
    // Ein Nachzieh-Lauf über drei Anträge misst hauptsächlich den Warmlauf der
    // Kernel und würde einen Vollbau um ein Vielfaches verfehlen.
    expect(berechneBauRate(9_000, 3, 0, JETZT)).toBeNull();
    expect(berechneBauRate(9_000, MESSUNG_MINDEST_ITEMS - 1, 0, JETZT)).toBeNull();
    expect(berechneBauRate(9_000, MESSUNG_MINDEST_ITEMS, 0, JETZT)).not.toBeNull();
  });

  it('schweigt ohne gemessene Dauer', () => {
    expect(berechneBauRate(0, 5_000, 1_000, JETZT)).toBeNull();
  });
});

describe('schaetzeVollbauSekunden', () => {
  const rate = berechneBauRate(300_000, 12_000, 3_000, JETZT);

  it('rechnet den kommenden Bestand mit der Verbund-Zahl der letzten Messung', () => {
    // 14.221 Vorhaben jetzt + 3.000 Verbünde aus der Messung, à 0,02 s.
    expect(schaetzeVollbauSekunden(rate, 14_221)).toBeCloseTo(344.42, 1);
  });

  it('behauptet ohne Messung nichts', () => {
    expect(schaetzeVollbauSekunden(null, 14_221)).toBeNull();
  });

  it('behauptet auch nichts, solange der Bestand unbekannt ist', () => {
    // Vor der Bestandsaufnahme wäre jede Minutenzahl eine Division durch nichts.
    expect(schaetzeVollbauSekunden(rate, 0)).toBeNull();
  });

  it('schweigt, wenn die Messung von einem anderen Rechenwerk stammt', () => {
    // Eine Rate ist eine Zahl mit Einheit: der Hauptprozessor braucht ein
    // Vielfaches der Grafikkarte. Nach einem Wechsel (v6.18) gilt die alte
    // Messung nicht mehr — dann steht am Knopf wieder die Anzahl.
    const aufGpu = berechneBauRate(300_000, 12_000, 3_000, JETZT, 'webgpu');
    expect(aufGpu?.geraet).toBe('webgpu');
    expect(schaetzeVollbauSekunden(aufGpu, 14_221, 'wasm')).toBeNull();
    expect(schaetzeVollbauSekunden(aufGpu, 14_221, 'webgpu')).toBeCloseTo(344.42, 1);
  });

  it('verwirft eine Messung nicht, nur weil eine Seite unbekannt ist', () => {
    // Messungen vor v6.18 tragen kein Rechenwerk, und vor dem ersten Ladelauf
    // weiß die Karte auch keines. „Nicht bekannt" ist kein Widerspruch.
    const ohneGeraet = berechneBauRate(300_000, 12_000, 3_000, JETZT);
    expect(schaetzeVollbauSekunden(ohneGeraet, 14_221, 'wasm')).toBeCloseTo(344.42, 1);
    const aufGpu = berechneBauRate(300_000, 12_000, 3_000, JETZT, 'webgpu');
    expect(schaetzeVollbauSekunden(aufGpu, 14_221, null)).toBeCloseTo(344.42, 1);
  });
});
