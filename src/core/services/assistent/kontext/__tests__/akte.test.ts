/**
 * Die Vorgangsakte als Text. Zwei Zusagen stehen im Vordergrund: leere Signale
 * erzeugen KEINE Zeile (ein „keine Angabe" gäbe das Modell weiter), und der
 * Verlauf sagt, worauf er beruht — je Kürzel nur das zuletzt gesetzte Datum.
 */
import { describe, expect, it } from 'vitest';
import { akteZeilen, AKTE_MAX_TERMINE, type VorgangsAkte } from '../akte';

const leer: VorgangsAkte = { fuer: 'V1', aufgaben: [], offenePaare: [], teilvorhaben: [] };

describe('akteZeilen', () => {
  it('eine leere Akte ergibt keine einzige Zeile', () => {
    expect(akteZeilen(leer)).toEqual([]);
  });

  it('nennt Aufgaben mit Adresse, TV-Anteil und Herkunft', () => {
    const text = akteZeilen({
      ...leer,
      aufgaben: [
        { rolle: 'AB', text: 'GA schreiben', adresse: 'liegt bei AB', anteil: '2 von 3 TV', abgeleitet: false },
        { rolle: 'FB', text: 'in QS', adresse: 'wartet auf QS', abgeleitet: true },
      ],
    }).join('\n');
    expect(text).toContain('- AB: GA schreiben (liegt bei AB; 2 von 3 TV)');
    expect(text).toContain('- FB: in QS (wartet auf QS; abgeleitet aus der Regel einer anderen Rolle)');
  });

  it('sagt beim Verlauf, worauf er beruht, und kappt auf die jüngsten Termine', () => {
    const n = AKTE_MAX_TERMINE + 5;
    const termine = Array.from({ length: n }, (_, i) => ({
      tag: '01.01.2026', label: `T${i}`, rollen: 'AB', traeger: 'Verbund',
    }));
    const text = akteZeilen({
      ...leer,
      verlauf: { von: '01.01.2026', bis: '09.01.2026', schritte: n, datumsangaben: n, nichtGesetzt: 2, termine },
    }).join('\n');
    expect(text).toContain('je Kürzel steht nur das zuletzt gesetzte Datum');
    expect(text).toContain('2 fehlende Kürzel-Angaben');
    expect(text).toContain(`die jüngsten ${AKTE_MAX_TERMINE} von ${n}`);
    expect(text).not.toContain(' T0 —');
    expect(text).toContain(` T${n - 1} —`);
  });

  it('zählt die Zuweisung, ohne jemanden zu nennen', () => {
    expect(akteZeilen({ ...leer, zuweisung: { ab: 2, fb: 1, von: 3 } }))
      .toContain('Zuweisung: AB in 2 von 3, FB in 1 von 3 Teilvorhaben besetzt');
  });

  it('nennt eine überschrittene Gesamtfrist als überschritten, nicht als negative Restzeit', () => {
    const text = akteZeilen({
      ...leer,
      meilensteine: { prognose: 'nicht haltbar', restTage: -5, fristDatum: '01.02.2026', gerissen: ['1.4 Gutachten — Soll 03.01.2026, 40 Tage über'], faellig: [] },
    }).join('\n');
    expect(text).toContain('Prognose nicht haltbar, Gesamtfrist seit 5 Tagen überschritten (01.02.2026)');
    expect(text).toContain('- gerissen: 1.4 Gutachten');
    expect(text).not.toContain('-5');
  });
});
