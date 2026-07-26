/**
 * Kriterien-basierte Abschnitts-QS (Phase 3): der autoritative Prompt-Block, die
 * Satz-Referenzen im toleranten Parser, die deterministische Vorarbeit
 * (`saetzeOhneBeleg`) und die Abnahme samt Invalidierung.
 */
import { describe, it, expect } from 'vitest';
import { buildQsKriterienBlock, parseQsBefunde } from '../qs';
import { saetzeOhneBeleg } from '../belege';
import {
  emptyRun, applyGeneration, applyQsHinweise, applyBearbeitung, applyLektorat, applyZuruecksetzen,
  type GenerationInput,
} from '../runner';
import { composeSkillPrompt } from '@/core/services/skills';
import type { QuellenBeleg, SkillRecord } from '@/core/services/skills';
import type { QsAbnahme, WorkflowRun } from '../types';

const NOW = '2026-07-20T10:00:00.000Z';
const LATER = '2026-07-20T11:00:00.000Z';

function gen(finalerText: string, over: Partial<GenerationInput> = {}): GenerationInput {
  return {
    quellenanalyse: 'qa', entwurf: '', finalerText, checks: [],
    modell: 'llama.cpp', skillId: 'gutachten-kurzfassung', skillVersion: 3, ...over,
  };
}
function runMitA(text = 'Satz eins. Satz zwei. Satz drei.'): WorkflowRun {
  return applyGeneration(emptyRun('AZ', NOW), 'A', gen(text), NOW);
}
const ABNAHME: QsAbnahme = { status: 'bestanden', am: NOW, kriterienVersion: 3 };

describe('buildQsKriterienBlock', () => {
  it('nennt jedes Kriterium als ###-Block und ueberstimmt die Default-Dimensionen', () => {
    const block = buildQsKriterienBlock(['Aussagen belegt', 'Risiken konkret']);
    expect(block).toContain('überstimmen die Dimensionen oben');
    expect(block).toContain('### Aussagen belegt');
    expect(block).toContain('### Risiken konkret');
    expect(block).toContain('Bewertung: ok | hinweis | unklar');
    expect(block).toContain('Sätze:');
  });

  it('leere Liste → leerer Block (Aufrufer haengt dann nichts an)', () => {
    expect(buildQsKriterienBlock([])).toBe('');
    expect(buildQsKriterienBlock(['   '])).toBe('');
  });

  it('nennt Pruefkandidaten 1-basiert und ausdruecklich als Auswahl-Hilfe', () => {
    const block = buildQsKriterienBlock(['Aussagen belegt'], [0, 2]);
    expect(block).toContain('1, 3');
    expect(block).toContain('KEIN Befund');
  });

  it('ohne Pruefkandidaten steht kein Auswahl-Hinweis im Block', () => {
    expect(buildQsKriterienBlock(['Aussagen belegt'])).not.toContain('Hinweis zur Auswahl');
  });
});

describe('composeSkillPrompt — qsKriterien-Anhang', () => {
  const skill: SkillRecord = {
    id: 'qs-basis', name: 'QS', beschreibung: '', version: 1,
    promptTemplate: 'Bewerte {{zielText}}.',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [], geaendert_am: 't',
  };
  const basis = { stammdaten: '', vbMarkdown: '', zielText: 'Text.' };

  it('ohne Kriterien ist der Prompt byte-identisch zu vorher', () => {
    const ohne = composeSkillPrompt(skill, [], basis, '');
    const leer = composeSkillPrompt(skill, [], { ...basis, qsKriterien: '' }, '');
    expect(leer).toBe(ohne);
  });

  it('mit Kriterien haengt der Block ans ENDE (ueberstimmt das Template)', () => {
    const ohne = composeSkillPrompt(skill, [], basis, '');
    const mit = composeSkillPrompt(skill, [], { ...basis, qsKriterien: 'BLOCK' }, '');
    expect(mit.startsWith(ohne)).toBe(true);
    expect(mit.endsWith('BLOCK')).toBe(true);
  });
});

