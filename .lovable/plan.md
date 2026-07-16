# Planora — Build Plan

A polished single-page finance app with a sidebar layout, 5 main views, glassmorphic top bar, command palette, and an AI chat drawer powered by Lovable AI.

## Scope

**Views (tabs in sidebar):**
1. **Dashboard** (`/`) — summary metrics, spending line chart, category doughnut, AI insight banner
2. **Receipts** (`/receipts`) — dashed dropzone upload → AI extraction → verify line items → save
3. **Transactions** (`/transactions`) — data grid with inline edit, filters, sorting
4. **Categories** (`/categories`) — colored tag grid, add/edit budget limits
5. **AI Agent Drawer** — collapsible right-side chat panel, available on every view

**Global chrome:**
- Sticky translucent left sidebar with Planora logo
- Frosted top bar (glassmorphism)
- Command palette (Cmd/Ctrl+K) to jump between views
- Soft shadows, off-white bg, Plus Jakarta Sans

## Tech decisions

- **Backend:** Enable Lovable Cloud. Tables: `categories`, `expenses`, `receipts`. RLS scoped to `auth.uid()`. Basic email/password auth gate.
- **AI:** Lovable AI Gateway (`google/gemini-3-flash-preview`) via server functions for (a) receipt OCR/extraction from uploaded image and (b) chat drawer conversation.
- **Realtime:** Supabase channels on `expenses` so grid + dashboard update live.
- **Charts:** Recharts.
- **Chat drawer storage:** Single conversation, localStorage (companion assistant, not threaded history).
- **Command palette:** shadcn `cmdk`.
- **Auth:** minimal `/auth` page; all app routes under `_authenticated/`.

## Design tokens (src/styles.css)

- `--background` #F8F9FA, cards pure white
- `--primary` deep indigo #3F51B5
- `--success` forest green #2E7D32
- `--accent` slate blue #455A64
- Soft shadow token: `0 10px 30px -5px rgba(0,0,0,0.05)`
- Font: Plus Jakarta Sans via `<link>` in root head

## Data model

```
categories(id, user_id, name, color, monthly_limit, created_at)
expenses(id, user_id, date, vendor, amount, category_id, notes, receipt_id, created_at)
receipts(id, user_id, storage_path, status, extracted_json, created_at)
```
Plus storage bucket `receipts` (private).

## Server functions

- `extractReceipt(receiptId)` — fetch image, call Gemini vision, return line items
- `chatWithAgent(messages)` — stream Lovable AI, system prompt includes user's recent summary context
- `getSummary()` — aggregate totals, monthly series, category breakdown

## Out of scope (v1)

- Threaded chat history (single conversation only)
- Multi-currency, bank connections, exports
- Sharing/collaboration
- Mobile-native app

## Delivery order

1. Enable Cloud + migrations (tables, RLS, storage bucket)
2. Design system + layout shell (sidebar, top bar, command palette)
3. Auth + protected routes
4. Categories view (simplest CRUD, seeds defaults)
5. Transactions grid with realtime
6. Receipts upload + AI extraction flow
7. Dashboard charts + AI insights
8. AI chat drawer (Lovable AI streaming)

Ready to build?
