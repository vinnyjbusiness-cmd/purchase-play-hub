

## Add Order Status Field with Inline Editing

### Overview
Add a clear, color-coded status system to each order with four states: Outstanding (amber), Delivered (green), Partially Delivered (blue), and Cancelled (red). The status will be tappable inline on the orders page and prominently displayed at the top of the edit dialog.

### 1. Database Migration
Add two new values to the existing `order_status` enum: `outstanding` and `partially_delivered`.

```sql
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'outstanding';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_delivered';
```

Also run an update to migrate existing `pending` orders to `outstanding`:
```sql
UPDATE orders SET status = 'outstanding' WHERE status = 'pending';
```

### 2. Orders Page — Inline Status Badge (src/pages/Orders.tsx)

**Status color map:**
- `outstanding` = amber/yellow (`bg-amber-500/15 text-amber-400 border-amber-500/30`)
- `delivered` = green (`bg-green-500/15 text-green-400 border-green-500/30`)
- `partially_delivered` = blue (`bg-blue-500/15 text-blue-400 border-blue-500/30`)
- `cancelled` = red (`bg-red-500/15 text-red-400 border-red-500/30`)

**Mobile cards:** Replace the current DELIVERED/OUTSTANDING badge with a tappable status pill. Tapping cycles through: outstanding -> partially_delivered -> delivered -> cancelled -> outstanding. The `updateField` function handles the DB update inline.

**Desktop table:** Replace the current "Status" column (which shows a static DELIVERED/OUTSTANDING badge) with a clickable status badge that cycles through statuses on click. Remove the separate "Delivered" checkbox column since the status field now covers this.

**Delivered count on header:** Update the delivered count logic to count orders with `status === 'delivered'` instead of checking `delivery_status`.

### 3. Edit Order Dialog — Status Dropdown (src/components/EditOrderDialog.tsx)

Add a prominent Status section at the very top of the form (before Source):
- Label: "Status"
- Four segmented buttons showing Outstanding, Delivered, Partially Delivered, Cancelled
- Each button color-coded to match the status colors
- Add `delivery_status` to the form state and submit payload

### 4. Order Detail Sheet (src/components/OrderDetailSheet.tsx)

Update the existing Order Status dropdown to use the new four values instead of the old five (pending/fulfilled/delivered/refunded/cancelled).

### Files Modified
| File | Changes |
|---|---|
| Database migration | Add `outstanding` and `partially_delivered` to `order_status` enum; migrate existing `pending` to `outstanding` |
| `src/pages/Orders.tsx` | Inline tappable status badge on mobile cards and desktop table rows; remove delivered checkbox; update delivered count logic |
| `src/components/EditOrderDialog.tsx` | Add status segmented buttons at top of form |
| `src/components/OrderDetailSheet.tsx` | Update status dropdown values |

