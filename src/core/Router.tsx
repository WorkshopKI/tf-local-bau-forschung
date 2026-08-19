import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import {
  createHashRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  RouterProvider,
} from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { ShellLayout } from '@/core/ShellLayout';
import { NavigationContext } from '@/core/hooks/useNavigation';
import type { NavigationParams } from '@/core/hooks/useNavigation';
import { legacyRedirectTarget, pluginIdToRoute, routeToPluginId } from '@/core/routes';
import { merkeSeite } from '@/core/nav/herkunft';
import { FLAT_ROUTE_PLUGIN_IDS } from '@/plugins.config';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { AufbereitungPage } from '@/plugins/antraege/aufbereitung/AufbereitungPage';
import { isAntragAufbereitungEnabled } from '@/config/feature-flags';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import { ModulSchlossGate } from '@/core/components/ModulSchlossGate';
import { useAuslastungFrei, useKuratorFrei } from '@/core/modul-freischaltung';
import { useKuratorSeiten } from '@/core/hooks/useKuratorSeiten';

/**
 * Kompatibilitäts-Wrapper: Bietet den bestehenden NavigationContext
 * über `useNavigate`/`useLocation`, sodass alle `useNavigation()`-Aufrufer
 * in Plugins weiterhin funktionieren, ohne dass sie React Router kennen.
 */
