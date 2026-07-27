import { describe, it, expect } from 'vitest';
import {
  ROLLEN, betrifftRolle, istNeutral, leseStatusRolle, parseRollenSpalte,
  rollenLabel, rollenVonFeld, sortiereRollen,
} from '@/core/status/rollen';
import type { Rolle, StatusFeldEintrag } from '@/core/status/typen';

/** Minimales Feld — nur die Rollen-Felder zählen für diese Tests. */
function feld(patch: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag {
  return {
    feldId: 'D_TEST', label: 'Test', typ: 'datum', ebene: 'tv',
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
    ...patch,
  };
}

describe('rollenVonFeld — Migration der abgelösten Zuständigkeit', () => {
  it('nimmt `rollen`, wenn vorhanden', () => {
    expect(rollenVonFeld(feld({ rollen: ['qs', 'pa'] }))).toEqual(['qs', 'pa']);
  });

  it('übersetzt `ab`/`fb` in die einelementige Liste', () => {
    expect(rollenVonFeld(feld({ zustaendigkeit: 'ab' }))).toEqual(['ab']);
    expect(rollenVonFeld(feld({ zustaendigkeit: 'fb' }))).toEqual(['fb']);
  });

  it('übersetzt `beide` in AB + FB', () => {
    expect(rollenVonFeld(feld({ zustaendigkeit: 'beide' }))).toEqual(['ab', 'fb']);
  });

  it('lässt `rollen` gewinnen, wenn beides dasteht', () => {
    expect(rollenVonFeld(feld({ rollen: ['jur'], zustaendigkeit: 'beide' }))).toEqual(['jur']);
  });

  it('liefert für ein Feld ohne beides die leere Liste', () => {
    expect(rollenVonFeld(feld())).toEqual([]);
  });
});

describe('neutral heißt „jeder darf", nicht „niemand"', () => {
  it('erkennt ein Feld ohne Rollen als neutral', () => {
    expect(istNeutral(feld({ rollen: [] }))).toBe(true);
    expect(istNeutral(feld({ rollen: ['ab'] }))).toBe(false);
  });

  it('zeigt ein neutrales Feld unter JEDER Rollenwahl', () => {
    const neutral = feld({ rollen: [] });
    expect(betrifftRolle(neutral, 'alle')).toBe(true);
    for (const r of ROLLEN) expect(betrifftRolle(neutral, r)).toBe(true);
  });

  it('filtert ein zugeordnetes Feld auf seine Rollen', () => {
    const nurQs = feld({ rollen: ['qs'] });
    expect(betrifftRolle(nurQs, 'qs')).toBe(true);
    expect(betrifftRolle(nurQs, 'ab')).toBe(false);
    expect(betrifftRolle(nurQs, 'alle')).toBe(true);
  });

  it('beschriftet neutral als „alle"', () => {
    expect(rollenLabel(feld({ rollen: [] }))).toBe('alle');
    expect(rollenLabel(feld({ rollen: ['ab', 'fb'] }))).toBe('AB/FB');
  });
});

describe('parseRollenSpalte — die Rollenspalte der Zuarbeit', () => {
  it('liest Einzel- und Mehrfachangaben', () => {
    expect(parseRollenSpalte('AB')).toEqual(['ab']);
    expect(parseRollenSpalte('AB/FB/QS')).toEqual(['ab', 'fb', 'qs']);
    expect(parseRollenSpalte('AB/QS/Juristen')).toEqual(['ab', 'qs', 'jur']);
  });

  it('macht aus `neutral` die leere Liste', () => {
    expect(parseRollenSpalte('neutral')).toEqual([]);
  });

  it('sortiert kanonisch — Reihenfolge der Quelle ist egal', () => {
    expect(parseRollenSpalte('QS/AB')).toEqual(parseRollenSpalte('AB/QS'));
  });

  it('verwirft Unbekanntes, statt zu werfen', () => {
    expect(parseRollenSpalte('AB/Hausmeister')).toEqual(['ab']);
    expect(parseRollenSpalte('')).toEqual([]);
  });

  it('entdoppelt', () => {
    expect(parseRollenSpalte('AB/AB')).toEqual(['ab']);
  });
});

describe('sortiereRollen', () => {
  it('bringt jede Eingabe in die kanonische Reihenfolge', () => {
    expect(sortiereRollen(['jur', 'ab', 'qs'] as Rolle[])).toEqual(['ab', 'qs', 'jur']);
  });
});

describe('leseStatusRolle — die Profil-Vorauswahl', () => {
  it('behandelt das abgelöste `beide` wie „alle"', () => {
    // v2.344 kannte nur AB/FB; `beide` war dort der „nichts ausblenden"-Wert.
    expect(leseStatusRolle('beide')).toBe('alle');
  });

  it('nimmt gesetzte Rollen unverändert', () => {
    for (const r of ROLLEN) expect(leseStatusRolle(r)).toBe(r);
  });

  it('fällt bei fehlendem oder unbekanntem Wert auf „alle" zurück', () => {
    expect(leseStatusRolle(undefined)).toBe('alle');
    expect(leseStatusRolle('hausmeister')).toBe('alle');
  });
});
