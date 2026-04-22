/**
 * Zentrale Routen-Map für alle Plugins.
 *
 * HashRouter-kompatibel (Pfade ohne führendes `#`). URLs haben die Form
 * `teamflow.html#/kuration/unterprogramme` im Browser; `react-router-dom`
 * normalisiert das intern auf `/kuration/unterprogramme`.
 *
 * Bei neuen Plugins: Hier registrieren, bevor die Route funktioniert.
 *
 * v1.9: Alte `/admin/*`-Routen wurden auf `/kuration/*` umgestellt.
 * Legacy-Redirects via `legacyRedirectTarget()` sichern bestehende
 * Bookmarks und Browser-History.
 */
export const PLUGIN_ROUTES: Record<string, string> = {
  home: '/',
  antraege: '/antraege',
  bauantraege: '/bauantraege',
  dokumente: '/dokumente',
  suche: '/suche',
  chat: '/chat',
  'feedback-board': '/feedback-board',
  einstellungen: '/einstellungen',
  kurator: '/kuration/suchindex',
  'programme-kuration': '/kuration/programme',
  'csv-sources-kuration': '/kuration/csv-quellen',
  'unterprogramme-kuration': '/kuration/unterprogramme',
  'filter-kuration': '/kuration/filter',
  'feedback-kuration': '/kuration/feedback',
  'dev-infrastructure-test': '/dev-infrastructure-test',
  'dev-state-inspector': '/dev-state-inspector',
};

/** Kehrt die Map um (Route → Plugin-ID) für Lookups aus `pathname`. */
const ROUTE_TO_PLUGIN: Array<{ route: string; pluginId: string }> =
  Object.entries(PLUGIN_ROUTES)
    .map(([pluginId, route]) => ({ route, pluginId }))
    // Längste Routen zuerst, damit `/kuration/programme` vor `/kuration/` matcht.
    .sort((a, b) => b.route.length - a.route.length);

export function pluginIdToRoute(pluginId: string): string {
  return PLUGIN_ROUTES[pluginId] ?? '/';
}

/**
 * Bildet eine konkrete URL auf die zugehörige Plugin-ID ab.
 * `/bauantraege/FKZ-2023-0001` → `bauantraege`, `/` → `home`.
 */
export function routeToPluginId(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'home';
  for (const { route, pluginId } of ROUTE_TO_PLUGIN) {
    if (route === '/') continue;
    if (normalized === route || normalized.startsWith(route + '/')) {
      return pluginId;
    }
  }
  return null;
}

/**
 * Legacy-Routing: alte /admin/*-URLs auf neue /kuration/*-URLs mappen.
 * Gibt null zurück, wenn kein Redirect greift. Unterpfade (z.B. Detail-URLs)
 * werden 1:1 übernommen.
 */
const LEGACY_ADMIN_REDIRECTS: Record<string, string> = {
  '/admin/suchindex': '/kuration/suchindex',
  '/admin/programme': '/kuration/programme',
  '/admin/csv-sources': '/kuration/csv-quellen',
  '/admin/unterprogramme': '/kuration/unterprogramme',
  '/admin/filter': '/kuration/filter',
  '/admin/feedback': '/kuration/feedback',
};

export function legacyRedirectTarget(pathname: string): string | null {
  if (!pathname.startsWith('/admin/')) return null;
  const direct = LEGACY_ADMIN_REDIRECTS[pathname];
  if (direct) return direct;
  for (const [oldPrefix, newPrefix] of Object.entries(LEGACY_ADMIN_REDIRECTS)) {
    if (pathname.startsWith(oldPrefix + '/')) {
      return newPrefix + pathname.slice(oldPrefix.length);
    }
  }
  return null;
}
