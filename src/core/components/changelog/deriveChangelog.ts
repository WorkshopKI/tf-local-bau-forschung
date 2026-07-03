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
  /** Jüngstes Patch-Datum dieser Minor, monatsgenau als ISO `YYYY-MM` (falls geparst). */
  dateIso?: string;
  /** Aus `dateIso` abgeleiteter, vergleichbarer Monats-Index (`year*12 + month0`) — für den Zeit-Filter. */
  monthIndex?: number;
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
/** `## v2.98` oder `## v2.98 — 2026-06` (optionaler ISO-Datums-Suffix) → [major, minor, jahr?, monat?]. */
const USER_HEADER_RE = /^##\s+v(\d+)\.(\d+)(?:\s*[—–-]\s*(\d{4})-(\d{2}))?/;
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

/** Deutsche Monatsnamen → Monatszahl (inkl. `März`/`Maerz`-Schreibweisen). */
const GERMAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

/**
 * Zieht aus der Trailing-Datums-Klammer eines Headers (`… (Juni 2026)`) das Datum
 * monatsgenau als ISO `YYYY-MM` (oder null, wenn kein erkennbarer dt. Monat+Jahr).
 */
function parseGermanMonth(rawTitle: string): string | null {
  const paren = /\(([^)]*?)\)\s*$/.exec(rawTitle);
  if (!paren) return null;
  const dm = /(\p{L}+)\s+(\d{4})/u.exec(paren[1] ?? '');
  if (!dm) return null;
  const month = GERMAN_MONTHS[(dm[1] ?? '').toLowerCase()];
  if (!month) return null;
  return `${dm[2]}-${String(month).padStart(2, '0')}`;
}

