import { describe, it, expect } from 'vitest';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import { readText } from '@/core/services/infrastructure/atomic-write';
import { spiegeleAbschnitt, slugFor } from '../gutachten-mirror';

describe('gutachten-mirror', () => {
  it('slugFor: Label → ASCII-Slug', () => {
    expect(slugFor('A')).toBe('kurzfassung'); // Label „Kurzfassung"
    expect(slugFor('D')).toBe('markt');        // Label „Markt"
  });

  it('schreibt den Entwurf als .md mit Frontmatter in den persönlichen Ordner', async () => {
    const root = memRoot();
    await spiegeleAbschnitt(root, '16EP001234', 'A', 'Das ist der Kurzfassungstext.', '2026-06-12T08:00:00.000Z');
    const md = await readText(root, 'ZAH/antraege/16EP001234/gutachten/A-kurzfassung.md');
    expect(md).not.toBeNull();
    expect(md).toContain('abschnitt: A');
    expect(md).toContain('status: entwurf');
    expect(md).toContain('Das ist der Kurzfassungstext.');
  });
});
