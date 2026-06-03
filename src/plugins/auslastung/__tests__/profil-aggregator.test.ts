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
  aggregateAntragCountByAnon,
  aggregateMaProfilesByAnon,
  aggregateAstByAnon,
  istDlAntrag,
  istDlVbPhase,
} from '../services/profil-aggregator';
import { buildAnonymMapForTests } from './test-helpers';
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
    expect(isZtTruthy('J')).toBe(true);    // Deutsche Single-Letter-Konvention
    expect(isZtTruthy('j')).toBe(true);
    expect(isZtTruthy('wahr')).toBe(true);
    expect(isZtTruthy(' true ')).toBe(true);
  });

  it('null/empty/0/nein/N zaehlen als falsch', () => {
    expect(isZtTruthy(null)).toBe(false);
    expect(isZtTruthy(undefined)).toBe(false);
    expect(isZtTruthy(0)).toBe(false);
    expect(isZtTruthy('')).toBe(false);
    expect(isZtTruthy('0')).toBe(false);
    expect(isZtTruthy('nein')).toBe(false);
    expect(isZtTruthy('false')).toBe(false);
    expect(isZtTruthy('N')).toBe(false);   // Deutsche Single-Letter-Konvention
    expect(isZtTruthy('n')).toBe(false);
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

  // ─── Echte User-Patterns aus dem Feld (Wizard + Label-XLS mit Gruppen) ───
  // Konvention: '_tv_ebene'-Suffix entsteht durch eine Gruppen-Spalte
  // 'TV-Ebene' im Label-XLS. VB-Spalten landen als rohe 10-Zeichen-
  // CSV-Header-Truncates mit '_1'-Dedup-Suffix (PapaParse).

  it("User-Pattern: '_tv_ebene'-Suffix (kunstliche_intelligenz_ki_tv_ebene)", () => {
    const rec = { kunstliche_intelligenz_ki_tv_ebene: 'J' };
    expect(findTruthyZtField(rec, 'Künstliche Intelligenz (KI)')).toBe(true);
  });

  it("User-Pattern: '_vb_ebene'-Suffix (kunstliche_intelligenz_ki_vb_ebene)", () => {
    const rec = { kunstliche_intelligenz_ki_vb_ebene: 'X' };
    expect(findTruthyZtField(rec, 'Künstliche Intelligenz (KI)')).toBe(true);
  });

  it("User-Pattern: VB-Roh-Header 'cloud comp_1' (10-Zeichen-Truncate mit Space)", () => {
    const rec = { 'cloud comp_1': 'J' };
    expect(findTruthyZtField(rec, 'Cloud Computing')).toBe(true);
  });

  it("User-Pattern: VB-Roh-Header 'big data a_1' (Truncate mit Space)", () => {
    const rec = { 'big data a_1': '1' };
    expect(findTruthyZtField(rec, 'Big Data Analyse')).toBe(true);
  });

  it("User-Pattern: VB-Roh-Header 'künstliche_1' (Truncate mit Umlaut)", () => {
    const rec = { 'künstliche_1': 'J' };
    expect(findTruthyZtField(rec, 'Künstliche Intelligenz (KI)')).toBe(true);
  });

  it("User-Pattern: VB-Roh-Header 'industrie_1' (Trailing-Space trimmed)", () => {
    const rec = { 'industrie_1': 'J' };
    expect(findTruthyZtField(rec, 'Industrie 4.0')).toBe(true);
  });

  it("User-Pattern: VB-Roh-Header 'digitale w_1' (Truncate mit Space)", () => {
    const rec = { 'digitale w_1': 'J' };
    expect(findTruthyZtField(rec, 'Digitale Wirtschaft und Gesellschaft (IKT)')).toBe(true);
  });

  it("User-Pattern: nackter NFD-Slug ohne Suffix (digitale_wirtschaft_und_gesellschaft_ikt)", () => {
    const rec = { digitale_wirtschaft_und_gesellschaft_ikt: 'J' };
    expect(findTruthyZtField(rec, 'Digitale Wirtschaft und Gesellschaft (IKT)')).toBe(true);
  });

  it("User-Pattern: User-CSV mit allen N-Werten → kein Match (alle falsy)", () => {
    // Regressions-Schutz fuer den realen User-Fall: ein Antrag, der gar keine
    // ZT-Spalten gesetzt hat, liefert auch keine Tags.
    const rec = {
      digitale_wirtschaft_und_gesellschaft_ikt: 'N',
      'digitale w_1': 'N',
      kunstliche_intelligenz_ki_tv_ebene: 'N',
      'künstliche_1': 'N',
      cloud_computing_tv_ebene: 'N',
      'cloud comp_1': 'N',
    };
    expect(findTruthyZtField(rec, 'Künstliche Intelligenz (KI)')).toBe(false);
    expect(findTruthyZtField(rec, 'Cloud Computing')).toBe(false);
    expect(findTruthyZtField(rec, 'Digitale Wirtschaft und Gesellschaft (IKT)')).toBe(false);
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

describe('DL-Ausschluss aus den Kompetenz-Aggregaten', () => {
  it('istDlVbPhase / istDlAntrag erkennen vb_phase 4 (DL)', () => {
    expect(istDlVbPhase(4)).toBe(true);
    expect(istDlVbPhase('4')).toBe(true);
    expect(istDlVbPhase(3)).toBe(false);     // FuE
    expect(istDlVbPhase(1)).toBe(false);     // NW
    expect(istDlVbPhase(undefined)).toBe(false);
    expect(istDlAntrag(makeAntrag({ vb_phase: 4 }))).toBe(true);
    expect(istDlAntrag(makeAntrag({ vb_phase: 1 }))).toBe(false);
  });

  it('DL-Antraege erhoehen weder Deskriptoren noch AST-Count noch Antrags-Count', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'ABC', vb_phase: 3, techn_1: 'KI', antragsteller: 'Foo GmbH' }),
      // DL (vb_phase 4) → muss komplett ignoriert werden:
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'ABC', vb_phase: 4, techn_1: 'Laser', antragsteller: 'Foo GmbH' }),
    ];
    const map = buildAnonymMapForTests(antraege);
    const anon = map.toAnon.get('ABC')!;

    expect(aggregateMaProfilesByAnon(antraege, map).get(anon)).toEqual(['ki']); // 'laser' (DL) fehlt
    expect(aggregateAstByAnon(antraege, map).get(anon)?.get('foo gmbh')).toBe(1); // nur A1
    expect(aggregateAntragCountByAnon(antraege, map).get(anon)).toBe(1);          // nur A1
  });
});

describe('aggregateAntragCountByAnon', () => {
  it('zaehlt historische Antraege pro anonId; leeres/fehlendes Kuerzel ignoriert', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'ABC' }),
      makeAntrag({ aktenzeichen: 'A2', tib_kuerz: 'ABC' }),
      makeAntrag({ aktenzeichen: 'A3', tib_kuerz: 'XYZ' }),
      makeAntrag({ aktenzeichen: 'A4', tib_kuerz: '' }), // ohne Kuerzel → ignoriert
    ];
    const map = buildAnonymMapForTests(antraege);
    const counts = aggregateAntragCountByAnon(antraege, map);
    const nonzero = [...counts.values()].filter(n => n > 0).sort((a, b) => a - b);
    expect(nonzero).toEqual([1, 2]);
    expect([...counts.values()].reduce((s, n) => s + n, 0)).toBe(3);
  });
});