/** ISO `YYYY-MM` → vergleichbarer Monats-Index (`year*12 + month0`), oder undefined. */
function monthIndexFromIso(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
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
  interface Entry { major: number; minor: number; title: string; date: string | null; body: string[] }
  const entries: Entry[] = [];
  let current: Entry | null = null;

  for (const line of devMd.split('\n')) {
    const m = DEV_HEADER_RE.exec(line.trim());
    if (m) {
      const rawTitle = m[4] ?? '';
      current = { major: Number(m[1]), minor: Number(m[2]), title: cleanTitle(rawTitle), date: parseGermanMonth(rawTitle), body: [] };
      entries.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }

  const order: number[] = [];
  const byMinor = new Map<number, { feature: string[]; fix: string[]; date: string | null }>();
  for (const e of entries) {
    if (e.major !== opts.major || !e.title) continue;
    if (!byMinor.has(e.minor)) {
      byMinor.set(e.minor, { feature: [], fix: [], date: null });
      order.push(e.minor);
    }
    const bucket = byMinor.get(e.minor)!;
    const cat = classifyDevEntry(e.title, detectBump(e.body));
    bucket[cat].push(e.title);
    // Jüngstes Datum der Minor merken (ISO `YYYY-MM` vergleicht lexikografisch korrekt).
    if (e.date && (bucket.date === null || e.date > bucket.date)) bucket.date = e.date;
  }

  const blocks = order.map((minor) => {
    const bucket = byMinor.get(minor)!;
    const header = bucket.date ? `## v${opts.major}.${minor} — ${bucket.date}` : `## v${opts.major}.${minor}`;
    const parts: string[] = [header];
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
  interface Section { major: number; minor: number; dateIso: string | null; bodyLines: string[] }
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of md.split('\n')) {
    const h = USER_HEADER_RE.exec(line.trim());
    if (h) {
      const dateIso = h[3] && h[4] ? `${h[3]}-${h[4]}` : null;
      current = { major: Number(h[1]), minor: Number(h[2]), dateIso, bodyLines: [] };
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
      dateIso: sec.dateIso ?? undefined,
      monthIndex: monthIndexFromIso(sec.dateIso),
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

/** Ein roher Markdown-Abschnitt je `## vX.Y`-Version (für das inkrementelle Glätten). */
export interface MinorSection {
  major: number;
  minor: number;
  /** Stabiler Schlüssel `major.minor` (z.B. `2.124`). */
  key: string;
  /** Roher Markdown-Abschnitt inkl. `## vX.Y`-Header — Datums-Suffix (` — YYYY-MM`) bleibt erhalten. */
  text: string;
}

/**
 * Zerlegt kanonische Changelog-Markdown in Abschnitte je `## vX.Y` (Header-Zeile + Body bis
 * zum nächsten Header). Zeilen vor dem ersten Header (Vorwort) werden verworfen. Reihenfolge
 * der Quelle bleibt erhalten.
 */
export function splitMinorSections(md: string): MinorSection[] {
  interface Acc { major: number; minor: number; lines: string[] }
  const acc: Acc[] = [];
  let current: Acc | null = null;
  for (const line of md.split('\n')) {
    const h = USER_HEADER_RE.exec(line.trim());
    if (h) {
      current = { major: Number(h[1]), minor: Number(h[2]), lines: [line] };
      acc.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return acc.map((s) => ({
    major: s.major,
    minor: s.minor,
    key: `${s.major}.${s.minor}`,
    text: s.lines.join('\n').trim(),
  }));
}

/**
 * Wählt aus `sourceMd` (volle Build-Wahrheit, aus CHANGELOG.md abgeleitet) genau die
 * `## vX.Y`-Abschnitte, die in `existingMd` (bereits geglätteter Share-Changelog) NOCH NICHT
 * vorkommen — die Eingabe fürs inkrementelle Glätten. Quell-Reihenfolge (neueste zuerst) bleibt.
 */
export function selectNewMinorSections(sourceMd: string, existingMd: string): MinorSection[] {
  const existing = new Set(splitMinorSections(existingMd).map((s) => s.key));
  return splitMinorSections(sourceMd).filter((s) => !existing.has(s.key));
}

/**
 * Mischt frisch geglättete Abschnitte (`polishedNewMd`) über den bestehenden Share-Changelog
 * (`existingMd`). Dedupliziert nach `major.minor` (frische Fassung gewinnt) und gibt absteigend
 * sortiert zurück (neueste zuerst) — robust gegen Reihenfolge/Doppelung der Eingaben.
 */
export function mergeChangelog(polishedNewMd: string, existingMd: string): string {
  const byKey = new Map<string, MinorSection>();
  for (const s of splitMinorSections(existingMd)) byKey.set(s.key, s);
  for (const s of splitMinorSections(polishedNewMd)) byKey.set(s.key, s); // frische überschreiben
  const sorted = [...byKey.values()].sort((a, b) => b.major - a.major || b.minor - a.minor);
  return sorted.map((s) => s.text).join('\n\n') + (sorted.length ? '\n' : '');
}

/**
 * Baut den ANZEIGE-Changelog fürs Modal: legt den kuratierten/geglätteten Override
 * (`overrideMd` — Share-Stand oder committed Fassung, `''` wenn keiner) über die aus
 * dem Build abgeleitete Vollwahrheit (`derivedMd`).
 *
 * Der Override GEWINNT je Version (behält die schöne Prosa), aber Versionen, die er
 * NICHT enthält — typisch die neueste, noch nicht geglättete — werden aus `derivedMd`
 * ergänzt. Damit hinkt die Anzeige nie hinter dem tatsächlichen Build her, selbst wenn
 * auf dem Share ein VERALTETER Override liegt (früher verdeckte ein alter Override alle
 * neueren Versionen komplett). Ohne Override-Inhalt → unverändert `derivedMd`.
 */
export function getDisplayChangelog(derivedMd: string, overrideMd: string): string {
  if (!hasUserChangelogContent(overrideMd)) return derivedMd;
  return mergeChangelog(overrideMd, derivedMd); // Override (1. Arg) gewinnt je Key, derived füllt Lücken
}

/** Ein 10er-Paket gebündelter Minor-Versionen (z.B. `v2.110 – v2.119`) für die Modal-Anzeige. */
export interface MinorBucket {
  /** Stabiler Schlüssel `major-decade`, z.B. `2-110`. */
  key: string;
  major: number;
  /** Dekaden-Start `floor(minor/10)*10`, z.B. 110. */
  decade: number;
  /** Niedrigste bzw. höchste enthaltene Minor-Nummer. */
  low: number;
  high: number;
  /** Anzeige-Label, z.B. `v2.110 – v2.119` (bei nur einer Version `v2.110`). */
  label: string;
  /** Enthaltene Minors, absteigend (neueste zuerst). */
  minors: ChangelogMinor[];
}

/**
 * Teilt die (absteigend sortierten) Minors EINER Hauptnummer in `loose` (die ersten
 * `looseCount`, einzeln dargestellt) und `buckets` (alle weiteren, gebündelt in 10er-Pakete
 * nach Versionsnummer). Pakete absteigend nach Dekade, innen absteigend — verkürzt die
 * lange Scroll-Liste.
 */
export function bucketizeMinors(
  minors: ChangelogMinor[],
  looseCount: number,
  major: number,
): { loose: ChangelogMinor[]; buckets: MinorBucket[] } {
  const n = Math.max(0, looseCount);
  const loose = minors.slice(0, n);
  const byDecade = new Map<number, ChangelogMinor[]>();
  for (const m of minors.slice(n)) {
    const decade = Math.floor(m.minor / 10) * 10;
    if (!byDecade.has(decade)) byDecade.set(decade, []);
    byDecade.get(decade)!.push(m);
  }
  const buckets: MinorBucket[] = [...byDecade.entries()]
    .map(([decade, ms]) => {
      const sorted = ms.slice().sort((a, b) => b.minor - a.minor);
      const high = sorted[0]!.minor;
      const low = sorted[sorted.length - 1]!.minor;
      return {
        key: `${major}-${decade}`,
        major,
        decade,
        low,
        high,
        label: low === high ? `v${major}.${low}` : `v${major}.${low} – v${major}.${high}`,
        minors: sorted,
      };
    })
    .sort((a, b) => b.decade - a.decade);
  return { loose, buckets };
}
