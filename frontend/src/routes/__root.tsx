import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';

/**
 * Paths that render bare (no nav shell). Everything else gets wrapped in
 * the AppShell so the top navigation is always one click away.
 */
const BARE_PATHS = new Set(['/', '/login', '/setup']);

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (BARE_PATHS.has(pathname)) {
    return (
      <div className="min-h-full bg-bg text-fg">
        <Outlet />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
