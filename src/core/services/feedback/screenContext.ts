// Bildschirmseiten-Kontext-Substrat für die Feedback-Verbesserung: liefert der
// internen KI kompaktes, aktuelles App-Wissen statt einer verstreuten Prompt-Kopie.
// Docs liegen im Repo unter docs/feedback-kontext/ (Pflege: docs/agents/update-screen-context.md).
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
 */
export const KURATION_PLUGIN_IDS: readonly string[] = [
  'kurator',
  'programme-kuration',
  'csv-sources-kuration',
  'dokumentenquellen-kuration',
  'anfragen-kuration',
  'filter-kuration',
  'feedback-kuration',
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