describe('parseQsBefunde — Satz-Referenzen', () => {
  const antwort = '### Aussagen belegt\nBewertung: hinweis\nDie 50-%-Angabe hat keine Fundstelle.\nSätze: 3, 1\n';

  it('liest die Satz-Zeile 1-basiert und speichert 0-basiert, sortiert + dedupliziert', () => {
    const [b] = parseQsBefunde(antwort, 5);
    expect(b!.satzIndizes).toEqual([0, 2]);
  });

  it('haelt die Satz-Zeile aus dem Befund-Text heraus', () => {
    const [b] = parseQsBefunde(antwort, 5);
    expect(b!.text).not.toContain('Sätze:');
    expect(b!.text).toContain('50-%-Angabe');
  });

  it('ohne bekannte Satzanzahl wird nichts zugeordnet (lieber keine als eine falsche Marke)', () => {
    expect(parseQsBefunde(antwort)[0]!.satzIndizes).toBeUndefined();
  });

  it('verwirft Nummern ausserhalb des Textes statt zu werfen', () => {
    const [b] = parseQsBefunde('### K\nBewertung: hinweis\nX.\nSätze: 2, 99, 0\n', 3);
    expect(b!.satzIndizes).toEqual([1]); // 2→1 gueltig; 99 raus; 0→-1 raus
  });

  it('Muell in der Satz-Zeile fuehrt zu keiner Zuordnung', () => {
    const [b] = parseQsBefunde('### K\nBewertung: ok\nX.\nSätze: keine\n', 3);
    expect(b!.satzIndizes).toBeUndefined();
  });

  it('Befunde ohne Satz-Zeile bleiben unveraendert (Default-Dimensionen)', () => {
    const [b] = parseQsBefunde('### Ton\nBewertung: ok\nSachlich.\n', 3);
    expect(b!.satzIndizes).toBeUndefined();
    expect(b!.bewertung).toBe('ok');
  });
});

describe('saetzeOhneBeleg', () => {
  const beleg = (satzIndizes: number[]): QuellenBeleg => ({ zitat: 'z', satzIndizes });

  it('liefert die Saetze ohne live gueltige Beleg-Zuordnung', () => {
    expect(saetzeOhneBeleg([beleg([0]), beleg([2])], 4)).toEqual([1, 3]);
  });

  it('ignoriert veraltete Indizes ausserhalb des Textes', () => {
    expect(saetzeOhneBeleg([beleg([9])], 3)).toEqual([0, 1, 2]);
  });

  it('ohne Belege sind alle Saetze Kandidaten', () => {
    expect(saetzeOhneBeleg([], 2)).toEqual([0, 1]);
  });
});

describe('QS-Abnahme — Ableitung und Invalidierung', () => {
  it('applyQsHinweise stempelt die uebergebene Abnahme', () => {
    const r = applyQsHinweise(runMitA(), 'A', [], NOW, ABNAHME);
    expect(r.schritte['A']!.qsAbnahme).toEqual(ABNAHME);
  });

  it('ein Lauf ohne Abnahme (Skill ohne Kriterien) raeumt eine aeltere ab', () => {
    const mit = applyQsHinweise(runMitA(), 'A', [], NOW, ABNAHME);
    const ohne = applyQsHinweise(mit, 'A', [], LATER);
    expect(ohne.schritte['A']!.qsAbnahme).toBeUndefined();
  });

  it('manuelle Bearbeitung entwertet die Abnahme sichtbar statt sie zu loeschen', () => {
    const mit = applyQsHinweise(runMitA(), 'A', [], NOW, ABNAHME);
    const bearbeitet = applyBearbeitung(mit, 'A', 'Neuer Text.', [], LATER);
    expect(bearbeitet.schritte['A']!.qsAbnahme).toEqual({ ...ABNAHME, veraltet: true });
  });

  it('auch der Feinschliff entwertet sie', () => {
    const mit = applyQsHinweise(runMitA(), 'A', [], NOW, ABNAHME);
    const poliert = applyLektorat(mit, 'A', { finalerText: 'Poliert.', checks: [], modell: 'x' }, LATER);
    expect(poliert.schritte['A']!.qsAbnahme?.veraltet).toBe(true);
  });

  it('Zuruecksetzen einer Bearbeitung entwertet sie ebenfalls', () => {
    const mit = applyQsHinweise(runMitA(), 'A', [], NOW, ABNAHME);
    const bearbeitet = applyBearbeitung(mit, 'A', 'Neuer Text.', [], LATER);
    const zurueck = applyZuruecksetzen(bearbeitet, 'A', [], LATER);
    expect(zurueck.schritte['A']!.qsAbnahme?.veraltet).toBe(true);
  });

  it('ohne Abnahme bleibt alles undefiniert (Bestands-Runs unveraendert)', () => {
    const bearbeitet = applyBearbeitung(runMitA(), 'A', 'Neuer Text.', [], LATER);
    expect(bearbeitet.schritte['A']!.qsAbnahme).toBeUndefined();
  });
});
