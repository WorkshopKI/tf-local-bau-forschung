/**
 * Die einseitige Kaskade Antragstyp → Projektart.
 *
 * Wählt der Nutzer oben „FuE", zählen die Projektart-Stufen nur noch FuE. Ohne
 * das behauptet „Einzelprojekt 397" eine Menge, die der Klick gar nicht liefern
 * kann — der Antragstyp-Filter liegt in der Pipeline davor.
 *
 * Getestet wird die Verkettung der beiden REINEN Bausteine, aus denen die
 * Toolbar sie baut (`matchesKategorie` + `getProjektartItems`), nicht die
 * Komponente: Vitest läuft node-only.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { matchesKategorie, type KategorieLabel } from '../kategorieQuickfilter';
import {
  getProjektartItems,
  PROJEKTART_LABELS,
  type Projektart,
} from '../projektartQuickfilter';

function antrag(aktenzeichen: string, vbPhase: number, verbundId: string): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    vb_phase: vbPhase,
    ...(verbundId ? { verbund_id: verbundId } : {}),
  } as AntragListItem;
}

// vb_phase 3 = FuE, 5 = DS, 4 = DL.
const LISTE: AntragListItem[] = [
  antrag('16EP000001', 3, ''),        // FuE, Einzel, ohne NW
  antrag('16KN106201', 3, ''),        // FuE, Einzel, mit NW
  antrag('16KN106227', 3, 'V2'),      // FuE, Kooperation
  antrag('16KN106228', 3, 'V2'),      // FuE, Kooperation
  antrag('16DS000001', 5, ''),        // DS, Einzel, weder noch
  antrag('16DL260001', 4, ''),        // DL — gar keine Projektart
];
const tv = (a: AntragListItem): number => (a.verbund_id === 'V2' ? 2 : 1);

/** Wie die Toolbar die Basis bildet. */
function basis(kategorie: KategorieLabel): AntragListItem[] {
  return kategorie === 'Alle' ? LISTE : LISTE.filter(a => matchesKategorie(a, kategorie));
}

function zahl(kategorie: KategorieLabel, art: Projektart): number {
  const items = getProjektartItems(basis(kategorie), tv)
    .flatMap(i => [i, ...(i.unterpunkte ?? [])]);
  return items.find(i => i.label === PROJEKTART_LABELS[art])!.count!;
}

describe('matchesKategorie', () => {
  it('„Alle" matcht jeden Antrag', () => {
    expect(LISTE.every(a => matchesKategorie(a, 'Alle'))).toBe(true);
  });

  it('trennt die Antragstypen über die vb_phase', () => {
    expect(basis('FuE').map(a => a.aktenzeichen))
      .toEqual(['16EP000001', '16KN106201', '16KN106227', '16KN106228']);
    expect(basis('DS').map(a => a.aktenzeichen)).toEqual(['16DS000001']);
    expect(basis('DL').map(a => a.aktenzeichen)).toEqual(['16DL260001']);
  });
});

describe('Kaskade Antragstyp → Projektart', () => {
  it('ohne Antragstyp-Wahl zählt die volle Basis', () => {
    expect(zahl('Alle', 'alle')).toBe(LISTE.length);
    expect(zahl('Alle', 'einzel')).toBe(3);          // 2× FuE + 1× DS
    expect(zahl('Alle', 'kooperation')).toBe(2);
  });

  it('„FuE" schneidet die Projektart-Zähler mit', () => {
    expect(zahl('FuE', 'alle')).toBe(4);
    expect(zahl('FuE', 'einzel')).toBe(2);           // das DS-Einzelprojekt fällt raus
    expect(zahl('FuE', 'einzel_mit_nb')).toBe(1);
    expect(zahl('FuE', 'einzel_ohne_nb')).toBe(1);
    expect(zahl('FuE', 'kooperation')).toBe(2);
  });

  it('„DS" lässt genau das DS-Einzelprojekt übrig — ohne NW-Zuordnung', () => {
    expect(zahl('DS', 'einzel')).toBe(1);
    // 16DS trägt weder 16KN noch 16EP: beide Unterstufen sind leer.
    expect(zahl('DS', 'einzel_mit_nb')).toBe(0);
    expect(zahl('DS', 'einzel_ohne_nb')).toBe(0);
  });

  it('„DL" kennt gar keine Projektart — alle Stufen außer „Alle" sind leer', () => {
    expect(zahl('DL', 'alle')).toBe(1);
    expect(zahl('DL', 'einzel')).toBe(0);
    expect(zahl('DL', 'kooperation')).toBe(0);
  });

  it('„Alle" der Projektart ist immer die Größe der (gekappten) Basis', () => {
    for (const k of ['Alle', 'FuE', 'DS', 'DL'] as KategorieLabel[]) {
      expect(zahl(k, 'alle'), k).toBe(basis(k).length);
    }
  });
});
