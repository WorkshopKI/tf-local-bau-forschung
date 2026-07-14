import { describe, it, expect } from 'vitest';
import {
  baueRun, istVeraltet, toggleOffenerPunkt, toggleErledigterPunkt, befundKey,
  uebernehmeOffenePunkte, uebernehmeErledigtePunkte, verbundZeitplanSummary,
} from '../store';
import type { TvPlan } from '../types';

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
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'projekt.docx' }, { markdown: ANLAGE_MD, name: 'Anlage 5.docx' }, [], NOW);

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
    const nurText = baueRun('Y', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW);
    expect(nurText.zeitplan?.herkunft).toBe('vb');
    expect(nurText.befunde).toEqual([]);
  });

  it('keine VB → definierter leerer Run mit Hinweis (nie Fehler)', () => {
    const leer = baueRun('X', null, null, [], NOW);
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
    const r = baueRun('K', { markdown: VB_MD, name: 'p.docx' }, { markdown: anlage, name: 'a.docx' }, [], NOW);
    const kap = r.befunde.find(b => b.typ === 'kapazitaet');
    expect(kap).toBeDefined();
    expect(kap!.schwere).toBe('warnung');
    expect(kap!.text).toContain('MA02');
  });
});

describe('baueRun — Korpus (narrative Zusatzdokumente, dokumentgrenzen-neutral)', () => {
  const MARKETING_MD = ['# Marktanalyse', 'Zielmarkt ist der Mittelstand mit hohem Effizienzdruck.', ''].join('\n');

  it('ohne narrative Docs: Gliederung identisch zum VB-only-Run', () => {
    const a = baueRun('N1', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW);
    const b = baueRun('N2', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW);
    expect(b.gliederung).toEqual(a.gliederung);
    expect(b.quellen.some(q => q.rolle === 'verwertung')).toBe(false);
  });

  it('narratives Dokument: eigene Quelle gestempelt, VB-Sektions-Offsets stabil, Marketing fundstellen-fähig', () => {
    const nurVb = baueRun('C1', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW);
    const mit = baueRun('C2', { markdown: VB_MD, name: 'p.docx' }, null, [{ markdown: MARKETING_MD, name: 'Marketing.pdf' }], NOW);
    // Marketing als eigene Quelle (rolle 'verwertung') gestempelt.
    expect(mit.quellen.filter(q => q.rolle === 'verwertung').map(q => q.name)).toEqual(['Marketing.pdf']);
    // VB-Sektion k-9 bleibt an identischer Start-Position (VB ist Präfix des Korpus).
    expect(mit.gliederung.find(s => s.id === 'k-9')!.start).toBe(nurVb.gliederung.find(s => s.id === 'k-9')!.start);
    // Der Marketing-Abschnitt taucht als zusätzliche, fundstellen-fähige Sektion auf.
    expect(mit.gliederung.some(s => s.titel.includes('Marketing.pdf'))).toBe(true);
    expect(mit.gliederung.length).toBeGreaterThan(nurVb.gliederung.length);
    // Deterministischer Zeitplan bleibt VB/Anlage-5-spezifisch (kein Marketing-Rauschen).
    expect(mit.tabellen.every(t => t.rolle === 'vb' || t.rolle === 'anlage5')).toBe(true);
  });

  it('istVeraltet reagiert auf hinzugefügte/geänderte/entfernte narrative Docs', () => {
    const mit = baueRun('V', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' },
      [{ markdown: MARKETING_MD, name: 'Marketing.pdf' }], NOW);
    const vbH = mit.quellen.find(q => q.rolle === 'vb')!.hash;
    const anlH = mit.quellen.find(q => q.rolle === 'anlage5')!.hash;
    const vwH = mit.quellen.find(q => q.rolle === 'verwertung')!.hash;
    expect(istVeraltet(mit, { vbHash: vbH, anlage5Hash: anlH, verwertungHashes: [vwH] })).toBe(false);
    expect(istVeraltet(mit, { vbHash: vbH, anlage5Hash: anlH, verwertungHashes: [] })).toBe(true);
    expect(istVeraltet(mit, { vbHash: vbH, anlage5Hash: anlH, verwertungHashes: ['anders'] })).toBe(true);
  });
});

