import { useEffect, useMemo } from 'react';
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
import { FLAT_ROUTE_PLUGIN_IDS } from '@/plugins.config';
import { useAntraegeStore } from '@/plugins/antraege/store';

/**
 * Kompatibilitäts-Wrapper: Bietet den bestehenden NavigationContext
 * über `useNavigate`/`useLocation`, sodass alle `useNavigation()`-Aufrufer
 * in Plugins weiterhin funktionieren, ohne dass sie React Router kennen.
 */
function NavigationBridge({ children }: { children: React.ReactNode }): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = routeToPluginId(location.pathname) ?? 'home';

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
    }),
    [navigate, activeId],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

function AntraegeRoute({ plugin }: { plugin: TeamFlowPlugin }): React.ReactElement {
  const { aktenzeichen } = useParams<{ aktenzeichen: string }>();
  const setAz = useAntraegeStore(s => s.setSelectedAktenzeichen);
  useEffect(() => {
    setAz(aktenzeichen ?? null);
  }, [aktenzeichen, setAz]);
  const Component = plugin.component;
  return <Component />;
}

function VerbundRoute({ plugin }: { plugin: TeamFlowPlugin }): React.ReactElement {
  const { verbundId } = useParams<{ verbundId: string }>();
  const setVb = useAntraegeStore(s => s.setSelectedVerbundId);
  useEffect(() => {
    setVb(verbundId ?? null);
  }, [verbundId, setVb]);
  const Component = plugin.component;
  return <Component />;
}

function RootLayout({ plugins }: { plugins: TeamFlowPlugin[] }): React.ReactElement {
  return (
    <NavigationBridge>
      <ShellLayout plugins={plugins}>
        <Outlet />
      </ShellLayout>
    </NavigationBridge>
  );
}

function stripLeadingSlash(route: string): string {
  return route.replace(/^\//, '');
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
    children.push({ path: stripLeadingSlash(pluginIdToRoute(id)), element: <Component /> });
  }

  // Legacy /admin/* → /kuration/* Redirects (Bookmarks / Browser-History).
  children.push({
    path: 'admin/*',
    Component: function LegacyAdminRedirect() {
      const location = useLocation();
      const target = legacyRedirectTarget(location.pathname) ?? '/';
      return <Navigate to={target} replace />;
    },
  });

  const antraege = byId.get('antraege');
  if (antraege) {
    children.push({ path: 'antraege', element: <AntraegeRoute plugin={antraege} /> });
    children.push({ path: 'antraege/verbund/:verbundId', element: <VerbundRoute plugin={antraege} /> });
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
