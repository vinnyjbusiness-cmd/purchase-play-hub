
# Phase 2: Analytics Hub — Tabbed Overhaul

Transform the Analytics page into a full tabbed hub with 5 tabs: **Overview | Events | Heatmap | Platforms | Reports**

---

## What Changes

### 1. Rewrite `src/pages/Analytics.tsx` as a tabbed container

The current Analytics page becomes **Tab 1 (Overview)** inside a new tabbed layout. The page will use the existing `Tabs` component from `@/components/ui/tabs`.

**Tab structure:**
- **Overview** — Current analytics content (KPI cards, bar chart, cumulative profit line chart, per-game table with compare mode). Kept as-is, just wrapped in a tab.
- **Events** — Full Events page content moved here (event cards with P&L, club filters, search, WC grouping). Clicking an event card opens a detail slide-over sheet instead of navigating away.
- **Heatmap** — New calendar heatmap showing daily profit density with colour-coded cells, hover tooltips, monthly bar chart, year selector.
- **Platforms** — Full Platforms page content moved here (per-platform tabs with summary cards, event breakdown, recent orders).
- **Reports** — Date-range based reports with preset ranges, exportable as CSV.

### 2. Event Detail Slide-Over (Events Tab)

Instead of navigating to `/events/:id`, clicking an event card on the Events tab opens a **Sheet** (slide-over panel) showing:
- Full P&L breakdown (revenue, costs, fees, profit, margin %)
- Ticket sell-through rate as a progress bar
- Bar chart: tickets sold per day leading up to event (using Recharts)
- Platform breakdown: which platform sold how many tickets
- Timeline of ticket sales activity
- Profit badge: green if positive, red if negative

This will be a new component: `src/components/EventDrilldownSheet.tsx`

### 3. Heatmap Tab (New)

Built with plain divs styled as a grid (no external library needed):
- 12 columns (months), ~31 rows (days)
- Each cell colour-coded using CSS: green shades for profit, red shades for loss, grey for no events
- Hover tooltip showing: date, events that day, total profit/loss
- Monthly summary bar chart below (Recharts BarChart)
- Year selector dropdown
- Summary stats: best month, worst month, total annual profit

### 4. Reports Tab (New)

- Preset date ranges: This Week, This Month, Last Month, This Year, All Time
- Custom date range picker (from/to inputs)
- Report shows: total revenue, costs, profit, event count, tickets sold, best performing event, month-by-month breakdown table
- Export as CSV button (generates and downloads a CSV file client-side)
- PDF export deferred to a future phase (requires additional library)

### 5. Route Changes

The standalone `/events` route will redirect to `/analytics` with the Events tab active. The `/platforms` route already removed from sidebar will also redirect to `/analytics`. The `/events/:id` route remains for direct links but the primary flow is through the sheet.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/EventDrilldownSheet.tsx` | Slide-over sheet with full event P&L, sell-through bar, daily sales chart, platform breakdown |

## Files to Edit

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Complete rewrite as tabbed hub with 5 tabs. Overview keeps current content. Events tab embeds Events page logic. Heatmap tab is new. Platforms tab embeds Platforms logic. Reports tab is new. |
| `src/App.tsx` | Add redirect from `/events` to `/analytics?tab=events` and `/platforms` to `/analytics?tab=platforms`. Keep `/events/:id` route. |

## No Database Changes Needed

All data (events, orders, purchases, platforms) already exists. This is purely a frontend restructure.

---

## Technical Notes

- The Events tab reuses all the logic from `src/pages/Events.tsx` (event cards, club filters, search, WC grouping, deduplication) but renders inline within the Analytics page instead of as a standalone route.
- The Platforms tab reuses all the logic from `src/pages/Platforms.tsx` (platform tabs, summary cards, event breakdown tables).
- The Heatmap is built with a CSS grid of div cells -- each cell maps to a calendar day, coloured by aggregated daily profit from the orders/purchases data.
- CSV export uses a simple `Blob` + `URL.createObjectURL` + hidden anchor click pattern (no library needed).
- All data is fetched once at the Analytics page level and passed down to each tab to avoid redundant queries.
