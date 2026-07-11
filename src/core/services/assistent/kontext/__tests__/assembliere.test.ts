/**
 * Tests des deterministischen Kontext-Assemblers (Assistent-Panel, Phase 1).
 *
 * Deckt die sechs geforderten Invarianten: (1) Determinismus; (2) fixe
 * Blockreihenfolge; (3) Budget-Kürzung in definierter Reihenfolge (Historie vor
 * Retrieval, Faktenblock nie); (4) gültiger Prompt ohne Entität; (5) Score-
 * Schwelle verwirft schwache Treffer; (6) verwendeteTreffer == eingebundene [n].
 */
import { describe, expect, it } from 'vitest';
import {
  assembliereAssistentKontext,
  GESAMT_MAX_CHARS,
  RETRIEVAL_K,
  RETRIEVAL_MIN_SCORE,
} from '../index';
import type { AssistentKontextEingabe, KontextEntitaet } from '../types';
import type { OramaSearchResult } from '@/core/services/search/orama-store';

function treffer(id: string, score: number, text = `Auszug ${id}`): OramaSearchResult {
  return { id, text, title: `Doc ${id}`, source: `${id}.pdf`, tags: [], type: 'dokument', score, method: 'hybrid' };
}

const entitaet: KontextEntitaet = {
  art: 'verbund',
  id: '16EP1234',
  titel: 'Musterbau',
  status: 'VN geprüft',
  phaseLabel: 'FuE-Phase',
  fristHinweis: 'in 45 T (im Zeitplan)',
  fristenAnzahl: 2,
  stammdaten: [{ label: 'Fördersumme', wert: '250.000 €' }],
};

function base(overrides: Partial<AssistentKontextEingabe> = {}): AssistentKontextEingabe {
  return {
    routeBeschreibung: 'Detailseite Verbund',
    entitaet,
    frage: 'Was ist mein nächster Schritt?',
    turns: [],
    treffer: null,
    ...overrides,
  };
}

describe('assembliereAssistentKontext', () => {
  it('(1) ist deterministisch — gleiche Eingabe ⇒ byte-identischer Prompt', () => {
    const eingabe = base({ treffer: [treffer('a', 0.8), treffer('b', 0.6)], turns: [{ rolle: 'nutzer', text: 'Hi' }] });
    expect(assembliereAssistentKontext(eingabe).promptText).toBe(assembliereAssistentKontext(eingabe).promptText);
  });

  it('(2) hält die feste Blockreihenfolge System → Fakten → Retrieval → Historie → Frage ein', () => {
    const { promptText } = assembliereAssistentKontext(base({
      treffer: [treffer('a', 0.8)],
      turns: [{ rolle: 'nutzer', text: 'frühere Frage' }],
    }));
    const iSystem = promptText.indexOf('Du bist der Assistent in TeamFlow Local');
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    const iRetrieval = promptText.indexOf('=== Auszüge aus den Dokumenten');
    const iHistorie = promptText.indexOf('=== Bisheriger Gesprächsverlauf');
    const iFrage = promptText.indexOf('=== Frage ===');
    expect(iSystem).toBeGreaterThanOrEqual(0);
    expect(iSystem).toBeLessThan(iFakten);
    expect(iFakten).toBeLessThan(iRetrieval);
    expect(iRetrieval).toBeLessThan(iHistorie);
    expect(iHistorie).toBeLessThan(iFrage);
  });

  it('(2b) bindet den geteilten Grundsatz-Block ein', () => {
    const { promptText } = assembliereAssistentKontext(base());
    expect(promptText).toContain('Streng quellenbasiert');
    expect(promptText).toContain('Keine Arbeitspaket-Verweise');
  });

  it('(3) kürzt Historie (älteste zuerst), bevor Retrieval angetastet wird; Faktenblock bleibt', () => {
    // Großer Faktenblock (Stammdaten) drückt das Ganze über das Gesamt-Budget.
    const grosseStammdaten = Array.from({ length: 30 }, (_, i) => ({
      label: `Feld ${i}`,
      wert: 'x'.repeat(600),
    }));
    const turns = Array.from({ length: 8 }, (_, i) => ({
      rolle: i % 2 === 0 ? ('nutzer' as const) : ('assistent' as const),
      text: `TURN_${i} ${'y'.repeat(1000)}`,
    }));
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({
      entitaet: { ...entitaet, stammdaten: grosseStammdaten },
      treffer: [treffer('a', 0.9), treffer('b', 0.8), treffer('c', 0.7)],
      turns,
    }));
    // Retrieval bleibt vollständig erhalten, Faktenblock (Stammdaten) auch.
    expect(verwendeteTreffer).toHaveLength(3);
    expect(promptText).toContain('Feld 29:');
    expect(promptText).toContain('=== Auszüge aus den Dokumenten');
    // Der älteste Turn wurde verworfen, der neueste bleibt.
    expect(promptText).not.toContain('TURN_0');
    expect(promptText).toContain('TURN_7');
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });

  it('(4) erzeugt ohne Entität einen gültigen Prompt ohne Faktenblock-Reste', () => {
    const { promptText, kontextBeschreibung } = assembliereAssistentKontext(base({ entitaet: null }));
    expect(promptText).toContain('Keine Entität ausgewählt');
    expect(promptText).toContain('Was ist mein nächster Schritt?');
    expect(promptText).not.toContain('Status:');
    expect(promptText).not.toContain('Nächster Schritt:');
    expect(promptText).not.toContain('Frist:');
    expect(kontextBeschreibung).toBe('Detailseite Verbund');
  });

  it('(5) verwirft Treffer unter der Score-Schwelle → kein Retrieval-Block', () => {
    const schwach = RETRIEVAL_MIN_SCORE - 0.05;
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({
      treffer: [treffer('a', schwach), treffer('b', schwach / 2)],
    }));
    expect(verwendeteTreffer).toHaveLength(0);
    expect(promptText).not.toContain('=== Auszüge aus den Dokumenten');
    expect(promptText).toContain('=== Frage ===');
  });

  it('(6) verwendeteTreffer enthält genau die eingebundenen [n] (top-k, sortiert)', () => {
    const many = Array.from({ length: RETRIEVAL_K + 2 }, (_, i) => treffer(`t${i}`, 0.9 - i * 0.02));
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({ treffer: many }));
    expect(verwendeteTreffer).toHaveLength(RETRIEVAL_K);
    expect(verwendeteTreffer.map(t => t.id)).toEqual(many.slice(0, RETRIEVAL_K).map(t => t.id));
    expect(promptText).toContain(`[${RETRIEVAL_K}]`);
    expect(promptText).not.toContain(`[${RETRIEVAL_K + 1}]`);
  });

  it('baut die Kontext-Beschreibung für die Chips aus den Entitäts-Metadaten', () => {
    expect(assembliereAssistentKontext(base()).kontextBeschreibung).toBe('Verbund Musterbau · FuE-Phase · 2 Fristen');
  });
});

