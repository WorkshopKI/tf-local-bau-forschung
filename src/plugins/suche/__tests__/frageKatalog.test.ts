/**
 * Der Frage-Katalog der Dokumenten-Suche (v4.109).
 *
 * Geprüft wird, was der Katalog zusagt: dass er derselbe Vorrat ist wie im
 * Startzustand (eine Liste, zwei Orte), dass die Trennlinie fertig/halb hält,
 * und dass keine Vorlage die Feld-Syntax der Stichwortsuche einschleppt — im
 * Frage-Modus tippt niemand `ort:`, und ein Beispiel, das es täte, lehrte
 * genau das Falsche.
 */
import { describe, it, expect } from 'vitest';
import { baueFrageAbschnitte, flacheListe, hatLuecke } from '@/components/frage-vorschlaege';
import { FRAGEN, SUCHE_FRAGE_KATALOG } from '../frage/katalog';

const abschnitte = (text = '', verlauf: readonly string[] = []) =>
  baueFrageAbschnitte(text, verlauf, SUCHE_FRAGE_KATALOG);

describe('SUCHE_FRAGE_KATALOG', () => {
  it('nimmt seine Beispiele aus DERSELBEN Liste wie der Reiter „Fragen"', () => {
    for (const b of SUCHE_FRAGE_KATALOG.beispiele) {
      expect(FRAGEN.map(f => f.frage)).toContain(b.text);
    }
    // Der Reiter zeigt alle, das Dropdown einen Ausschnitt — aber keinen anderen.
    expect(SUCHE_FRAGE_KATALOG.beispiele.length).toBeLessThan(FRAGEN.length);
  });

  it('trennt fertige Frage und halben Satz an der Lücke', () => {
    for (const b of SUCHE_FRAGE_KATALOG.beispiele) expect(hatLuecke(b.text)).toBe(false);
    for (const v of SUCHE_FRAGE_KATALOG.vorlagen) expect(hatLuecke(v.text)).toBe(true);
  });

  it('schleppt die Feld-Syntax der Stichwortsuche nicht ein', () => {
    for (const v of [...SUCHE_FRAGE_KATALOG.beispiele, ...SUCHE_FRAGE_KATALOG.vorlagen]) {
      expect(v.text).not.toMatch(/\b(ort|bl|ast|nw|deskriptor|wahlkreis):/);
    }
  });

  it('jede Lücke NENNT, was hineingehört — kein Beispielwert als Platzhalter', () => {
    for (const v of SUCHE_FRAGE_KATALOG.vorlagen) {
      expect(v.text).toMatch(/‹(Thema|Bundesland|Jahr)›/);
      expect(v.hinweis.length).toBeGreaterThan(0);
    }
  });
});

describe('die Abschnitte dieser Seite', () => {
  it('zeigt ohne Verlauf zwei Abschnitte, mit Verlauf drei', () => {
    expect(abschnitte().map(a => a.titel)).toEqual(['Beispielfragen', 'Zum Ausfüllen']);
    expect(abschnitte('', ['Was läuft zu Sensorik?']).map(a => a.titel))
      .toEqual(['Zuletzt gefragt', 'Beispielfragen', 'Zum Ausfüllen']);
  });

  it('nur der Verlauf lässt sich löschen — Beispiele und Vorlagen gehören der App', () => {
    const arten = flacheListe(abschnitte('', ['alte Frage'])).map(v => v.art);
    expect(arten.filter(a => a === 'verlauf')).toHaveLength(1);
    expect(new Set(arten)).toEqual(new Set(['verlauf', 'beispiel', 'vorlage']));
  });

  it('filtert mit dem getippten Text — eine eigene Frage lässt den Katalog hinter sich', () => {
    expect(abschnitte('Normung')).toHaveLength(1);
    expect(abschnitte('etwas ganz anderes ohne Treffer')).toEqual([]);
  });
});
