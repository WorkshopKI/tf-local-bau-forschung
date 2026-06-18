/**
 * Changelog-Aufbereitung für das Nutzer-Modal (Klick auf die Versionsnummer).
 *
 * Zwei Quellen, EINE Render-Pipeline:
 *  - Default: `deriveUserChangelogFromDev()` leitet aus der entwickler-orientierten
 *    CHANGELOG.md (+ Archiv) eine schlanke „kanonische" Nutzer-Form ab — pro Minor
 *    `x.yy` aggregiert, Datei-Links/Backticks entfernt, auf die aktuelle Hauptnummer
 *    gefiltert. Jeder Eintrag wird nach Kategorie gebündelt (Neu & Verbesserungen
 *    vs. Fehlerbehebungen) in `### `-Untersektionen — das ist zugleich die Basis für
 *    den Kategorie-Filter im Modal.
 *  - Override: eine committed `changelog-user.md` (geglättete Fassung). Sobald sie
 *    ≥ einen `## vX.Y`-Abschnitt enthält, hat sie Vorrang (`getChangelogMarkdown`).
 *    Ihre `### Neu`/`### Bugfixes`-Untersektionen liefern die Kategorie direkt.
 *
 * Beide Quellen liegen als dieselbe kanonische Markdown-Form vor und gehen durch
 * `parseUserChangelog()` → gruppiert nach Major, jede Änderung mit Kategorie.
 *
 * Reine String-/Daten-Funktionen (kein React, kein DOM) — direkt unit-testbar.
 */

/** Grobe Zwei-Bucket-Kategorie für den Modal-Filter. */
export type ChangeCategory = 'feature' | 'fix';

export interface ChangelogChange {
  /** Einzeiliger Änderungstext (darf leichtes Inline-Markdown enthalten). */
  text: string;
  category: ChangeCategory;
}

export interface ChangelogMinor {
  /** Minor-Zahl, z.B. 98 für v2.98. */
  minor: number;
  /** Anzeige-Label, z.B. `v2.98`. */
  label: string;
  /** Einzelne Änderungen mit Kategorie (für Liste + Filter). */
  changes: ChangelogChange[];
  /** Roher Markdown-Body — Fallback-Render, falls keine Bullets geparst wurden. */
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

/** Untersektions-Überschriften der abgeleiteten Form (parsebar zurück zu Kategorien). */
const FEATURE_HEADING = '### Neu & Verbesserungen';
const FIX_HEADING = '### Fehlerbehebungen';

/** `### v2.98.3 — Titel (Juni 2026)` → [major, minor, patch, titel]. */
const DEV_HEADER_RE = /^###\s+v(\d+)\.(\d+)\.(\d+)\s*[—–-]\s*(.+)$/;
/** `## v2.98` (ggf. mit nachfolgendem Text) → [major, minor]. */
const USER_HEADER_RE = /^##\s+v(\d+)\.(\d+)\b/;
/** `### Irgendeine Überschrift` (Kategorie-Untersektion). */
const SUBHEADING_RE = /^###\s+(.+)$/;
/** `- bullet` / `* bullet`. */
const BULLET_RE = /^[-*]\s+(.+)$/;
/** `PATCH-Bump` / `MINOR-Bump` / `MAJOR-Bump` am Zeilenanfang. */
const BUMP_RE = /^(PATCH|MINOR|MAJOR)-Bump\b/;
/** Trailing Datums-Klammer wie `(Juni 2026)` (enthält eine 4-stellige Jahreszahl). */
const TRAILING_DATE_RE = /\s*\([^)]*\b\d{4}\b[^)]*\)\s*$/;

/** Klare Fehler-/Bug-Sprache → Fehlerbehebung. */
const FIX_TEXT_RE = /\b(fix|bugfix|bug|behoben|korrigi|gefixt|fehler|race|crash|regression|absturz|defekt|hängt|hang)\b/i;
/** Klare „etwas Neues kam dazu"-Sprache → Feature (überschreibt den Bump-Fallback). */
const FEATURE_TEXT_RE = /\b(neu|neue|neuer|neues|hinzugef|ergänz|ergaenz)/i;

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
 * Kategorisiert einen abgeleiteten Eintrag. Primärsignal ist der Bump-Typ
 * (MINOR/MAJOR = additiv = Feature, PATCH = Bugfix/Tweak per Repo-Konvention),
 * mit Keyword-Override für eindeutige Fälle. Bewusst eine Heuristik — die
 * geglättete `changelog-user.md` mit echten `### Neu`/`### Bugfixes`-Sektionen
 * liefert exakte Kategorien.
 */
function classifyDevEntry(title: string, bump: 'PATCH' | 'MINOR' | 'MAJOR' | null): ChangeCategory {
  if (FEATURE_TEXT_RE.test(title)) return 'feature';
  if (FIX_TEXT_RE.test(title)) return 'fix';
  if (bump === 'MINOR' || bump === 'MAJOR') return 'feature';
  if (bump === 'PATCH') return 'fix';
  return 'feature';
}

