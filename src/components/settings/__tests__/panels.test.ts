/**
 * Rangfolge der Hub-Suche.
 *
 * Bis v4.116 filterte sie unsortiert über `label + keywords + panelLabel` und
 * schnitt bei sechs ab — der SEITENNAME zählte damit so viel wie der
 * Abschnittsname. Wer „Verbindung" tippte, bekam alle sechs Abschnitte der
 * Seite „Daten & Verbindungen" und ausgerechnet den nicht, der „Verbindung"
 * heißt: er stand in der Registry weiter hinten und fiel unter den Deckel.
 */
import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchSettings, type SettingsPanel } from '../panels';

const ICON = (() => null) as unknown as SettingsPanel['icon'];

function panel(id: string, label: string, sections: Array<[string, string, string]>): SettingsPanel {
  return {
    id,
    label,
    untertitel: '',
    icon: ICON,
    sections: sections.map(([sid, slabel, keywords]) => ({
      id: sid, label: slabel, gruppe: slabel, keywords,
    })),
    render: (() => null) as unknown as SettingsPanel['render'],
  };
}

const INDEX = buildSearchIndex([
  panel('daten', 'Daten & Verbindungen', [
    ['sec-speicher', 'Ordner', 'datenordner speicher'],
    ['sec-verzeichnisse', 'Verbundene Verzeichnisse', 'verzeichnis'],
    ['sec-arbeitsverlauf', 'Arbeitsverlauf', 'protokoll'],
    ['sec-doku', 'Persönliche Dokumentenquellen', 'pfade'],
    ['sec-tags', 'Tags', 'tag-verwaltung'],
    ['sec-team', 'Team-Status', 'online presence'],
  ]),
  panel('ki', 'Interne KI', [
    ['sec-internki', 'Verbindung', 'browser bridge'],
    ['sec-internki-einrichtung', 'Verbindung einrichten', 'lesezeichen bookmarklet'],
  ]),
]);

describe('searchSettings', () => {
  it('setzt den genauen Label-Treffer an die Spitze', () => {
    const treffer = searchSettings(INDEX, 'Verbindung');
    expect(treffer[0]?.id).toBe('sec-internki');
    expect(treffer[1]?.id).toBe('sec-internki-einrichtung');
    // Der Deckel greift weiterhin, aber er schneidet jetzt die schwachen ab.
    expect(treffer).toHaveLength(6);
  });

  it('stellt den Wortanfang vor den Treffer mitten im Wort', () => {
    const treffer = searchSettings(INDEX, 'verzeich');
    expect(treffer[0]?.id).toBe('sec-verzeichnisse');
  });

  it('findet über Stichworte, aber nachrangig', () => {
    const treffer = searchSettings(INDEX, 'lesezeichen');
    expect(treffer.map(t => t.id)).toEqual(['sec-internki-einrichtung']);
  });

  it('hält die Registry-Reihenfolge innerhalb einer Trefferklasse', () => {
    // Alle sechs Abschnitte der Datenseite treffen nur über den Seitennamen.
    const treffer = searchSettings(INDEX, 'daten &');
    expect(treffer.map(t => t.panelId)).toEqual(Array(6).fill('daten'));
    expect(treffer[0]?.id).toBe('sec-speicher');
  });

  it('schweigt unter zwei Zeichen', () => {
    expect(searchSettings(INDEX, 'v')).toEqual([]);
    expect(searchSettings(INDEX, '  ')).toEqual([]);
  });
});
