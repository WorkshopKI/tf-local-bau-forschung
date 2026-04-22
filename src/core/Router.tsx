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
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
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
          if (pluginId === 'bauantraege') useBauantraegeStore.getState().setSelectedId(params.selectedId);
          if (pluginId === 'antraege') useAntraegeStore.getState().setSelectedAktenzeichen(params.selectedId);
          const base = pluginIdToRoute(pluginId);
          navigate(`${base}/${encodeURIComponent(params.selectedId)}`);
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

function BauantraegeRoute({ plugin }: { plugin: TeamFlowPlugin }): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const setSelectedId = useBauantraegeStore(s => s.setSelectedId);
  useEffect(() => {
    setSelectedId(id ?? null);
  }, [id, setSelectedId]);
  const Component = plugin.component;
  return <Component />;
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

function RootLayout({ plugins, department }: { plugins: TeamFlowPlugin[]; department: 'antraege' | 'bauantraege' | 'beide' }): React.ReactElement {
  return (
    <NavigationBridge>
      <ShellLayout plugins={plugins} department={department}>
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
  department: 'antraege' | 'bauantraege' | 'beide',
): ReturnType<typeof createHashRouter> {
  const byId = new Map(plugins.map(p => [p.id, p]));
  const children: RouteObject[] = [];

  const home = byId.get('home');
  if (home) children.push({ index: true, element: <home.component /> });

  // Einfache Plugins ohne Detail-Routen
  const flatIds = [
    'dokumente',
    'suche',
    'chat',
    'feedback-board',
    'einstellungen',
    'kurator',
    'programme-kuration',
    'csv-sources-kuration',
    'unterprogramme-kuration',
    'filter-kuration',
    'feedback-kuration',
    'dev-infrastructure-test',
    'dev-state-inspector',
  ];
  for (const id of flatIds) {
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

  const bauantraege = byId.get('bauantraege');
  if (bauantraege) {
    children.push({ path: 'bauantraege', element: <BauantraegeRoute plugin={bauantraege} /> });
    children.push({ path: 'bauantraege/:id', element: <BauantraegeRoute plugin={bauantraege} /> });
  }
  const antraege = byId.get('antraege');
  if (antraege) {
    children.push({ path: 'antraege', element: <AntraegeRoute plugin={antraege} /> });
    children.push({ path: 'antraege/verbund/:verbundId', element: <VerbundRoute plugin={antraege} /> });
    children.push({ path: 'antraege/:aktenzeichen', element: <AntraegeRoute plugin={antraege} /> });
  }

  // Fallback: unbekannte Routen (inkl. via Feature-Flag deaktivierte Bereiche)
  // leiten auf Home. Verhindert dass Bookmarks auf deaktivierte Features
  // leere Seiten zeigen.
  children.push({ path: '*', element: <Navigate to="/" replace /> });

  return createHashRouter([
    {
      path: '/',
      element: <RootLayout plugins={plugins} department={department} />,
      children,
    },
  ]);
}

export function AppRouter({
  plugins,
  department,
}: {
  plugins: TeamFlowPlugin[];
  department: 'antraege' | 'bauantraege' | 'beide';
}): React.ReactElement {
  const router = useMemo(() => buildRouter(plugins, department), [plugins, department]);
  return <RouterProvider router={router} />;
}
