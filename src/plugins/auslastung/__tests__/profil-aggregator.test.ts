/**
 * profil-aggregator: readAntragDeskriptoren + findTruthyZtField.
 *
 * Schwerpunkt: Multi-Candidate-Slug-Matching fuer ZT-Boolean-Spalten.
 * Beide Slug-Konventionen muessen funktionieren:
 *  - Fixture-Stil aus build-default-labels.mjs (zt_<slug-ue>_tv/_vb)
 *  - Wizard-Stil aus slugifyFieldName (NFD, kein Prefix, kein Suffix)
 */
import { describe, it, expect } from 'vitest';
import {
  readAntragDeskriptoren,
  findTruthyZtField,
  normalizeDeskriptor,
  isZtTruthy,
} from '../services/profil-aggregator';
import type { Antrag } from '@/core/services/csv/types';

function makeAntrag(fields: Partial<Antrag> & Record<string, unknown> = {}): Antrag {
  return {
    aktenzeichen: 'A1',
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

describe('isZtTruthy', () => {
  it('true/Zahl/String-Varianten zaehlen als wahr', () => {
    expect(isZtTruthy(true)).toBe(true);
    expect(isZtTruthy(1)).toBe(true);
    expect(isZtTruthy('X')).toBe(true);
    expect(isZtTruthy('x')).toBe(true);
    expect(isZtTruthy('1')).toBe(true);
    expect(isZtTruthy('ja')).toBe(true);
    expect(isZtTruthy('Ja')).toBe(true);
    expect(isZtTruthy('JA')).toBe(true);
    expect(isZtTruthy('wahr')).toBe(true);
    expect(isZtTruthy(' true ')).toBe(true);
  });

  it('null/empty/0/nein zaehlen als falsch', () => {
    expect(isZtTruthy(null)).toBe(false);
    expect(isZtTruthy(undefined)).toBe(false);
    expect(isZtTruthy(0)).toBe(false);
    expect(isZtTruthy('')).toBe(false);
    expect(isZtTruthy('0')).toBe(false);
    expect(isZtTruthy('nein')).toBe(false);
    expect(isZtTruthy('false')).toBe(false);
    expect(isZtTruthy([])).toBe(false);
    expect(isZtTruthy({})).toBe(false);
  });
});

describe('normalizeDeskriptor', () => {
  it('trim + lowercase, leere/"-"/"0" -> null', () => {
    expect(normalizeDeskriptor('  KI  ')).toBe('ki');
    expect(normalizeDeskriptor('Künstliche Intelligenz (KI)')).toBe('künstliche intelligenz (ki)');
    expect(normalizeDeskriptor('')).toBeNull();
    expect(normalizeDeskriptor('-')).toBeNull();
    expect(normalizeDeskriptor('0')).toBeNull();
    expect(normalizeDeskriptor(null)).toBeNull();
    expect(normalizeDeskriptor(42)).toBeNull();
  });
});

describe('findTruthyZtField — Multi-Slug-Matching', () => {
  const klartext = 'Künstliche Intelligenz (KI)';

  it('Fixture-Style (zt_<ue-slug>_tv) wird erkannt', () => {
    const rec = { zt_kuenstliche_intelligenz_ki_tv: true };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Fixture-Style mit String "X" wird erkannt', () => {
    const rec = { zt_kuenstliche_intelligenz_ki_tv: 'X' };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Fixture-Style VB-Variante wird erkannt', () => {
    const rec = { zt_kuenstliche_intelligenz_ki_vb: 'X' };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Wizard-NFD-Style ohne Prefix/Suffix wird erkannt', () => {
    // slugifyFieldName aus useCsvWizardState.ts: ue → u via NFD.
    const rec = { kunstliche_intelligenz_ki: 'X' };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Wizard-Style ue-Variante ohne zt_-Prefix wird erkannt', () => {
    const rec = { kuenstliche_intelligenz_ki: '1' };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Wizard-Style mit Suffix _tv wird erkannt', () => {
    const rec = { kunstliche_intelligenz_ki_tv: 'ja' };
    expect(findTruthyZtField(rec, klartext)).toBe(true);
  });

  it('Falsches Feld liefert false', () => {
    const rec = { irgendwas_anderes: 'X' };
    expect(findTruthyZtField(rec, klartext)).toBe(false);
  });

  it('Field existiert aber Wert ist falsy', () => {
    const rec = { zt_kuenstliche_intelligenz_ki_tv: '' };
    expect(findTruthyZtField(rec, klartext)).toBe(false);
  });

  it('Unbekannter Klartext (nicht in ZUKUNFTSTECHNOLOGIE_FELDER) — Ad-hoc-Slug', () => {
    // Sollte trotzdem funktionieren — Kandidaten werden ad-hoc generiert.
    const rec = { fantasie_technologie: 'X' };
    expect(findTruthyZtField(rec, 'Fantasie Technologie')).toBe(true);
  });
});

describe('readAntragDeskriptoren — End-to-End', () => {
  it('TECHN_*-Spalten werden gelesen und normalisiert', () => {
    const a = makeAntrag({ techn_1: 'KI', techn_2: 'Sensorik' });
    const out = readAntragDeskriptoren(a);
    expect(out).toContain('ki');
    expect(out).toContain('sensorik');
  });

  it('Fixture-Style ZT-Spalte liefert Klartext im Profil', () => {
    const a = makeAntrag({ zt_kuenstliche_intelligenz_ki_tv: 'X' });
    const out = readAntragDeskriptoren(a);
    expect(out).toContain('künstliche intelligenz (ki)');
  });

  it('Wizard-NFD-Style ZT-Spalte liefert denselben Klartext', () => {
    // Aus Sicht des Auslastungs-Moduls darf es egal sein, welcher CSV-Pfad
    // benutzt wurde — Wizard- und Fixture-Imports muessen identische Profile
    // produzieren.
    const a = makeAntrag({ kunstliche_intelligenz_ki: 'X' });
    const out = readAntragDeskriptoren(a);
    expect(out).toContain('künstliche intelligenz (ki)');
  });

  it('TV + VB derselben ZT-Spalte: nur 1× im Set (Klartext-Dedup)', () => {
    const a = makeAntrag({
      zt_kuenstliche_intelligenz_ki_tv: true,
      zt_kuenstliche_intelligenz_ki_vb: 'X',
    });
    const out = readAntragDeskriptoren(a);
    const hits = out.filter(x => x === 'künstliche intelligenz (ki)');
    expect(hits.length).toBe(1);
  });

  it('Gemischte Konventionen (Fixture TV + Wizard "VB"): 1 Klartext', () => {
    // Anwendungsfall: zwei CSV-Sources im Programm, eine pro Konvention.
    const a = makeAntrag({
      zt_cloud_computing_tv: 'X',           // Fixture-Style
      cloud_computing_vb: '1',              // Wizard-Style mit Suffix
    });
    const out = readAntragDeskriptoren(a);
    const hits = out.filter(x => x === 'cloud computing');
    expect(hits.length).toBe(1);
  });

  it('Mehrere unterschiedliche ZT-Klartexte werden alle aufgenommen', () => {
    const a = makeAntrag({
      kunstliche_intelligenz_ki: 'X',
      cloud_computing: 'ja',
      big_data_analyse: '1',
      leichtbautechnologien: 'wahr',
    });
    const out = readAntragDeskriptoren(a);
    expect(out).toContain('künstliche intelligenz (ki)');
    expect(out).toContain('cloud computing');
    expect(out).toContain('big data analyse');
    expect(out).toContain('leichtbautechnologien');
  });

  it('Keine ZT-Spalten gesetzt: leeres Profil', () => {
    const a = makeAntrag({});
    expect(readAntragDeskriptoren(a)).toEqual([]);
  });

  it('Branche-Spalten werden NICHT als Deskriptor aufgenommen (Bereinigung)', () => {
    // Regressions-Schutz: nach dem Patch sind branche_* keine
    // Tech-Kompetenzen mehr.
    const a = makeAntrag({
      branche: 'Maschinenbau',
      branche_2: 'Pflanzenproduktion',
      anwend_1: 'Verkehr',
      techn_1: 'KI',
    });
    const out = readAntragDeskriptoren(a);
    expect(out).toEqual(['ki']);
    expect(out).not.toContain('maschinenbau');
    expect(out).not.toContain('pflanzenproduktion');
    expect(out).not.toContain('verkehr');
  });
});