describe('baueRun — Verbund (Anlage 5 pro TV)', () => {
  const anlageTvA = [
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Konzept A | 01.01.2023 | 28.02.2023 | MA01 | 2 |',
  ].join('\n');
  const anlageTvB = [
    '| AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 1 | Kern B | 01.04.2023 | 15.04.2023 | MA02 | 4 |',
    '| 2 | Erweiterung B | 16.04.2023 | 30.04.2023 | MA02 | 3 |',
  ].join('\n');

  const teilvorhaben = [
    { nr: 1, tvAz: '16KN0001', akronym: 'ALPHA', titel: 'TV Alpha' },
    { nr: 2, tvAz: '16KN0002', akronym: 'BETA', titel: 'TV Beta' },
    { nr: 3, tvAz: '16KN0003', akronym: 'GAMMA', titel: 'TV Gamma' },
  ];
  const anlagenProTv = new Map([
    ['16KN0001', { markdown: anlageTvA, name: 'AP_16KN0001.docx' }],
    ['16KN0002', { markdown: anlageTvB, name: 'AP_16KN0002.docx' }],
  ]);
  const run = baueRun('VBND', { markdown: VB_MD, name: 'p.docx' }, null, [], NOW,
    { teilvorhaben, anlagenProTv, unzugeordnet: ['fremd.pdf'] });

  it('baut ein teilplaene-Array mit einem Eintrag je TV (fehlende TV = anlage null)', () => {
    expect(run.teilplaene?.map(t => t.tvAz)).toEqual(['16KN0001', '16KN0002', '16KN0003']);
    expect(run.teilplaene?.map(t => t.tvAkronym)).toEqual(['ALPHA', 'BETA', 'GAMMA']);
    expect(run.teilplaene?.[0]?.zeitplan?.zeilen.length).toBe(1);
    expect(run.teilplaene?.[2]?.anlage).toBeNull();       // GAMMA ohne Anlage 5
    expect(run.teilplaene?.[2]?.zeitplan).toBeNull();
  });

  it('Top-Level zeitplan ist null; quellen tragen VB + je TV eine anlage5-Quelle mit tvAz', () => {
    expect(run.zeitplan).toBeNull();
    const anlageQ = run.quellen.filter(q => q.rolle === 'anlage5');
    expect(anlageQ.map(q => q.tvAz)).toEqual(['16KN0001', '16KN0002']);
    expect(run.quellen.find(q => q.rolle === 'vb')).toBeDefined();
  });

  it('Kapazitäts-Befunde sind pro TV geflacht (mit tvAz + TV-Kürzel im Text)', () => {
    const kap = run.befunde.filter(b => b.typ === 'kapazitaet');
    expect(kap.length).toBeGreaterThan(0);
    expect(kap.every(b => b.tvAz === '16KN0002')).toBe(true); // nur BETA ist überplant
    expect(kap[0]!.text.startsWith('BETA:')).toBe(true);
  });

  it('unzuordenbare Anlagen landen in anlagenOhneTv', () => {
    expect(run.anlagenOhneTv).toEqual(['fremd.pdf']);
  });

  it('Regression: 1 TV bzw. kein verbund-Arg → Solo-Pfad unverändert (kein teilplaene)', () => {
    const solo = baueRun('S', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);
    expect(solo.teilplaene).toBeUndefined();
    expect(solo.zeitplan?.herkunft).toBe('beide');
    // Auch mit verbund-Arg, aber nur 1 TV → Solo-Pfad.
    const einTv = baueRun('S1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW,
      { teilvorhaben: [{ nr: 1, tvAz: '16KN0001', akronym: 'ALPHA', titel: null }],
        anlagenProTv: new Map(), unzugeordnet: [] });
    expect(einTv.teilplaene).toBeUndefined();
    expect(einTv.zeitplan?.herkunft).toBe('beide');
  });
});