/** Kategorie aus einer Untersektions-Überschrift (`### …`). */
function classifyHeading(heading: string): ChangeCategory {
  return /fehler|bug|fix|behoben|korrektur/i.test(heading) ? 'fix' : 'feature';
}

/** Kategorie eines Bullets ohne zugehörige Untersektion (Keyword-Heuristik). */
function classifyBullet(text: string): ChangeCategory {
  return FIX_TEXT_RE.test(text) ? 'fix' : 'feature';
}

function detectBump(bodyLines: string[]): 'PATCH' | 'MINOR' | 'MAJOR' | null {
  for (const line of bodyLines) {
    const m = BUMP_RE.exec(line.trim());
    if (m) return m[1] as 'PATCH' | 'MINOR' | 'MAJOR';
  }
  return null;
}

/**
 * Leitet aus der entwickler-orientierten CHANGELOG-Markdown (CHANGELOG.md ggf. mit
 * Archiv konkateniert) die kanonische Nutzer-Form für genau eine Hauptnummer ab.
 *
 * Jede Minor `x.yy` wird zu einem `## vX.Y`-Abschnitt; ihre Patch-Einträge werden
 * nach Kategorie in `### Neu & Verbesserungen` / `### Fehlerbehebungen` gebündelt.
 * Patch-Nummern selbst tauchen NICHT auf (Anforderung: x.yy statt x.yy.zz).
 */
export function deriveUserChangelogFromDev(devMd: string, opts: { major: number }): string {
  interface Entry { major: number; minor: number; title: string; body: string[] }
  const entries: Entry[] = [];
  let current: Entry | null = null;

  for (const line of devMd.split('\n')) {
    const m = DEV_HEADER_RE.exec(line.trim());
    if (m) {
      current = { major: Number(m[1]), minor: Number(m[2]), title: cleanTitle(m[4] ?? ''), body: [] };
      entries.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }

  const order: number[] = [];
  const byMinor = new Map<number, { feature: string[]; fix: string[] }>();
  for (const e of entries) {
    if (e.major !== opts.major || !e.title) continue;
    if (!byMinor.has(e.minor)) {
      byMinor.set(e.minor, { feature: [], fix: [] });
      order.push(e.minor);
    }
    const bucket = byMinor.get(e.minor)!;
    const cat = classifyDevEntry(e.title, detectBump(e.body));
    bucket[cat].push(e.title);
  }

  const blocks = order.map((minor) => {
    const bucket = byMinor.get(minor)!;
    const parts: string[] = [`## v${opts.major}.${minor}`];
    if (bucket.feature.length) parts.push(FEATURE_HEADING, ...bucket.feature.map((t) => `- ${t}`));
    if (bucket.fix.length) parts.push(FIX_HEADING, ...bucket.fix.map((t) => `- ${t}`));
    return parts.join('\n');
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
 * Parst kanonische Nutzer-Changelog-Markdown in nach Major gruppierte Abschnitte
 * mit kategorisierten Einzeländerungen.
 *  - Splittet an `## vX.Y` (H2) in Minor-Abschnitte.
 *  - Innerhalb eines Abschnitts setzt jedes `### …` die aktuelle Kategorie
 *    (Heading-Heuristik); jedes `- bullet` wird zu einer Änderung dieser Kategorie
 *    (ohne vorangehendes Heading: Keyword-Heuristik je Bullet).
 * Majors und Minors werden absteigend zurückgegeben (neueste zuerst).
 */
export function parseUserChangelog(md: string): ChangelogMajor[] {
  interface Section { major: number; minor: number; bodyLines: string[] }
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of md.split('\n')) {
    const h = USER_HEADER_RE.exec(line.trim());
    if (h) {
      current = { major: Number(h[1]), minor: Number(h[2]), bodyLines: [] };
      sections.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }

  const byMajor = new Map<number, ChangelogMinor[]>();
  for (const sec of sections) {
    const changes: ChangelogChange[] = [];
    let headingCat: ChangeCategory | null = null;
    for (const raw of sec.bodyLines) {
      const line = raw.trim();
      const sub = SUBHEADING_RE.exec(line);
      if (sub) {
        headingCat = classifyHeading(sub[1] ?? '');
        continue;
      }
      const bullet = BULLET_RE.exec(line);
      if (bullet) {
        const text = stripInlineMarkup(bullet[1] ?? '');
        if (!text) continue;
        changes.push({ text, category: headingCat ?? classifyBullet(text) });
      }
    }

    if (!byMajor.has(sec.major)) byMajor.set(sec.major, []);
    byMajor.get(sec.major)!.push({
      minor: sec.minor,
      label: `v${sec.major}.${sec.minor}`,
      changes,
      bodyMarkdown: sec.bodyLines.join('\n').trim(),
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
