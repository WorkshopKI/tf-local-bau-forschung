/**
 * Der Export: eine Zeile je Meldung × Treffer.
 *
 * Die Form ist der Vertrag mit dem Fachreferat — dort wird nach FKZ gefiltert
 * und sortiert. Eine Meldung ohne Übereinstimmung muss trotzdem mit genau EINER
 * Zeile im Blatt stehen: sie ist das Ergebnis, nicht dessen Abwesenheit.
 */
import { describe, it, expect } from 'vitest';
import { baueExportZeilen, EXPORT_KOPF } from '@/plugins/doppelfoerderung/services/export';
import type { MeldungsZeile, TrefferBefund, ZeilenErgebnis } from '@/plugins/doppelfoerderung/types';

function zeile(nr: number, fkz: string): MeldungsZeile {
  return {
    zeilenNr: nr, fkz, thema: `Thema ${nr}`, aufgabenbeschreibung: 'Text',
    betrag: 1_850_000, betragRoh: '1850000', zuwendungsempfaenger: 'Hochschule', laufzeit: '',
  };
}

function befund(akz: string, abdeckung: number): TrefferBefund {
  return {
    aktenzeichen: akz, verbundId: `VB-${akz}`, verbundTitel: `Verbund ${akz}`,
    titel: `TV ${akz}`, kurzbeschreibung: 'Kurzfassung', getroffeneWorte: ['Laser'],
    abdeckung, aehnlichkeit: 0.812345, quelle: 'beide',
    status: 'bewilligt', antragsdatum: '2024-01-01', antragsteller: 'GmbH',
  };
}

const MIT_TREFFERN: ZeilenErgebnis = {
  zeile: zeile(2, 'A1'), schlagworte: ['Laser', 'Naht', 'Blech'],
  befunde: [befund('16KN1', 3), befund('16KN2', 2)],
  uebereinstimmung: true, grund: 'schlagworte',
};

const OHNE_TREFFER: ZeilenErgebnis = {
  zeile: zeile(3, 'A2'), schlagworte: ['Mikroalge', 'Bioreaktor', 'Ernte'],
  befunde: [], uebereinstimmung: false, grund: 'keine',
};

const GESCHEITERT: ZeilenErgebnis = {
  zeile: zeile(4, 'A3'), schlagworte: [], befunde: [],
  uebereinstimmung: false, grund: 'keine', fehler: 'Die interne KI ist nicht verbunden.',
};

describe('baueExportZeilen', () => {
  it('schreibt eine Zeile je Treffer', () => {
    const zeilen = baueExportZeilen([MIT_TREFFERN]);
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]?.[7]).toBe('16KN1');
    expect(zeilen[1]?.[7]).toBe('16KN2');
  });

  it('wiederholt die Meldungs-Spalten auf jeder Trefferzeile', () => {
    const zeilen = baueExportZeilen([MIT_TREFFERN]);
    expect(zeilen[0]?.slice(0, 3)).toEqual(zeilen[1]?.slice(0, 3));
    expect(zeilen[0]?.[1]).toBe('A1');
  });

  it('behält eine Meldung ohne Treffer mit genau einer Zeile', () => {
    const zeilen = baueExportZeilen([OHNE_TREFFER]);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.[5]).toBe('keine Übereinstimmung');
    expect(zeilen[0]?.[7]).toBe('');
  });

  it('markiert eine gescheiterte Zeile als „nicht geprüft" und nennt den Grund', () => {
    const zeilen = baueExportZeilen([GESCHEITERT]);
    expect(zeilen[0]?.[5]).toBe('nicht geprüft');
    expect(zeilen[0]?.[6]).toBe('Die interne KI ist nicht verbunden.');
  });

  it('hält jede Zeile auf Kopfbreite', () => {
    const zeilen = baueExportZeilen([MIT_TREFFERN, OHNE_TREFFER, GESCHEITERT]);
    for (const z of zeilen) expect(z).toHaveLength(EXPORT_KOPF.length);
  });

  it('schreibt die Abdeckung als Bruch und rundet die Ähnlichkeit', () => {
    const zeilen = baueExportZeilen([MIT_TREFFERN]);
    expect(zeilen[0]?.[11]).toBe('3/3');
    expect(zeilen[1]?.[11]).toBe('2/3');
    expect(zeilen[0]?.[13]).toBe(0.812);
  });
});
