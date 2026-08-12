/**
 * Artefakt-Leiste-VMs (Journey-Paket 2 Phase 7). Sichtbarkeits-Matrix (Run ×
 * Fachprüfung), GA-Fortschritt (freigegeben/gesamt + aktiver Abschnitt),
 * NF-Versand-Zählung + nächstes offenes TV, Frist-Kurzformat.
 */
import { describe, it, expect } from 'vitest';
import {
  buildGutachtenKarte, buildNachforderungKarte, formatFristKurz, istGutachtenPhase,
} from '../artefaktKarten';
import type { StepRun, WorkflowRun } from '../../gutachten/types';

const STEPS = [
  { id: 'A', label: 'Ausgangslage' },
  { id: 'B', label: 'Stand' },
  { id: 'C', label: 'Ziele' },
  { id: 'D', label: 'Markt' },
  { id: 'E', label: 'Verwertung' },
  { id: 'F', label: 'Wirkung' },
  { id: 'G', label: 'Gesamt' },
];

function step(status: StepRun['status']): StepRun {
  return { quellenanalyse: '', entwurf: '', finalerText: '', checks: [], status, erstellt_am: '', modell: '' };
}

function gaRun(over: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    aktenzeichen: 'VB-1', schritte: {}, aktiverSchritt: 'A',
    erstellt_am: '', geaendert_am: '', schemaVersion: 1, ...over,
  };
}

describe('buildGutachtenKarte', () => {
  it('kein Run + nicht Fachprüfung → null (Karte nicht rendern)', () => {
    expect(buildGutachtenKarte(null, STEPS, false)).toBeNull();
  });

  it('kein Run + Fachprüfung → „leer" (Noch nicht begonnen)', () => {
    expect(buildGutachtenKarte(null, STEPS, true)).toEqual({ kind: 'leer' });
  });

  it('Run → Fortschritt: freigegeben/gesamt + aktiver Abschnitt (Label + Status)', () => {
    const run = gaRun({
      aktiverSchritt: 'D',
      schritte: {
        A: step('freigegeben'), B: step('freigegeben'),
        C: step('freigegeben'), D: step('entwurf'),
      },
    });
    expect(buildGutachtenKarte(run, STEPS, true)).toEqual({
      kind: 'fortschritt',
      freigegeben: 3,
      gesamt: 7,
      aktiverSchritt: 'D',
      aktiverLabel: 'Markt',
      aktiverStatus: 'entwurf',
    });
  });

  it('aktiver Abschnitt ohne StepRun → Status „leer"', () => {
    const run = gaRun({ aktiverSchritt: 'A', schritte: {} });
    const vm = buildGutachtenKarte(run, STEPS, false);
    expect(vm).toMatchObject({ kind: 'fortschritt', freigegeben: 0, gesamt: 7, aktiverStatus: 'leer' });
  });

  it('gesamt folgt der aufgelösten Schrittliste (nicht fix 7)', () => {
    const run = gaRun({ schritte: { A: step('freigegeben') } });
    const vm = buildGutachtenKarte(run, STEPS.slice(0, 3), false);
    expect(vm).toMatchObject({ freigegeben: 1, gesamt: 3 });
  });
});

function nfRun(status: StepRun['status'], az: string): WorkflowRun {
  return {
    aktenzeichen: az, schritte: { NF: step(status) }, aktiverSchritt: 'NF',
    erstellt_am: '', geaendert_am: '', schemaVersion: 1,
  };
}

