import { describe, it, expect } from 'vitest';
import {
  berechneRelevanz,
  relevanzAusAehnlichkeit,
  nurUeberAehnlichkeit,
  relevanzStufe,
  sortiereFelder,
  zaehleVorkommen,
  TREFFERFELD_LABEL,
  RELEVANZ_LABEL,
  type Trefferfeld,
} from '../trefferstelle';

describe('berechneRelevanz', () => {
  it('ohne Fundstelle keine Relevanz', () => {
    expect(berechneRelevanz([], 1)).toBe(0);
  });

  it('Titel wiegt schwerer als Kurzbeschreibung, die schwerer als die Einrichtung', () => {
    const titel = berechneRelevanz(['titel'], 1);
    const kurz = berechneRelevanz(['kurzbeschreibung'], 1);
    const org = berechneRelevanz(['organisation'], 1);
    expect(titel).toBeGreaterThan(kurz);
    expect(kurz).toBeGreaterThan(org);
  });

  it('mehr Fundstellen heben die Relevanz', () => {
    const nurTitel = berechneRelevanz(['titel'], 1);
    const titelUndText = berechneRelevanz(['titel', 'kurzbeschreibung'], 1);
    expect(titelUndText).toBeGreaterThan(nurTitel);
  });

  it('Breite ist gesättigt — die vierte Fundstelle hebt nicht mehr', () => {
    const drei = berechneRelevanz(['titel', 'kurzbeschreibung', 'dokument'], 1);
    const vier = berechneRelevanz(['titel', 'kurzbeschreibung', 'dokument', 'deskriptoren'], 1);
    expect(vier).toBe(drei);
  });

  it('halbe Wort-Abdeckung halbiert die Relevanz (ODER-Fall)', () => {
    const voll = berechneRelevanz(['titel'], 1);
    const halb = berechneRelevanz(['titel'], 0.5);
    expect(halb).toBeCloseTo(voll / 2, 10);
  });

  it('bleibt in 0..1, auch bei unsinniger Abdeckung', () => {
    expect(berechneRelevanz(['titel', 'akronym'], 5)).toBeLessThanOrEqual(1);
    expect(berechneRelevanz(['titel'], -3)).toBe(0);
    expect(berechneRelevanz(['titel'], Number.NaN)).toBe(0);
  });

  it('eine Menge wird nur einmal gezählt (Set als Eingabe)', () => {
    const set = new Set<Trefferfeld>(['titel', 'titel' as Trefferfeld]);
    expect(berechneRelevanz(set, 1)).toBe(berechneRelevanz(['titel'], 1));
  });
});

describe('relevanzAusAehnlichkeit', () => {
  it('bleibt immer unter einem wörtlichen Titeltreffer — Wortlaut schlägt Bedeutung', () => {
    const besteAehnlichkeit = relevanzAusAehnlichkeit(1);
    expect(besteAehnlichkeit).toBeLessThan(berechneRelevanz(['titel'], 1));
  });

  it('erreicht nie die Stufe „hoch"', () => {
    expect(relevanzStufe(relevanzAusAehnlichkeit(1))).toBeLessThan(3);
  });

  it('höhere Cosine, höhere Relevanz', () => {
    expect(relevanzAusAehnlichkeit(0.9)).toBeGreaterThan(relevanzAusAehnlichkeit(0.4));
  });
});

describe('relevanzStufe', () => {
  it('bildet die drei Stufen monoton ab', () => {
    expect(relevanzStufe(1)).toBe(3);
    expect(relevanzStufe(0.5)).toBe(2);
    expect(relevanzStufe(0.1)).toBe(1);
    expect(relevanzStufe(0)).toBe(1);
  });

  it('Regressionsgatter: die Fundstellen erzeugen tatsächlich VERSCHIEDENE Stufen', () => {
    // Der Defekt, den dieses Modul behebt: bis v4.4.4 bekam jeder Wortlaut-
    // Treffer den festen Score 1.0 — alle Zeilen gleich, Sortierung wirkungslos.
    const faelle: Trefferfeld[][] = [
      ['titel'],
      ['kurzbeschreibung'],
      ['organisation'],
    ];
    const stufen = new Set(faelle.map(f => relevanzStufe(berechneRelevanz(f, 1))));
    expect(stufen.size).toBeGreaterThan(1);
  });
});

describe('sortiereFelder', () => {
  it('stellt die stärkste Fundstelle voran, unabhängig von der Eingabereihenfolge', () => {
    expect(sortiereFelder(['organisation', 'titel'])).toEqual(['titel', 'organisation']);
    expect(sortiereFelder(['titel', 'organisation'])).toEqual(['titel', 'organisation']);
  });

  it('entdoppelt', () => {
    expect(sortiereFelder(['titel', 'titel'])).toEqual(['titel']);
  });

  it('jedes Feld hat eine Beschriftung', () => {
    for (const f of sortiereFelder(Object.keys(TREFFERFELD_LABEL) as Trefferfeld[])) {
      expect(TREFFERFELD_LABEL[f].length).toBeGreaterThan(0);
    }
  });

  it('sortiereFelder kennt JEDES Feld — sonst verschwindet ein Tag lautlos', () => {
    const alle = Object.keys(TREFFERFELD_LABEL) as Trefferfeld[];
    expect(sortiereFelder(alle)).toHaveLength(alle.length);
  });
});

describe('zaehleVorkommen', () => {
  it('zählt überlappungsfrei und ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(zaehleVorkommen('Normen und normen', ['normen'])).toBe(2);
  });

  it('zählt mehrere Wörter zusammen', () => {
    expect(zaehleVorkommen('Laser und Schweissen mit Laser', ['laser', 'schweissen'])).toBe(3);
  });

  it('leeres Wort und leerer Text zählen nicht', () => {
    expect(zaehleVorkommen('', ['laser'])).toBe(0);
    expect(zaehleVorkommen('laser', [''])).toBe(0);
  });

  it('findet auch Wortbestandteile — dieselbe Regel wie die Suche selbst', () => {
    expect(zaehleVorkommen('Laserquelle', ['laser'])).toBe(1);
  });
});

describe('RELEVANZ_LABEL', () => {
  it('benennt alle drei Stufen', () => {
    expect(RELEVANZ_LABEL[1]).toBe('gering');
    expect(RELEVANZ_LABEL[2]).toBe('mittel');
    expect(RELEVANZ_LABEL[3]).toBe('hoch');
  });
});

describe('nurUeberAehnlichkeit', () => {
  it('trifft genau den Fall „einzige Fundstelle ist die Aehnlichkeit"', () => {
    expect(nurUeberAehnlichkeit(['aehnlichkeit'])).toBe(true);
    expect(nurUeberAehnlichkeit(['aehnlichkeit', 'titel'])).toBe(false);
    expect(nurUeberAehnlichkeit(['titel'])).toBe(false);
  });

  it('haelt eine fehlende oder leere Angabe NICHT fuer Aehnlichkeit', () => {
    // Ein Treffer ohne Fundstellen ist unbekannter Herkunft, nicht geraten:
    // ihn zu den Vorschlaegen zu schieben hiesse, ihn stillschweigend abzuwerten.
    expect(nurUeberAehnlichkeit(undefined)).toBe(false);
    expect(nurUeberAehnlichkeit([])).toBe(false);
  });
});
