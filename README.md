# Planora — Personal Finance & AI Receipt Scanner (Frontend)

Planora is a modern, intuitive, and feature-rich personal finance dashboard designed to help users track expenses, manage budgets, organize transaction categories, and automatically scan and itemize receipts using AI.

---

## 🚀 Key Features

- **📊 Interactive Financial Dashboard**:
  - **Daily & Monthly Spend Breakdown**: Bar charts displaying expenditure over selected months or full annual views.
  - **Cumulative Spend & Category Breakdown (50-50 Split)**: Side-by-side visualization featuring a line chart for cumulative spend and a color-coded bar chart for itemized spending breakdown ("Expenditure by area").
  - **Budget Tracker & Comparisons**: Real-time spending progress tracking with comparative spending deltas (+/- %) vs. previous period.

- **🎯 Category & Sub-Category Limits**:
  - **Per-Month Limit Management**: Dedicated pages for configuring monthly spending caps for main categories (`/categories`) and target sub-categories (`/sub-categories`).
  - **Joined 3-Bar Utilization Visualizations**: Grouped side-by-side bar plots (`barGap={0}`) displaying **Monthly Limit** (Blue), **Actual Spend** (Red), and **Remaining Budget** (Yellow) touching with zero gap.
  - **Month-by-Month Filter**: Interactive month selector (`July 2026`, `June 2026`, etc.) for reviewing historical limits and actual spend.
  - **Case-Insensitive Spend Engine**: Smart, case-insensitive matching (`Milk`, `milk`, `Milk Packet`) connecting expenses to sub-categories automatically.

- **🧾 AI Receipt Scanner**:
  - Upload receipt images or PDFs.
  - Automated AI extraction of merchant name, receipt date, total amount, and itemized line items.
  - Interactive verification step before saving expenses to the database.

- **💳 Transactions Manager**:
  - View, search, and filter individual transactions by category, payment method, date, or item name.
  - Quick action capabilities to add, edit, or delete transactions.

- **⌨️ Command Palette**:
  - Quick navigation shortcut (`Ctrl+K` / `Cmd+K`) to switch views, search pages, or perform common actions.

- **🔒 Authentication & Security**:
  - Supabase authentication integration (Sign in, Sign up, and protected route shell).
  - Bearer token session management.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19 & Vite)
- **Routing**: [TanStack Router](https://tanstack.com/router/v1/docs/guide/introduction) (Type-safe routing)
- **State & Data Fetching**: [TanStack Query](https://tanstack.com/query/latest) (React Query v5)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🔒 License & Notice

**Proprietary & Confidential** — All rights reserved. Unauthorized copying, distribution, installation, or execution of this software via any medium is strictly prohibited.
