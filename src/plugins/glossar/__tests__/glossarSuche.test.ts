import { describe, it, expect } from 'vitest';
import { GLOSSAR_BEGRIFFE } from '@/core/glossar';
import {
  ART_REIHENFOLGE, begriffAlsEintrag, gruppiere, gesamtZahl, rang, verwandteIds,
  waehleEintrag,
} from '../glossarSuche';

const ALLE = GLOSSAR_BEGRIFFE.map(begriffAlsEintrag);

describe('Glossar-Seed', () => {
  it('vergibt jede Id genau einmal', () => {
    const ids = GLOSSAR_BEGRIFFE.map(b => b.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('verweist nur auf Eintraege, die es gibt', () => {
    const ids = new Set(GLOSSAR_BEGRIFFE.map(b => b.id));
    const tot = GLOSSAR_BEGRIFFE.flatMap(
      b => (b.verwandt ?? []).filter(v => !ids.has(v)).map(v => `${b.id} → ${v}`),
    );
    expect(tot, `Verweise ins Leere:\n${tot.join('\n')}`).toEqual([]);
  });

  it('fuehrt die Abkuerzungen, die der Auftrag verlangt', () => {
    // Bewusst NICHT dabei (im Repo nirgends ausgeschrieben): TB, MAP, DMS.
    const pflicht = [
      'fkz', 'tv', 'verbund', 'nf', 'nl', 'rne', 'abl', 'sv', 'zuwb', 'vn',
      'precheck', 'ga', 'qs', 'foerdervariante', 'richtlinie', 'meilenstein',
      'zieltage', 'verfahrensschritt', 'arbeitsliste', 'fassung',
      'betrachtungsbereich', 'vorgang',
    ];
    const ids = new Set(GLOSSAR_BEGRIFFE.map(b => b.id));
    expect(pflicht.filter(p => !ids.has(p))).toEqual([]);
  });

  it('erklaert jeden Eintrag in ganzen Saetzen', () => {
    const duenn = GLOSSAR_BEGRIFFE
      .filter(b => b.erklaerung.trim().length < 20 || !b.erklaerung.trim().endsWith('.'))
      .map(b => b.id);
    expect(duenn).toEqual([]);
  });
});

describe('gruppiere', () => {
  it('liefert ohne Suchbegriff alle Eintraege in einer Gruppe', () => {
    const g = gruppiere(ALLE, '');
    expect(g).toHaveLength(1);
    expect(g[0]?.art).toBe('begriff');
    expect(gesamtZahl(g)).toBe(GLOSSAR_BEGRIFFE.length);
  });

  it('laesst leere Gruppen weg statt sie leer zu zeigen', () => {
    expect(gruppiere(ALLE, 'gibtesnicht')).toEqual([]);
  });

  it('sucht auch im Erklaerungstext, nicht nur im Titel', () => {
    const treffer = gruppiere(ALLE, 'zwischenbericht');
    expect(gesamtZahl(treffer)).toBeGreaterThan(0);
    expect(treffer[0]?.eintraege.some(e => e.titel === 'VN')).toBe(true);
  });

  it('stellt den Titel-Treffer vor den Fliesstext-Treffer', () => {
    const treffer = gruppiere(ALLE, 'nf');
    expect(treffer[0]?.eintraege[0]?.titel).toBe('NF');
  });

  it('ignoriert Gross-/Kleinschreibung und Rand-Leerzeichen', () => {
    const a = gruppiere(ALLE, '  ZuwB ');
    const b = gruppiere(ALLE, 'zuwb');
    expect(gesamtZahl(a)).toBe(gesamtZahl(b));
  });

  it('haelt die Gruppen in der festgelegten Reihenfolge', () => {
    const arten = gruppiere(ALLE, '').map(g => g.art);
    const erwartet = ART_REIHENFOLGE.filter(a => arten.includes(a));
    expect(arten).toEqual(erwartet);
  });
});

describe('rang', () => {
  const nf = begriffAlsEintrag(GLOSSAR_BEGRIFFE.find(b => b.id === 'nf')!);

  it('wertet die exakte Uebereinstimmung am hoechsten', () => {
    expect(rang(nf, 'nf')).toBe(0);
  });

  it('wertet einen reinen Fliesstext-Treffer am niedrigsten', () => {
    expect(rang(nf, 'antragsteller')).toBe(3);
  });
});

describe('waehleEintrag', () => {
  it('leitet die Auswahl aus den sichtbaren Gruppen ab', () => {
    const g = gruppiere(ALLE, '');
    expect(waehleEintrag(g, 'begriff:nf')?.titel).toBe('NF');
  });

  it('gibt null, wenn der gewaehlte Eintrag weggefiltert wurde', () => {
    // Genau der Fall „Detail schliesst sich beim Weitertippen von selbst".
    expect(waehleEintrag(gruppiere(ALLE, 'zuwb'), 'begriff:nf')).toBeNull();
  });
});

describe('verwandteIds', () => {
  it('ergaenzt die Gegenrichtung eines einseitig gepflegten Verweises', () => {
    // `fkz` nennt `tv`; `tv` nennt `fkz` NICHT — trotzdem muss der Verweis
    // von beiden Seiten sichtbar sein.
    const tv = GLOSSAR_BEGRIFFE.find(b => b.id === 'tv')!;
    expect(tv.verwandt).not.toContain('fkz');
    expect(verwandteIds(tv, GLOSSAR_BEGRIFFE)).toContain('fkz');
  });

  it('nennt keinen Eintrag doppelt und sich selbst nie', () => {
    for (const b of GLOSSAR_BEGRIFFE) {
      const ids = verwandteIds(b, GLOSSAR_BEGRIFFE);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(b.id);
    }
  });
});
