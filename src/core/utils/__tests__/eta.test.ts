/**
 * Restzeit aus einem gleitenden Fenster — und warum das Gesamtmittel nicht reicht.
 *
 * Am Korpus-Bau sagte die alte Rechnung (`elapsed / done × Rest`) zu Beginn
 * „25 min" für einen Lauf, dessen laufende Phase in Minuten fertig war: die
 * ersten Sekunden sind Warmlauf, und Datensätze ohne Text rauschen in
 * Millisekunden durch. Ein Fenster vergisst beides wieder.
 */
import { describe, it, expect } from 'vitest';
import {
  computeEtaMsFromSamples, computeEtaFromSamples, type ThroughputSample,
} from '../eta';

/** Messpunkte mit fester Schrittweite, beginnend bei t=0. */
function reihe(schritte: Array<{ dauerMs: number; items: number }>): ThroughputSample[] {
  const out: ThroughputSample[] = [{ t: 0, processed: 0 }];
  let t = 0;
  let processed = 0;
  for (const s of schritte) {
    for (let i = 0; i < s.items; i++) {
      t += s.dauerMs;
      processed += 1;
      out.push({ t, processed });
    }
  }
  return out;
}

describe('computeEtaMsFromSamples', () => {
  it('rechnet mit dem AKTUELLEN Tempo, nicht mit dem Mittel seit Beginn', () => {
    // 10 zähe Items à 500 ms (Warmlauf), danach 200 schnelle à 20 ms. Genau der
    // Fall, der „25 min" für einen Lauf von Minuten erzeugt hat.
    const alle = reihe([{ dauerMs: 500, items: 10 }, { dauerMs: 20, items: 200 }]);
    const ende = (alle[alle.length - 1] as ThroughputSample).t;

    // Das Fenster: die letzten 15 s — hier also alles ab t > ende − 15.000.
    const fenster = alle.filter(s => s.t >= ende - 15_000 && s.t >= 5_000);
    const ausFenster = computeEtaMsFromSamples(fenster, 310) as number;

    // 100 offene Items. Mit dem aktuellen Tempo ~2 s; das Gesamtmittel
    // (9.000 ms / 210 ≈ 43 ms) behauptete mehr als das Doppelte.
    const gesamtMittel = (ende / 210) * 100;
    expect(ausFenster).toBeCloseTo(100 * 20, -2);
    expect(ausFenster).toBeLessThan(gesamtMittel / 2);
  });

  it('liefert auch bei schnellem Durchsatz eine Schätzung, wenn das Fenster über die ZEIT begrenzt ist', () => {
    // Der Grund, warum das Fenster im Korpus-Bau nach Zeit und nicht nach
    // Anzahl beschnitten wird: 40 Punkte à 20 ms spannen 0,8 s und blieben unter
    // der Konfidenz-Schwelle — es gäbe nie eine Restzeit.
    const schnell = reihe([{ dauerMs: 20, items: 200 }]);
    expect(computeEtaMsFromSamples(schnell.slice(-40), 400)).toBeNull();
    expect(computeEtaMsFromSamples(schnell, 400)).toBeCloseTo(200 * 20, -2);
  });

  it('schweigt, solange das Fenster zu kurz oder zu dünn ist', () => {
    expect(computeEtaMsFromSamples([{ t: 0, processed: 0 }], 100)).toBeNull();
    // drei Punkte, aber nur 300 ms Spanne → unter `minWindowMs`
    const kurz = reihe([{ dauerMs: 100, items: 3 }]);
    expect(computeEtaMsFromSamples(kurz, 100)).toBeNull();
  });

  it('schweigt, wenn nichts mehr offen ist oder nichts vorangeht', () => {
    const voll = reihe([{ dauerMs: 100, items: 30 }]);
    expect(computeEtaMsFromSamples(voll, 30)).toBeNull();

    const stillstand: ThroughputSample[] = [
      { t: 0, processed: 5 }, { t: 3000, processed: 5 }, { t: 6000, processed: 5 },
    ];
    expect(computeEtaMsFromSamples(stillstand, 100)).toBeNull();
  });

  it('trägt weiterhin die formatierte Fassung — eine Rechnung, zwei Ausgaben', () => {
    const s = reihe([{ dauerMs: 100, items: 30 }]);
    const ms = computeEtaMsFromSamples(s, 60) as number;
    expect(ms).toBeCloseTo(30 * 100, -1);
    expect(computeEtaFromSamples(s, 60)).toBe('~3s verbleibend');
    expect(computeEtaFromSamples(s, 30)).toBeNull();
  });
});
