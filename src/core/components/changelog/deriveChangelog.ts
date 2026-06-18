/**
 * Changelog-Aufbereitung für das Nutzer-Modal (Klick auf die Versionsnummer).
 *
 * Zwei Quellen, EINE Render-Pipeline:
 *  - Default: `deriveUserChangelogFromDev()` leitet aus der entwickler-orientierten
 *    CHANGELOG.md (+ Archiv) eine schlanke „kanonische" Nutzer-Form ab — pro Minor
 *    `x.yy` aggregiert (Patch-Titel als Bullets), Datei-Links/Backticks entfernt,
 *    auf die aktuelle Hauptnummer gefiltert.
 *  - Override: eine committed `changelog-user.md` (geglättete Fassung). Sobald sie
 *    ≥ einen `## vX.Y`-Abschnitt enthält, hat sie Vorrang (`getChangelogMarkdown`).
 *
 * Beide Quellen liegen als dieselbe kanonische Markdown-Form vor und gehen durch
 * `parseUserChangelog()` → gruppiert nach Major → gerendert im Dialog.
 *
 * Reine String-/Daten-Funktionen (kein React, kein DOM) — direkt unit-testbar.
 */

export interface ChangelogMinor {
  /** Minor-Zahl, z.B. 98 für v2.98. */
  minor: number;
  /** Anzeige-Label, z.B. `v2.98`. */
  label: string;
  /** Markdown-Body des Abschnitts (Bullets bzw. `### Neu`/`### Bugfixes`-Untersektionen). */
  bodyMarkdown: string;
}

export interface ChangelogMajor {
  /** Major-Zahl, z.B. 2. */
  major: number;
  /** Anzeige-Label, z.B. `Version 2`. */
  label: string;
  /** Minors absteigend (neueste zuerst). */
  minors: ChangelogMinor[];
}

/** `### v2.98.3 — Titel (Juni 2026)` → [major, minor, patch, titel]. */
const DEV_HEADER_RE = /^###\s+v(\d+)\.(\d+)\.(\d+)\s*[—–-]\s*(.+)$/;
/** `## v2.98` (ggf. mit nachfolgendem Text) → [major, minor]. */
const USER_HEADER_RE = /^##\s+v(\d+)\.(\d+)\b/;
/** Trailing Datums-Klammer wie `(Juni 2026)` (enthält eine 4-stellige Jahreszahl). */
const TRAILING_DATE_RE = /\s*\([^)]*\b\d{4}\b[^)]*\)\s*$/;

/** Inline-Markdown aus einem Titel entfernen: `[Text](url)` → `Text`, Backticks weg. */
function stripInlineMarkup(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`/g, '')
    .trim();
}

/** Einen Patch-Header-Titel in einen sauberen Bullet-Text wandeln. */
function cleanTitle(rawTitle: string): string {
  return stripInlineMarkup(rawTitle.replace(TRAILING_DATE_RE, ''));
}

/**
 * Leitet aus der entwickler-orientierten CHANGELOG-Markdown (CHANGELOG.md ggf. mit
 * Archiv konkateniert) die kanonische Nutzer-Form für genau eine Hauptnummer ab.
 *
 * Jede Minor `x.yy` wird zu einem `## vX.Y`-Abschnitt; die Titel ihrer Patch-Einträge
 * (absteigend, wie in der Quelle) werden zu Bullets. Patch-Nummern selbst tauchen
 * NICHT auf (Anforderung: x.yy statt x.yy.zz).
 */
export function deriveUserChangelogFromDev(devMd: string, opts: { major: number }): string {
  // Minor-Reihenfolge = Erst-Vorkommen (Quelle ist absteigend sortiert).
  const order: number[] = [];
  const byMinor = new Map<number, string[]>();

  for (const line of devMd.split('\n')) {
    const m = DEV_HEADER_RE.exec(line.trim());
    if (!m) continue;
    const major = Number(m[1]);
    if (major !== opts.major) continue;
    const minor = Number(m[2]);
    const title = cleanTitle(m[4] ?? '');
    if (!title) continue;
    if (!byMinor.has(minor)) {
      byMinor.set(minor, []);
      order.push(minor);
    }
    byMinor.get(minor)!.push(title);
  }

  const blocks = order.map((minor) => {
    const bullets = byMinor.get(minor)!.map((t) => `- ${t}`).join('\n');
    return `## v${opts.major}.${minor}\n${bullets}`;
  });

  return blocks.join('\n\n') + (blocks.length ? '\n' : '');
}

/** Hat die Markdown mindestens einen `## vX.Y`-Abschnitt? (→ als Nutzer-Changelog tauglich) */
export function hasUserChangelogContent(md: string): boolean {
  return /^##\s+v\d+\.\d+/m.test(md);
}

/**
 * Bevorzugt die committed/geglättete `userMd`, sobald sie echte `## vX.Y`-Abschnitte
 * enthält; sonst die aus `devMd` abgeleitete Fassung für `major`.
 */
export function getChangelogMarkdown(devMd: string, userMd: string, major: number): string {
  if (hasUserChangelogContent(userMd)) return userMd.trim();
  return deriveUserChangelogFromDev(devMd, { major });
}

/**
 * Parst kanonische Nutzer-Changelog-Markdown in nach Major gruppierte Abschnitte.
 * Splittet ausschließlich an `## vX.Y` (H2) — `### …`-Untersektionen bleiben im Body.
 * Majors und Minors werden absteigend zurückgegeben (neueste zuerst).
 */
export function parseUserChangelog(md: string): ChangelogMajor[] {
  const lines = md.split('\n');
  const flat: { major: number; minor: number; body: string[] }[] = [];

  let current: { major: number; minor: number; body: string[] } | null = null;
  for (const line of lines) {
    const h = USER_HEADER_RE.exec(line.trim());
    if (h) {
      current = { major: Number(h[1]), minor: Number(h[2]), body: [] };
      flat.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }

  const byMajor = new Map<number, ChangelogMinor[]>();
  for (const sec of flat) {
    if (!byMajor.has(sec.major)) byMajor.set(sec.major, []);
    byMajor.get(sec.major)!.push({
      minor: sec.minor,
      label: `v${sec.major}.${sec.minor}`,
      bodyMarkdown: sec.body.join('\n').trim(),
    });
  }

  return [...byMajor.entries()]
    .map(([major, minors]) => ({
      major,
      label: `Version ${major}`,
      minors: minors.slice().sort((a, b) => b.minor - a.minor),
    }))
    .sort((a, b) => b.major - a.major);
}
