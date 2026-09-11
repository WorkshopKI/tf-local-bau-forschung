/**
 * Unit-Tests für die PUREN Funktionen aus scripts/version-bump.mjs
 * (Skeleton-Insertion, Version-Bump, Rotation/Block-Split). Kein FS —
 * ausschließlich synthetische Changelog-Strings.
 */
import { describe, it, expect } from 'vitest';
import {
  bumpVersionField,
  splitIntoBlocks,
  insertChangelogSkeleton,
  insertUserSkeleton,
  hatUserBlock,
  rotateChangelog,
} from '../../scripts/version-bump.mjs';

const HEADER = '# Changelog\n\nBla bla.\n\n';
const mkBlock = (v: string, t: string): string =>
  `### v${v} — ${t} (Januar 2026)\n\nPATCH — motivation\n\n- bullet\n\n`;

describe('bumpVersionField', () => {
  const pkg = '{\n  "name": "x",\n  "version": "2.247.0"\n}\n';
  it('bumpt major/minor/patch', () => {
    expect(bumpVersionField(pkg, 'major').version).toBe('3.0.0');
    expect(bumpVersionField(pkg, 'minor').version).toBe('2.248.0');
    expect(bumpVersionField(pkg, 'patch').version).toBe('2.247.1');
    expect(bumpVersionField(pkg, 'patch').text).toContain('"version": "2.247.1"');
  });
  it('wirft bei fehlendem version-Feld oder falschem Typ', () => {
    expect(() => bumpVersionField('{}', 'patch')).toThrow();
    expect(() => bumpVersionField(pkg, 'nope')).toThrow();
  });
});

describe('insertChangelogSkeleton', () => {
  it('fügt vor dem ersten ### v ein; Header bleibt oben', () => {
    const cl = HEADER + mkBlock('2.247.0', 'Alt');
    const out = insertChangelogSkeleton(cl, {
      version: '2.248.0', title: 'Neu', kind: 'minor', monthYear: 'Juli 2026',
    });
    expect(out.startsWith(HEADER)).toBe(true);
    const iNew = out.indexOf('### v2.248.0');
    const iOld = out.indexOf('### v2.247.0');
    expect(iNew).toBeGreaterThan(-1);
    expect(iNew).toBeLessThan(iOld);
    expect(out).toContain('### v2.248.0 — Neu (Juli 2026)');
    expect(out).toContain('MINOR —');
  });
});

describe('rotateChangelog', () => {
  // blocks newest-first: v1.6.0 … v1.1.0
  const blocks = Array.from({ length: 6 }, (_, i) => mkBlock(`1.${6 - i}.0`, `T${6 - i}`));
  const cl = HEADER + blocks.join('');
  const archive = '# Archiv\n\n' + mkBlock('0.9.0', 'Old');

  it('No-op unter dem Trigger', () => {
    const r = rotateChangelog(cl, archive, { trigger: 10 * 1024 });
    expect(r.rotated).toBe(0);
    expect(r.changelog).toBe(cl);
    expect(r.archive).toBe(archive);
  });

  it('peelt von unten bis targetMax, hält minKeep, bewahrt Reihenfolge + Block-Zahl', () => {
    const r = rotateChangelog(cl, archive, { trigger: 1, targetMax: 1, minKeep: 2 });
    expect(r.rotated).toBe(4);
    const kept = splitIntoBlocks(r.changelog).blocks;
    expect(kept.length).toBe(2);
    expect(r.changelog).toContain('### v1.6.0');
    expect(r.changelog).toContain('### v1.5.0');
    expect(r.changelog).not.toContain('### v1.1.0');
    const aBlocks = splitIntoBlocks(r.archive).blocks;
    expect(aBlocks[0]).toContain('### v1.4.0'); // erster gepeelter, oben im Archiv
    expect(aBlocks[aBlocks.length - 1]).toContain('### v0.9.0');
    expect(kept.length + aBlocks.length).toBe(6 + 1); // nichts verloren
  });

  it('respektiert minKeep auch wenn targetMax nie erreichbar ist', () => {
    const r = rotateChangelog(cl, archive, { trigger: 1, targetMax: 1, minKeep: 6 });
    expect(r.rotated).toBe(0);
  });
});

describe('insertUserSkeleton', () => {
  it('fügt ## v vor dem ersten ## v ein', () => {
    const u = '<!-- header -->\n\n## v2.247 — 2026-07\n\n### Neu\n- x\n';
    const out = insertUserSkeleton(u, { majorMinor: '2.248', isoMonth: '2026-07' });
    const iNew = out.indexOf('## v2.248');
    const iOld = out.indexOf('## v2.247');
    expect(iNew).toBeGreaterThan(-1);
    expect(iNew).toBeLessThan(iOld);
    expect(out).toContain('### Verbesserungen');
  });

  it('lässt den Text unverändert, wenn der Block der Minor-Version schon steht (Patch mit --user)', () => {
    const u = '<!-- header -->\n\n## v6.60 — 2026-09\n\n### Neu\n- x\n\n## v6.59 — 2026-09\n';
    expect(insertUserSkeleton(u, { majorMinor: '6.60', isoMonth: '2026-09' })).toBe(u);
  });

  it('verwechselt v6.6 nicht mit v6.60', () => {
    const u = '<!-- header -->\n\n## v6.60 — 2026-09\n\n### Neu\n- x\n';
    const out = insertUserSkeleton(u, { majorMinor: '6.6', isoMonth: '2026-09' });
    expect(out).toContain('## v6.6 — 2026-09');
    expect(out.indexOf('## v6.6 —')).toBeLessThan(out.indexOf('## v6.60'));
  });
});

describe('hatUserBlock', () => {
  const u = '<!-- ## v9.9 im Kommentar zählt nicht -->\n\n## v6.60 — 2026-09\n';
  it('findet nur eine echte Überschrift der Minor-Version', () => {
    expect(hatUserBlock(u, '6.60')).toBe(true);
    expect(hatUserBlock(u, '6.6')).toBe(false);
    expect(hatUserBlock(u, '6.61')).toBe(false);
    expect(hatUserBlock(u, '9.9')).toBe(false);
  });
});
