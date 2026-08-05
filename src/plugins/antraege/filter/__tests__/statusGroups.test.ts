/**
 * Der Status-Filter gruppiert nach **ZAH-Phasen auf Code-Ebene**.
 *
 * Bis v2.383 war das eine dritte Achse: eine handgeschriebene Liste von 24
 * Roh-Labels, entkoppelt vom Katalog. Sie lief genau dort auseinander, wo es
 * zählt — `NF gestellt` unter „Nachforderung" statt „Vollständigkeit",
 * `bewilligt` unter „Entscheidung" statt „Begleitung", und jede amtliche
 * Schreibweise, die der Handoff nicht kannte, fiel in „Sonstige".
 *
 * Die Zusagen hier: **eine Zeile je Code** (Schreibweisen kollabieren mit
 * Summen-Zählung), **Marker als eigene Gruppe** (sie laufen neben dem
 * Verfahren), und **„Nicht im Katalog" meint genau das** — nicht „Rest".
 */
import { describe, it, expect } from 'vitest';
import {
  getStatusGroups, groupStatusValues, getPhaseForStatus, getPhaseLabel,
} from '../statusGroups';
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';
import { ZAH_PHASEN_REIHENFOLGE, SEED_MARKER_CODES } from '@/core/status/zah-phasen';

describe('Die Gruppen kommen aus dem Katalog', () => {
  it('führt die sechs ZAH-Phasen, dann Marker, dann Katalog-Fremde', () => {
    expect(getStatusGroups().map(g => g.id))
      .toEqual([...ZAH_PHASEN_REIHENFOLGE, 'marker', 'sonstige']);
  });

  it('verteilt jeden Katalog-Code auf genau eine Gruppe', () => {
    const codes = getStatusGroups().flatMap(g => g.items).map(it => it.value);
    expect(codes).toHaveLength(STATUS_CODE_KATALOG.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('legt die Marker in ihre eigene Gruppe, nicht unter „Sonstige"', () => {
    const marker = getStatusGroups().find(g => g.id === 'marker')!;
    const erwartet = STATUS_CODE_KATALOG
      .filter(e => SEED_MARKER_CODES.has(e.code)).map(e => e.text).sort();
    expect(marker.items.map(it => it.value).sort()).toEqual(erwartet);
    // „Nicht im Katalog" startet leer — es ist eine Kuratier-Anzeige, kein Rest.
    expect(getStatusGroups().find(g => g.id === 'sonstige')!.items).toHaveLength(0);
  });

  it('ordnet die Werte dort ein, wo der Katalog sie führt', () => {
    // Beide Fälle liefen in der alten Handliste woanders.
    expect(getPhaseForStatus('NF gestellt')).toBe('vollstaendigkeit');
    expect(getPhaseForStatus('bewilligt')).toBe('begleitung');
    expect(getPhaseForStatus('Irrläufer')).toBe('marker');
    expect(getPhaseForStatus('Wunschstatus')).toBe('sonstige');
    expect(getPhaseLabel('marker')).toBe('Marker (ohne Phase)');
  });

  it('trifft auch über die Varianten', () => {
    // So schreibt der Export sie.
    expect(getPhaseForStatus('Ablehnung')).toBe('entscheidung');
    expect(getPhaseForStatus('VN techn. geprüft')).toBe('begleitung');
    expect(getPhaseForStatus('nl eingegangen')).toBe('vollstaendigkeit');
  });
});

describe('groupStatusValues — Schreibweisen kollabieren', () => {
  it('summiert die Zählungen aller Schreibweisen eines Codes auf EINE Zeile', () => {
    const gruppen = groupStatusValues(new Map([
      ['Ablehnung versandt', 4],   // amtlich
      ['Ablehnung', 59],           // wie der Export schreibt
    ]));
    const entscheidung = gruppen.find(g => g.id === 'entscheidung')!;
    const zeile = entscheidung.items.filter(it => it.count > 0);
    expect(zeile).toHaveLength(1);
    expect(zeile[0]).toMatchObject({ value: 'Ablehnung versandt', count: 63, designed: true });
    // Gefiltert wird über beide — sonst fände ein Häkchen nur die Hälfte.
    expect(zeile[0]?.schreibweisen).toContain('Ablehnung');
  });

  it('zeigt Katalog-Codes auch mit Zählung 0 — als Orientierung', () => {
    const gruppen = groupStatusValues(new Map());
    const alle = gruppen.flatMap(g => g.items);
    expect(alle).toHaveLength(STATUS_CODE_KATALOG.length);
    expect(alle.every(it => it.count === 0 && it.designed)).toBe(true);
  });

  it('legt unbekannte Werte nach „Nicht im Katalog", alphabetisch und markiert', () => {
    const gruppen = groupStatusValues(new Map([['Zeta-Status', 1], ['Alpha-Status', 2]]));
    const fremd = gruppen.find(g => g.id === 'sonstige')!;
    expect(fremd.items.map(it => it.value)).toEqual(['Alpha-Status', 'Zeta-Status']);
    expect(fremd.items.every(it => !it.designed)).toBe(true);
  });

  it('ignoriert Leerwerte', () => {
    const gruppen = groupStatusValues(new Map([['', 5], ['(leer)', 7]]));
    expect(gruppen.find(g => g.id === 'sonstige')!.items).toHaveLength(0);
  });

  it('verliert keine Zählung — die Summe bleibt die Summe', () => {
    const counts = new Map([
      ['beantragt', 139], ['NL eingegangen', 52], ['Ablehnung', 59],
      ['VN techn. geprüft', 53], ['Irrläufer', 82], ['Wunschstatus', 3],
    ]);
    const gesamt = groupStatusValues(counts)
      .flatMap(g => g.items).reduce((n, it) => n + it.count, 0);
    expect(gesamt).toBe([...counts.values()].reduce((a, b) => a + b, 0));
  });
});
