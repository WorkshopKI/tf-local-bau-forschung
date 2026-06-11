import { describe, it, expect } from 'vitest';
import { buildMarkdownMitFrontmatter, parseFrontmatter, type DokumentMeta } from '../frontmatter';

describe('frontmatter', () => {
  const meta: DokumentMeta = {
    fkz: '16EP001234', typ: 'vorhabensbeschreibung',
    quelle: 'VB.pdf', konvertiert_am: '2026-06-11T10:00:00.000Z',
  };

  it('baut Frontmatter + Inhalt', () => {
    const md = buildMarkdownMitFrontmatter(meta, '# Titel\n\nText');
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('fkz: 16EP001234');
    expect(md).toContain('typ: vorhabensbeschreibung');
    expect(md).toContain('quelle: VB.pdf');
    expect(md.endsWith('# Titel\n\nText')).toBe(true);
  });

  it('round-trip: parse liest die Meta zurück', () => {
    const md = buildMarkdownMitFrontmatter(meta, 'Body');
    const parsed = parseFrontmatter(md);
    expect(parsed?.meta).toEqual(meta);
    expect(parsed?.body).toBe('Body');
  });

  it('Werte mit Doppelpunkt werden gequotet', () => {
    const md = buildMarkdownMitFrontmatter({ ...meta, quelle: 'a: b.pdf' }, 'x');
    expect(parseFrontmatter(md)?.meta.quelle).toBe('a: b.pdf');
  });

  it('ohne Frontmatter → null', () => {
    expect(parseFrontmatter('# nur Inhalt')).toBeNull();
  });
});
