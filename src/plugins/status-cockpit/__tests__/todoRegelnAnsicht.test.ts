/**
 * Das Ansichts-Modell des Regeln-Tabs: welche Regeln ein Regelsatz zeigt, welche
 * davon geöffnet ist und in welchem Zustand sie steht.
 *
 * Der Kern ist Pitfall #47: `regelsatz` fehlend heißt AB, `giltFuer` an einer
 * Sperre fehlend heißt ALLE — gegenläufig zu `zustaendig`. Eine Sperre, die aus
 * einem fremden Satz verschwände, nähme dort die Begründung mit, warum ein
 * Vorgang stumm bleibt.
 */
import { describe, it, expect } from 'vitest';
import type { Rolle, TodoRegel } from '@/core/status';
import {
  bekannteStraenge, brauchtRolloutRueckfrage, driftSatz, fehltStrangTrotzSperre,
  kaskadenPositionen, positionsText, seedBilanz, sichtbareRegeln, sperrSatz, strangLabel,
  todoRegelIdAusPlatzhalter, waehleRegel, wirkungsAnzeige, zustandsMarker,
} from '../todoRegelnAnsicht';

const regel = (p: Partial<TodoRegel> & { id: string; reihenfolge: number }): TodoRegel => ({
  beschreibung: p.id, bedingung: { feldId: 'status', op: 'gefuellt' },
  todo: 'etwas tun', zustaendig: [], aktiv: true, ...p,
});

const AB1 = regel({ id: 'r1', reihenfolge: 20 });
const AB2 = regel({ id: 'r2', reihenfolge: 10 });
const FB1 = regel({ id: 'f1', reihenfolge: 30, regelsatz: 'fb' });
const SPERRE_ALLE = regel({ id: 's0', reihenfolge: 5, sperrt: ['*'], todo: '' });
const SPERRE_FB = regel({ id: 's9', reihenfolge: 6, sperrt: ['*'], giltFuer: ['fb'], todo: '' });

describe('sichtbareRegeln', () => {
  it('rechnet eine Regel ohne regelsatz dem AB-Satz zu', () => {
    expect(sichtbareRegeln([AB1, FB1], 'ab').map(r => r.id)).toEqual(['r1']);
    expect(sichtbareRegeln([AB1, FB1], 'fb').map(r => r.id)).toEqual(['f1']);
  });

  it('zeigt eine Sperre ohne giltFuer in JEDEM Satz', () => {
    for (const satz of ['ab', 'fb', 'qs'] as Rolle[]) {
      expect(sichtbareRegeln([SPERRE_ALLE], satz).map(r => r.id), satz).toEqual(['s0']);
    }
  });

  it('beschränkt eine Sperre mit giltFuer auf die genannten Sätze', () => {
    expect(sichtbareRegeln([SPERRE_FB], 'fb').map(r => r.id)).toEqual(['s9']);
    expect(sichtbareRegeln([SPERRE_FB], 'ab')).toEqual([]);
  });

  it('sortiert nach reihenfolge, nicht nach Array-Position', () => {
    expect(sichtbareRegeln([AB1, SPERRE_ALLE, AB2], 'ab').map(r => r.id)).toEqual(['s0', 'r2', 'r1']);
  });
});

describe('waehleRegel', () => {
  const regeln = sichtbareRegeln([AB1, SPERRE_ALLE, AB2], 'ab'); // s0, r2, r1

  it('liefert null ohne Auswahl und bei unbekannter Id', () => {
    expect(waehleRegel(regeln, null)).toBeNull();
    expect(waehleRegel(regeln, 'gibt-es-nicht'), 'verworfener Entwurf schließt das Detail').toBeNull();
  });

  it('gibt den Index der SORTIERTEN Liste zurück', () => {
    expect(waehleRegel(regeln, 'r1')).toEqual({ regel: AB1, index: 2, anzahl: 3 });
    expect(waehleRegel(regeln, 's0')?.index).toBe(0);
  });
});

describe('zustandsMarker', () => {
  it('erkennt eine vorgangsweite Sperre im fremden Satz als nicht-eigen', () => {
    const m = zustandsMarker(SPERRE_ALLE, 'fb', []);
    expect(m.istSperre).toBe(true);
    expect(m.eigen, 'verschieben nur im Satz AB').toBe(false);
    expect(m.giltFuerAlle).toBe(true);
  });

  it('nennt dieselbe Sperre im eigenen Satz nicht „gilt für alle"', () => {
    const m = zustandsMarker(SPERRE_ALLE, 'ab', []);
    expect(m.eigen).toBe(true);
    expect(m.giltFuerAlle).toBe(false);
  });

  it('meldet stillgelegt und reicht unbekannte Felder durch', () => {
    const m = zustandsMarker(regel({ id: 'x', reihenfolge: 1, aktiv: false }), 'ab', ['D_FEHLT']);
    expect(m.stillgelegt).toBe(true);
    expect(m.unbekannte).toEqual(['D_FEHLT']);
  });
});

