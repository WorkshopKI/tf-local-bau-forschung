/**
 * Skill-eigene Vorgaben: Materialisierung als synthetische Regeln + persönlicher
 * Override. Die Reihenfolge ist hier bewusst festgeschrieben — sie landet als
 * Zeilenfolge im `## Formale Vorgaben`-Prompt-Block und ist damit Prompt-Text.
 */
import { describe, it, expect } from 'vitest';
import {
  vorgabenZuRegeln,
  wendeOverrideAn,
  regelnMitOverride,
  istVorgabeRegel,
  istUeberschreibbar,
  VORGABE_KEYS,
} from '../vorgaben';
import { buildPromptVorgaben, runRegelChecks } from '../check-engine';
import { effektiveKategorie } from '../kategorien';
import type { QualitaetsRegel, SkillRecord, SkillVorgaben } from '../types';

const STAND = '2026-07-22T00:00:00.000Z';

const VOLL: SkillVorgaben = {
  wortanzahl: { schweregrad: 'fehler', min: 300, max: 350 },
  satzanzahl: { schweregrad: 'hinweis', min: 8, max: 12, persoenlichAnpassbar: true },
  zeichenMax: { schweregrad: 'fehler', max: 1000 },
  absatzMin: { schweregrad: 'fehler', min: 4 },
  satzlaengeMax: { schweregrad: 'hinweis', maxWoerter: 25 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
  pflichtAnfang: { schweregrad: 'fehler', text: 'Das Vorhaben wird' },
};

function skill(vorgaben?: SkillVorgaben): SkillRecord {
  return {
    id: 'demo', name: 'Demo', beschreibung: '', version: 1, promptTemplate: '',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: STAND, ...(vorgaben ? { vorgaben } : {}),
  };
}

describe('vorgabenZuRegeln', () => {
  it('ohne Vorgaben leer (Bestands-Skills bleiben unverändert)', () => {
    expect(vorgabenZuRegeln('demo', undefined, STAND)).toEqual([]);
    expect(vorgabenZuRegeln('demo', {}, STAND)).toEqual([]);
  });

  it('materialisiert in fester Reihenfolge mit stabilen IDs', () => {
    const regeln = vorgabenZuRegeln('demo', VOLL, STAND);
    expect(regeln.map(r => r.id)).toEqual([
      'vorgabe:demo:wortanzahl',
      'vorgabe:demo:satzanzahl',
      'vorgabe:demo:zeichen_max',
      'vorgabe:demo:absatz_min',
      'vorgabe:demo:satzlaenge_max',
      'vorgabe:demo:keine_aufzaehlungen',
      'vorgabe:demo:pflicht_anfang',
    ]);
    // Reihenfolge deckt sich mit der deklarierten Schlüssel-Reihenfolge.
    expect(regeln).toHaveLength(VORGABE_KEYS.length);
    expect(regeln.every(r => r.aktiv)).toBe(true);
    expect(regeln.every(r => istVorgabeRegel(r.id))).toBe(true);
  });

  it('überträgt Werte und Schweregrad in die Regel-Params', () => {
    const byTyp = new Map(vorgabenZuRegeln('demo', VOLL, STAND).map(r => [r.typ, r]));
    expect(byTyp.get('wortanzahl')!.params).toEqual({ min: 300, max: 350 });
    expect(byTyp.get('wortanzahl')!.schweregrad).toBe('fehler');
    expect(byTyp.get('satzanzahl')!.schweregrad).toBe('hinweis');
    expect(byTyp.get('zeichen_max')!.params).toEqual({ max: 1000 });
    expect(byTyp.get('absatz_min')!.params).toEqual({ min: 4 });
    expect(byTyp.get('satzlaenge_max')!.params).toEqual({ maxWoerter: 25 });
    expect(byTyp.get('keine_aufzaehlungen')!.params).toEqual({});
    expect(byTyp.get('pflicht_anfang')!.params).toEqual({ text: 'Das Vorhaben wird' });
  });

  it('lässt eine offene Bandgrenze weg statt sie zu erfinden', () => {
    const [r] = vorgabenZuRegeln('demo', { wortanzahl: { schweregrad: 'fehler', min: 750 } }, STAND);
    expect(r!.params).toEqual({ min: 750 });
  });

  it('ist von Check-Engine und Kategorie-Ableitung wie eine echte Regel verwertbar', () => {
    const regeln = vorgabenZuRegeln('demo', { satzanzahl: { schweregrad: 'fehler', min: 2, max: 3 } }, STAND);
    expect(buildPromptVorgaben(regeln)).toContain('Der finale Text hat 2 bis 3 Sätze.');
    const checks = runRegelChecks('Ein Satz. Noch einer.', regeln);
    expect(checks).toHaveLength(1);
    expect(checks[0]!.level).toBe('ok');
    expect(effektiveKategorie(regeln[0]!)).toBe('umfang');
  });
});

describe('wendeOverrideAn', () => {
  it('ist ein No-op ohne Override oder ohne Vorgaben', () => {
    expect(wendeOverrideAn(VOLL, undefined)).toBe(VOLL);
    expect(wendeOverrideAn(undefined, { satzanzahl: { min: 3 } })).toBeUndefined();
  });

  it('übernimmt nur freigegebene Vorgaben', () => {
    const out = wendeOverrideAn(VOLL, { satzanzahl: { min: 4, max: 6 }, wortanzahl: { min: 10 } })!;
    // satzanzahl ist freigegeben → übernommen
    expect(out.satzanzahl).toMatchObject({ min: 4, max: 6 });
    // wortanzahl ist NICHT freigegeben → Team-Stand bleibt
    expect(out.wortanzahl).toEqual(VOLL.wortanzahl);
  });

  it('lässt Schweregrad und Freigabe-Flag beim Team-Stand', () => {
    const out = wendeOverrideAn(VOLL, { satzanzahl: { min: 4 } })!;
    expect(out.satzanzahl!.schweregrad).toBe('hinweis');
    expect(out.satzanzahl!.persoenlichAnpassbar).toBe(true);
  });

  it('ist ein No-op, wenn keine der übersteuerten Vorgaben freigegeben ist', () => {
    expect(wendeOverrideAn(VOLL, { wortanzahl: { min: 10 } })).toBe(VOLL);
  });

  it('kennt keine Freigabe für Struktur-Vorgaben', () => {
    expect(istUeberschreibbar('keineAufzaehlungen')).toBe(false);
    expect(istUeberschreibbar('pflichtAnfang')).toBe(false);
    expect(istUeberschreibbar('satzanzahl')).toBe(true);
  });
});

describe('regelnMitOverride', () => {
  const bibliothek: QualitaetsRegel = {
    id: 'seed-passiv', name: 'Passiv', typ: 'verbotenes_muster', params: { muster: ['x'] },
    schweregrad: 'hinweis', aktiv: true, erstellt_am: STAND, geaendert_am: STAND,
  };

  it('ersetzt nur die synthetischen Einträge und behält die Reihenfolge', () => {
    const s = skill(VOLL);
    const team = [...vorgabenZuRegeln(s.id, VOLL, STAND), bibliothek];
    const out = regelnMitOverride(s, team, { satzanzahl: { min: 4, max: 6 } });
    expect(out.map(r => r.id)).toEqual(team.map(r => r.id));
    expect(out.find(r => r.typ === 'satzanzahl')!.params).toEqual({ min: 4, max: 6 });
    expect(out.find(r => r.id === 'seed-passiv')).toBe(bibliothek);
  });

  it('ist ein No-op ohne Override, ohne Vorgaben oder ohne Freigabe', () => {
    const s = skill(VOLL);
    const team = [...vorgabenZuRegeln(s.id, VOLL, STAND), bibliothek];
    expect(regelnMitOverride(s, team, undefined)).toBe(team);
    expect(regelnMitOverride(skill(), team, { satzanzahl: { min: 4 } })).toBe(team);
    expect(regelnMitOverride(s, team, { wortanzahl: { min: 10 } })).toBe(team);
  });
});
