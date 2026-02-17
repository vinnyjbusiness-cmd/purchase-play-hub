

# VJX Ticket Ops — Implementation Plan

## Overview
A clean, modern ticket trading operations dashboard that replaces Google Sheets. Light mode by default with dark mode toggle. Built with React + Lovable Cloud (Postgres, Auth, Edge Functions). Seeded with realistic demo data (World Cup matches, sample suppliers like Tixstock, FanPass, FootballTicketNet, P2P deals).

---

## Phase 1: Foundation & Data Model

### Database Schema
Set up the full relational data model:
- **Events** — competition, teams, date, venue
- **Suppliers** — name, contact, payment terms
- **Platforms** — name (Tixstock, FanPass, FootballTicketNet, P2P/WhatsApp, etc.), fee structure
- **Purchases** — supplier buys with cost, currency (GBP/USD/EUR), exchange rate, fees, status
- **Inventory** — individual tickets linked to purchases (event, category, section, seat, status)
- **Orders (Sales)** — platform, buyer ref, sale price, fees, net received, delivery type/status
- **Order Lines** — link each sold ticket to its inventory item (the chain: Purchase → Inventory → Sale)
- **Transactions Ledger** — single source of truth for all money movement (sales, fees, refunds, payouts, supplier payments)
- **Payouts** — platform payout tracking
- **Refunds/Chargebacks**
- **User Roles** — Admin / Viewer (secure role table, not on profiles)
- **Audit Log** — tracks finance edits and manual overrides

### Authentication
- Email/password login
- Admin and Viewer roles
- Protected routes

### Seed Data
Populate with ~20 World Cup matches (M1–M20), sample suppliers, ~50 purchases, ~40 orders, inventory, and corresponding ledger entries so the app feels alive on first load.

---

## Phase 2: Dashboard (Home)

- **Summary cards**: Total Revenue, Total Profit, Owed to Suppliers, Pending Payouts, Open Orders, Completed Orders, Refunds
- **Time period toggles**: Today / 7 days / 30 days / All time
- **Charts**: Revenue over time (line), Profit by event (bar), Sales by platform (pie)
- **Quick filters**: Competition, event, platform, supplier, date range, currency
- Clicking any card drills down to the relevant page

---

## Phase 3: Events / Matches Page

- List of all events with search and competition filter
- Each event card shows: date, teams, total inventory, sold count, profit
- **Event detail page** with tabs:
  - **Inventory** — tickets on hand by category/section
  - **Sales** — orders for this event
  - **Purchases** — supplier buys for this event
  - **Profit summary** — revenue, costs, fees, net profit
  - **Ticket chain drilldown** — visual trail from Supplier → Purchase → Inventory → Sale

---

## Phase 4: Orders (Sales) Page

- Searchable, sortable table: Order ID, Platform, Event, Category, Qty, Sale Price, Fees, Net Received, Status, Delivery Type, Buyer Ref, Date
- Filters: platform, event, status, date range
- **Order detail drawer/page**:
  - Linked supplier purchase(s)
  - Line-by-line profit breakdown
  - Notes & attachments section (links to PDFs/screenshots)
- Status badges (Pending, Fulfilled, Delivered, Refunded)
- CSV export

---

## Phase 5: Purchases (Supplier Buys) Page

- Searchable table: Supplier, Supplier Order ID, Event, Category, Qty, Buy Price, Fees, Total Cost, Currency, Date, Status
- Filters: supplier, event, currency, status
- **Purchase detail**:
  - Inventory items created from this purchase
  - Which orders these tickets fulfilled
  - Currency info with exchange rate (original + GBP converted)
- CSV export

---

## Phase 6: Finance / Accounting Page

- **Transaction Ledger** — full log of every financial event (sale, fee, refund, payout, supplier payment) with filters
- **Profit & Loss view** — filterable by date, event, platform, supplier
- **Cashflow chart** — money in/out over time
- **Owed sections**:
  - Owed to suppliers (unpaid purchases)
  - Pending platform payouts
- **Multi-currency**: each transaction stores original currency + GBP equivalent with exchange rate; manual rate override per transaction
- CSV/PDF export

---

## Phase 7: Reconciliation & Exceptions Page

- Automated checks surfaced as alerts:
  - Sales with no linked supplier purchase
  - Purchases not assigned to any sale
  - Delivery overdue orders
  - Negative profit deals (highlighted in red)
  - Missing or unknown fees
- Each exception is clickable to jump to the relevant order/purchase
- Summary count badges on the sidebar

---

## Phase 8: Integration Framework & Data Import

- **CSV Import** — upload CSV files mapped to orders, purchases, or inventory with column mapping UI
- **Integration stub** — a clear pattern (edge function + sync log) for adding API-based integrations later (Tixstock, FanPass, etc.)
- **Sync log** — records of all imports with success/failure details
- **Manual "Sync Now" button** + scheduled sync placeholder
- Documentation comments in code explaining how to add a new data source

---

## Across All Pages
- Sidebar navigation with collapsible menu
- Global search bar
- Persistent filters (saved in URL params)
- Dark mode toggle
- Responsive design
- Audit log for finance edits

