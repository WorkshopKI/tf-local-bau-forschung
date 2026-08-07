/**
 * Der C16-Index der Verlaufsableitung. Festgehalten wird, was er NICHT tun darf:
 *
 * - Zeilen eines fremden Programms nehmen
 * - eine Zulässigkeitsprüfung als Statuswechsel führen
 * - eine unbekannte Bezugsdatei-Nummer auf eine Ebene raten
 * - „Programm unbekannt" und „Programm ohne Regeln" verschmelzen
 */
import { describe, it, expect } from 'vitest';
import {
  baueC16Regeln, zeilenFuer, zielStatusFuer, wirktAufVerbund, erreichbareCodes,
} from '@/core/status/verlauf/c16-regeln';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import type { TriggerZeile } from '@/core/status/typen';

const z = (
  kuerzel: string, folge: number, parameter: string,
  prozedur = 'TRG_TVs_Status_TV_VB', programm = '76',
): TriggerZeile => parseTriggerZeile({ programm, kuerzel, folge, prozedur, parameter });

describe('baueC16Regeln — Auswahl und Lage', () => {
  it('nimmt nur die Zeilen des eigenen Programms', () => {
    const r = baueC16Regeln([
      z('AAE', 1, '<59||||||31|'),
      z('AAE', 1, '<59||||||99|', 'TRG_TVs_Status_TV_VB', '131'),
    ], '76');
    expect(r.lage).toBe('regeln');
    expect(zeilenFuer(r.index, 'AAE')).toHaveLength(1);
    expect(zielStatusFuer(zeilenFuer(r.index, 'AAE')[0]!, 'tv')).toBe(31);
  });

  it('trennt „Programm unbekannt" von „Programm ohne Regeln"', () => {
    const zeilen = [z('AAE', 1, '<59||||||31|')];
    expect(baueC16Regeln(zeilen, null).lage).toBe('programm-unbekannt');
    expect(baueC16Regeln(zeilen, '   ').lage).toBe('programm-unbekannt');
    expect(baueC16Regeln(zeilen, '46').lage).toBe('programm-ohne-regeln');
  });

  it('sortiert die Zeilen eines Kürzels nach Folge, egal wie sie in der Datei stehen', () => {
    const r = baueC16Regeln([
      z('AAE', 3, '<59||||||33|'),
      z('AAE', 1, '<59||||||31|'),
      z('AAE', 2, '<59||||||32|'),
    ], '76');
    expect(zeilenFuer(r.index, 'AAE').map(x => x.folge)).toEqual([1, 2, 3]);
  });

  it('findet ein Kürzel unabhängig von Schreibweise und Normalform', () => {
    const r = baueC16Regeln([z('ÄA', 1, '<59||||||37|')], '76');
    expect(zeilenFuer(r.index, 'äa')).toHaveLength(1);
    expect(zeilenFuer(r.index, 'ÄA'.normalize('NFD'))).toHaveLength(1);
  });
});

describe('baueC16Regeln — was NICHT in den Index kommt', () => {
  it('lässt eine reine Zulässigkeitsprüfung draußen, zählt sie aber', () => {
    // `<99|||AB||||` prüft nur, ob das Kürzel gesetzt werden DARF — es erklärt
    // keinen Statuswechsel und hätte in einer Bahn nichts zu suchen.
    const r = baueC16Regeln([z('AAE', 1, '<99|||AB||||')], '76');
    expect(r.index.size).toBe(0);
    expect(r.nurZulaessigkeit).toBe(1);
    expect(r.lage).toBe('programm-ohne-regeln');
  });

  it('zählt nicht interpretierte Zeilen, statt sie zu verschlucken', () => {
    const r = baueC16Regeln([
      z('AAE', 1, 'was auch immer', 'TRG.Unbekannt'),
      z('ABB', 1, '<59||||||59|'),
    ], '76');
    expect(r.nichtInterpretiert).toBe(1);
    expect(r.index.size).toBe(1);
  });

  it('lässt Mail- und Folge-Eintrags-Zeilen draußen', () => {
    const r = baueC16Regeln([
      z('AAR', 2, 'TIB|!.055.VorgInfo.01|BIB', 'TRG.VorgEintragMail'),
      z('AAE', 3, 'XAAE|210|0', 'TRG.VorgEintragNeu'),
    ], '76');
    expect(r.index.size).toBe(0);
    expect(r.nurZulaessigkeit).toBe(0);
  });
});

describe('zielStatusFuer — Setzebene ist nicht Wirkungsebene', () => {
  it('liest statusTv und statusVb unabhängig voneinander', () => {
    const nurTv = z('AT4', 1, '<59||||||38|');
    const nurVb = z('XHSP', 1, '<59|||||||50');
    const beide = z('ABB', 1, '<59||||||59|59');
    expect([zielStatusFuer(nurTv, 'tv'), zielStatusFuer(nurTv, 'verbund')]).toEqual([38, null]);
    expect([zielStatusFuer(nurVb, 'tv'), zielStatusFuer(nurVb, 'verbund')]).toEqual([null, 50]);
    expect([zielStatusFuer(beide, 'tv'), zielStatusFuer(beide, 'verbund')]).toEqual([59, 59]);
  });

  it('deutet die Bezugsdatei-Nummern von statusSetzen: 210 = Verbund, 211 = TV', () => {
    const tv = z('ABA', 1, '211|74', 'TRG.Status.TV.VB');
    const vb = z('ABLWR', 1, '210|73', 'TRG.Status.TV.VB');
    expect([zielStatusFuer(tv, 'tv'), zielStatusFuer(tv, 'verbund')]).toEqual([74, null]);
    expect([zielStatusFuer(vb, 'tv'), zielStatusFuer(vb, 'verbund')]).toEqual([null, 73]);
  });

  it('setzt bei unbekannter Bezugsdatei-Nummer NICHTS, statt eine Ebene zu raten', () => {
    const fremd = z('ABA', 1, '999|74', 'TRG.Status.TV.VB');
    expect(zielStatusFuer(fremd, 'tv')).toBeNull();
    expect(zielStatusFuer(fremd, 'verbund')).toBeNull();
    expect(baueC16Regeln([fremd], '76').index.size).toBe(0);
  });
});

describe('wirktAufVerbund / erreichbareCodes', () => {
  const r = baueC16Regeln([
    z('AT4', 1, '<59||||||38|'),
    z('ABB', 1, '<59||||||59|59'),
    z('XHSP', 1, '<59|||||||50'),
    z('ABA', 1, '211|74', 'TRG.Status.TV.VB'),
  ], '76');

  it('erkennt Verbund-Wirkung auch an einem TV-Kürzel', () => {
    expect(wirktAufVerbund(r.index, 'ABB')).toBe(true);
    expect(wirktAufVerbund(r.index, 'AT4')).toBe(false);
    expect(wirktAufVerbund(r.index, 'GIBTESNICHT')).toBe(false);
  });

  it('sammelt die erreichbaren Codes je Ebene getrennt', () => {
    expect([...erreichbareCodes(r.index, 'tv')].sort((a, b) => a - b)).toEqual([38, 59, 74]);
    expect([...erreichbareCodes(r.index, 'verbund')].sort((a, b) => a - b)).toEqual([50, 59]);
  });
});
