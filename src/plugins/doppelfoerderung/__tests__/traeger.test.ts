/**
 * Die Träger-Achse — an den Fällen festgehalten, die die Messung an der
 * 72er-Liste hervorgebracht hat.
 *
 * Jeder Fehlertyp hier ist einmal wirklich aufgetreten; die Namen sind die
 * echten aus dem Lauf vom 23.08.2026.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  baueTraegerIndex, traegerAbgleich, traegerTokens, ENTHALTUNG_MAX_DF, TRAEGER_NAEHE_SCHWELLE,
} from '@/plugins/doppelfoerderung/services/traeger';

function item(akz: string, antragsteller: string): AntragListItem {
  return { aktenzeichen: akz, programm_id: 'p', status: 'bewilligt', antragsteller } as AntragListItem;
}

function index(...paare: Array<[string, string]>) {
  const items = paare.map(([akz, name]) => item(akz, name));
  return baueTraegerIndex(items, new Set(items.map(i => i.aktenzeichen)));
}

describe('traegerTokens — normalisieren, ohne zu verwischen', () => {
  it('wirft die Rechtsform weg, damit „fzmb GmbH" und „fzmb" derselbe Träger sind', () => {
    expect([...traegerTokens('fzmb GmbH')]).toEqual(['fzmb']);
  });

  it('behält den Ort — er unterscheidet zwei Häuser desselben Typs', () => {
    // „Hochschule Osnabrück" und „Hochschule Stralsund" sind verschiedene Träger.
    expect(traegerTokens('Hochschule Osnabrück').has('osnabrück')).toBe(true);
    expect(traegerTokens('Hochschule Stralsund').has('osnabrück')).toBe(false);
  });

  it('macht aus ß ein ss, damit die Schreibweise nicht trennt', () => {
    expect(traegerTokens('Grosse Straße')).toEqual(traegerTokens('Grosse Strasse'));
  });
});

describe('traegerAbgleich — Namensgleichheit', () => {
  it('findet dieselbe Einrichtung über den ganzen Namen', () => {
    const i = index(
      ['16KN073848', 'fzmb GmbH, Forschungszentrum für Medizintechnik und Biotechnologie'],
      ['16KN000001', 'Andere GmbH'],
    );
    const t = traegerAbgleich('fzmb GmbH, Forschungszentrum für Medizintechnik und Biotechnologie', i);
    expect(t.get('16KN073848')).toBe('gleich');
    expect(t.has('16KN000001')).toBe(false);
  });

  it('findet auch die grossen Häuser, deren Name nur aus häufigen Wörtern besteht', () => {
    // Der Fehler, den dieser Test festhält: eine Regel über die Token-SELTENHEIT
    // verlor „Technische Universität Chemnitz" komplett — kein Bestandteil des
    // Namens liegt unter df=94, obwohl das Haus 88 Vorhaben im Bereich führt.
    const i = index(
      ['A', 'Technische Universität Chemnitz'],
      ['B', 'Technische Universität Dresden'],
    );
    const t = traegerAbgleich('Technische Universität Chemnitz', i);
    expect(t.get('A')).toBe('gleich');
    expect(t.has('B')).toBe(false);
  });

  it('lässt einen leeren Trägernamen NICHTS treffen, nicht alles', () => {
    const i = index(['A', 'Irgendwer GmbH']);
    expect(traegerAbgleich('', i).size).toBe(0);
    expect(traegerAbgleich('   ', i).size).toBe(0);
  });
});

describe('traegerAbgleich — die gehärtete Enthaltung', () => {
  it('erkennt denselben Träger, anders ausgeschrieben', () => {
    const i = index(['16KN120201', 'ZENIT Zentrum für Innovation und Technik']);
    expect(traegerAbgleich('ZENIT GmbH', i).get('16KN120201')).toBe('enthalten');
  });

  it('fällt NICHT auf ein häufiges Wort herein, das zufällig steckenbleibt', () => {
    // Beide Fälle sind echt: ohne Härtung galt „H&F-Engineering GmbH" als
    // Hasso-Plattner-Institut und „ZM-I München GmbH" als Universität der
    // Bundeswehr München.
    //
    // Die 40 sind eine FESTE Zahl, keine aus `ENTHALTUNG_MAX_DF` abgeleitete.
    // Abgeleitet wüchse die Fixture mit der Konstante mit — der Test bliebe
    // grün, egal welchen Wert sie trägt, und hielte damit nichts (einmal
    // passiert, 23.08.2026).
    const viele: Array<[string, string]> = Array.from(
      { length: 40 },
      (_, n) => [`E${n}`, `Firma${n} Engineering GmbH`],
    );
    const i = index(['HPI', 'Hasso-Plattner-Institut für Digital Engineering'], ...viele);
    expect(traegerAbgleich('H&F-Engineering GmbH', i).has('HPI')).toBe(false);
  });

  it('hält die Härtungs-Schwelle klein genug, dass 40 Häuser sie reissen', () => {
    // Der Gegenpol zum Test darüber: er allein liesse sich mit einer riesigen
    // Schwelle aushebeln, wenn die Fixture mitwüchse. Hier steht die Zahl selbst.
    expect(ENTHALTUNG_MAX_DF).toBeLessThan(40);
    expect(ENTHALTUNG_MAX_DF).toBeGreaterThanOrEqual(7); // `zenit` trägt 7 und MUSS durch
  });

  it('hält „August Friedberg" von „Georg-August-Universität" fern', () => {
    // Die Seltenheits-Regel tat genau das: gemeinsames Token `august` mit df=3.
    // Weder steckt der eine Name im anderen noch sind sie gleich — die
    // Namensregel hat diesen Fall gar nicht erst.
    const i = index(['16KN094227', 'Georg-August-Universität Göttingen']);
    expect(traegerAbgleich('August Friedberg GmbH', i).size).toBe(0);
  });

  it('hält „Hochschule Stralsund" von jeder anderen Hochschule fern', () => {
    const i = index(['A', 'Hochschule Osnabrück'], ['B', 'Hochschule Bremen']);
    expect(traegerAbgleich('Hochschule Stralsund', i).size).toBe(0);
  });
});

describe('die Schwellen tragen ihre Messung', () => {
  it('verlangt für den Träger-Auslöser weniger Nähe als die freie Ähnlichkeit', () => {
    // Der gemeinsame Träger hat den Blick schon gerechtfertigt; die Nähe muss
    // ihn nicht noch einmal allein tragen.
    expect(TRAEGER_NAEHE_SCHWELLE).toBeLessThan(0.52);
  });

  it('liegt über den beiden gemessenen echten Funden nicht drüber', () => {
    // fzmb → VetDx/ZytoVet 0,514 und STFI → InnoTecOP 0,493 müssen auslösen.
    expect(TRAEGER_NAEHE_SCHWELLE).toBeLessThanOrEqual(0.493);
  });
});
