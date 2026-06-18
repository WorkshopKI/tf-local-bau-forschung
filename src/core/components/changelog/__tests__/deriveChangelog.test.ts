import { describe, it, expect } from 'vitest';
import {
  deriveUserChangelogFromDev,
  parseUserChangelog,
  getChangelogMarkdown,
  hasUserChangelogContent,
} from '../deriveChangelog';

const DEV_SAMPLE = `# Changelog — TeamFlow Local App

Vorwort, kein Header.

### v2.98.1 — Delta-Write: [Voll-Write](src/core/services/csv/snapshot.ts)-Fallback (Juni 2026)

PATCH-Bump — egal.

### v2.98.0 — Delta-Snapshots: Schreiber aktiv (Juni 2026)

MINOR-Bump — egal.

### v2.97.0 — Delta-Snapshots: \`Leser\` (Juni 2026)

MINOR-Bump — egal.

### v1.14.0 — Alt-Eintrag aus Major 1 (Mai 2025)

MINOR-Bump — egal.
`;

describe('deriveUserChangelogFromDev', () => {
  const out = deriveUserChangelogFromDev(DEV_SAMPLE, { major: 2 });

  it('gruppiert Patches unter ihrer Minor (## vX.Y), ohne Patch-Nummern', () => {
    expect(out).toContain('## v2.98');
    expect(out).toContain('## v2.97');
    expect(out).not.toContain('v2.98.1');
    expect(out).not.toContain('v2.98.0');
  });

  it('bündelt nach Kategorie in ### Untersektionen (MINOR→Feature, PATCH→Fix)', () => {
    expect(out).toContain('### Neu & Verbesserungen');
    expect(out).toContain('### Fehlerbehebungen');
    // MINOR-Bump landet unter Feature, PATCH-Bump unter Fix
    const featureIdx = out.indexOf('- Delta-Snapshots: Schreiber aktiv');
    const fixIdx = out.indexOf('- Delta-Write: Voll-Write-Fallback');
    expect(featureIdx).toBeGreaterThan(out.indexOf('### Neu & Verbesserungen'));
    expect(fixIdx).toBeGreaterThan(out.indexOf('### Fehlerbehebungen'));
  });

  it('entfernt Inline-Links, Backticks und die Datums-Klammer aus Titeln', () => {
    expect(out).toContain('- Delta-Snapshots: Leser');
    expect(out).not.toContain('snapshot.ts');
    expect(out).not.toContain('`');
    expect(out).not.toContain('(Juni 2026)');
  });

  it('filtert fremde Hauptnummern heraus', () => {
    expect(out).not.toContain('Alt-Eintrag');
    expect(out).not.toContain('v1.14');
  });
});

describe('parseUserChangelog — Struktur + Kategorien', () => {
  it('gruppiert nach Major und sortiert Major + Minor absteigend', () => {
    const md = ['## v2.97', '- a', '', '## v2.98', '- b', '', '## v3.0', '- c'].join('\n');
    const groups = parseUserChangelog(md);
    expect(groups.map((g) => g.major)).toEqual([3, 2]);
    const major2 = groups.find((g) => g.major === 2)!;
    expect(major2.label).toBe('Version 2');
    expect(major2.minors.map((m) => m.minor)).toEqual([98, 97]);
    expect(major2.minors[0]!.label).toBe('v2.98');
  });

  it('leitet die Kategorie aus ### Untersektionen ab', () => {
    const md = ['## v2.98', '### Neu', '- x', '### Bugfixes', '- y'].join('\n');
    const [maj] = parseUserChangelog(md);
    const changes = maj!.minors[0]!.changes;
    expect(changes).toEqual([
      { text: 'x', category: 'feature' },
      { text: 'y', category: 'fix' },
    ]);
  });

  it('klassifiziert Bullets ohne Untersektion per Keyword', () => {
    const md = ['## v2.50', '- Fix für Absturz beim Start', '- Neue Tab-Ansicht'].join('\n');
    const [maj] = parseUserChangelog(md);
    const changes = maj!.minors[0]!.changes;
    expect(changes[0]).toEqual({ text: 'Fix für Absturz beim Start', category: 'fix' });
    expect(changes[1]).toEqual({ text: 'Neue Tab-Ansicht', category: 'feature' });
  });

  it('Round-Trip: abgeleitete Markdown ist wieder parsebar inkl. Kategorien', () => {
    const groups = parseUserChangelog(deriveUserChangelogFromDev(DEV_SAMPLE, { major: 2 }));
    expect(groups).toHaveLength(1);
    const v298 = groups[0]!.minors.find((m) => m.minor === 98)!;
    expect(v298.changes).toContainEqual({ text: 'Delta-Snapshots: Schreiber aktiv', category: 'feature' });
    expect(v298.changes).toContainEqual({ text: 'Delta-Write: Voll-Write-Fallback', category: 'fix' });
  });
});

describe('getChangelogMarkdown / hasUserChangelogContent', () => {
  const COMMENT_ONLY = '<!--\n  Platzhalter, kein ## v-Header.\n-->\n';

  it('erkennt einen echten Nutzer-Changelog an mindestens einem ## vX.Y', () => {
    expect(hasUserChangelogContent(COMMENT_ONLY)).toBe(false);
    expect(hasUserChangelogContent('## v2.5\n- x')).toBe(true);
  });

  it('bevorzugt die geglättete Datei, sobald sie ## vX.Y-Abschnitte hat', () => {
    const userMd = '## v2.5\n- handgeglättet';
    expect(getChangelogMarkdown(DEV_SAMPLE, userMd, 2)).toBe(userMd);
  });

  it('fällt auf die Ableitung zurück, wenn die Datei nur ein Kommentar ist', () => {
    const result = getChangelogMarkdown(DEV_SAMPLE, COMMENT_ONLY, 2);
    expect(result).toBe(deriveUserChangelogFromDev(DEV_SAMPLE, { major: 2 }));
    expect(result).toContain('## v2.98');
  });
});