describe('positionsText', () => {
  it('zeigt 1-basiert über 0-basiertem Index', () => {
    expect(positionsText(4, 27)).toBe('Position 5 von 27');
    expect(positionsText(0, 1)).toBe('Position 1 von 1');
  });
});

describe('brauchtRolloutRueckfrage', () => {
  it('fragt nur beim AKTIVIEREN außerhalb des AB-Satzes', () => {
    expect(brauchtRolloutRueckfrage(FB1, true)).toBe(true);
    expect(brauchtRolloutRueckfrage(FB1, false), 'stilllegen ist immer harmlos').toBe(false);
    expect(brauchtRolloutRueckfrage(AB1, true), 'AB wirkt überall gleich').toBe(false);
  });
});

describe('wirkungsAnzeige (was an einer Regel über ihre Wirkung steht)', () => {
  it('ohne Lauf steht NICHTS da — kein Platzhalterstrich', () => {
    // Ein „—" läse sich wie eine gemessene Null. Nicht gemessen ist nicht null.
    expect(wirkungsAnzeige(undefined, false)).toBeNull();
    expect(wirkungsAnzeige(undefined, true)).toBeNull();
  });

  it('sind beide Zahlen gleich, steht nur EINE da', () => {
    const a = wirkungsAnzeige({ gewinnt: 43, trifftZu: 43, greift: 0 }, false);
    expect(a?.kurz).toBe('43 Vorgänge');
    expect(a?.kurz).not.toContain('trifft');
    expect(a?.nullbefund).toBe(false);
  });

  it('bei Kaskadenverlust stehen beide, und der Satz erklärt die Differenz', () => {
    const a = wirkungsAnzeige({ gewinnt: 43, trifftZu: 153, greift: 0 }, false);
    expect(a?.kurz).toBe('trifft 153 · gewinnt 43');
    expect(a?.lang).toContain('110');   // 153 − 43 = die verdeckten Fälle
    expect(a?.lang).toContain('weiter vorn in der Kaskade');
  });

  it('bei genau einem verdeckten Fall steht kein Plural-Satz um eine 1', () => {
    // Am echten Bestand gemessen: die Differenz ist regelmäßig genau eins, und
    // „bei den übrigen 1" fällt im Termin sofort auf.
    const a = wirkungsAnzeige({ gewinnt: 199, trifftZu: 200, greift: 0 }, false);
    expect(a?.lang).toContain('bei einem davon greift');
    expect(a?.lang).not.toContain('übrigen 1 ');
  });

  it('trifft nie zu ⇒ ruhiger Hinweis, kein stiller Nullwert', () => {
    const a = wirkungsAnzeige({ gewinnt: 0, trifftZu: 0, greift: 0 }, false);
    expect(a?.nullbefund).toBe(true);
    expect(a?.lang).toContain('überholt');
  });

  it('eine Sperre bekommt ihre eigene Zahl statt zweier Nullen', () => {
    const a = wirkungsAnzeige({ gewinnt: 0, trifftZu: 0, greift: 862 }, true);
    expect(a?.kurz).toBe('greift 862');
    expect(a?.lang).toContain('Stränge still');
    expect(a?.nullbefund).toBe(false);
  });

  it('eine Sperre, die nie greift, ist ebenfalls ein Befund', () => {
    expect(wirkungsAnzeige({ gewinnt: 0, trifftZu: 0, greift: 0 }, true)?.nullbefund).toBe(true);
  });

  it('Tausendertrennung deutsch, damit die Zahl im Termin lesbar ist', () => {
    expect(wirkungsAnzeige({ gewinnt: 1234, trifftZu: 5678, greift: 0 }, false)?.kurz)
      .toBe('trifft 5.678 · gewinnt 1.234');
  });
});

