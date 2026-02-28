

## Plan: Orders Page Overhaul — Collapsible Events, Logos, Pricing, Contact Display, Mobile Edit

### 1. Collapsible Event Rows

Replace the current always-expanded event groups with an accordion-style collapsible pattern using React state.

**Implementation:**
- Add `expandedEvents` state (`Set<string>`) tracking which event groups are open
- The event header row becomes a clickable toggle showing: event name, date, total tickets, total value, and a chevron icon
- Clicking toggles the event key in/out of the set (multiple can be open simultaneously)
- Order details (table on desktop, cards on mobile) are only rendered when the group is expanded
- Smooth height animation using Tailwind `animate-accordion-down`/`animate-accordion-up` or a simple conditional render

**File:** `src/pages/Orders.tsx`

---

### 2. Unique Colour per Event

Add a rotating colour palette for event header rows so no two consecutive events share the same colour.

**Implementation:**
- Define 8-10 dark-theme-friendly accent colours (e.g., emerald, violet, blue, amber, rose, cyan, indigo, orange)
- Assign colours by index in the grouped array (`index % palette.length`)
- Apply as a 4px left border stripe on the event header row
- Works identically on all screen sizes as it's just a CSS border

**File:** `src/pages/Orders.tsx`

---

### 3. Club Logos on Event Headers

Display home and away club logos next to the event name on each header row.

**Implementation:**
- The `suppliers` table has `logo_url` but clubs/teams don't have a dedicated table. Rather than a migration, use a static logo map keyed by team name that maps to known logo URLs (or use the existing `LogoAvatar` component's initial-badge fallback)
- Create a small `TeamLogo` inline component: if a logo URL exists in the map, show it as a 28px rounded image; otherwise fall back to a coloured initial badge (same gradient logic as `LogoAvatar`)
- Show `[HomeLogo] Home vs Away [AwayLogo]` in the header
- On mobile, logos are slightly smaller (24px)

**File:** `src/pages/Orders.tsx` (add `TeamLogo` component inline or as a small shared component)

---

### 4. Price x Quantity Calculation

Ensure `sale_price` is treated as **per-ticket price** and totals are always `sale_price * quantity`.

**Current behaviour:** `sale_price` appears to be stored as a single value and displayed as-is. The display shows `£{sale_price}` without multiplying by quantity.

**Changes:**
- On the collapsed event header: show total value as `sum(order.sale_price * order.quantity)` across all orders in the group
- On each order row/card: display both the per-ticket price and the total (e.g., "12 x £135 = £1,620")
- In the `OrderDetailSheet` P&L section: use `sale_price * quantity` as the sale total
- In `AddOrderDialog` and `EditOrderDialog`: clarify the label as "Price per Ticket (£)" so users know this is per-ticket
- Balance auto-entries: update to use `sale_price * quantity` when creating balance_payments for contact-sourced orders

**Files:** `src/pages/Orders.tsx`, `src/components/OrderDetailSheet.tsx`, `src/components/AddOrderDialog.tsx`, `src/components/EditOrderDialog.tsx`

---

### 5. Full Order Editing on Mobile

On mobile/iPad, tapping an order should open the `EditOrderDialog` as a full-screen sheet where all fields are editable.

**Implementation:**
- The `Dialog` component already renders as a full-screen bottom sheet on mobile (per earlier responsive work)
- Change the mobile card tap handler: instead of opening `OrderDetailSheet` (read-only), open `EditOrderDialog` directly
- Ensure the Save button in `EditOrderDialog` has `sticky bottom-0` positioning so it's always visible without scrolling
- Keep the desktop click behaviour opening `OrderDetailSheet` (with an Edit button inside)

**File:** `src/pages/Orders.tsx` (change mobile card `onClick`), `src/components/EditOrderDialog.tsx` (sticky save button)

---

### 6. Show Contact Name Instead of Platform

Replace the Platform column with the contact/supplier name as the primary display.

**Current behaviour:** The Platform column shows the supplier contact name (from linked purchase) as primary with platform as secondary, or just the platform name.

**Changes:**
- **Desktop table:** Rename column header from "Platform" to "Source". Show contact name (from `contact_id` link or assignment info) as primary bold label. Show buyer name as secondary line underneath. Format: "Affy → John Smith"
- **Mobile cards:** Same pattern — primary line shows contact/source name, secondary shows buyer name
- **Collapsed header row:** Include a summary like "Affy → John Smith · 4 tickets · £400" for each order visible in a compact preview list (show first 2-3 orders as one-line summaries when collapsed)
- **Fallback:** If no contact is linked, show the platform name as before

**File:** `src/pages/Orders.tsx`

---

### Summary of Files to Modify

| File | Changes |
|---|---|
| `src/pages/Orders.tsx` | Collapsible events, colour palette, team logos, price*qty totals, mobile edit tap, contact name display, collapsed preview |
| `src/components/OrderDetailSheet.tsx` | Price*qty in P&L section |
| `src/components/EditOrderDialog.tsx` | "Price per Ticket" label, sticky save button, price*qty for balance entries |
| `src/components/AddOrderDialog.tsx` | "Price per Ticket" label, price*qty for balance entries |

All changes use responsive Tailwind classes and will work identically across iPhone, iPad portrait/landscape, and desktop.

