import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) throw redirect({ to: "/" });
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (typeof window !== "undefined") localStorage.removeItem("auth_token");
        throw redirect({ to: "/" });
      }
      const data = await res.json();
      return { user: data.user };
    } catch (e) {
      if (e && typeof e === "object" && "isRedirect" in e) throw e; // Let TanStack Router redirect pass
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
