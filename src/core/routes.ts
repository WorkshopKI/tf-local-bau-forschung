/**
 * Zentrale Routen-Helper (HashRouter-kompatibel).
 *
 * URLs haben die Form `teamflow.html#/kuration/unterprogramme` im Browser;
 * `react-router-dom` normalisiert das intern auf `/kuration/unterprogramme`.
 *
 * **Single Source of Truth**: `PLUGIN_ROUTES` wird in `src/plugins.config.ts`
 * aus `allPlugins.map(p => [p.id, p.route])` generiert. Neue Plugins
 * pflegen ihre Route direkt im Plugin-Index (`route: '/kuration/...'`),
 * keine separate Map mehr hier.
 *
 * v1.9: Alte `/admin/*`-Routen wurden auf `/kuration/*` umgestellt.
 * Legacy-Redirects via `legacyRedirectTarget()` sichern bestehende
 * Bookmarks und Browser-History.
 */
import { PLUGIN_ROUTES } from '@/plugins.config';

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
 * Legacy-Routing für Lesezeichen und Browser-History. Zwei Wellen:
 *
 *  - v1.9: `/admin/*` → `/kuration/*`.
 *  - v4.34: die Kuration-Seiten sind Panels EINER Seite geworden; ihre alten
 *    Routen zeigen jetzt auf `/kuration?panel=…`. Eigenständig geblieben (und
 *    darum NICHT hier) sind `/kuration/csv-quellen` und
 *    `/kuration/dokument-review`.
 *
 * Gibt null zurück, wenn kein Redirect greift. Unterpfade (z.B. Detail-URLs)
 * werden 1:1 übernommen — außer bei den Panel-Zielen, die eine Query tragen.
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  // v1.9
  '/admin/suchindex': '/kuration/suchindex',
  '/admin/programme': '/kuration/programme',
  '/admin/csv-sources': '/kuration/csv-quellen',
  '/admin/filter': '/kuration/filter',
  // Das Feedback-Board hat die Kurations-Seite mit v2.364 aufgenommen; bis
  // v4.33 zeigte dieser Eintrag auf `/kuration/feedback`, das es seitdem nicht
  // mehr gibt — der Weg endete im Catch-all auf der Startseite.
  '/admin/feedback': '/feedback-board',
  // v4.34
  '/kuration/anfragen': '/kuration?panel=dienste',
  '/kuration/suchindex': '/kuration?panel=suche-index',
  '/kuration/dokumentenquellen': '/kuration?panel=suche-index&sektion=sec-dokumentenquellen',
};

/**
 * Ziele mit Query vertragen kein angehängtes Unterpfad-Suffix — ein
 * `/kuration/anfragen/xyz` landet auf dem Panel, nicht auf
 * `/kuration?panel=dienste/xyz`.
 */
function traegtQuery(ziel: string): boolean {
  return ziel.includes('?');
}

export function legacyRedirectTarget(pathname: string): string | null {
  const direct = LEGACY_REDIRECTS[pathname];
  if (direct) return direct;
  for (const [oldPrefix, newPrefix] of Object.entries(LEGACY_REDIRECTS)) {
    if (pathname.startsWith(oldPrefix + '/')) {
      return traegtQuery(newPrefix) ? newPrefix : newPrefix + pathname.slice(oldPrefix.length);
    }
  }
  return null;
}
