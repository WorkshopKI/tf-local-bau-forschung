// Bildschirmseiten-Kontext-Substrat: die Zugriffsschicht auf docs/feedback-kontext/.
// Zwei Konsumenten, EINE Quelle je Seite:
//   1. die Feedback-Verbesserung bekommt das GANZE Doc als App-Wissen (getScreenContext),
//   2. die Seiten-Hilfe zeigt dasselbe Doc als Kurzanleitung im „Hilfe"-Dialog,
//      ohne den Technik-Teil (getSeitenHilfe, siehe Strip-Regeln weiter unten).
// Eine zweite, nutzer-eigene Doku-Datei wäre gegen diese hier gedriftet und hätte jede
// Feature-Änderung zweimal gekostet; der Preis für die eine Quelle ist der Strip.
// Pflege: docs/agents/update-screen-context.md.
// Bundling per import.meta.glob(eager+raw) — Precedent: core/services/seed/fixture-loader.ts.
// Kein fetch/dynamischer Import (Pitfalls #1/#2) — die Docs landen statisch im Single-File-Build.

const CONTEXT_DOC_MODULES = import.meta.glob('../../../../docs/feedback-kontext/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Key = Dateiname ohne Pfad (z.B. "antraege.md", "_app.md"). */
const CONTEXT_DOCS: Record<string, string> = Object.fromEntries(
  Object.entries(CONTEXT_DOC_MODULES).map(([path, content]) => [path.split('/').pop() ?? path, content]),
);

/**
 * Plugin-IDs mit `category: 'kuration'`, die sich ein gemeinsames `kuration.md`
 * teilen statt eines eigenen Docs — gehalten in Sync mit dem Coverage-Guard
 * (`screen-context-coverage` in codebase-conventions.test.ts). Bewusst NICHT
 * `skill-verwaltung-kuration` (trägt trotz des Namens `category: 'tools'`, siehe
 * plugins.config.ts / src/plugins/skill-verwaltung-kuration/index.ts).
 *
 * Der Hub `kuration` steht hier NICHT: er trägt `kuration.md` als eigenes Doc
 * und findet es über den Dateinamen. `anfragen-kuration` ist mit v4.34 in ihm
 * aufgegangen.
 */
export const KURATION_PLUGIN_IDS: readonly string[] = [
  'programme-kuration',
  'csv-sources-kuration',
  'filter-kuration',
  'dokument-review',
];

/** Globaler App-Überblick (immer mitgesendet). Leerer String falls `_app.md` fehlt. */
export function getAppOverview(): string {
  return CONTEXT_DOCS['_app.md'] ?? '';
}

/**
 * Kontext-Doc für eine konkrete Bildschirmseite. Kuration-Plugins routen auf das
 * gemeinsame `kuration.md`. `null` wenn kein Doc existiert (Aufrufer fällt dann
 * auf reinen App-Overview zurück).
 */
export function getScreenContext(pluginId: string): string | null {
  if (KURATION_PLUGIN_IDS.includes(pluginId)) {
    return CONTEXT_DOCS['kuration.md'] ?? null;
  }
  return CONTEXT_DOCS[`${pluginId}.md`] ?? null;
}

/** Dateinamen (ohne `.md`) aller vorhandenen Kontext-Docs außer `_app`/`README` — für den Coverage-Guard. */
export function getKnownScreenContextIds(): string[] {
  return Object.keys(CONTEXT_DOCS)
    .filter(name => name !== '_app.md' && name.toLowerCase() !== 'readme.md')
    .map(name => name.replace(/\.md$/, ''));
}

// ── Seiten-Hilfe: dasselbe Doc, nutzer-lesbar ──────────────────────────────────
//
// Weggeschnitten wird, was nur Maschine oder Entwickler brauchen:
//   - alles ab einer `## Technik`-Überschrift bis Dateiende (expliziter Marker;
//     seit v2.369 tragen ihn alle Docs, siehe docs/feedback-kontext/README.md),
//   - die Zeilen `**Datenmodell dahinter:**` / `**Code:**` (Fett-Label am
//     Zeilenanfang, je genau eine Zeile) — Netz für ein Doc, das wieder im alten
//     Ein-Zeilen-Stil landet.
//
// Nebeneffekt, der den Aufwand trägt: die Docs werden dadurch überhaupt erst gelesen.
// Der Coverage-Guard erzwingt ihre Existenz, nicht ihre Aktualität — ein Nutzer, der
// die Kurzanleitung liest, meldet Abweichungen.

/** Ab dieser Überschrift bis Dateiende steht nur noch Technik (Route, Flag, Stores, Dateien). */
const TECHNIK_MARKER = /^#{2,3}\s+Technik\b/i;

/**
 * Fett-Label, die eine reine Technik-Zeile einleiten. Seit der Umstellung auf
 * `## Technik` (v2.369) stehen sie unterhalb des Markers und fallen schon dem
 * Abschnitts-Cut zum Opfer — die Regel bleibt als Netz für ein Doc, das wieder
 * im alten Ein-Zeilen-Stil geschrieben wird. Der Struktur-Guard in
 * `__tests__/seitenHilfe.test.ts` prüft ohnehin schärfer: oberhalb von
 * `## Technik` steht weder Datei-Pfad noch Route/Flag/Komponentenname.
 */
const TECHNIK_LABEL = /^\*\*(Datenmodell dahinter|Code):\*\*/i;

export interface SeitenHilfe {
  /** H1 des Docs ohne führendes `# ` — Titel des Hilfe-Dialogs. */
  titel: string;
  /** Rumpf ohne H1 und ohne Technik-Teile, weiterhin Markdown. */
  markdown: string;
}

/** Schneidet die nur für Maschine/Entwickler gedachten Teile weg. Rein. */
export function entferneTechnik(markdown: string): string {
  const behalten: string[] = [];
  for (const zeile of markdown.split(/\r?\n/)) {
    const geputzt = zeile.trimStart();
    if (TECHNIK_MARKER.test(geputzt)) break;
    if (TECHNIK_LABEL.test(geputzt)) continue;
    behalten.push(zeile);
  }
  return behalten.join('\n').trim();
}

/** Trennt die H1-Überschrift vom Rumpf. Ohne H1 bleibt `titel` leer. Rein. */
export function teileTitel(markdown: string): { titel: string; rumpf: string } {
  const zeilen = markdown.split(/\r?\n/);
  const idx = zeilen.findIndex(z => /^#\s+\S/.test(z));
  if (idx === -1) return { titel: '', rumpf: markdown.trim() };
  return {
    titel: (zeilen[idx] ?? '').replace(/^#\s+/, '').trim(),
    rumpf: [...zeilen.slice(0, idx), ...zeilen.slice(idx + 1)].join('\n').trim(),
  };
}

/**
 * Nutzer-lesbare Kurzanleitung zu einer Bildschirmseite, oder `null` wenn es kein
 * Doc gibt bzw. nach dem Strippen nichts übrig bleibt (dann zeigt die UI gar keinen
 * Hilfe-Knopf statt eines leeren Dialogs).
 */
export function getSeitenHilfe(pluginId: string): SeitenHilfe | null {
  const doc = getScreenContext(pluginId);
  if (doc === null) return null;
  const { titel, rumpf } = teileTitel(entferneTechnik(doc));
  return rumpf === '' ? null : { titel, markdown: rumpf };
}

/**
 * Nutzer-lesbarer App-Überblick aus `_app.md` — derselbe Strip wie bei den
 * Seiten-Docs, für den Abschnitt „Überblick" im Dialog „Über die App".
 * `null`, wenn `_app.md` fehlt oder nach dem Strippen leer ist.
 */
export function getAppUeberblick(): SeitenHilfe | null {
  const doc = getAppOverview();
  if (doc === '') return null;
  const { titel, rumpf } = teileTitel(entferneTechnik(doc));
  return rumpf === '' ? null : { titel, markdown: rumpf };
}
