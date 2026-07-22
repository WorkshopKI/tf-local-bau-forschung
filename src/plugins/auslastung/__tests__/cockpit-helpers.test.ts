/**
 * Reine Helfer des Zuweisungs-Cockpits: Status-Aggregation über die TVs eines
 * Verbundes + Interessenten-Reihenfolge der Übernahme-Wünsche.
 *
 * Kern-Invariante (v2.288, User-Feedback): ein Übernahme-Wunsch ist eine
 * Bewerbung, keine Zuweisung — der Verbund bleibt „offen", bis die PL freigibt.
 */
import { describe, it, expect } from 'vitest';
import {
  verbundStatusFlags,
  interessentenNachWunschzeit,
  wunschKlickTs,
  tageSeitFreigabe,
  unbestaetigteFreigabeTage,
  BESTAETIGUNG_FAELLIG_TAGE,
} from '../views/cockpit-helpers';
import type { Zuweisung } from '../types';

const z = (p: Partial<Zuweisung> & Pick<Zuweisung, 'antragId' | 'anonId' | 'status'>): Zuweisung => ({
  quartal: '2026-Q2',
  stunden: 40,
  ...p,
});

const TVS = ['A1', 'A2'];

describe('verbundStatusFlags', () => {
  it('ohne Zuweisungen: offen', () => {
    expect(verbundStatusFlags(TVS, [])).toEqual({ offen: true, selbst: false, zug: false });
  });

  it('Übernahme-Wunsch bleibt offen (offen UND selbst)', () => {
    const flags = verbundStatusFlags(TVS, [z({ antragId: 'A1', anonId: 'MA01', status: 'selbst' })]);
    expect(flags).toEqual({ offen: true, selbst: true, zug: false });
  });

  it('freigegeben schliesst offen aus', () => {
    const flags = verbundStatusFlags(TVS, [z({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben' })]);
    expect(flags).toEqual({ offen: false, selbst: false, zug: true });
  });

  it('freigegeben + selbstEingetragen ist NICHT offen (Flag überlebt die Freigabe)', () => {
    const flags = verbundStatusFlags(TVS, [
      z({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben', selbstEingetragen: true }),
    ]);
    expect(flags.offen).toBe(false);
    expect(flags.zug).toBe(true);
  });

  it('nur abgelehnte Zuweisungen: offen', () => {
    const flags = verbundStatusFlags(TVS, [
      z({ antragId: 'A1', anonId: 'MA01', status: 'abgelehnt' }),
      z({ antragId: 'A2', anonId: 'MA02', status: 'abgelehnt' }),
    ]);
    expect(flags).toEqual({ offen: true, selbst: false, zug: false });
  });

  it('Wunsch auf einem TV + Freigabe auf einem anderen TV: nicht offen', () => {
    const flags = verbundStatusFlags(TVS, [
      z({ antragId: 'A1', anonId: 'MA01', status: 'selbst' }),
      z({ antragId: 'A2', anonId: 'MA02', status: 'freigegeben' }),
    ]);
    expect(flags).toEqual({ offen: false, selbst: true, zug: true });
  });

  it('ignoriert Zuweisungen fremder Anträge', () => {
    const flags = verbundStatusFlags(TVS, [z({ antragId: 'FREMD', anonId: 'MA01', status: 'freigegeben' })]);
    expect(flags).toEqual({ offen: true, selbst: false, zug: false });
  });
});

describe('interessentenNachWunschzeit', () => {
  it('sortiert nach Klick-Zeit aufsteigend (zuerst Wollender vorne)', () => {
    const res = interessentenNachWunschzeit([
      z({ antragId: 'A1', anonId: 'MA02', status: 'selbst', selbstEingetragenAm: '2026-06-02T10:00:00.000Z' }),
      z({ antragId: 'A1', anonId: 'MA01', status: 'selbst', selbstEingetragenAm: '2026-06-01T10:00:00.000Z' }),
    ]);
    expect(res.map(r => r.anonId)).toEqual(['MA01', 'MA02']);
  });

  it('pro MA nur EIN Eintrag — die früheste Vormerkung über mehrere TVs', () => {
    const res = interessentenNachWunschzeit([
      z({ antragId: 'A2', anonId: 'MA01', status: 'selbst', selbstEingetragenAm: '2026-06-05T10:00:00.000Z' }),
      z({ antragId: 'A1', anonId: 'MA01', status: 'selbst', selbstEingetragenAm: '2026-06-01T10:00:00.000Z' }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0]!.antragId).toBe('A1');
  });

  it('nimmt selbstEingetragen-Einträge ohne Status "selbst" mit', () => {
    const res = interessentenNachWunschzeit([
      z({ antragId: 'A1', anonId: 'MA03', status: 'abgelehnt', selbstEingetragen: true }),
      z({ antragId: 'A1', anonId: 'MA04', status: 'abgelehnt' }),
    ]);
    expect(res.map(r => r.anonId)).toEqual(['MA03']);
  });

  it('Einträge ohne Zeitstempel landen hinten', () => {
    const res = interessentenNachWunschzeit([
      z({ antragId: 'A1', anonId: 'MA01', status: 'selbst' }),
      z({ antragId: 'A1', anonId: 'MA02', status: 'selbst', selbstEingetragenAm: '2026-06-02T10:00:00.000Z' }),
    ]);
    expect(res.map(r => r.anonId)).toEqual(['MA02', 'MA01']);
  });
});

describe('wunschKlickTs', () => {
  it('fällt für Pre-v2.9-Einträge auf freigegebenAm zurück', () => {
    const ts = wunschKlickTs(z({ antragId: 'A1', anonId: 'MA01', status: 'selbst', freigegebenAm: '2026-06-01T10:00:00.000Z' }));
    expect(ts).toBe(Date.parse('2026-06-01T10:00:00.000Z'));
  });

  it('ohne jedes Datum: Infinity (sortiert ans Ende)', () => {
    expect(wunschKlickTs(z({ antragId: 'A1', anonId: 'MA01', status: 'selbst' }))).toBe(Number.POSITIVE_INFINITY);
  });
});

// Das eigentliche Zuweisen passiert im Fachsystem; bestätigt wird es erst durch
// den CSV-Import (tib_kuerz). Bis dahin ist die App-Freigabe eine Absicht.
describe('unbestaetigteFreigabeTage', () => {
  const JETZT = Date.parse('2026-06-10T12:00:00.000Z');
  const vorTagen = (n: number): string =>
    new Date(JETZT - n * 86_400_000).toISOString();

  it('frische Freigabe ist kein Alarm (Bestätigung kommt frühestens morgen)', () => {
    const ze = [z({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben', freigegebenAm: vorTagen(1) })];
    expect(unbestaetigteFreigabeTage(ze, JETZT)).toBeNull();
  });

  it('ab der Fälligkeit meldet sie das Alter', () => {
    const ze = [z({
      antragId: 'A1', anonId: 'MA01', status: 'freigegeben',
      freigegebenAm: vorTagen(BESTAETIGUNG_FAELLIG_TAGE),
    })];
    expect(unbestaetigteFreigabeTage(ze, JETZT)).toBe(BESTAETIGUNG_FAELLIG_TAGE);
  });

  it('nimmt die ÄLTESTE Freigabe des Verbundes', () => {
    const ze = [
      z({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben', freigegebenAm: vorTagen(4) }),
      z({ antragId: 'A2', anonId: 'MA01', status: 'freigegeben', freigegebenAm: vorTagen(9) }),
    ];
    expect(unbestaetigteFreigabeTage(ze, JETZT)).toBe(9);
  });

  it('ignoriert Wünsche und Ablehnungen — nur Freigaben warten auf die CSV', () => {
    const ze = [
      z({ antragId: 'A1', anonId: 'MA01', status: 'selbst', selbstEingetragenAm: vorTagen(30) }),
      z({ antragId: 'A2', anonId: 'MA02', status: 'abgelehnt' }),
    ];
    expect(unbestaetigteFreigabeTage(ze, JETZT)).toBeNull();
  });

  it('ohne Freigabe-Datum (Altbestand) kein Alarm statt falscher Zahl', () => {
    const ze = [z({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben' })];
    expect(tageSeitFreigabe(ze[0]!, JETZT)).toBeNull();
    expect(unbestaetigteFreigabeTage(ze, JETZT)).toBeNull();
  });
});
