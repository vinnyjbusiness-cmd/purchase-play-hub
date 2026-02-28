

## Plan: World Cup 2026 Section

### Overview
Create a dedicated World Cup 2026 page accessible from the sidebar, with three tabbed views (Orders, Finance, Inventory) — all pre-filtered to only show World Cup fixtures. The top filter bar will show country/team names dynamically extracted from the World Cup events data, instead of club names.

### 1. Add Sidebar Link

**File: `src/components/AppSidebar.tsx`**
- Add a new nav item in `adminNavItems` (and optionally `viewerNavItems`) with a trophy/globe icon and label "World Cup 2026"
- Route: `/world-cup`
- Use the `Globe` or a suitable icon from lucide-react

### 2. Create World Cup Page

**New file: `src/pages/WorldCup.tsx`**

This page will have:
- **Tabs** at the top: Orders | Finance | Inventory (using Radix Tabs or simple button tabs)
- **Sticky country filter bar** below the tabs — dynamically generated from distinct `home_team` and `away_team` values in events where `competition` contains "World Cup". Shows "All" as default, with green highlighting on the active filter
- **Three tab panels** that reuse the existing logic from Orders, Finance, and Inventory pages but scoped to World Cup events only

**How filtering works:**
- On mount, fetch all events where `competition ILIKE '%world cup%'`
- Extract the World Cup event IDs to scope all queries
- Extract unique team/country names from those events for the filter bar
- Each tab (Orders, Finance, Inventory) queries its respective table filtered by `event_id IN (worldCupEventIds)`
- When a country is selected, further filter to only events involving that country

**Tab content:**
- **Orders tab**: Same table layout as the main Orders page (order ref, buyer, platform, price, delivery status, edit/delete buttons, link tickets) but only showing World Cup orders
- **Finance tab**: Same summary cards and per-event breakdown as the main Finance page, scoped to World Cup
- **Inventory tab**: Same grouped inventory view as the main Inventory page, scoped to World Cup events

### 3. Add Route

**File: `src/App.tsx`**
- Add route: `<Route path="/world-cup" element={<AdminOnly><WorldCup /></AdminOnly>} />`
- Import the new WorldCup page

### Technical Approach

Rather than duplicating hundreds of lines of code from Orders/Finance/Inventory, the World Cup page will:

1. Fetch World Cup events and their IDs upfront
2. Build a country filter bar from the team names in those events
3. Implement three tab views that fetch and display data using the same patterns as the existing pages, but with the World Cup event ID filter baked in
4. Reuse existing components (EditOrderDialog, AddOrderDialog, LinkInventoryDialog, OrderDetailSheet, etc.)

The page will be self-contained in a single file (~500-700 lines) with the three tab panels inline, keeping the same look and feel as the existing pages but with the World Cup scope applied everywhere.

### Country Filter Bar
- Positioned sticky at top, below the tab selector
- Shows "All" + dynamic country names (e.g., "England", "Brazil", "Argentina")
- Plain text labels, green when active, muted grey when inactive
- Generated from `SELECT DISTINCT home_team, away_team FROM events WHERE competition ILIKE '%world cup%'`
