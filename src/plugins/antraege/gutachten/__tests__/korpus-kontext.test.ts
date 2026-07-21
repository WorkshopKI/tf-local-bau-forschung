/**
 * Die tragenden Invarianten der Korpus-Umstellung. Sie schützen zwei Dinge, die
 * stillschweigend brechen können — ohne Fehler, nur mit falschem Prompt:
 *
 *  1. Bei leerer Auswahl muss der Korpus BYTE-IDENTISCH zur VB sein, sonst
 *     invalidiert die Umstellung die Relevanz-Map-Caches aller Bestands-Verbünde.
 *  2. Die Heading-Spans, die `getOrComputeRelevanzMap` berechnet, werden später von
 *     `assembleVbRelevant` zum Slicen benutzt. Beide MÜSSEN dieselbe Zeichenkette
 *     sehen — Compute auf Korpus + Assemble auf VB liefert falsch geschnittenen Text.
 */
import { describe, it, expect } from 'vitest';
import { baueKorpus, misseKorpus, type KorpusDok } from '../../dokumentKorpus';
import { parseVbHeadings, assembleVbRelevant, vbBrauchtRelevanzMap } from '../relevanz-map';
import { hashText } from '../runner';

const vb: KorpusDok = {
  name: 'Vorhabensbeschreibung.pdf',
  markdown: [
    '## 1 Ausgangslage',
    'Der Stand der Technik ist unzureichend.',
    '',
    '## 2 Ziele',
    'Wir wollen einen Demonstrator bauen.',
    '',
    '## 3 Arbeitsplan',
    'AP1 bis AP4 in 24 Monaten.',
  ].join('\n'),
};

const extras: KorpusDok[] = [
  { name: 'Markteinfuehrungskonzept.pdf', markdown: '## Markt\nDer Zielmarkt wächst.' },
  { name: 'Wirkung.pdf', markdown: '## Wirkung\nCO2-Einsparung von 12 %.' },
];

describe('Byte-Identität bei leerer Auswahl', () => {
  it('Korpus === VB, Zeichen für Zeichen', () => {
    expect(baueKorpus(vb, [])).toBe(vb.markdown);
  });

  it('gleicher hashText ⇒ bestehende Relevanz-Map-Caches bleiben gültig', () => {
    expect(hashText(baueKorpus(vb, []))).toBe(hashText(vb.markdown));
  });

  it('nicht-leere Auswahl ⇒ anderer Hash (Cache wird korrekt neu berechnet)', () => {
    expect(hashText(baueKorpus(vb, extras))).not.toBe(hashText(vb.markdown));
  });

  it('die Schwellenprüfung sieht den Korpus, nicht nur die VB', () => {
    const grossesExtra: KorpusDok = { name: 'gross.pdf', markdown: 'x'.repeat(30_000) };
    expect(vbBrauchtRelevanzMap(vb.markdown)).toBe(false);
    expect(vbBrauchtRelevanzMap(baueKorpus(vb, [grossesExtra]))).toBe(true);
  });
});

describe('Heading-Spans über den Korpus', () => {
  it('VB-Headings behalten id UND span, weil die VB der Präfix ist', () => {
    const nurVb = parseVbHeadings(vb.markdown);
    const imKorpus = parseVbHeadings(baueKorpus(vb, extras));
    for (const h of nurVb) {
      const gleich = imKorpus.find(k => k.id === h.id);
      expect(gleich).toBeDefined();
      expect(gleich!.heading).toBe(h.heading);
      expect(gleich!.start).toBe(h.start);
      // Das letzte VB-Heading endet im Korpus früher — dort beginnt das erste Extra.
      if (h.id !== nurVb[nurVb.length - 1]!.id) expect(gleich!.end).toBe(h.end);
    }
  });

  it('die Quellenmarkierung wird eine eigene Sektion (## matcht den Heading-Regex)', () => {
    const headings = parseVbHeadings(baueKorpus(vb, extras));
    expect(headings.map(h => h.heading)).toContain('[Quelle: Markteinfuehrungskonzept.pdf]');
    expect(headings.map(h => h.heading)).toContain('[Quelle: Wirkung.pdf]');
  });

  it('Zusatzdokumente hängen HINTER der VB — kein VB-Heading verschiebt sich', () => {
    const nurVb = parseVbHeadings(vb.markdown);
    const imKorpus = parseVbHeadings(baueKorpus(vb, extras));
    expect(imKorpus.length).toBeGreaterThan(nurVb.length);
    expect(imKorpus.slice(0, nurVb.length).map(h => h.id)).toEqual(nurVb.map(h => h.id));
  });
});

describe('assembleVbRelevant über den Korpus (verankert die Compute/Assemble-Kopplung)', () => {
  const korpus = baueKorpus(vb, extras);
  const headings = parseVbHeadings(korpus);

  it('sliced wortgetreu aus DEM STRING, aus dem die Spans stammen', () => {
    const ziel = headings.find(h => h.heading === '2 Ziele')!;
    const block = assembleVbRelevant({ B: [ziel.id] }, headings, korpus, 'B', 10_000);
    expect(block).toContain('## 2 Ziele');
    expect(block).toContain('Wir wollen einen Demonstrator bauen.');
    expect(block).not.toContain('Ausgangslage');
  });

  it('kann eine Sektion aus einem Zusatzdokument liefern', () => {
    const wirkung = headings.find(h => h.heading === 'Wirkung')!;
    const block = assembleVbRelevant({ D: [wirkung.id] }, headings, korpus, 'D', 10_000);
    expect(block).toContain('CO2-Einsparung von 12 %.');
  });

  it('Spans aus dem Korpus gegen die VB geslicet ⇒ FALSCHER Text (der Fehler, den Test 1 verhindert)', () => {
    // Dieser Test dokumentiert die Kopplung: wer nur einen der drei Aufrufe umstellt,
    // bekommt keinen Fehler — nur stillschweigend den falschen Ausschnitt.
    const wirkung = headings.find(h => h.heading === 'Wirkung')!;
    const falsch = assembleVbRelevant({ D: [wirkung.id] }, headings, vb.markdown, 'D', 10_000);
    expect(falsch).not.toContain('CO2-Einsparung');
  });
});

describe('misseKorpus', () => {
  it('schlägt an, wo jedes Einzeldokument für sich unter dem Cap liegt', () => {
    const a: KorpusDok = { name: 'a', markdown: 'x'.repeat(600) };
    const b: KorpusDok = { name: 'b', markdown: 'y'.repeat(600) };
    const cap = 1000;
    expect(misseKorpus(a.markdown, cap).ueberCap).toBe(false);
    expect(misseKorpus(b.markdown, cap).ueberCap).toBe(false);
    expect(misseKorpus(baueKorpus(a, [b]), cap).ueberCap).toBe(true);
  });

  it('meldet die tatsächliche Zeichenzahl des Korpus', () => {
    const korpus = baueKorpus(vb, extras);
    expect(misseKorpus(korpus, 999_999).zeichen).toBe(korpus.length);
  });
});
