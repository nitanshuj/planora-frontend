import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetch(`${API_BASE_URL}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) navigate({ to: "/dashboard" });
          else localStorage.removeItem("auth_token");
        })
        .catch(() => {});
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Registration failed");
        }
        const signupData = await res.json();

        if (signupData.session?.access_token) {
          localStorage.setItem("auth_token", signupData.session.access_token);
          toast.success("Account created", { description: "You're signed in." });
        } else {
          // Log in directly
          const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            localStorage.setItem("auth_token", loginData.access_token);
            toast.success("Account created", { description: "You're signed in." });
          } else {
            toast.info("Account created. Please sign in.");
            setMode("signin");
            setLoading(false);
            return;
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Authentication failed");
        }
        const loginData = await res.json();
        localStorage.setItem("auth_token", loginData.access_token);
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="h-9 w-9 rounded-xl bg-white/15 grid place-items-center backdrop-blur">
            <Wallet className="h-5 w-5" />
          </div>
          Planora
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Your money,
            <br /> quietly organized.
          </h1>
          <p className="text-primary-foreground/80 max-w-md">
            AI-powered categorization, receipt scanning, and a conversational agent that actually
            understands your spending.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} Planora</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-lg font-semibold">
            <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            Planora
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin"
                ? "Sign in to your Planora workspace."
                : "Start tracking in seconds."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground">
            {mode === "signin" ? "New to Planora?" : "Already have an account?"}{" "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
