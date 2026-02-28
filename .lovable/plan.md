

## Listings Manager Page

### Overview
A new "Listings Manager" page for managing ticket listings across platforms (Tixstock, FootballTicketNet, LiveFootball, Fanpass). Events are grouped as collapsible cards with per-listing controls for publishing, pricing, and deletion.

### 1. Database: New `listings` table

Uses the existing `events` table (no new events table needed).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, gen_random_uuid() |
| org_id | uuid | NOT NULL |
| event_id | uuid | NOT NULL, FK to events |
| platform | text | NOT NULL (tixstock, footballticketnet, livefootball, fanpass) |
| section | text | nullable |
| row | text | nullable |
| seat_from | text | nullable |
| seat_to | text | nullable |
| quantity | integer | NOT NULL, default 1 |
| price | numeric | NOT NULL |
| face_value | numeric | nullable |
| status | text | NOT NULL, default 'published' |
| external_listing_id | text | nullable |
| last_synced_at | timestamptz | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Admin-only full access, authenticated SELECT.

### 2. New Page: `src/pages/ListingsManager.tsx`

**Layout:**
- Header: "Listings Manager" title with page-level search input
- Horizontal filter tabs: All | Tixstock | FootballTicketNet | LiveFootball | Fanpass (matching existing FilterSelect/tab style)
- Each platform tab shows a "Sync" button and "Last synced" timestamp
- Below tabs: event cards in a vertical stack

**Event Cards (collapsed):**
- Dark gradient background (reusing EVENT_PALETTE from Orders)
- Club badge via CLUBS lookup on the left
- Match name, date, venue
- Total listings count badge
- Status pill: Active (all published), Partial (mixed), Unlisted (none published)
- Chevron toggle to expand

**Event Cards (expanded):**
- "Publish All" / "Unpublish All" buttons at top-right
- "Add Listing" button opening a modal
- Sub-listing rows as compact cards showing:
  - Platform badge (Tixstock=purple, FootballTicketNet=amber, LiveFootball=green, Fanpass=blue)
  - Section / Row / Seat info
  - Quantity, Price per ticket
  - Publish/Unpublish toggle
  - Inline price edit input
  - Delete button

**Add/Edit Listing Modal:**
- Fields: Platform (dropdown), Section, Row, Seat From, Seat To, Quantity, Price, Face Value

**Sync Button:**
- Placeholder function per platform that shows a toast ("Sync not yet connected - API key required")
- Updates `last_synced_at` concept (stored in component state for now)

### 3. Routing and Sidebar

**`src/App.tsx`:**
- Add route `/listings` wrapped in `<AdminOnly>`
- Import ListingsManager page

**`src/components/AppSidebar.tsx`:**
- Add nav item `{ to: "/listings", icon: Globe, label: "Listings" }` in admin nav items, near the Orders/Events section

### 4. Mobile Responsiveness
- Event cards stack vertically (already natural)
- Sub-listing rows become compact stacked cards on mobile (grid cols adjust)
- Add Listing modal goes near-fullscreen on mobile via Dialog responsive classes

### Files Summary
| File | Action |
|---|---|
| Database migration | Create `listings` table with RLS |
| `src/pages/ListingsManager.tsx` | New page with tabs, event cards, listing CRUD |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add sidebar link |

