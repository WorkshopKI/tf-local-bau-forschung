import { describe, it, expect } from 'vitest';
import type { VbSektion } from '../gliederung';
import {
  PRUEF_ASPEKTE, buildAspektePrompt, parseAspektMapping, berechneSubstanz,
  sektionZuAspekte, ermittleOhneAspekt, fehlendeAlsKandidaten, type AspektMapping,
} from '../aspekte';

function sektion(id: string, nummer: string | undefined, titel: string, ebene: 1 | 2 | 3, start: number, end: number): VbSektion {
  return { id, nummer, titel, ebene, start, end, quelle: 'heading' };
}

const GLIEDERUNG: VbSektion[] = [
  sektion('s-toc', undefined, 'Inhaltsverzeichnis', 1, 0, 100),
  sektion('k-1', '1', 'Ausgangssituation', 1, 100, 2000),
  sektion('k-3', '3', 'Technische Funktionalitäten', 1, 2000, 2100),
  sektion('k-3.1', '3.1', 'Kernfunktionen', 2, 2100, 4000),
  sektion('k-3.2', '3.2', 'Erweiterte Funktionen', 2, 4000, 4200),
  sektion('k-5', '5', 'Wirtschaftliche Risiken', 1, 4200, 4500),
];
const SEKTION_IDS = GLIEDERUNG.map(s => s.id);

describe('PRUEF_ASPEKTE', () => {
  it('umfasst genau A–J mit Name + Fokus', () => {
    expect(PRUEF_ASPEKTE.map(a => a.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    expect(PRUEF_ASPEKTE.every(a => a.name.length > 0 && a.fokus.length > 0)).toBe(true);
  });
});

describe('buildAspektePrompt', () => {
  it('listet Sektionen (ohne s-toc) + alle Aspekte + den VB-Volltext', () => {
    const prompt = buildAspektePrompt(GLIEDERUNG, 'VOLLER VB TEXT');
    expect(prompt).toContain('[k-1] 1 Ausgangssituation');
    expect(prompt).toContain('[k-3.1] 3.1 Kernfunktionen');
    expect(prompt).not.toContain('[s-toc]');
    expect(prompt).toContain('A: Ausgangssituation & Marktbedarf');
    expect(prompt).toContain('VOLLER VB TEXT');
    expect(prompt).toContain('A-fehlt:');
  });
});

describe('parseAspektMapping', () => {
  it('parst Zuordnung + Fehlt, verwirft unbekannte IDs, dedupliziert', () => {
    const raw = [
      'A: k-1, k-1, unbekannt-99',
      'C: k-3, k-3.1, k-3.2',
      'A-fehlt: Preisvorstellungen für Zielmärkte',
      'X: k-1', // unbekannter Aspekt → ignoriert
    ].join('\n');
    const m = parseAspektMapping(raw, SEKTION_IDS);
    expect(m.zuordnung['A']).toEqual(['k-1']);
    expect(m.zuordnung['C']).toEqual(['k-3', 'k-3.1', 'k-3.2']);
    expect(m.zuordnung['X']).toBeUndefined();
    expect(m.fehlend['A']).toEqual(['Preisvorstellungen für Zielmärkte']);
  });

  it('tolerant gegen Bullets/Deko und I/J-Doppelbuchstaben', () => {
    const raw = [
      '- **A**: k-1',
      'I/J: k-5',
    ].join('\n');
    const m = parseAspektMapping(raw, SEKTION_IDS);
    expect(m.zuordnung['A']).toEqual(['k-1']);
    expect(m.zuordnung['I']).toEqual(['k-5']);
    expect(m.zuordnung['J']).toEqual(['k-5']);
  });

  it('leeres/Müll-Ergebnis → leere Maps, kein Throw', () => {
    const m = parseAspektMapping('nur Prosa ohne Struktur', SEKTION_IDS);
    expect(m.zuordnung).toEqual({});
    expect(m.fehlend).toEqual({});
  });
});

describe('berechneSubstanz', () => {
  it('Anteil = zugeordnete Zeichen ÷ Gesamt (ohne s-toc); dünn unter Schwelle', () => {
    // Gesamt ohne s-toc = 1900 + 100 + 1900 + 200 + 300 = 4400.
    const mapping: AspektMapping = { zuordnung: { A: ['k-1'], C: ['k-3', 'k-3.2'] }, fehlend: {} };
    const sub = berechneSubstanz(mapping, GLIEDERUNG);
    const a = sub.find(s => s.aspektId === 'A')!;
    expect(a.zeichen).toBe(1900);           // k-1: 2000-100
    expect(a.anteil).toBeCloseTo(1900 / 4400, 5);
    expect(a.duenn).toBe(false);            // 1900 ≥ 1200 und Anteil ≥ 3 %
    const c = sub.find(s => s.aspektId === 'C')!;
    expect(c.zeichen).toBe(300);            // k-3 (100) + k-3.2 (200)
    expect(c.duenn).toBe(true);             // 300 < 1200 → dünn
    // Aspekt ohne Zuordnung ist NICHT „dünn" (eigener Zustand).
    expect(sub.find(s => s.aspektId === 'B')!.duenn).toBe(false);
    expect(sub.find(s => s.aspektId === 'B')!.sektionIds).toEqual([]);
  });
});

describe('sektionZuAspekte', () => {
  it('invertiert die Zuordnung (Sektion → Aspekte, A…J-stabil)', () => {
    const mapping: AspektMapping = { zuordnung: { C: ['k-3'], D: ['k-3'] }, fehlend: {} };
    expect(sektionZuAspekte(mapping)['k-3']).toEqual(['C', 'D']);
  });
});

describe('ermittleOhneAspekt', () => {
  it('Ebene-1-Sektion ohne eigene/Kind-Zuordnung = ohne Aspekt; s-intro/s-toc aus', () => {
    // k-3 ist nicht direkt zugeordnet, aber k-3.1 (Kind) ist → k-3 NICHT ohne Aspekt.
    const mapping: AspektMapping = { zuordnung: { C: ['k-3.1'], A: ['k-1'] }, fehlend: {} };
    const ohne = ermittleOhneAspekt(mapping, GLIEDERUNG).map(s => s.id);
    expect(ohne).toContain('k-5');       // 5 Wirtschaftliche Risiken — keine Zuordnung
    expect(ohne).not.toContain('k-3');   // hat zugeordnetes Kind
    expect(ohne).not.toContain('k-1');   // direkt zugeordnet
    expect(ohne).not.toContain('k-3.1'); // Ebene 2, nicht Ebene 1
  });
});

describe('fehlendeAlsKandidaten', () => {
  it('bildet stabile aspekt-fehlt-Keys', () => {
    const mapping: AspektMapping = { zuordnung: {}, fehlend: { I: ['Preisvorstellungen für Zielmärkte nicht genannt'] } };
    const k = fehlendeAlsKandidaten(mapping);
    expect(k).toHaveLength(1);
    expect(k[0]!.aspektId).toBe('I');
    expect(k[0]!.key).toMatch(/^aspekt-fehlt:I:/);
    // stabil bei gleichem Text:
    expect(fehlendeAlsKandidaten(mapping)[0]!.key).toBe(k[0]!.key);
  });
});