describe('verbundZeitplanSummary', () => {
  const tp = (nr: number, tvAz: string, zeilen: unknown, achseMax: number): TvPlan => ({
    nr, tvAz, tvAkronym: `TV${nr}`, tvTitel: null,
    anlage: { name: `a${nr}.docx`, hash: 'h', gelesenAm: NOW, rolle: 'anlage5', tvAz },
    zeitplan: zeilen ? { zeilen: zeilen as never, achseMax } : null,
  });

  it('summiert PM, MA-Zahl (pro TV distinct) und längsten Horizont; fehlende TVs zählen 0', () => {
    const tps: TvPlan[] = [
      tp(1, 'A', [
        { nummer: '1', bezeichnung: 'x', istUnterAp: false, monatStart: 1, monatEnde: 3, pm: 4, maNr: 'MA01' },
        { nummer: '2', bezeichnung: 'y', istUnterAp: false, monatStart: 2, monatEnde: 4, pm: 2, maNr: 'MA02' },
      ], 4),
      tp(2, 'B', [
        { nummer: '1', bezeichnung: 'z', istUnterAp: false, monatStart: 1, monatEnde: 6, pm: 5, maNr: 'MA01' },
      ], 6),
      tp(3, 'C', null, 1), // Anlage 5 fehlt
    ];
    const s = verbundZeitplanSummary(tps);
    expect(s.summePm).toBe(11);      // 4+2 (TV A) + 5 (TV B)
    expect(s.maAnzahl).toBe(3);      // 2 (A: MA01,MA02) + 1 (B: MA01) — TV-lokal, nicht global dedupliziert
    expect(s.horizont).toBe(6);
    expect(s.tvMitAnlage).toBe(2);
    expect(s.tvGesamt).toBe(3);
  });
});

describe('uebernehmeOffenePunkte', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);

  it('erhält gültige Befund-Keys + aspekt-fehlt-/risiko-fehlt-/zahl-widerspruch-Keys, verwirft verwaiste', () => {
    const gueltig = befundKey(run.befunde[0]!);
    const merged = uebernehmeOffenePunkte(run, [
      gueltig, 'aspekt-fehlt:I:preise', 'risiko-fehlt:k-3.1', 'zahl-widerspruch:pm:48-pm',
      'zeitraum-abweichung::gibt-es-nicht',
    ]);
    expect(merged.offenePunkte).toContain(gueltig);
    expect(merged.offenePunkte).toContain('aspekt-fehlt:I:preise');
    expect(merged.offenePunkte).toContain('risiko-fehlt:k-3.1');
    expect(merged.offenePunkte).toContain('zahl-widerspruch:pm:48-pm');
    expect(merged.offenePunkte).not.toContain('zeitraum-abweichung::gibt-es-nicht');
  });

  it('leere Vorgabe → Run unverändert (offenePunkte bleibt [])', () => {
    expect(uebernehmeOffenePunkte(run, []).offenePunkte).toEqual([]);
  });
});

describe('istVeraltet', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);
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
    const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);
    const key = befundKey(run.befunde[0]!);
    const r2 = toggleOffenerPunkt(run, key);
    expect(r2.offenePunkte).toContain(key);
    const r3 = toggleOffenerPunkt(r2, key);
    expect(r3.offenePunkte).not.toContain(key);
  });
});

describe('uebernehmeErledigtePunkte + toggleErledigterPunkt (Fragen-Achse)', () => {
  const run = baueRun('VB-1', { markdown: VB_MD, name: 'p.docx' }, { markdown: ANLAGE_MD, name: 'a.docx' }, [], NOW);

  it('erhält gültige Befund-/Kandidaten-Keys über „Neu aufbereiten", verwirft verwaiste', () => {
    const gueltig = befundKey(run.befunde[0]!);
    const merged = uebernehmeErledigtePunkte(run, [gueltig, 'aspekt-leer:H', 'risiko-unzugeordnet:x', 'zeitraum-abweichung::weg']);
    expect(merged.erledigtePunkte).toContain(gueltig);
    expect(merged.erledigtePunkte).toContain('aspekt-leer:H');
    expect(merged.erledigtePunkte).toContain('risiko-unzugeordnet:x');
    expect(merged.erledigtePunkte).not.toContain('zeitraum-abweichung::weg');
  });

  it('erledigt ist von offen getrennt (unabhängige Achse)', () => {
    const key = befundKey(run.befunde[0]!);
    const r2 = toggleErledigterPunkt(toggleOffenerPunkt(run, key), key);
    expect(r2.offenePunkte).toContain(key);
    expect(r2.erledigtePunkte).toContain(key);
    const r3 = toggleErledigterPunkt(r2, key);
    expect(r3.erledigtePunkte).not.toContain(key);
    expect(r3.offenePunkte).toContain(key); // offen bleibt unberührt
  });
});