describe('sperrSatz (was eine Sperre stilllegt, als deutscher Satz)', () => {
  const sperre = (p: Partial<TodoRegel>): TodoRegel =>
    regel({ id: 's', reihenfolge: 1, todo: '', ...p });

  it('der Sentinel legt alles still', () => {
    expect(sperrSatz(sperre({ sperrt: ['*'] }))).toBe('kein To-do mehr');
    expect(sperrSatz(sperre({ sperrt: ['*'], sperrtNicht: ['r3'] }))).toBe('kein To-do mehr — außer r3');
  });

  it('mehrere Stränge stehen als Aufzählung, nicht als Id-Liste', () => {
    expect(sperrSatz(sperre({ sperrt: ['strang:precheck', 'strang:nachforderung'] })))
      .toBe('die Stränge PreCheck und Nachforderung ruhen');
  });

  it('ein einzelner Strang steht im Singular — samt Verb', () => {
    // „der Strang RNE ruhen" war die erste Fassung; das sah man erst im Browser.
    expect(sperrSatz(sperre({ sperrt: ['strang:rne'] }))).toBe('der Strang RNE ruht');
  });

  it('Regel-Ids ohne Strang bekommen kein Zahlwort vor den Artikel', () => {
    // Gemessen im Browser: „7 die Regeln r1, …" — `zaehlwort` gehört nicht vor
    // einen bestimmten Artikel.
    const satz = sperrSatz(sperre({ sperrt: ['r1', 'r2', 'r22'] }));
    expect(satz).toBe('die Regeln r1, r2, r22 ruhen');
    expect(satz).not.toMatch(/^\d/);
    expect(sperrSatz(sperre({ sperrt: ['r22'] }))).toBe('die Regel r22 ruht');
  });

  it('gemischte Listen nennen beides', () => {
    expect(sperrSatz(sperre({ sperrt: ['strang:rne', 'r22'] })))
      .toBe('der Strang RNE und die Regel r22 ruhen');
  });

  it('eine leere Sperr-Liste behauptet keine Wirkung', () => {
    expect(sperrSatz(sperre({ sperrt: [] }))).toBe('nichts wird gesperrt');
  });
});

describe('strangLabel', () => {
  it('gibt den gepflegten Ketten ihre Schreibweise', () => {
    expect(strangLabel('rne')).toBe('RNE');
    expect(strangLabel('zuwb')).toBe('ZuwB');
    expect(strangLabel('precheck')).toBe('PreCheck');
  });

  it('ein selbst vergebener Strang bekommt nur einen Großbuchstaben', () => {
    expect(strangLabel('widerspruch')).toBe('Widerspruch');
  });
});

describe('Strang-Auswahl und die Warnung dazu', () => {
  const MIT_STRANG = regel({ id: 'r1', reihenfolge: 10, strang: 'rne' });
  const OHNE_STRANG = regel({ id: 'r2', reihenfolge: 20 });
  const STRANG_SPERRE = regel({ id: 's1', reihenfolge: 5, todo: '', sperrt: ['strang:rne'] });
  const ID_SPERRE = regel({ id: 's2', reihenfolge: 6, todo: '', sperrt: ['r2'] });

  it('bekannteStraenge nimmt Vorschläge, gepflegte Stränge UND Sperr-Ziele auf', () => {
    const eigen = regel({ id: 'x', reihenfolge: 99, strang: 'widerspruch' });
    const sperre = regel({ id: 'y', reihenfolge: 98, todo: '', sperrt: ['strang:sonderfall'] });
    const alle = bekannteStraenge([eigen, sperre]);
    expect(alle).toContain('widerspruch');
    expect(alle).toContain('sonderfall');
    expect(alle).toContain('rne');
  });

  it('warnt bei fehlendem Strang — aber nur, wo eine Strang-Sperre greift', () => {
    expect(fehltStrangTrotzSperre(OHNE_STRANG, [STRANG_SPERRE, OHNE_STRANG], 'ab')).toBe(true);
    // Ohne Strang-Sperre im Satz wäre der Hinweis Lärm an jeder Regel.
    expect(fehltStrangTrotzSperre(OHNE_STRANG, [ID_SPERRE, OHNE_STRANG], 'ab')).toBe(false);
  });

  it('eine Regel MIT Strang und eine Sperre selbst werden nie gewarnt', () => {
    expect(fehltStrangTrotzSperre(MIT_STRANG, [STRANG_SPERRE, MIT_STRANG], 'ab')).toBe(false);
    expect(fehltStrangTrotzSperre(STRANG_SPERRE, [STRANG_SPERRE], 'ab')).toBe(false);
  });

  it('eine stillgelegte Sperre löst keine Warnung aus', () => {
    const aus = { ...STRANG_SPERRE, aktiv: false };
    expect(fehltStrangTrotzSperre(OHNE_STRANG, [aus, OHNE_STRANG], 'ab')).toBe(false);
  });

  it('eine Sperre, die nur für FB gilt, warnt im AB-Satz nicht', () => {
    const nurFb = { ...STRANG_SPERRE, giltFuer: ['fb' as const] };
    expect(fehltStrangTrotzSperre(OHNE_STRANG, [nurFb, OHNE_STRANG], 'ab')).toBe(false);
    expect(fehltStrangTrotzSperre(OHNE_STRANG, [nurFb, OHNE_STRANG], 'fb')).toBe(true);
  });
});

