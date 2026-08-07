import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /trips and /trips/$tripId.
 * TanStack Router's file-based convention nests trips.$tripId as a child of
 * this route. By rendering <Outlet /> here (and nothing else), the child
 * routes render directly inside the AppShell's <main> without any wrapper.
 */
export const Route = createFileRoute("/_authenticated/trips")({
  component: () => <Outlet />,
});
