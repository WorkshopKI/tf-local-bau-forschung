import { describe, it, expect } from 'vitest';
import {
  deriveUserChangelogFromDev,
  parseUserChangelog,
  getChangelogMarkdown,
  hasUserChangelogContent,
  splitMinorSections,
  selectNewMinorSections,
  mergeChangelog,
  bucketizeMinors,
} from '../deriveChangelog';
import type { ChangelogMinor } from '../deriveChangelog';

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

  it('emittiert das jüngste Monats-Datum als ISO-Suffix am Header (nicht als dt. Klammer)', () => {
    expect(out).toContain('## v2.98 — 2026-06');
    expect(out).toContain('## v2.97 — 2026-06');
    // Die rohe deutsche Datums-Klammer darf NICHT durchsickern (Titel sind bereinigt).
    expect(out).not.toContain('(Juni 2026)');
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

  it('liest den optionalen ISO-Datums-Suffix in dateIso/monthIndex', () => {
    const md = ['## v2.124 — 2026-06', '- a', '', '## v2.50 — 2025-03', '- b'].join('\n');
    const [maj] = parseUserChangelog(md);
    const v124 = maj!.minors.find((m) => m.minor === 124)!;
    const v50 = maj!.minors.find((m) => m.minor === 50)!;
    expect(v124.dateIso).toBe('2026-06');
    expect(v124.monthIndex).toBe(2026 * 12 + 5); // Juni = month0 5
    expect(v50.dateIso).toBe('2025-03');
    expect(v50.monthIndex).toBe(2025 * 12 + 2);
  });

  it('lässt dateIso/monthIndex bei datumslosen Headern undefiniert', () => {
    const [maj] = parseUserChangelog(['## v2.5', '- x'].join('\n'));
    expect(maj!.minors[0]!.dateIso).toBeUndefined();
    expect(maj!.minors[0]!.monthIndex).toBeUndefined();
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

describe('inkrementelles Glätten — splitMinorSections / selectNewMinorSections / mergeChangelog', () => {
  const SOURCE = ['## v2.126 — 2026-07', '- c neu', '', '## v2.125 — 2026-06', '- b', '', '## v2.124 — 2026-06', '- a'].join('\n');

  it('splitMinorSections zerlegt je Version inkl. Header + Datums-Suffix', () => {
    const secs = splitMinorSections(SOURCE);
    expect(secs.map((s) => s.key)).toEqual(['2.126', '2.125', '2.124']);
    expect(secs[0]!.text).toBe('## v2.126 — 2026-07\n- c neu');
    expect(secs[2]!.text).toBe('## v2.124 — 2026-06\n- a');
  });

  it('splitMinorSections verwirft Vorwort vor dem ersten Header', () => {
    const secs = splitMinorSections('# Titel\n\nVorwort.\n\n## v2.5\n- x');
    expect(secs).toHaveLength(1);
    expect(secs[0]!.text).toBe('## v2.5\n- x');
  });

  it('selectNewMinorSections liefert nur Versionen, die im Share-File fehlen', () => {
    const existing = ['## v2.124 — 2026-06', '- a (geglättet)'].join('\n');
    const neu = selectNewMinorSections(SOURCE, existing);
    expect(neu.map((s) => s.key)).toEqual(['2.126', '2.125']);
  });

  it('selectNewMinorSections: leeres Share-File → alle Versionen sind neu (Erstlauf)', () => {
    expect(selectNewMinorSections(SOURCE, '').map((s) => s.key)).toEqual(['2.126', '2.125', '2.124']);
  });

  it('mergeChangelog setzt Frisches oben drauf, dedupliziert und sortiert absteigend', () => {
    const existing = ['## v2.124 — 2026-06', '- a (alt)'].join('\n');
    const polishedNew = ['## v2.126 — 2026-07', '- c (neu)', '', '## v2.125 — 2026-06', '- b (neu)'].join('\n');
    const merged = mergeChangelog(polishedNew, existing);
    expect(splitMinorSections(merged).map((s) => s.key)).toEqual(['2.126', '2.125', '2.124']);
    expect(merged).toContain('- a (alt)');
    expect(merged).toContain('- c (neu)');
  });

  it('mergeChangelog: frische Fassung gewinnt bei Versions-Konflikt', () => {
    const merged = mergeChangelog('## v2.124 — 2026-06\n- neu', '## v2.124 — 2026-06\n- alt');
    expect(splitMinorSections(merged)).toHaveLength(1);
    expect(merged).toContain('- neu');
    expect(merged).not.toContain('- alt');
  });
});

describe('bucketizeMinors — 10er-Pakete', () => {
  const mk = (minor: number): ChangelogMinor => ({ minor, label: `v2.${minor}`, changes: [], bodyMarkdown: '' });
  // Absteigend sortiert, wie aus parseUserChangelog.
  const MINORS = [126, 125, 124, 123, 122, 121, 120, 119, 118, 6].map(mk);

  it('hält die ersten `looseCount` einzeln, bündelt den Rest in 10er-Dekaden', () => {
    const { loose, buckets } = bucketizeMinors(MINORS, 3, 2);
    expect(loose.map((m) => m.minor)).toEqual([126, 125, 124]);
    // Rest: 123–120 (Dekade 120), 119–118 (Dekade 110), 6 (Dekade 0) — absteigend nach Dekade.
    expect(buckets.map((b) => b.decade)).toEqual([120, 110, 0]);
    expect(buckets[0]!.minors.map((m) => m.minor)).toEqual([123, 122, 121, 120]);
    expect(buckets[0]!.label).toBe('v2.120 – v2.123');
    expect(buckets[0]!.key).toBe('2-120');
  });

  it('Einzel-Version im Paket → Label ohne Bereich', () => {
    const { buckets } = bucketizeMinors(MINORS, 3, 2);
    const solo = buckets.find((b) => b.decade === 0)!;
    expect(solo.minors.map((m) => m.minor)).toEqual([6]);
    expect(solo.label).toBe('v2.6');
  });

  it('looseCount 0 → alles in Pakete (z.B. ältere Hauptnummern)', () => {
    const { loose, buckets } = bucketizeMinors([mk(15), mk(14), mk(3)], 0, 2);
    expect(loose).toEqual([]);
    expect(buckets.map((b) => b.decade)).toEqual([10, 0]);
  });

  it('weniger Minors als looseCount → keine Pakete', () => {
    const { loose, buckets } = bucketizeMinors([mk(126), mk(125)], 3, 2);
    expect(loose.map((m) => m.minor)).toEqual([126, 125]);
    expect(buckets).toEqual([]);
  });
});