describe('buildNachforderungKarte', () => {
  const tvs = [{ aktenzeichen: 'TV1' }, { aktenzeichen: 'TV2' }, { aktenzeichen: 'TV3' }];

  it('kein NF-Run auf irgendeinem TV → null (nicht erreicht)', () => {
    expect(buildNachforderungKarte({ tvs, nfRunByAz: new Map(), fristDatum: null })).toBeNull();
  });

  it('versendet = TV-Runs mit NF.status freigegeben; nächstes TV = erstes offene', () => {
    const map = new Map([
      ['TV1', nfRun('freigegeben', 'TV1')],
      ['TV2', nfRun('freigegeben', 'TV2')],
      ['TV3', nfRun('entwurf', 'TV3')],
    ]);
    expect(buildNachforderungKarte({ tvs, nfRunByAz: map, fristDatum: null })).toEqual({
      versendet: 2,
      tvGesamt: 3,
      naechstesTv: { index: 3, aktenzeichen: 'TV3' },
      fristKurz: null,
    });
  });

  it('nur Entwürfe → versendet 0, nächstes TV = TV1', () => {
    const map = new Map([['TV1', nfRun('entwurf', 'TV1')]]);
    const vm = buildNachforderungKarte({ tvs, nfRunByAz: map, fristDatum: null });
    expect(vm).toMatchObject({ versendet: 0, naechstesTv: { index: 1, aktenzeichen: 'TV1' } });
  });

  it('alle versendet → naechstesTv null', () => {
    const map = new Map([
      ['TV1', nfRun('freigegeben', 'TV1')],
      ['TV2', nfRun('freigegeben', 'TV2')],
      ['TV3', nfRun('freigegeben', 'TV3')],
    ]);
    const vm = buildNachforderungKarte({ tvs, nfRunByAz: map, fristDatum: null });
    expect(vm).toMatchObject({ versendet: 3, naechstesTv: null });
  });

  it('Frist wird als DD.MM. formatiert', () => {
    const map = new Map([['TV1', nfRun('entwurf', 'TV1')]]);
    const vm = buildNachforderungKarte({ tvs, nfRunByAz: map, fristDatum: '2026-07-14' });
    expect(vm?.fristKurz).toBe('14.07.');
  });
});

describe('formatFristKurz', () => {
  it('ISO → DD.MM.', () => {
    expect(formatFristKurz('2026-07-14')).toBe('14.07.');
    expect(formatFristKurz('2026-01-03')).toBe('03.01.');
  });
  it('null / ungültig → null', () => {
    expect(formatFristKurz(null)).toBeNull();
    expect(formatFristKurz('kein-datum')).toBeNull();
  });
});

/*
 * Das Gate der GA-Karte hing bis v4.3 an zwei festen ZAH-Phasen-Ids. Es fragt
 * aber „wer ist am Zug", also die Arbeitsliste — die Achse, die im Code bleibt.
 */
describe('istGutachtenPhase', () => {
  it('gilt in Prüfung und Entscheidung', () => {
    expect(istGutachtenPhase('techn geprüft')).toBe(true);      // 38 → in_pruefung
    expect(istGutachtenPhase('Gutachten fertig')).toBe(true);   // 40 → in_pruefung
    expect(istGutachtenPhase('bewilligungsreif')).toBe(true);   // 51 → entscheidung
    expect(istGutachtenPhase('Ablehnung versandt')).toBe(true); // 70 → entscheidung
  });

  it('gilt nicht davor, nicht danach und nicht bei fehlendem Status', () => {
    expect(istGutachtenPhase('beantragt')).toBe(false);         // 31 → offen
    expect(istGutachtenPhase('NF gestellt')).toBe(false);       // 35 → nachforderung (Anker)
    expect(istGutachtenPhase('bewilligt')).toBe(false);         // 59 → bewilligt
    expect(istGutachtenPhase('Schlussvermerk')).toBe(false);    // 99 → abgeschlossen
    expect(istGutachtenPhase(null)).toBe(false);
    expect(istGutachtenPhase('')).toBe(false);
  });

  it('schließt „abgelehnt/zurückgezogen" am Rohwert aus, nicht erst über die Kategorie', () => {
    expect(istGutachtenPhase('abgelehnt/zurückgezogen')).toBe(false);
  });
});
