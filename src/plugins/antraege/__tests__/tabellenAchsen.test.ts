/**
 * Die zwei Achsen der Tabellen-Ansicht: Zeilen-Körnung („Ansicht") und
 * Abschnitts-Bänder („Gruppierung") — Optionen, Defaults, Persistenz-Whitelist.
 *
 * Bis v3.0 steckte die Verbund-Verdichtung als Wert `'verbund'` in der
 * Gruppierung. Der Wert ist weg; ein Profil, das ihn noch gespeichert hat, muss
 * auf dem Default landen statt auf einem toten Zustand.
 */
import { describe, it, expect } from 'vitest';
import {
  TABLE_GROUPING_OPTIONS,
  TABLE_ANSICHT_OPTIONS,
  DEFAULT_TABLE_ANSICHT,
  istTableGroupingMode,
  istTabellenAnsicht,
} from '../tableGrouping';
import { getEffectiveTableGroupingMode, getEffectiveTableAnsicht } from '../store';

describe('Gruppierungs-Optionen der Tabelle', () => {
  it('bietet Keine/Status/Frist/NW/FB/AB — und „Verbund" NICHT mehr', () => {
    // „Frist" ist seit v4.62 die vierte Sektionierungs-Achse und steht direkt
    // hinter „Status": beide bändern eine Eigenschaft der Zeile selbst, NW/FB/AB
    // dagegen eine Zugehörigkeit. Sie ist die einzige, die eine GERECHNETE
    // Größe bändert — die Schwellen kommen aus FRIST_AMPEL_STUFEN.
    expect(TABLE_GROUPING_OPTIONS.map(o => o.key))
      .toEqual(['none', 'status', 'frist', 'netzwerk', 'fb', 'ab']);
    expect(TABLE_GROUPING_OPTIONS.map(o => o.label))
      .toEqual(['Keine', 'Status', 'Frist', 'NW', 'FB', 'AB']);
  });

  it('„NW-Größe" bleibt der Karten-/Listen-Ansicht vorbehalten', () => {
    const keys: readonly string[] = TABLE_GROUPING_OPTIONS.map(o => o.key);
    expect(keys).not.toContain('netzwerk-by-size');
  });
});

describe('istTableGroupingMode — Persistenz-Whitelist', () => {
  it('nimmt jede angebotene Option an', () => {
    for (const o of TABLE_GROUPING_OPTIONS) expect(istTableGroupingMode(o.key)).toBe(true);
  });

  it('weist den Altwert „verbund" ab (Migration auf den Default)', () => {
    expect(istTableGroupingMode('verbund')).toBe(false);
    // …und der Selektor liefert dann den Default, nicht `undefined`.
    expect(getEffectiveTableGroupingMode('alle', {})).toBe('none');
  });

  it('weist Unsinn ab', () => {
    expect(istTableGroupingMode('netzwerk-by-size')).toBe(false);
    expect(istTableGroupingMode(null)).toBe(false);
    expect(istTableGroupingMode(42)).toBe(false);
  });
});

describe('Ansicht-Achse', () => {
  it('bietet genau zwei Körnungen, „Antrag" ist der Standard', () => {
    expect(TABLE_ANSICHT_OPTIONS.map(o => o.key)).toEqual(['antrag', 'antrag-mit-tv']);
    expect(TABLE_ANSICHT_OPTIONS.map(o => o.label)).toEqual(['Antrag', 'Antrag mit TV']);
    expect(DEFAULT_TABLE_ANSICHT).toBe('antrag');
  });

  it('ohne Nutzer-Wahl gilt der Standard, mit Wahl die Wahl', () => {
    expect(getEffectiveTableAnsicht('alle', {})).toBe('antrag');
    expect(getEffectiveTableAnsicht('alle', { alle: 'antrag-mit-tv' })).toBe('antrag-mit-tv');
    // Wahl gilt pro Reiter — ein anderer Reiter bleibt beim Standard.
    expect(getEffectiveTableAnsicht('meine_offenen', { alle: 'antrag-mit-tv' })).toBe('antrag');
  });

  it('akzeptiert nur die beiden Körnungen aus der Persistenz', () => {
    expect(istTabellenAnsicht('antrag')).toBe(true);
    expect(istTabellenAnsicht('antrag-mit-tv')).toBe(true);
    expect(istTabellenAnsicht('verbund')).toBe(false);
    expect(istTabellenAnsicht(undefined)).toBe(false);
  });
});
