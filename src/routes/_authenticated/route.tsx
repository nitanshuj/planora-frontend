import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
    if (!token) throw redirect({ to: "/auth" });
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/session", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (typeof window !== 'undefined') localStorage.removeItem("auth_token");
        throw redirect({ to: "/auth" });
      }
      const data = await res.json();
      return { user: data.user };
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e) throw e; // Let TanStack Router redirect pass
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