function NavigationBridge({
  plugins,
  children,
}: { plugins: TeamFlowPlugin[]; children: React.ReactNode }): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = routeToPluginId(location.pathname) ?? 'home';
  // Namensauflösung gehört hierher: der Router kennt die Plugin-Liste ohnehin,
  // die Verbraucher (Feedback-Kontext) sollen sie nicht dafür laden müssen.
  const activeName = plugins.find(p => p.id === activeId)?.name ?? activeId;

  // Herkunft für den Rückweg aus der Antrags-Detailseite: hier liegen Pfad UND
  // Anzeigename schon beieinander, also merkt es EIN Ort statt jeder Aufrufer
  // (siehe `core/nav/herkunft.ts`; Detail-Routen übergeht `merkeSeite` selbst).
  useEffect(() => {
    merkeSeite(location.pathname + location.search, activeName);
  }, [location.pathname, location.search, activeName]);

  const value = useMemo(
    () => ({
      navigate: (pluginId: string, params?: NavigationParams) => {
        if (params?.selectedId) {
          if (pluginId === 'antraege') useAntraegeStore.getState().setSelectedAktenzeichen(params.selectedId);
          const base = pluginIdToRoute(pluginId);
          const query = params.view ? `?view=${encodeURIComponent(params.view)}` : '';
          navigate(`${base}/${encodeURIComponent(params.selectedId)}${query}`);
          return;
        }
        navigate(pluginIdToRoute(pluginId));
      },
      activeId,
      activeName,
    }),
    [navigate, activeId, activeName],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

function AntraegeRoute({ plugin }: { plugin: TeamFlowPlugin }): React.ReactElement {
  const { aktenzeichen } = useParams<{ aktenzeichen: string }>();
  const setAz = useAntraegeStore(s => s.setSelectedAktenzeichen);
  // Assistent-Protokoll: eine Öffnung je Aktenzeichen (dedupe gegen StrictMode-
  // Doppel-Effekt + Re-Renders). Kein Detail wenn der Slim-Store noch leer ist.
  const zuletztAntrag = useRef<string | null>(null);
  useEffect(() => {
    setAz(aktenzeichen ?? null);
    if (aktenzeichen && zuletztAntrag.current !== aktenzeichen) {
      zuletztAntrag.current = aktenzeichen;
      const item = useAntraegeStore.getState().antraege.find(a => a.aktenzeichen === aktenzeichen);
      void protokolliereEreignis({
        typ: 'antrag_geoeffnet',
        route: `#/antraege/${aktenzeichen}`,
        entitaet: { art: 'antrag', id: aktenzeichen },
        detail: item ? { status: item.status, phase: item.vb_phase } : undefined,
      });
    }
  }, [aktenzeichen, setAz]);
  const Component = plugin.component;
  return <Component />;
}

function VerbundRoute({ plugin }: { plugin: TeamFlowPlugin }): React.ReactElement {
  const { verbundId } = useParams<{ verbundId: string }>();
  const setVb = useAntraegeStore(s => s.setSelectedVerbundId);
  const zuletztVerbund = useRef<string | null>(null);
  useEffect(() => {
    setVb(verbundId ?? null);
    if (verbundId && zuletztVerbund.current !== verbundId) {
      zuletztVerbund.current = verbundId;
      void protokolliereEreignis({
        typ: 'antrag_geoeffnet',
        route: `#/antraege/verbund/${verbundId}`,
        entitaet: { art: 'verbund', id: verbundId },
      });
    }
  }, [verbundId, setVb]);
  const Component = plugin.component;
  return <Component />;
}

function AufbereitungRoute(): React.ReactElement {
  const { aktenzeichen } = useParams<{ aktenzeichen: string }>();
  return <AufbereitungPage antragKey={aktenzeichen ?? ''} />;
}

function RootLayout({ plugins }: { plugins: TeamFlowPlugin[] }): React.ReactElement {
  return (
    <NavigationBridge plugins={plugins}>
      <ShellLayout plugins={plugins}>
        <Outlet />
      </ShellLayout>
    </NavigationBridge>
  );
}

function stripLeadingSlash(route: string): string {
  return route.replace(/^\//, '');
}

/**
 * v3.0: Rendert eine geschuetzte Plugin-Seite — oder die Sperre.
 *
 * Betrifft `kuratorOnly`-Plugins und solche mit `modulSchloss`. Ohne Schloss in
 * der Config sind die Praedikate konstant `true`, dev/local aendern sich also nicht.
 */
function GeschuetzteSeite({ plugin }: { plugin: TeamFlowPlugin }): ReactElement {
  const auslastungFrei = useAuslastungFrei();
  const kuratorFrei = useKuratorFrei();
  const istKurator = useKuratorSeiten();
  const Component = plugin.component;

  const kuratorOnly = plugin.kuratorOnly ?? plugin.adminOnly;

  let frei = true;
  if (kuratorOnly) frei = istKurator;
  if (plugin.modulSchloss === 'auslastung') frei = frei && auslastungFrei;
  if (plugin.modulSchloss === 'kurator') frei = frei && kuratorFrei;

  return (
    <ModulSchlossGate frei={frei} bereich={plugin.name} slot={plugin.modulSchloss}>
      <Component />
    </ModulSchlossGate>
  );
}

/** Braucht dieses Plugin ueberhaupt einen Routen-Schutz? */
function brauchtSchutz(p: TeamFlowPlugin): boolean {
  return !!(p.modulSchloss || p.kuratorOnly || p.adminOnly);
}

export function buildRouter(
  plugins: TeamFlowPlugin[],
): ReturnType<typeof createHashRouter> {
  const byId = new Map(plugins.map(p => [p.id, p]));
  const children: RouteObject[] = [];

  const home = byId.get('home');
  if (home) children.push({ index: true, element: <home.component /> });

  // Einfache Plugins ohne Detail-Routen — die Liste wird aus den Plugin-
  // Definitionen abgeleitet (`src/plugins.config.ts: FLAT_ROUTE_PLUGIN_IDS`),
  // Plugins mit Custom-Route-Handlern (home, antraege) sind dort ausgenommen
  // und werden unten explizit registriert.
  for (const id of FLAT_ROUTE_PLUGIN_IDS) {
    const plugin = byId.get(id);
    if (!plugin) continue;
    const Component = plugin.component;
    children.push({
      path: stripLeadingSlash(pluginIdToRoute(id)),
      element: brauchtSchutz(plugin) ? <GeschuetzteSeite plugin={plugin} /> : <Component />,
    });
  }

  // Legacy-Redirects für Bookmarks / Browser-History (siehe `routes.ts`):
  //   `/admin/*`    → v1.9, die alten Kurator-Routen
  //   `/kuration/*` → v4.34, die Seiten, die Panels des Hubs geworden sind
  //
  // Beide Muster sind Splats und greifen erst, wenn keine echte Route passt —
  // React Router rankt statische Segmente über `*`, `/kuration/csv-quellen`
  // und `/kuration` selbst gehen also weiter an ihre eigenen Seiten.
  const legacyRedirect = (fallback: string) =>
    function LegacyRedirect() {
      const location = useLocation();
      const target = legacyRedirectTarget(location.pathname) ?? fallback;
      return <Navigate to={target} replace />;
    };
  children.push({ path: 'admin/*', Component: legacyRedirect('/') });
  // Ein unbekanntes `/kuration/…` meinte immer eine Kurator-Seite — der Hub ist
  // der ehrlichere Landeplatz als die Startseite.
  //
  // Aber nur, WENN es ihn in dieser Build-Variante gibt: die statische Route
  // `/kuration` entsteht aus der gefilterten Plugin-Liste (prod: `kuratorMenus:
  // false`), der Splat dagegen unbedingt. Ohne die Pruefung fing `kuration/*`
  // auch `/kuration` selbst — ein `*` matcht die leere Restmenge — und jedes
  // alte Lesezeichen endete in prod auf einer leeren Flaeche statt auf Home
  // (v4.119).
  const hubDa = byId.has('kuration');
  children.push({ path: 'kuration/*', Component: legacyRedirect(hubDa ? '/kuration' : '/') });

  const antraege = byId.get('antraege');
  if (antraege) {
    children.push({ path: 'antraege', element: <AntraegeRoute plugin={antraege} /> });
    children.push({ path: 'antraege/verbund/:verbundId', element: <VerbundRoute plugin={antraege} /> });
    // Antrag-Aufbereitung (flag-gated) — Vollbild-Kind unter demselben Shell.
    if (isAntragAufbereitungEnabled()) {
      children.push({ path: 'antraege/:aktenzeichen/aufbereitung', element: <AufbereitungRoute /> });
    }
    children.push({ path: 'antraege/:aktenzeichen', element: <AntraegeRoute plugin={antraege} /> });
  }

  // Deep-Link auf einen einzelnen Skill (Provenienz-Affordanz aus dem Gutachten-
  // Flow). Die flache Route ist bereits oben registriert; diese Variante trägt
  // die Skill-ID als Pfad-Segment — die Seite liest sie via `useParams`.
  const skillVerwaltung = byId.get('skill-verwaltung-kuration');
  if (skillVerwaltung) {
    const Component = skillVerwaltung.component;
    children.push({ path: `${stripLeadingSlash(pluginIdToRoute('skill-verwaltung-kuration'))}/:skillId`, element: <Component /> });
  }

  // Fallback: unbekannte Routen (inkl. via Feature-Flag deaktivierte Bereiche)
  // leiten auf Home. Verhindert dass Bookmarks auf deaktivierte Features
  // leere Seiten zeigen.
  children.push({ path: '*', element: <Navigate to="/" replace /> });

  return createHashRouter([
    {
      path: '/',
      element: <RootLayout plugins={plugins} />,
      children,
    },
  ]);
}

export function AppRouter({
  plugins,
}: {
  plugins: TeamFlowPlugin[];
}): React.ReactElement {
  const router = useMemo(() => buildRouter(plugins), [plugins]);
  return <RouterProvider router={router} />;
}
