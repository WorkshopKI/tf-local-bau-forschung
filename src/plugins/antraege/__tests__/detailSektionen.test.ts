import { describe, it, expect } from 'vitest';
import {
  DETAIL_SEKTIONEN, sektionOffenDefault, sektionsKey, type DetailSektionId,
} from '../detailSektionen';

const IDS = Object.keys(DETAIL_SEKTIONEN) as DetailSektionId[];

describe('detailSektionen — Klapp-Vorgaben der Verbund-Detailseite', () => {
  it('beim ersten Anzeigen ist genau EINE Sektion offen: die Antragsdaten', () => {
    const offen = IDS.filter(id => DETAIL_SEKTIONEN[id].offen === true);
    expect(offen, 'Die Detailseite soll zugeklappt starten — sonst scrollt der Nutzer '
      + 'an aufgeklappten Werkstätten vorbei, bevor er die Fakten sieht.').toEqual(['antragsdaten']);
  });

  it('die Kurzbeschreibung ist die einzige Sektion, die von ihrem Inhalt abhängt', () => {
    const bedingt = IDS.filter(id => DETAIL_SEKTIONEN[id].offen === 'wennGefuellt');
    expect(bedingt).toEqual(['kurzbeschreibung']);
    expect(sektionOffenDefault('kurzbeschreibung', true)).toBe(true);
    // Leer aufgeklappt zeigte nur den „noch nicht erstellt"-Hinweis — eine Karte
    // Höhe für eine Nicht-Aussage.
    expect(sektionOffenDefault('kurzbeschreibung', false)).toBe(false);
  });

  it('`gefuellt` wirkt NUR auf bedingte Sektionen', () => {
    expect(sektionOffenDefault('gutachten', true)).toBe(false);
    expect(sektionOffenDefault('antragsdaten', false)).toBe(true);
  });

  it('jeder Schlüssel ist eindeutig und trägt den v2-Bump', () => {
    const keys = IDS.map(sektionsKey);
    expect(new Set(keys).size, `Doppelter Schlüssel: ${keys.join(', ')}`).toBe(keys.length);
    // Ohne den Bump gewinnt ein persistierter Alt-Wert über den neuen Default —
    // die Umstellung wäre dann nur in frischen Profilen sichtbar.
    expect(keys.filter(k => !k.endsWith('_collapsed_v2'))).toEqual([]);
  });
});
