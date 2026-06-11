import { describe, expect, it } from 'vitest';
import { renderCitations } from '../services/citations';

describe('renderCitations', () => {
  it('wandelt [n] in einen klickbaren cite-Span (Klammern entfernt)', () => {
    const out = renderCitations('<p>Text [3] mehr</p>');
    expect(out).toContain('<span class="cite" data-cite="3">3</span>');
    expect(out).not.toContain('[3]');
  });

  it('[n, m] → zwei einzelne Chips', () => {
    const out = renderCitations('<p>[3, 5]</p>');
    expect(out).toContain('data-cite="3"');
    expect(out).toContain('data-cite="5"');
    expect(out).not.toContain('[3, 5]');
  });

  it('markiert die aktive Quelle mit der active-Klasse', () => {
    const out = renderCitations('<p>[3] [4]</p>', 3);
    expect(out).toContain('<span class="cite active" data-cite="3">3</span>');
    expect(out).toContain('<span class="cite" data-cite="4">4</span>');
  });

  it('fasst [n] in <code> nicht an', () => {
    const out = renderCitations('<p>siehe <code>arr[3]</code> hier</p>');
    expect(out).toContain('<code>arr[3]</code>');
  });

  it('fasst [n] in <pre>-Blöcken nicht an', () => {
    const out = renderCitations('<pre><code>matrix[1][2]</code></pre>');
    expect(out).toContain('matrix[1][2]');
    expect(out).not.toContain('data-cite');
  });

  it('lässt Tag-Attribute unangetastet', () => {
    const out = renderCitations('<a href="/a?x=[1]">link</a>');
    expect(out).toContain('href="/a?x=[1]"');
  });

  it('Text ohne Zitate bleibt unverändert', () => {
    expect(renderCitations('<p>Nur Text</p>')).toBe('<p>Nur Text</p>');
  });
});
