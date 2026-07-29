/**
 * Ladezustand des Auslastungs-Moduls (v2.352) — zwei reine Funktionen:
 *
 *  - `baueVollstaendigkeitsHinweise`: Regressionsschutz gegen den Fehlalarm
 *    „Vollständigkeits-Prüfung inaktiv", der bis v2.351 bei JEDEM ersten
 *    Modul-Aufruf erschien. Die Gate-Flags stammen aus den Stream-Artefakten des
 *    Antraege-Caches (Phase 2); solange die laufen, sind sie leer — die Diagnose
 *    darf daraus keinen Mapping-Fehler ableiten.
 *  - `bestimmeLadePhase`: Praezedenz der Anzeige-Phasen.
 */
import { describe, it, expect } from 'vitest';
import { baueVollstaendigkeitsHinweise } from '../services/klassifizierung';
import { bestimmeLadePhase } from '../hooks/useAuslastungReady';

const FELDER = {
  xtecFeld: 'alle_antrage_in_c16_eingegeben',
  advFeld: 'antrag_in_c16_eingestellt',
  xtecGefunden: true,
  advGefunden: true,
};
/** Gate wie waehrend des Ladens (Az-Sets noch leer) bzw. bei echter Fehlkonfiguration. */
const GATE_LEER = { dxtec: false, dadv: false };

describe('baueVollstaendigkeitsHinweise', () => {
  it('schweigt waehrend des Ladens, auch wenn das Gate leer aussieht', () => {
    expect(baueVollstaendigkeitsHinweise({
      datenBereit: false,
      fueDs: 18,
      dlNw: 7,
      felder: FELDER,
      gate: GATE_LEER,
    })).toEqual([]);
  });

  it('meldet nach dem Laden pro betroffenem Bucket genau einen Hinweis', () => {
    const msgs = baueVollstaendigkeitsHinweise({
      datenBereit: true,
      fueDs: 18,
      dlNw: 7,
      felder: FELDER,
      gate: GATE_LEER,
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('D_XTEC');
    expect(msgs[0]).toContain(FELDER.xtecFeld);
    expect(msgs[1]).toContain('D_ADV');
    expect(msgs[1]).toContain(FELDER.advFeld);
  });

  it('meldet nur den Bucket, der ueberhaupt Verbuende hat', () => {
    const msgs = baueVollstaendigkeitsHinweise({
      datenBereit: true,
      fueDs: 18,
      dlNw: 0,
      felder: FELDER,
      gate: GATE_LEER,
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('FuE/DS');
  });

  it('schweigt, wenn die Spalte gar nicht gemappt ist (Pruefung nicht gewollt)', () => {
    expect(baueVollstaendigkeitsHinweise({
      datenBereit: true,
      fueDs: 18,
      dlNw: 7,
      felder: { ...FELDER, xtecGefunden: false, advGefunden: false },
      gate: GATE_LEER,
    })).toEqual([]);
  });

  it('schweigt, wenn das Gate greift (irgendein Antrag traegt ein Datum)', () => {
    expect(baueVollstaendigkeitsHinweise({
      datenBereit: true,
      fueDs: 18,
      dlNw: 7,
      felder: FELDER,
      gate: { dxtec: true, dadv: true },
    })).toEqual([]);
  });
});

describe('bestimmeLadePhase', () => {
  it('zeigt nichts an, wenn nichts haengt', () => {
    expect(bestimmeLadePhase({ auslastungBusy: false, antraegeBusy: false, korpusBusy: false }))
      .toBeNull();
  });

  it('Auslastungsdaten haben Vorrang vor Antraegen und Korpus', () => {
    expect(bestimmeLadePhase({ auslastungBusy: true, antraegeBusy: true, korpusBusy: true }))
      .toBe('auslastungsdaten');
  });

  it('Antraege haben Vorrang vor dem Korpus', () => {
    expect(bestimmeLadePhase({ auslastungBusy: false, antraegeBusy: true, korpusBusy: true }))
      .toBe('antraege');
  });

  it('Korpus zuletzt — er blockiert die Seite nicht, wird aber gemeldet', () => {
    expect(bestimmeLadePhase({ auslastungBusy: false, antraegeBusy: false, korpusBusy: true }))
      .toBe('themenvektoren');
  });
});
