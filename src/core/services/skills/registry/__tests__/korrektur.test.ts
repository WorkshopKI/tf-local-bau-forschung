import { describe, it, expect } from 'vitest';
import { regelKorrekturAnweisung, regelLimit } from '../korrektur';
import type { CheckResult, CheckRichtung } from '../check-engine';
import type { QualitaetsRegel, Pruefart } from '../types';

function regel(
  typ: string,
  params: Record<string, unknown>,
  opts: { pruefart?: Pruefart } = {},
): QualitaetsRegel {
  return {
    id: `r-${typ}`, name: typ, typ, params,
    schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't',
    ...(opts.pruefart ? { pruefart: opts.pruefart } : {}),
  };
}

function check(opts: { richtung?: CheckRichtung; messwert?: number } = {}): CheckResult {
  return {
    id: 'c', level: 'fehler', label: 'x',
    ...(opts.richtung ? { richtung: opts.richtung } : {}),
    ...(opts.messwert !== undefined ? { messwert: opts.messwert } : {}),
  };
}

describe('regelKorrekturAnweisung — Modifier + Zielwert je Typ', () => {
  it('zeichen_max → kuerzer mit max + Ist-Wert', () => {
    const k = regelKorrekturAnweisung(check({ richtung: 'zu_lang', messwert: 1117 }), regel('zeichen_max', { max: 1000 }));
    expect(k).not.toBeNull();
    expect(k!.modifier).toBe('kuerzer');
    expect(k!.label).toBe('Mit KI kürzen');
    expect(k!.anweisung).toBe('Kürze auf höchstens 1000 Zeichen; aktuell 1117.');
  });

  it('zeichen_max ohne Messwert → Anweisung ohne Ist-Wert', () => {
    const k = regelKorrekturAnweisung(check(), regel('zeichen_max', { max: 1000 }));
    expect(k!.anweisung).toBe('Kürze auf höchstens 1000 Zeichen.');
  });

  it('wortanzahl zu_lang → kuerzer(max); zu_kurz → laenger(min)', () => {
    const lang = regelKorrekturAnweisung(check({ richtung: 'zu_lang', messwert: 300 }), regel('wortanzahl', { min: 100, max: 200 }));
    expect(lang!.modifier).toBe('kuerzer');
    expect(lang!.anweisung).toBe('Kürze auf höchstens 200 Wörter; aktuell 300.');
    const kurz = regelKorrekturAnweisung(check({ richtung: 'zu_kurz', messwert: 50 }), regel('wortanzahl', { min: 100, max: 200 }));
    expect(kurz!.modifier).toBe('laenger');
    expect(kurz!.anweisung).toBe('Erweitere auf mindestens 100 Wörter; aktuell 50.');
  });

  it('wortanzahl ohne richtung (ok) → null', () => {
    expect(regelKorrekturAnweisung(check({ messwert: 150 }), regel('wortanzahl', { min: 100, max: 200 }))).toBeNull();
  });

  it('satzanzahl zu_lang → kuerzer; zu_kurz → laenger (mit „Sätze")', () => {
    const lang = regelKorrekturAnweisung(check({ richtung: 'zu_lang', messwert: 15 }), regel('satzanzahl', { min: 8, max: 12 }));
    expect(lang!.modifier).toBe('kuerzer');
    expect(lang!.anweisung).toBe('Kürze auf höchstens 12 Sätze; aktuell 15.');
    const kurz = regelKorrekturAnweisung(check({ richtung: 'zu_kurz', messwert: 3 }), regel('satzanzahl', { min: 8, max: 12 }));
    expect(kurz!.modifier).toBe('laenger');
    expect(kurz!.anweisung).toBe('Erweitere auf mindestens 8 Sätze; aktuell 3.');
  });

  it('absatz_min → laenger(min), richtungslos', () => {
    const k = regelKorrekturAnweisung(check({ messwert: 1 }), regel('absatz_min', { min: 3 }));
    expect(k!.modifier).toBe('laenger');
    expect(k!.anweisung).toBe('Gliedere in mindestens 3 Absätze; aktuell 1.');
  });

  it('satzlaenge_max → neu mit maxWoerter', () => {
    const k = regelKorrekturAnweisung(check(), regel('satzlaenge_max', { maxWoerter: 25 }));
    expect(k!.modifier).toBe('neu');
    expect(k!.label).toBe('Mit KI korrigieren');
    expect(k!.anweisung).toBe('Formuliere Sätze mit höchstens 25 Wörtern.');
  });

  it('pflicht_anfang → neu mit Soll-Anfang', () => {
    const k = regelKorrekturAnweisung(check(), regel('pflicht_anfang', { text: 'Das Vorhaben wird' }));
    expect(k!.modifier).toBe('neu');
    expect(k!.anweisung).toBe('Beginne exakt mit: „Das Vorhaben wird“');
  });

  it('keine_aufzaehlungen → neu (Fließtext)', () => {
    const k = regelKorrekturAnweisung(check(), regel('keine_aufzaehlungen', {}));
    expect(k!.modifier).toBe('neu');
    expect(k!.anweisung).toBe('Wandle Aufzählungen in Fließtext um.');
  });

  it('verbotenes_muster → null (nur „Anzeigen", Stil entscheidet Gutachter)', () => {
    expect(regelKorrekturAnweisung(check(), regel('verbotenes_muster', { muster: ['x'] }))).toBeNull();
  });

  it('unbekannter Typ → null', () => {
    expect(regelKorrekturAnweisung(check({ richtung: 'zu_lang' }), regel('irgendwas_neues', {}))).toBeNull();
  });

  it('pruefart fachlich/administrativ → null (nicht deterministisch korrigierbar)', () => {
    expect(regelKorrekturAnweisung(check({ richtung: 'zu_lang' }), regel('zeichen_max', { max: 1000 }, { pruefart: 'fachlich' }))).toBeNull();
    expect(regelKorrekturAnweisung(check({ richtung: 'zu_lang' }), regel('zeichen_max', { max: 1000 }, { pruefart: 'administrativ' }))).toBeNull();
  });

  it('fehlende Pflicht-Parameter → null, nie werfen', () => {
    expect(regelKorrekturAnweisung(check({ richtung: 'zu_lang' }), regel('zeichen_max', {}))).toBeNull();
    expect(regelKorrekturAnweisung(check({ richtung: 'zu_kurz' }), regel('wortanzahl', { max: 200 }))).toBeNull();
    expect(regelKorrekturAnweisung(check(), regel('pflicht_anfang', {}))).toBeNull();
    expect(regelKorrekturAnweisung(check(), regel('satzlaenge_max', {}))).toBeNull();
  });
});

describe('regelLimit — Zielwert für die Mono-Anzeige', () => {
  it('zeichen_max → max; satzlaenge_max → maxWoerter; absatz_min → min', () => {
    expect(regelLimit(regel('zeichen_max', { max: 1000 }))).toBe(1000);
    expect(regelLimit(regel('satzlaenge_max', { maxWoerter: 25 }))).toBe(25);
    expect(regelLimit(regel('absatz_min', { min: 3 }))).toBe(3);
  });
  it('zweiseitig: richtung wählt den verletzten Rand', () => {
    expect(regelLimit(regel('wortanzahl', { min: 100, max: 200 }), 'zu_lang')).toBe(200);
    expect(regelLimit(regel('wortanzahl', { min: 100, max: 200 }), 'zu_kurz')).toBe(100);
    expect(regelLimit(regel('satzanzahl', { min: 8, max: 12 }), 'zu_lang')).toBe(12);
  });
  it('unbekannt / fehlend → null', () => {
    expect(regelLimit(regel('verbotenes_muster', { muster: ['x'] }))).toBeNull();
    expect(regelLimit(regel('zeichen_max', {}))).toBeNull();
  });
});
