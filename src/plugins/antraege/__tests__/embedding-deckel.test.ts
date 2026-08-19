/**
 * Wen der Deckel der Ähnlichkeitsstufe trifft (v4.113).
 *
 * Gemessen war der Defekt so: über 8 Anfragen gegen 14 065 Vektoren lagen 450
 * Vorhaben über der Schwelle, 297 wurden angewendet — und von den 147 NEUEN
 * fielen 62 weg (42 %). Systematisch, nicht zufällig: neue Treffer lagen im
 * Mittel auf Rang 54,3, schon vorhandene auf 40,8. Wer bei 50 nach Cosine
 * schneidet, schneidet überproportional die einzigen weg, die eine Zeile
 * hinzufügen würden.
 *
 * Ein schon gelisteter Treffer kostet keine Zeile, nur eine Fundstelle — der
 * Deckel schützt die Listenlänge und hat dort nichts zu regeln.
 */
import { describe, it, expect } from 'vitest';
import { searchAntraegeVector } from '../services/antraege-search-service';

const DIM = 768;
const AUS = new AbortController().signal;

/** Vektor, dessen Cosine mit `frage` genau `ziel` ist (Einheitsvektoren). */
function vektorMitCosine(ziel: number): number[] {
  const v = new Array<number>(DIM).fill(0);
  v[0] = ziel;
  v[1] = Math.sqrt(Math.max(0, 1 - ziel * ziel));
  return v;
}

const frage = (() => { const v = new Array<number>(DIM).fill(0); v[0] = 1; return v; })();

/** Korpus mit `n` Vorhaben, Cosine gleichmäßig von `hoch` abwärts. */
function korpus(n: number, hoch = 0.60, tief = 0.52): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const c = hoch - ((hoch - tief) * i) / Math.max(1, n - 1);
    m.set(`AKZ${String(i).padStart(4, '0')}`, vektorMitCosine(c));
  }
  return m;
}

describe('searchAntraegeVector: der Deckel', () => {
  it('meldet die Zahl ueber der Schwelle, nicht die gedeckelte', async () => {
    const r = await searchAntraegeVector(frage, korpus(80), AUS);
    expect(r.ueberSchwelle).toBe(80);
    expect(r.treffer.length).toBe(50);
    expect(r.verworfen).toBe(30);
  });

  it('ohne bekannte Menge bleibt es beim alten Verhalten (Deckel ueber alles)', async () => {
    const r = await searchAntraegeVector(frage, korpus(60), AUS);
    expect(r.treffer.length).toBe(50);
    expect(r.treffer.every(t => t.akz < 'AKZ0050')).toBe(true);
  });

  // Der Kern: 40 der 60 stehen schon in der Liste. Sie kosten keine Zeile, also
  // duerfen sie die 20 neuen nicht verdraengen — vorher blieben von den neuen
  // nur die uebrig, die zufaellig in die besten 50 fielen.
  it('bekannte Treffer verdraengen keine neuen mehr', async () => {
    const k = korpus(60);
    const bekannt = new Set([...k.keys()].slice(0, 40));
    const r = await searchAntraegeVector(frage, k, AUS, bekannt);
    const neu = r.treffer.filter(t => !bekannt.has(t.akz));
    expect(r.ueberSchwelle).toBe(60);
    expect(neu.length).toBe(20);          // ALLE neuen sind dabei
    expect(r.verworfen).toBe(0);
    expect(r.treffer.length).toBe(60);    // bekannte behalten ihre Fundstelle
  });

  it('mehr als 50 neue: gedeckelt wird bei 50, und die Zahl steht dabei', async () => {
    const k = korpus(80);
    const bekannt = new Set([...k.keys()].slice(0, 10));
    const r = await searchAntraegeVector(frage, k, AUS, bekannt);
    const neu = r.treffer.filter(t => !bekannt.has(t.akz));
    expect(neu.length).toBe(50);
    expect(r.verworfen).toBe(20);   // 70 neue, 50 genommen
    expect(r.ueberSchwelle).toBe(80);
  });

  it('gedeckelt werden die schwaechsten neuen, nicht beliebige', async () => {
    const k = korpus(80);
    const bekannt = new Set<string>();
    const r = await searchAntraegeVector(frage, k, AUS, bekannt);
    const min = Math.min(...r.treffer.map(t => t.score));
    const genommen = new Set(r.treffer.map(t => t.akz));
    for (const [akz, vec] of k) {
      if (genommen.has(akz)) continue;
      let d = 0; for (let i = 0; i < DIM; i++) d += frage[i]! * vec[i]!;
      expect(d).toBeLessThanOrEqual(min + 1e-9);
    }
  });

  it('leerer Korpus: nichts behauptet', async () => {
    const r = await searchAntraegeVector(frage, new Map(), AUS);
    expect(r).toEqual({ treffer: [], ueberSchwelle: 0, verworfen: 0 });
  });

  // Garbage-Schutz: liegt selbst die beste Cosine unter dem Floor, schweigt die
  // Stufe. Am echten Bestand gemessen trennt 0,35 sauber — Unsinn-Anfragen
  // erreichten hoechstens 0,339, echte Fachanfragen mindestens 0,369.
  it('alles unter dem Floor: kein Treffer, keine Zahl', async () => {
    const r = await searchAntraegeVector(frage, korpus(30, 0.30, 0.10), AUS);
    expect(r.ueberSchwelle).toBe(0);
    expect(r.treffer).toEqual([]);
  });
});
