/**
 * Reine Werkbank-Logik: Punkt-Keys/CRUD, Vorschläge (Aspekt schlägt Wortstamm),
 * Auftrags-Bau (Scope-Trennung, nur freigegebene, Punkt-Kontext), TODO-Tor.
 */
import { describe, it, expect } from 'vitest';
import { extractPlatzhalter, type TextbausteinRecord } from '@/core/services/skills';
import { entfernePunkt, neuerPunkt, punktKeyAusText, setzeErledigt, upsertPunkt } from '../punkte';
import { baueAuftrag, todoPunkte, vorschlaegeFuerPunkt } from '../bausteinAuswahl';
import type { WerkbankPunkt } from '../types';

const TS = '2026-08-01T00:00:00.000Z';

function baustein(over: Partial<TextbausteinRecord>): TextbausteinRecord {
  const text = over.text ?? 'Text.';
  return {
    id: 'X', artefaktTyp: 'nf', scope: 'tv', thema: 'Thema', kategorie: '',
    aspekte: [], stichworte: [], text, platzhalter: extractPlatzhalter(text),
    status: 'freigegeben', version: 1, historie: [], geaendertAm: TS, ...over,
  };
}

describe('Punkte', () => {
  it('leitet einen stabilen Key aus dem normalisierten Text ab', () => {
    expect(punktKeyAusText('  Risiken  benennen ')).toBe(punktKeyAusText('risiken benennen'));
    expect(punktKeyAusText('A')).not.toBe(punktKeyAusText('B'));
  });

  it('upsert ist idempotent bei gleichem Text', () => {
    const p1 = neuerPunkt('Risiken benennen', 'D', [], TS);
    let liste = upsertPunkt([], p1);
    liste = upsertPunkt(liste, neuerPunkt('risiken benennen', 'D', ['s2'], TS));
    expect(liste).toHaveLength(1);
    expect(liste[0]!.fundstellen).toEqual(['s2']);
  });

  it('entfernen + erledigt-Toggle wirken per Key', () => {
    const p = neuerPunkt('Punkt', null, [], TS);
    const liste = upsertPunkt([], p);
    expect(setzeErledigt(liste, p.key, true)[0]!.erledigt).toBe(true);
    expect(entfernePunkt(liste, p.key)).toEqual([]);
  });
});

const KATALOG: TextbausteinRecord[] = [
  baustein({ id: 'T1.1', scope: 'tv', thema: 'Risiken', text: 'Bitte benennen Sie technische Risiken.', aspekte: ['D'] }),
  baustein({ id: 'T1.2', scope: 'tv', thema: 'Schutzrechte', text: 'Bitte legen Sie Ihre Schutzrechte dar.' }),
  baustein({ id: 'G1.1', scope: 'verbund', thema: 'Arbeitsteilung', text: 'Bitte erläutern Sie die Arbeitsteilung.', aspekte: ['B'] }),
  baustein({ id: 'T9.9', scope: 'tv', thema: 'Entwurf', text: 'Noch offen.', status: 'entwurf', aspekte: ['D'] }),
];

function punkt(text: string, aspektId: string | null): WerkbankPunkt {
  return neuerPunkt(text, aspektId, [], TS);
}

describe('vorschlaegeFuerPunkt', () => {
  it('gewichtet den Aspekt-Tag über den Wortstamm-Treffer', () => {
    const v = vorschlaegeFuerPunkt(KATALOG, punkt('irgendwas', 'D'));
    expect(v[0]!.baustein.id).toBe('T1.1'); // Aspekt D
    expect(v.every(t => t.baustein.status === 'freigegeben')).toBe(true); // kein Entwurf
  });

  it('findet auch ohne Aspekt über den Wortstamm', () => {
    const v = vorschlaegeFuerPunkt(KATALOG, punkt('Schutzrechte klären', null));
    expect(v[0]!.baustein.id).toBe('T1.2');
  });
});

describe('baueAuftrag', () => {
  it('trennt die bestätigten Bausteine nach Scope und dedupliziert', () => {
    const pD = punkt('Risiken', 'D');
    const pB = punkt('Arbeitsteilung', 'B');
    const auftrag = baueAuftrag(KATALOG, [pD, pB], { [pD.key]: ['T1.1'], [pB.key]: ['G1.1'] });
    expect(auftrag.tvBausteine.map(b => b.id)).toEqual(['T1.1']);
    expect(auftrag.verbundBausteine.map(b => b.id)).toEqual(['G1.1']);
    expect(auftrag.punktKeys).toEqual([pD.key, pB.key]);
  });

  it('lässt nicht-freigegebene Bausteine still weg', () => {
    const p = punkt('Risiken', 'D');
    const auftrag = baueAuftrag(KATALOG, [p], { [p.key]: ['T1.1', 'T9.9'] });
    expect(auftrag.tvBausteine.map(b => b.id)).toEqual(['T1.1']); // T9.9 ist Entwurf
  });

  it('schreibt den Punkt-Kontext mit Aspekt und zugeordneten Bausteinen', () => {
    const p = punkt('Risiken benennen', 'D');
    const auftrag = baueAuftrag(KATALOG, [p], { [p.key]: ['T1.1'] });
    expect(auftrag.punktKontext).toContain('Risiken benennen');
    expect(auftrag.punktKontext).toContain('T1.1');
    expect(auftrag.punktKontext).toContain('[D');
  });

  it('markiert unzugeordnete Punkte als „kein Baustein"', () => {
    const p = punkt('Ohne Zuordnung', null);
    const auftrag = baueAuftrag(KATALOG, [p], {});
    expect(auftrag.punktKontext).toContain('kein Baustein zugeordnet');
    expect(auftrag.tvBausteine).toEqual([]);
  });
});

describe('todoPunkte', () => {
  it('nennt genau die gewählten Punkte ohne Baustein', () => {
    const p1 = punkt('A', 'D');
    const p2 = punkt('B', null);
    expect(todoPunkte([p1, p2], { [p1.key]: ['T1.1'] })).toEqual([p2.key]);
    expect(todoPunkte([p1, p2], { [p1.key]: ['T1.1'], [p2.key]: ['T1.2'] })).toEqual([]);
  });
});
