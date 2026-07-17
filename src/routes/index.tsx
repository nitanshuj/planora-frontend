import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowRight,
  Shield,
  Sparkles,
  Receipt,
  Brain,
  ChevronRight,
  Zap,
  Play,
  Check,
  RefreshCw,
  DollarSign,
  PieChart,
  TrendingUp,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

type DemoTab = "scan" | "dashboard" | "ledger";

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<DemoTab>("scan");

  // State for Receipt Scan Demo
  const [scanStep, setScanStep] = useState<"idle" | "scanning" | "done">("idle");
  const [extractedData, setExtractedData] = useState<any>(null);

  // State for Dashboard Demo
  const [monthlyLimit, setMonthlyLimit] = useState(20000);
  const [currentSpent, setCurrentSpent] = useState(13240);
  const budgetPct = Math.min(100, (currentSpent / monthlyLimit) * 100);

  // State for Ledger Demo
  const [ledgerItems, setLedgerItems] = useState([
    { item_name: "Weekly Groceries", category: "Groceries", total_paid: 3200, date: "2026-07-16" },
    { item_name: "Taxi to Office", category: "Transport", total_paid: 450, date: "2026-07-15" },
  ]);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCat, setNewCat] = useState("Groceries");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setIsAuthenticated(!!token);
  }, []);

  const destination = isAuthenticated ? "/dashboard" : "/auth";

  // Demo 1: Receipt Scanner Simulation
  const handleScanDemo = () => {
    if (scanStep !== "idle") return;
    setScanStep("scanning");
    setTimeout(() => {
      setScanStep("done");
      setExtractedData({
        expense_date: "2026-07-17",
        payment_method: "Credit Card",
        items: [
          { item_name: "Single Origin Espresso", category: "Dining", total_paid: 350 },
          { item_name: "Avocado Toast", category: "Dining", total_paid: 850 },
        ],
        total: 1200,
      });
    }, 2000);
  };

  const resetScanDemo = () => {
    setScanStep("idle");
    setExtractedData(null);
  };

  // Demo 3: Add transaction simulation
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || !newAmount) return;
    const amt = parseFloat(newAmount);
    if (isNaN(amt)) return;

    setLedgerItems((prev) => [
      {
        item_name: newDesc,
        category: newCat,
        total_paid: amt,
        date: new Date().toISOString().split("T")[0],
      },
      ...prev,
    ]);
    setCurrentSpent((prev) => prev + amt);
    setNewDesc("");
    setNewAmount("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans text-foreground">
      {/* Decorative Grid Grid & Glowing Orbs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.05)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[128px]" />
      <div className="pointer-events-none absolute top-1/4 -right-20 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[128px]" />
      <div className="pointer-events-none absolute bottom-10 left-1/4 h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[128px]" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Wallet className="h-5.5 w-5.5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Planora</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#playground"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Interactive Demo
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#security"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Security
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to={destination}>{isAuthenticated ? "Dashboard" : "Sign In"}</Link>
            </Button>
            <Button className="shadow-soft" asChild>
              <Link to={destination} className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-12 md:pt-28 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          {/* Badge chip */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary transition-all duration-300 hover:bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span>Planora Finance workspace</span>
          </div>

          {/* Headline */}
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Track, scan, and manage
            <span className="mt-3 block bg-gradient-to-r from-primary via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              your personal finance.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            A simplified personal finance application. Extract data directly from uploaded receipts,
            organize items into clear custom categories, and monitor your monthly spending budget.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="w-full sm:w-auto shadow-float text-base font-semibold"
              asChild
            >
              <Link to={destination} className="gap-2">
                Launch Dashboard <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-base font-semibold"
              asChild
            >
              <a href="#playground">Try Live Sandbox</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Interactive Sandbox/Playground Section */}
      <section id="playground" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card-soft p-1.5 bg-card/60 backdrop-blur-xl border border-border/80 shadow-float">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
            {/* Left Controls Column */}
            <div className="lg:col-span-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Interactive Sandbox
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-foreground mt-2">
                  Test Planora features
                </h3>
                <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
                  Interact with real app features to see how Planora organizes and visualizes your
                  transactions.
                </p>

                {/* Tab selectors */}
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => setActiveTab("scan")}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${
                      activeTab === "scan"
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Receipt className="h-4.5 w-4.5" />
                    <span>Receipt OCR Extractor</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${
                      activeTab === "dashboard"
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <PieChart className="h-4.5 w-4.5" />
                    <span>Monthly Budget Tracker</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("ledger")}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${
                      activeTab === "ledger"
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Wallet className="h-4.5 w-4.5" />
                    <span>Quick Ledger Entry</span>
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/40">
                <Button className="w-full shadow-soft" asChild>
                  <Link to={destination} className="gap-2">
                    Open Your Dashboard <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Live Panel Column */}
            <div className="lg:col-span-8 bg-muted/40 rounded-2xl border border-border/50 p-6 relative min-h-[360px] flex flex-col justify-between overflow-hidden">
              {/* Decorative grid pattern inside the preview panel */}
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40" />

              {/* Sandbox Panel 1: Receipt Scanning */}
              {activeTab === "scan" && (
                <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        OCR Extract Preview
                      </h4>
                      <button
                        onClick={resetScanDemo}
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        title="Reset Scanner"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mock Receipt */}
                      <div className="relative bg-card p-4 rounded-xl border border-border/80 shadow-soft overflow-hidden">
                        {scanStep === "scanning" && (
                          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent top-0 animate-[bounce_2s_infinite] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                        <div className="text-center border-b border-dashed border-border pb-3">
                          <p className="font-bold text-xs uppercase tracking-widest text-foreground">
                            Blue Bottle Coffee
                          </p>
                          <p className="text-[10px] text-muted-foreground">San Francisco, CA</p>
                        </div>
                        <div className="space-y-1.5 py-3 border-b border-dashed border-border text-xs">
                          <div className="flex justify-between">
                            <span>1x Single Origin Espresso</span>
                            <span>₹350</span>
                          </div>
                          <div className="flex justify-between">
                            <span>1x Avocado Toast</span>
                            <span>₹850</span>
                          </div>
                        </div>
                        <div className="pt-2.5 text-xs font-semibold flex justify-between">
                          <span>Total</span>
                          <span>₹1,200</span>
                        </div>
                      </div>

                      {/* Scanning Result */}
                      <div className="bg-card/40 p-4 rounded-xl border border-border/50 flex flex-col justify-center items-center text-center">
                        {scanStep === "idle" && (
                          <p className="text-xs text-muted-foreground">
                            Click "Process Receipt" to simulate automatic field extraction
                          </p>
                        )}
                        {scanStep === "scanning" && (
                          <div className="space-y-2">
                            <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-xs text-foreground font-medium">
                              Extracting lines with LLM model...
                            </p>
                          </div>
                        )}
                        {scanStep === "done" && extractedData && (
                          <div className="w-full text-left space-y-2 text-xs">
                            <p className="font-bold text-emerald-500 flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5" /> Parsed Correctly
                            </p>
                            <div className="space-y-1 bg-card p-2.5 rounded border border-border/40">
                              <p>
                                <span className="text-muted-foreground">Date:</span>{" "}
                                {extractedData.expense_date}
                              </p>
                              <p>
                                <span className="text-muted-foreground">Method:</span>{" "}
                                {extractedData.payment_method}
                              </p>
                              <div className="border-t border-border/30 my-1 pt-1">
                                {extractedData.items.map((item: any, i: number) => (
                                  <p key={i} className="flex justify-between">
                                    <span>
                                      {item.item_name} ({item.category})
                                    </span>
                                    <span className="font-semibold">₹{item.total_paid}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleScanDemo}
                      disabled={scanStep !== "idle"}
                      className="gap-2"
                    >
                      {scanStep === "scanning"
                        ? "Scanning..."
                        : scanStep === "done"
                          ? "Extracted"
                          : "Process Receipt"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Sandbox Panel 2: Monthly Budget */}
              {activeTab === "dashboard" && (
                <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Monthly Budget Limit & Spent
                      </h4>
                    </div>

                    <div className="card-soft p-5 bg-card shadow-soft">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Spent this Month
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <div className="text-3xl font-semibold num">
                          ₹{currentSpent.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground num">
                          / ₹{monthlyLimit.toLocaleString()}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden mt-4">
                        <div
                          className="absolute h-full bg-primary transition-all duration-500"
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{budgetPct.toFixed(0)}% budget consumed</span>
                        <span>₹{(monthlyLimit - currentSpent).toLocaleString()} remaining</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Real-time budget indicators based on added transactions.</span>
                  </div>
                </div>
              )}

              {/* Sandbox Panel 3: Quick Ledger */}
              {activeTab === "ledger" && (
                <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm text-foreground">
                        Add Transaction Entry
                      </h4>
                    </div>

                    {/* Simple Quick Add Form */}
                    <form
                      onSubmit={handleAddTransaction}
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-card p-3 rounded-xl border border-border/50"
                    >
                      <input
                        type="text"
                        placeholder="Expense Item"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="md:col-span-2 px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                      />
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                      />
                      <button
                        type="submit"
                        className="bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:bg-primary/95 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </form>

                    {/* Small list preview */}
                    <div className="mt-4 space-y-2">
                      {ledgerItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-card/60 p-2.5 rounded-lg border border-border/30 text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">{item.item_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.date} • {item.category}
                            </p>
                          </div>
                          <span className="font-semibold num">₹{item.total_paid}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Block Section */}
      <section id="features" className="py-20 bg-muted/30 border-y border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Grounded, Actionable Money Management
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Planora maps out your finances using direct database items, allowing full manual
              adjustment and instant receipt scans.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Expense Tracking */}
            <div className="card-soft p-6 shadow-soft group hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                  <Wallet className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Granular Expense Ledger</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Record your daily expenses with specific dates, item names, payment methods, and
                  customized tags.
                </p>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-primary">
                Learn more{" "}
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Card 2: Receipt Extraction */}
            <div className="card-soft p-6 shadow-soft group hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                  <Receipt className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Receipt Upload & OCR</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Upload transaction invoice photos. Planora extracts line items, pricing, date, and
                  tax fields, allowing quick edits before confirming.
                </p>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-primary">
                Learn more{" "}
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Card 3: Category Budgets */}
            <div className="card-soft p-6 shadow-soft group hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Categorized Budgets</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Assign transactions to custom categories (e.g. Groceries, Travel, Leisure). Tag
                  items as mandatory or discretionary spending.
                </p>
              </div>
              <div className="mt-8 flex items-center text-sm font-semibold text-primary">
                Learn more{" "}
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="card-soft p-8 md:p-12 shadow-float bg-card/60 backdrop-blur-xl border border-border/80 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Secured Local Environment
              </h2>
              <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                Your credentials and personal information are strictly encrypted at rest and in
                transit. Planora communicates directly with safe databases and local authentication
                storage, keeping your sessions secure.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>256-Bit SSL Encryption</span>
                </div>
                <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Secure JWT Authentication</span>
                </div>
              </div>
            </div>
            <div className="relative aspect-video rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden">
              {/* Decorative encryption pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.05)_1px,transparent_1px)] bg-[size:16px_16px]" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="p-4 bg-primary text-primary-foreground rounded-full shadow-soft animate-pulse">
                  <Shield className="h-8 w-8" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Secured via Planora Vault
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 text-center text-sm text-muted-foreground bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4.5 w-4.5 text-primary" />
              <span className="font-semibold text-foreground">Planora</span>
            </div>
            <p>© {new Date().getFullYear()} Planora Inc. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
