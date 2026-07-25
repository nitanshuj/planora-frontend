import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  Table2,
  Wallet,
  Search,
  LogOut,
  Layers,
  Target,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { API_BASE_URL } from "@/lib/api";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Table2 },
  { to: "/receipts", label: "AI Receipt Scanner", icon: Receipt },
  { to: "/categories", label: "Category Limits", icon: Layers },
  { to: "/sub-categories", label: "Sub-Category Limits", icon: Target },
  { to: "/export", label: "Export Expense Data", icon: FileSpreadsheet },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetch(`${API_BASE_URL}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          if (data.user) {
            setUser({
              email: data.user.email,
              name: data.user.full_name || data.user.email.split("@")[0],
            });
          }
        })
        .catch(() => {
          localStorage.removeItem("auth_token");
          navigate({ to: "/auth" });
        });
    }

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const signOut = async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      localStorage.removeItem("auth_token");
    }
    navigate({ to: "/auth" });
  };

  const currentLabel = NAV.find((n) => pathname.startsWith(n.to))?.label ?? "Planora";

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/70 backdrop-blur-xl sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">Planora</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">Personal finance OS</div>
          </div>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-border/70 bg-background/60 text-sm text-muted-foreground hover:bg-accent/60 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or ask…</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border/70">
            ⌘K
          </kbd>
        </button>

        <nav className="px-2 flex-1 space-y-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-2">
          {user && (
            <div className="px-3 py-1.5 text-xs">
              <p className="font-medium text-foreground truncate">{user.name || "User"}</p>
              <p className="text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass sticky top-0 z-30 h-14 flex items-center gap-4 px-5">
          <div className="md:hidden flex items-center gap-2 font-semibold">
            <Wallet className="h-5 w-5 text-primary" /> Planora
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            <span className="hidden md:inline">Planora</span>
            <span className="hidden md:inline mx-2 text-border">/</span>
            <span className="text-foreground">{currentLabel}</span>
          </div>
          <div className="flex-1" />
        </header>

        <main className="flex-1 p-5 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
