/**
 * Tests für den QS-Freigaben-Selektor (Phase 3 v1.1): Entwurf-vs-freigegeben-
 * Filter, offene Regeln (CheckResult `level !== 'ok'`) → Aktions-Label,
 * Bearbeiter-Filter (alle + Kürzel über scopeInfo), Pflichtfreigabe-Sortierung,
 * GA-Abschnitt-Untertitel, Typ-Zähler, Leerzustand.
 */
import { describe, expect, it } from 'vitest';
import type { CheckResult } from '@/core/services/skills';
import type { StepRun, StepStatus, WorkflowRun } from '@/plugins/antraege/gutachten/types';
import {
  baueQsFreigabenZeilen,
  zaehleProTyp,
  type QsRunEintrag,
  type QsScopeInfo,
} from '../qsFreigaben';

const NOW = Date.parse('2026-07-13T00:00:00.000Z');

function checks(...levels: Array<'ok' | 'hinweis' | 'fehler'>): CheckResult[] {
  return levels.map((level, i) => ({ id: `c${i}`, level, label: 'x' })) as CheckResult[];
}

function step(status: StepStatus, chk: CheckResult[], erstellt_am = '2026-06-01T00:00:00.000Z'): StepRun {
  return { status, checks: chk, erstellt_am } as unknown as StepRun;
}

function run(
  schritte: Record<string, StepRun>,
  geaendert_am = '2026-06-01T00:00:00.000Z',
): WorkflowRun {
  return { aktenzeichen: 'x', schritte, aktiverSchritt: 'A', erstellt_am: geaendert_am, geaendert_am, schemaVersion: 1 } as WorkflowRun;
}

const SCOPE = (scopeId: string): QsScopeInfo => ({ akronym: scopeId });

describe('baueQsFreigabenZeilen', () => {
  it('nimmt nur Entwurf-Schritte (freigegeben/leer raus)', () => {
    const runs: QsRunEintrag[] = [{
      typ: 'ga', scopeId: 'V1',
      run: run({
        A: step('freigegeben', checks('ok')),
        B: step('entwurf', checks('ok', 'fehler')),
        C: step('leer', []),
      }),
    }];
    const zeilen = baueQsFreigabenZeilen(runs, SCOPE, NOW);
    expect(zeilen.map(z => z.key)).toEqual(['ga:V1:B']);
    expect(zeilen[0]!.untertitel).toBe('Gutachten · Abschnitt B');
  });

  it('offene Regeln = Checks mit level !== ok → Aktions-Label', () => {
    const gruen = baueQsFreigabenZeilen(
      [{ typ: 'ga', scopeId: 'V1', run: run({ A: step('entwurf', checks('ok', 'ok')) }) }],
      SCOPE, NOW,
    );
    expect(gruen[0]!.offeneRegeln).toBe(0);
    expect(gruen[0]!.regelnGruen).toBe(true);

    const offen = baueQsFreigabenZeilen(
      [{ typ: 'ga', scopeId: 'V2', run: run({ A: step('entwurf', checks('ok', 'fehler', 'hinweis')) }) }],
      SCOPE, NOW,
    );
    expect(offen[0]!.offeneRegeln).toBe(2); // fehler + hinweis
    expect(offen[0]!.regelnGruen).toBe(false);
  });

  it('KEIN Bearbeiter-Filter — auch der Entwurf an einem fremden Vorgang bleibt', () => {
    // Die Runs liegen gerätelokal: wer sie sieht, hat sie selbst erzeugt. Bis
    // v4.134 filterte ein `sichtbar`-Flag sie nach dem Kürzel des Antrags —
    // gemessen verschwand damit der EIGENE Entwurf, während die Resume-Karte
    // daneben ihn zum Weiterarbeiten anbot.
    const runs: QsRunEintrag[] = [
      { typ: 'ga', scopeId: 'MEIN', run: run({ A: step('entwurf', checks('ok')) }) },
      { typ: 'ga', scopeId: 'FREMD', run: run({ A: step('entwurf', checks('ok')) }) },
    ];
    expect(baueQsFreigabenZeilen(runs, SCOPE, NOW).map(z => z.scopeId).sort()).toEqual(['FREMD', 'MEIN']);
  });

  it('sortiert Pflichtfreigabe (ABL/RNE) zuerst, dann Alter absteigend', () => {
    const runs: QsRunEintrag[] = [
      { typ: 'ga', scopeId: 'G', run: run({ A: step('entwurf', checks('ok'), '2026-01-01T00:00:00.000Z') }) }, // alt
      { typ: 'abl', scopeId: 'A', run: run({ A: step('entwurf', checks('ok'), '2026-06-01T00:00:00.000Z') }) }, // neu, aber Pflicht
      { typ: 'rne', scopeId: 'R', run: run({ A: step('entwurf', checks('ok'), '2026-05-01T00:00:00.000Z') }) }, // Pflicht
    ];
    const zeilen = baueQsFreigabenZeilen(runs, SCOPE, NOW);
    // Pflichtfreigabe zuerst (unter sich nach Alter desc: R älter als A), dann GA
    expect(zeilen.map(z => z.scopeId)).toEqual(['R', 'A', 'G']);
    expect(zeilen[0]!.pflichtfreigabe).toBe(true);
    expect(zeilen[2]!.pflichtfreigabe).toBe(false);
  });

  it('NF-Untertitel ohne Abschnitt', () => {
    const zeilen = baueQsFreigabenZeilen(
      [{ typ: 'nf', scopeId: 'TV1', run: run({ A: step('entwurf', checks('ok')) }) }],
      SCOPE, NOW,
    );
    expect(zeilen[0]!.untertitel).toBe('Nachforderung');
    expect(zeilen[0]!.typBadge).toBe('NF');
  });

  it('Leerzustand: keine Entwürfe → []', () => {
    const zeilen = baueQsFreigabenZeilen(
      [{ typ: 'ga', scopeId: 'V', run: run({ A: step('freigegeben', checks('ok')) }) }],
      SCOPE, NOW,
    );
    expect(zeilen).toEqual([]);
  });
});

describe('zaehleProTyp', () => {
  it('zählt je Artefakt-Typ', () => {
    const runs: QsRunEintrag[] = [
      { typ: 'ga', scopeId: 'V1', run: run({ A: step('entwurf', checks('ok')), B: step('entwurf', checks('ok')) }) },
      { typ: 'nf', scopeId: 'TV1', run: run({ A: step('entwurf', checks('ok')) }) },
    ];
    const zeilen = baueQsFreigabenZeilen(runs, SCOPE, NOW);
    const pills = zaehleProTyp(zeilen);
    expect(pills).toEqual([
      { typ: 'ga', badge: 'GA', count: 2 },
      { typ: 'nf', badge: 'NF', count: 1 },
    ]);
  });
});