/**
 * Der Kern von v4.121: **zwei Kaskaden, zwei Nummernkreise.** Am Bild gemessen
 * stand die einzige FB-Regel als „4" zwischen vier AB-Sperren, beide Pfeile
 * aktiv — und ein Klick tat nichts, weil `verschiebeTodoRegel` in der Kaskade
 * des eigenen Satzes rechnet, wo sie erste und letzte zugleich war.
 */
describe('Kaskaden-Position (v4.121)', () => {
  const SPERRE_10 = regel({ id: 's0', reihenfolge: 10, sperrt: ['*'], todo: '' });
  const SPERRE_40 = regel({ id: 's2', reihenfolge: 40, sperrt: ['*'], todo: '' });
  const FB_NEU = regel({ id: 'fb-r2', reihenfolge: 10, regelsatz: 'fb' });
  const alle = [SPERRE_10, FB_NEU, SPERRE_40];

  it('stellt fremde Sperren VOR die eigene Kaskade', () => {
    // Nach `reihenfolge` allein läge die neue FB-Regel (10) zwischen s0 (10) und
    // s2 (40) — auf einem Platz, den niemand gewählt hat und den die Engine
    // nicht kennt: ihr Sperr-Pass ist ein Vollscan ohne Ordnung.
    expect(sichtbareRegeln(alle, 'fb').map(r => r.id)).toEqual(['s0', 's2', 'fb-r2']);
  });

  it('lässt die reine AB-Ansicht unverändert — dort ist alles eigen', () => {
    expect(sichtbareRegeln([AB1, SPERRE_ALLE, AB2], 'ab').map(r => r.id)).toEqual(['s0', 'r2', 'r1']);
  });

  it('gibt fremden Sperren KEINE Position in diesem Satz', () => {
    const p = kaskadenPositionen(sichtbareRegeln(alle, 'fb'), 'fb');
    expect(p.get('s0'), 'die Sperre gehört dem Satz AB').toBeUndefined();
    expect(p.get('fb-r2')).toEqual({ index: 0, anzahl: 1 });
  });

  it('zählt im eigenen Satz durch, unabhängig von der angezeigten Länge', () => {
    const sichtbar = sichtbareRegeln([AB1, AB2, SPERRE_ALLE], 'ab');
    const p = kaskadenPositionen(sichtbar, 'ab');
    expect(p.get('r2')).toEqual({ index: 1, anzahl: 3 });
    expect(p.get('r1')).toEqual({ index: 2, anzahl: 3 });
  });
});

describe('todoRegelIdAusPlatzhalter', () => {
  it('bildet dieselbe Id, die das Anlegen vergibt', () => {
    // Beide Seiten brauchen sie: die eine legt an, die andere muss sehen, dass
    // es die Regel schon gibt — sonst lädt ein zweiter Klick zu einer Aktion
    // ein, die wortlos nichts tut.
    expect(todoRegelIdAusPlatzhalter({ rolle: 'fb', quellRegelId: 'r2' })).toBe('fb-r2');
  });
});

describe('driftSatz', () => {
  const leer = { neu: [], geaendert: [], entfallen: [] };

  it('schweigt, wenn nichts driftet', () => {
    expect(driftSatz(leer)).toBeNull();
  });

  it('dekliniert die Einzahl — „1 neue Regeln" stand bis v4.120 da', () => {
    expect(driftSatz({ ...leer, neu: ['r7'] })).toBe('1 neue Regel (r7)');
    expect(driftSatz({ ...leer, neu: ['r7', 'r8'] })).toBe('2 neue Regeln (r7, r8)');
  });

  it('reiht die drei Sorten in fester Ordnung', () => {
    expect(driftSatz({ neu: ['a'], geaendert: ['b', 'c'], entfallen: ['d'] }))
      .toBe('1 neue Regel (a) · 2 Regeln geändert (b, c) · 1 Regel entfallen (d)');
  });
});

describe('seedBilanz', () => {
  it('zählt Regeln und Sperren, statt sie abzuschreiben', () => {
    const seed = [AB1, AB2, SPERRE_ALLE];
    expect(seedBilanz(seed)).toBe('2 Regeln + 1 Sperre');
    expect(seedBilanz([AB1])).toBe('1 Regel + 0 Sperren');
  });
});
