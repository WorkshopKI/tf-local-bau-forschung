import { describe, it, expect } from 'vitest';
import { baueRun, istVeraltet, toggleOffenerPunkt, befundKey, uebernehmeOffenePunkte } from '../store';

const NOW = '2026-07-09T00:00:00.000Z';

const VB_MD = [
  '# 9 Projektplan',
  'Der Zeitplan sieht wie folgt aus:',
  '',
  '| Arbeitspaket | Monat Beginn | Monat Ende | Dauer (Monate) |',
  '| --- | --- | --- | --- |',
  '| Entwicklung des Prototyps | 3 | 5 | 3 |',
  '',
].join('\n');

const ANLAGE_MD = [
  '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
  '| --- | --- | --- | --- | --- | --- |',
  '| 1 | Konzept | 01.01.2023 | 28.02.2023 | MA01 | 2 |',
  '| 3 | Entwicklung des Prototyps |  |  |  |  |',
  '| 3.1 | Kernfunktionen | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
  '| 3.2 | Erweiterte Funktionen | 16.04.2023 | 30.04.2023 | MA03 | 3 |',
].join('\n');

describe('baueRun', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'projekt.docx' }, { markdown: ANLAGE_MD, name: 'Anlage 5.docx' }, NOW);

  it('stempelt beide Quellen mit Hash + Zeitstempel', () => {
    expect(run.version).toBe(1);
    expect(run.antragKey).toBe('VB-1');
    expect(run.quellen.map(q => q.rolle)).toEqual(['vb', 'anlage5']);
    expect(run.quellen.every(q => q.hash.length > 0 && q.gelesenAm === NOW)).toBe(true);
    expect(run.hinweis).toBeUndefined();
  });

  it('Anlage 5 gewinnt für den angezeigten Zeitplan, herkunft=beide', () => {
    expect(run.zeitplan?.herkunft).toBe('beide');
    expect(run.zeitplan?.zeilen.map(z => z.nummer)).toEqual(['1', '3', '3.1', '3.2']);
  });

  it('erntet Gliederung + Tabellen und verknüpft den Befund mit § 9', () => {
    expect(run.gliederung.some(s => s.id === 'k-9')).toBe(true);
    expect(run.tabellen.map(t => t.rolle)).toEqual(['vb', 'anlage5']);
    const abw = run.befunde.find(b => b.typ === 'zeitraum-abweichung');
    expect(abw).toBeDefined();
    expect(abw!.quellen.find(q => q.rolle === 'vb')?.sektionId).toBe('9');
    expect(run.offenePunkte).toEqual([]);
  });

  it('nur VB (ohne Anlage 5): herkunft=vb, keine Befunde', () => {
    const nurText = baueRun('Y', { markdown: VB_MD, name: 'p.docx' }, null, NOW);
    expect(nurText.zeitplan?.herkunft).toBe('vb');
    expect(nurText.befunde).toEqual([]);
  });

  it('keine VB → definierter leerer Run mit Hinweis (nie Fehler)', () => {
    const leer = baueRun('X', null, null, NOW);
    expect(leer.gliederung).toEqual([]);
    expect(leer.zeitplan).toBeNull();
    expect(leer.quellen).toEqual([]);
    expect(leer.hinweis).toBeTruthy();
  });

  it('Kapazitäts-Befunde werden an die Zeitplan-Befunde angehängt (schwere=warnung)', () => {
    // Im Standard-ANLAGE_MD liegen 3.1 (4 PM) und 3.2 (3 PM) je in EINEM Monat →
    // beide MAs über der Grenze; die Kapazitäts-Befunde folgen den Vergleichs-Befunden.
    const kap = run.befunde.filter(b => b.typ === 'kapazitaet');
    expect(kap.length).toBeGreaterThan(0);
    expect(kap.every(b => b.schwere === 'warnung')).toBe(true);
  });

  it('Kapazitäts-Befund erscheint, wenn eine MA in einem Monat überplant ist', () => {
    const anlage = [
      '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 3.1 | Kernfunktionen | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
      '| 3.2 | Erweiterte Funktionen | 16.04.2023 | 30.04.2023 | MA02 | 3 |',
    ].join('\n');
    const r = baueRun('K', { markdown: VB_MD, name: 'p.docx' }, { markdown: anlage, name: 'a.docx' }, NOW);
    const kap = r.befunde.find(b => b.typ === 'kapazitaet');
    expect(kap).toBeDefined();
    expect(kap!.schwere).toBe('warnung');
    expect(kap!.text).toContain('MA02');
  });
});

describe('uebernehmeOffenePunkte', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, NOW);

  it('erhält gültige Befund-Keys + aspekt-fehlt-Keys, verwirft verwaiste', () => {
    const gueltig = befundKey(run.befunde[0]!);
    const merged = uebernehmeOffenePunkte(run, [gueltig, 'aspekt-fehlt:I:preise', 'zeitraum-abweichung::gibt-es-nicht']);
    expect(merged.offenePunkte).toContain(gueltig);
    expect(merged.offenePunkte).toContain('aspekt-fehlt:I:preise');
    expect(merged.offenePunkte).not.toContain('zeitraum-abweichung::gibt-es-nicht');
  });

  it('leere Vorgabe → Run unverändert (offenePunkte bleibt [])', () => {
    expect(uebernehmeOffenePunkte(run, []).offenePunkte).toEqual([]);
  });
});

describe('istVeraltet', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, NOW);
  const vbH = run.quellen.find(q => q.rolle === 'vb')!.hash;
  const anlH = run.quellen.find(q => q.rolle === 'anlage5')!.hash;

  it('gleiche Hashes → nicht veraltet', () => {
    expect(istVeraltet(run, { vbHash: vbH, anlage5Hash: anlH })).toBe(false);
  });
  it('geänderter VB-Hash → veraltet', () => {
    expect(istVeraltet(run, { vbHash: 'anders', anlage5Hash: anlH })).toBe(true);
  });
  it('verschwundene Anlage 5 → veraltet', () => {
    expect(istVeraltet(run, { vbHash: vbH, anlage5Hash: undefined })).toBe(true);
  });
});

describe('toggleOffenerPunkt', () => {
  it('setzt und entfernt einen Befund-Key', () => {
    const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, NOW);
    const key = befundKey(run.befunde[0]!);
    const r2 = toggleOffenerPunkt(run, key);
    expect(r2.offenePunkte).toContain(key);
    const r3 = toggleOffenerPunkt(r2, key);
    expect(r3.offenePunkte).not.toContain(key);
  });
});
