/**
 * Tests für das Zusammenziehen der beiden Organisationsspalten (v4.4.3).
 *
 * `ORG_AST` (Rechtsperson) und `ORG_AFS` (ausführende Stelle) sind am Bestand
 * gemessen in 97,5 % der Sätze identisch. Doppelt gespeichert wären das ~14 000
 * überflüssige Kopien; getrennt gespeichert zwei Felder, die fast immer dasselbe
 * sagen. Beides zusammengezogen, Gleichheit entdoppelt.
 */
import { describe, it, expect } from 'vitest';
import { verbindeOrganisation } from '../services/search-corpus';

describe('verbindeOrganisation', () => {
  it('speichert einen identischen Namen nur einmal', () => {
    expect(verbindeOrganisation('Mogic GmbH', 'Mogic GmbH')).toBe('Mogic GmbH');
  });

  it('führt zwei verschiedene Namen zusammen', () => {
    expect(verbindeOrganisation('Universitätsklinikum Leipzig AöR', 'Universität Leipzig'))
      .toBe('Universitätsklinikum Leipzig AöR Universität Leipzig');
  });

  it('kommt mit einer fehlenden Rechtsperson aus', () => {
    expect(verbindeOrganisation('Mogic GmbH', '')).toBe('Mogic GmbH');
  });

  it('kommt mit einer fehlenden ausführenden Stelle aus — ohne führendes Leerzeichen', () => {
    expect(verbindeOrganisation('', 'Universität Leipzig')).toBe('Universität Leipzig');
  });

  it('liefert für zwei leere Spalten einen leeren String', () => {
    // Wichtig für den `includeEmpty`-Guard: `.length > 0` muss falsch bleiben,
    // sonst käme jeder textlose Antrag in den Korpus.
    expect(verbindeOrganisation('', '')).toBe('');
  });
});
