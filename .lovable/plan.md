
# Complete Dashboard Redesign — Operational Hub (Zero Financial Data)

Full rewrite of `src/pages/Dashboard.tsx` as a premium dark operational information hub. No financial data whatsoever.

---

## File Changes

### 1. Install `lottie-react` dependency

Add `lottie-react` to package.json for the animated widget.

### 2. Complete rewrite of `src/pages/Dashboard.tsx`

Delete all existing code and rebuild from scratch with the following sections:

---

## HEADER (Full Width)

**Left side:**
- "Good [morning/afternoon/evening], [FirstName]" -- large bold text, Inter/sans-serif
- Date + time below: "Monday, 2 March 2026 . 21:01" -- same font family, medium size
- Next event line: "Liverpool vs Tottenham . 15d 4h 32m" -- countdown numbers in `#10b981`
- NO monospace fonts anywhere in header
- First name extracted from `display_name` by splitting on space

**Right side:**
- Lottie animation widget in a dark card (`#111318` bg)
- 120x120px, emerald glow border/shadow, loops continuously
- On hover: speed up animation (playback speed 2x)
- Primary URL: `https://assets10.lottiefiles.com/packages/lf20_ksgyxaxy.json`
- Fallback URL: `https://assets9.lottiefiles.com/packages/lf20_qforpkhe.json`
- If both fail: CSS animated football emoji bouncing up/down
- Below widget: countdown pill with match name + live ticking "15d 4h 32m 10s"
- Pulsing green dot if event is today

---

## ROW 1 -- KPI Cards (4 cards, grid)

All cards: count-up animation on load, hover lift (`translateY(-2px)`), consistent dark style (`#111318` bg, `#1e2028` border).

| Card | Data Source | Subtitle |
|------|-----------|----------|
| Active Listings | `listings` table, status=active, sum quantity | "X platforms active" (distinct platform count) |
| Orders | `orders` table, status=pending/fulfilled | "X awaiting delivery" amber if >0, "All clear" green if 0 |
| Upcoming Events | `events` in next 30 days (deduplicated) | "Next: [Match Name]" muted |
| Open Tasks | `todos` table, status != done | "X overdue" red if any past due_date, "All clear" green |

---

## ROW 2 -- Next Event Card (60%) + Quick Actions (40%)

**Next Event Card:**
- Large bold match name
- Venue + full date/time in muted text
- Live ticking countdown in emerald green, updates every second
- Sell-through progress bar: "X of Y tickets sold" -- NO currency values
  - Y = total inventory for event, X = inventory with status "sold" or linked to orders
- Platform pills showing which platforms have active listings for this event
- "View Event" button linking to `/analytics?tab=events`

**Quick Actions (2x3 grid):**
- Add Inventory (emerald bg) -> opens AddInventoryDialog or navigates to /stock?tab=inventory
- Add Purchase (blue bg) -> /stock?tab=purchases
- Create Invoice -> /invoices
- View Analytics -> /analytics
- Add Event -> /analytics?tab=events (or trigger add event flow)
- Check Orders -> /orders (amber badge if pending orders exist)

Each: icon + label, rounded card, hover lift

---

## ROW 3 -- Activity Feed (50%) + Upcoming Events (50%)

**Activity Feed ("Recent Activity"):**
- Query `audit_log` table, limit 20, order by created_at desc
- Filter OUT: table_name = "navigation" or action = "PAGE_VIEW" or action = "LOGIN" or action = "LOGOUT"
- Render human-readable descriptions:
  - orders/INSERT: "2x [Match] sold on [Platform]"
  - inventory/INSERT: "5x [Match] inventory added"
  - Format using event names and platform names from joined data
- Each item: Lucide icon left, description center, relative timestamp right
- Filter pills above: All | Sales | Orders | Inventory | Team
- Max 8 items visible, "View All" links to /activity
- NO financial values in any item

**Upcoming Events List:**
- Next 6 future events (deduplicated), sorted by date
- Each row:
  - Bold match name
  - Date + time + venue in muted text
  - Sell-through progress bar: "X / Y tickets" -- no currency
  - Days-until badge: green (7+), amber (3-6), red (<3)
- Click navigates to `/analytics?tab=events`

---

## ROW 4 -- Ops Checklist (Full Width, Collapsible)

**Collapsed by default** using Collapsible component.

- Header: Zap icon + "Ops Checklist -- X issues"
- Red badge if urgent issues, amber if only minor
- Chevron rotates on expand/collapse
- Smooth animation (already built into Radix Collapsible)

**When expanded, three independently collapsible sections:**

**URGENT (red):**
- Overdue events with unresolved issues (past event date, undelivered orders)
- Orders not linked to inventory (quantity > linked count)
- Undelivered orders for past events

**TODAY (amber):**
- Events in next 24 hours with pending tasks
- Orders due for delivery today

**UPCOMING (neutral):**
- Future events with outstanding tasks
- Inventory not yet listed (available inventory with no matching listing)

Each issue row: event name + date, issue description, quick action button ("Mark Delivered" | "Link Inventory" | "View Event")

---

## Design System

All hardcoded in the component (dark theme override for this page):

- Background: `#0a0a0f`
- Card backgrounds: `#111318`
- Card borders: `#1e2028`
- Primary accent: `#10b981` (emerald)
- Warning: `#f59e0b` (amber)
- Error: `#ef4444` (red)
- Primary text: white
- Muted text: `#6b7280`
- Font: sans-serif throughout, NO monospace anywhere
- Hover: `translateY(-2px)` + shadow on all cards
- Count-up animation on KPI numbers using `requestAnimationFrame`
- Fully responsive grid layout

---

## Data Fetching

Single `useEffect` loads all needed data in parallel:
- `profiles` (display_name for greeting)
- `events` (all, for upcoming/next event)
- `orders` (status, delivery_status, event_id, quantity, platform_id)
- `platforms` (id, name)
- `inventory` (event_id, status, purchase_id)
- `listings` (event_id, platform, quantity, status)
- `todos` (status, due_date, title)
- `audit_log` (recent 20, filtered)
- `order_lines` (for linking checks)
- `purchases` (for supplier checks in ops checklist)
- `suppliers` (names for ops checklist)

No financial columns fetched: `sale_price`, `unit_cost`, `face_value`, `amount` etc. are NOT selected.

---

## Removed Items (vs current Dashboard)

- Confetti animation and canvas-confetti usage
- "GOOOAAL!" banner
- Email address from greeting
- PAGE_VIEW / navigation audit entries
- All currency/financial figures
- Monospace fonts
- Delivery Queue card (replaced by Ops Checklist sections)

---

## Files Summary

| Action | File |
|--------|------|
| Install | `lottie-react` package |
| Rewrite | `src/pages/Dashboard.tsx` |

No database changes needed. All tables already exist.