describe('assembliereAssistentKontext — Gedächtnis-Block (Phase 2)', () => {
  it('ohne Gedächtnis: kein Block, gedaechtnisAnzahl 0', () => {
    const { promptText, gedaechtnisAnzahl } = assembliereAssistentKontext(base());
    expect(promptText).not.toContain('Hintergrundwissen');
    expect(gedaechtnisAnzahl).toBe(0);
  });

  it('fügt den Gedächtnis-Block NACH System und VOR Fakten ein; gedaechtnisAnzahl = Anzahl', () => {
    const { promptText, gedaechtnisAnzahl } = assembliereAssistentKontext(base({
      gedaechtnis: [{ text: 'Arbeitet an Verbund V1.' }, { text: 'Nutzt den Skill Kurzfassung.' }],
    }));
    const iSystem = promptText.indexOf('Du bist der Assistent in TeamFlow Local');
    const iGed = promptText.indexOf('=== Hintergrundwissen');
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    expect(iSystem).toBeLessThan(iGed);
    expect(iGed).toBeLessThan(iFakten);
    expect(promptText).toContain('kann veraltet sein');
    expect(promptText).toContain('Arbeitet an Verbund V1.');
    expect(gedaechtnisAnzahl).toBe(2);
  });

  it('kürzt das Gedächtnis ZUERST (vor Historie/Retrieval), Fakten bleiben', () => {
    const grosseStammdaten = Array.from({ length: 31 }, (_, i) => ({ label: `Feld ${i}`, wert: 'x'.repeat(600) }));
    const gedaechtnis = Array.from({ length: 12 }, (_, i) => ({ text: `MEM_${i} ${'g'.repeat(300)}` }));
    const turns = [
      { rolle: 'nutzer' as const, text: `TURN_0 ${'y'.repeat(800)}` },
      { rolle: 'assistent' as const, text: `TURN_1 ${'z'.repeat(800)}` },
    ];
    const { promptText, gedaechtnisAnzahl, verwendeteTreffer } = assembliereAssistentKontext(base({
      entitaet: { ...entitaet, stammdaten: grosseStammdaten },
      gedaechtnis,
      turns,
      treffer: [treffer('a', 0.9)],
    }));
    // Gedächtnis wird TEILWEISE gekürzt (von hinten). Dass noch Einträge übrig
    // sind (>0) BEWEIST, dass die Kaskade in der Gedächtnis-Phase gestoppt hat —
    // Historie + Retrieval + Fakten wurden also nie angetastet.
    expect(gedaechtnisAnzahl).toBeGreaterThan(0);
    expect(gedaechtnisAnzahl).toBeLessThan(12);
    expect(promptText).not.toContain('MEM_11'); // letzter Eintrag zuerst gekürzt
    expect(promptText).toContain('MEM_0');       // erster Eintrag bleibt
    expect(promptText).toContain('TURN_0');      // Historie unangetastet
    expect(promptText).toContain('TURN_1');
    expect(verwendeteTreffer).toHaveLength(1);   // Retrieval unangetastet
    expect(promptText).toContain('Feld 30:');    // Fakten unangetastet
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });
});
