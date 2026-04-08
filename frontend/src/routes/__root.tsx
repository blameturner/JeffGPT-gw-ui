import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-full bg-bg text-text">
      <Outlet />
    </div>
  ),
});
