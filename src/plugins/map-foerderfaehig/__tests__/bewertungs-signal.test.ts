/**
 * Signalstufe eines Bewertungsstands.
 *
 * Kernzusage: „vollständig" ist nicht „gut". Ein fertig bewerteter
 * Innovationsgrad unterhalb des Kurzpfads bleibt eine Warnung — sonst
 * quittiert die Oberfläche ein schwaches Ergebnis als Erfolg.
 */
import { describe, expect, it } from 'vitest';
import {
  istAlarm, signalFuerInnoScore, signalFuerStatus, signalFuerStufe,
} from '../ansicht/bewertungs-signal';
import type { MapInnoScore } from '../checkliste/bewertung';
import type { MapItemStatus, MapStufe } from '../checkliste/typen';

const inno = (teil: Partial<MapInnoScore>): MapInnoScore => ({
  punkte: 0, rohSumme: 0, maxPunkte: 9, nullWegenB0: false,
  b0Items: [], vollstaendig: false, vertiefungNoetig: false, ...teil,
});

describe('signalFuerStufe', () => {
  it('stuft B0 kritisch und B1 als Warnung ein', () => {
    expect(signalFuerStufe('B0')).toBe('kritisch');
    expect(signalFuerStufe('B1')).toBe('warnung');
  });

  it('lässt B2 neutral und B3 gut', () => {
    expect(signalFuerStufe('B2')).toBe('neutral');
    expect(signalFuerStufe('B3')).toBe('gut');
  });

  it('behandelt „noch nicht bewertet" als neutral, nicht als Befund', () => {
    expect(signalFuerStufe(null)).toBe('neutral');
    expect(istAlarm(signalFuerStufe(null))).toBe(false);
  });

  it('markiert genau B0 und B1 als Alarm', () => {
    const stufen: MapStufe[] = ['B0', 'B1', 'B2', 'B3'];
    expect(stufen.filter(s => istAlarm(signalFuerStufe(s)))).toEqual(['B0', 'B1']);
  });
});

describe('signalFuerStatus', () => {
  it('trennt Befund von Haken', () => {
    expect(signalFuerStatus('nicht-erfuellt')).toBe('kritisch');
    expect(signalFuerStatus('nf-notwendig')).toBe('warnung');
    expect(signalFuerStatus('erfuellt')).toBe('gut');
    expect(signalFuerStatus('nf-erfuellt')).toBe('gut');
  });

  it('hält „offen" und „nicht zutreffend" still', () => {
    expect(signalFuerStatus('offen')).toBe('neutral');
    expect(signalFuerStatus('nicht-zutreffend')).toBe('neutral');
  });

  it('markiert genau die beiden Befund-Status als Alarm', () => {
    const alle: MapItemStatus[] = [
      'offen', 'erfuellt', 'nicht-erfuellt', 'nicht-zutreffend', 'nf-notwendig', 'nf-erfuellt',
    ];
    expect(alle.filter(s => istAlarm(signalFuerStatus(s))))
      .toEqual(['nicht-erfuellt', 'nf-notwendig']);
  });
});

describe('signalFuerInnoScore', () => {
  it('meldet B0 als kritisch — unabhängig von den übrigen Kategorien', () => {
    expect(signalFuerInnoScore(inno({
      nullWegenB0: true, vollstaendig: true, rohSumme: 7,
    }))).toBe('kritisch');
  });

  it('bleibt neutral, solange nicht alle Kategorien bewertet sind', () => {
    expect(signalFuerInnoScore(inno({ vollstaendig: false, punkte: 6 }))).toBe('neutral');
  });

  it('meldet ein vollständiges, aber schwaches Ergebnis als Warnung', () => {
    // Dreimal B1 = 3 Punkte: fertig bewertet, aber unter dem Kurzpfad.
    expect(signalFuerInnoScore(inno({
      vollstaendig: true, vertiefungNoetig: true, punkte: 3,
    }))).toBe('warnung');
  });

  it('meldet nur oberhalb des Kurzpfads „gut"', () => {
    expect(signalFuerInnoScore(inno({
      vollstaendig: true, vertiefungNoetig: false, punkte: 8,
    }))).toBe('gut');
  });

  it('quittiert Vollständigkeit NIE allein als Erfolg', () => {
    const schwachAberFertig = inno({ vollstaendig: true, vertiefungNoetig: true, punkte: 3 });
    expect(signalFuerInnoScore(schwachAberFertig)).not.toBe('gut');
    expect(istAlarm(signalFuerInnoScore(schwachAberFertig))).toBe(true);
  });
});
