/**
 * Tests für generateClaudeCodePrompt — Schwerpunkt: die strukturierten
 * Formular-Felder (FeedbackItem.structured) werden typspezifisch gerendert.
 */
import { describe, expect, it } from 'vitest';
import { generateClaudeCodePrompt } from '../promptGenerator';
import { makeFeedback } from './fixtures';

describe('generateClaudeCodePrompt — structured', () => {
  it('Bug: rendert Repro/Tatsächlich/Erwartet, lässt leere Felder weg', () => {
    const ticket = makeFeedback({
      category: 'problem',
      text: 'irgendwas',
      structured: { steps: 'Suche geöffnet', actual: 'Absturz', expected: '' },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Schritte zur Reproduktion\n\nSuche geöffnet');
    expect(prompt).toContain('### Tatsächliches Verhalten\n\nAbsturz');
    expect(prompt).not.toContain('### Erwartetes Verhalten');
    expect(prompt).toContain('Kategorie: **Problem**');
  });

  it('Feature: rendert Ziel/Begründung/Lösungsidee', () => {
    const ticket = makeFeedback({
      category: 'idea',
      structured: { goal: 'PDF-Export', reason: 'Für die Ablage', idea: 'Button oben rechts' },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Ziel\n\nPDF-Export');
    expect(prompt).toContain('### Begründung / Kontext\n\nFür die Ablage');
    expect(prompt).toContain('### Lösungsidee\n\nButton oben rechts');
  });

  // Ehemalige UX-Tickets werden beim Lesen auf 'idea' + goal/idea normalisiert
  // (normalizeLegacyFields, v2.289) — der Prompt rendert sie als Feature-Wunsch.
  it('migriertes UX-Ticket: rendert Ziel/Lösungsidee', () => {
    const ticket = makeFeedback({
      category: 'idea',
      structured: { goal: 'Zu viele Klicks', idea: 'Direkt-Button' },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Ziel\n\nZu viele Klicks');
    expect(prompt).toContain('### Lösungsidee\n\nDirekt-Button');
  });

  it('stellt eine vorhandene LLM-Summary voran, ersetzt die Felder aber nicht', () => {
    const ticket = makeFeedback({
      category: 'problem',
      structured: { actual: 'Absturz' },
      llm_classification: {
        category: 'bug', summary: 'Suche stürzt ab', details: '', affectedArea: 'Suche', priority_suggestion: 3,
      },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('Suche stürzt ab');
    expect(prompt).toContain('### Tatsächliches Verhalten\n\nAbsturz');
  });

  it('Fallback ohne structured: nutzt den rohen Text', () => {
    const ticket = makeFeedback({ category: 'praise', text: 'Tolle App' });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('Tolle App');
    expect(prompt).not.toContain('###');
  });
});

describe('generateClaudeCodePrompt — improveFeedback-Felder (v2.165)', () => {
  it('rendert Anforderung (Ist/Soll) VOR den structured-Sektionen', () => {
    const ticket = makeFeedback({
      category: 'problem',
      structured: { actual: 'Absturz' },
      llm_classification: {
        category: 'bug', summary: 'S', details: '', affectedArea: 'suche', priority_suggestion: 3,
        anforderung: 'IST: Absturz beim Suchen. SOLL: Kein Absturz.',
      },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    const anforderungIdx = prompt.indexOf('### Anforderung (Ist/Soll)');
    const strukturIdx = prompt.indexOf('### Tatsächliches Verhalten');
    expect(anforderungIdx).toBeGreaterThan(-1);
    expect(strukturIdx).toBeGreaterThan(anforderungIdx);
    expect(prompt).toContain('IST: Absturz beim Suchen. SOLL: Kein Absturz.');
  });

  it('rendert Akzeptanzkriterien als Liste', () => {
    const ticket = makeFeedback({
      category: 'idea',
      llm_classification: {
        category: 'feature', summary: 'S', details: '', affectedArea: 'suche', priority_suggestion: 3,
        akzeptanzkriterien: ['Kriterium eins', 'Kriterium zwei'],
      },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Akzeptanzkriterien');
    expect(prompt).toContain('- Kriterium eins');
    expect(prompt).toContain('- Kriterium zwei');
  });

  it('verbessert:true → Hinweiszeile "Durch interne KI verfeinert"', () => {
    const ticket = makeFeedback({
      category: 'praise',
      llm_classification: {
        category: 'praise', summary: 'S', details: '', affectedArea: 'suche', priority_suggestion: 3, verbessert: true,
      },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('Durch interne KI verfeinert');
  });

  it('ohne anforderung/akzeptanzkriterien/verbessert: keine neuen Abschnitte', () => {
    const ticket = makeFeedback({ category: 'praise', text: 'Tolle App' });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).not.toContain('### Anforderung (Ist/Soll)');
    expect(prompt).not.toContain('### Akzeptanzkriterien');
    expect(prompt).not.toContain('Durch interne KI verfeinert');
  });
});

describe('generateClaudeCodePrompt — attachments', () => {
  it('listet Screenshots (Dateiname + Caption) + Manuell-Anhängen-Hinweis, kein base64', () => {
    const ticket = makeFeedback({
      category: 'problem',
      structured: { actual: 'Absturz' },
      attachments: [
        { id: 'a1', filename: 'fb1-a1.png', caption: 'Hier passiert es', mime: 'image/png', width: 800, height: 600, bytes: 1234 },
        { id: 'a2', filename: 'fb1-a2.jpg', mime: 'image/jpeg', width: 800, height: 600, bytes: 2345 },
      ],
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('Beigefügte Anhänge');
    expect(prompt).toContain('### Screenshots');
    expect(prompt).toContain('`fb1-a1.png`');
    expect(prompt).toContain('Hier passiert es');
    expect(prompt).toContain('`fb1-a2.jpg`');
    expect(prompt).toContain('manuell mit anhängen');
    expect(prompt).not.toContain('base64');
    expect(prompt).not.toContain('data:image');
  });

  it('listet beigefügte Dateien mit Original-Namen unter „### Dateien"', () => {
    const ticket = makeFeedback({
      category: 'idea',
      structured: { goal: 'Import' },
      attachments: [
        { id: 'f1', filename: 'fb1-f1.xlsx', kind: 'file', name: 'Kennzahlen.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', width: 0, height: 0, bytes: 4096 },
      ],
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Dateien');
    expect(prompt).toContain('`Kennzahlen.xlsx`');
    expect(prompt).not.toContain('### Screenshots');
  });

  it('ohne attachments kein Anhang-Abschnitt', () => {
    const prompt = generateClaudeCodePrompt(makeFeedback({ category: 'praise', text: 'gut' }));
    expect(prompt).not.toContain('Beigefügte Anhänge');
  });
});
