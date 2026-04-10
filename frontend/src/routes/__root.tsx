import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';

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
