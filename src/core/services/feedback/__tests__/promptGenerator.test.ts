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

  it('UX: rendert Aktuelles Problem/Gewünschte Verbesserung', () => {
    const ticket = makeFeedback({
      category: 'ux',
      structured: { pain: 'Zu viele Klicks', better: 'Direkt-Button' },
    });
    const prompt = generateClaudeCodePrompt(ticket);
    expect(prompt).toContain('### Aktuelles Problem\n\nZu viele Klicks');
    expect(prompt).toContain('### Gewünschte Verbesserung\n\nDirekt-Button');
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
    expect(prompt).toContain('Beigefügte Screenshots');
    expect(prompt).toContain('`fb1-a1.png`');
    expect(prompt).toContain('Hier passiert es');
    expect(prompt).toContain('`fb1-a2.jpg`');
    expect(prompt).toContain('manuell mit anhängen');
    expect(prompt).not.toContain('base64');
    expect(prompt).not.toContain('data:image');
  });

  it('ohne attachments kein Screenshot-Abschnitt', () => {
    const prompt = generateClaudeCodePrompt(makeFeedback({ category: 'praise', text: 'gut' }));
    expect(prompt).not.toContain('Beigefügte Screenshots');
  });
});
