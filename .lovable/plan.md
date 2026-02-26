

## Plan: Edit Orders + Fix Link Tickets Dialog

### 1. Add Edit Button to Order Rows

Add a pencil/edit icon button next to the existing delete button on each order row in the Orders table.

**How it works:**
- Clicking the edit button opens an "Edit Order" dialog pre-populated with all the order's current data
- Create a new `EditOrderDialog.tsx` component that mirrors the Add Order form but pre-fills all fields and uses an UPDATE instead of INSERT
- Editable fields: Platform, Event, Order Ref, Buyer Name, Buyer Phone, Category, Block, Split Type, Quantity, Sale Price, Delivery Type, Notes, Device Type
- On save, updates the order in the database and refreshes the table

**Files:**
- Create `src/components/EditOrderDialog.tsx`
- Edit `src/pages/Orders.tsx` -- add edit button + state for editing

### 2. Fix "Unknown" Supplier and £0.00 in Link Tickets Dialog

The issue is that inventory items may have `purchase_id` set to NULL (e.g., manually added inventory without a purchase), causing the supplier lookup to fail and cost to show as 0.

**Fixes in `LinkInventoryDialog.tsx`:**
- Also fetch `face_value` from the inventory table to display as fallback price when no purchase exists
- Handle NULL `purchase_id` gracefully -- show "Direct / No Purchase" instead of "Unknown"
- Display the inventory's own `face_value` when the purchase cost is 0 or missing
- Filter out inventory with null `purchase_id` from the purchaseIds lookup to avoid errors

### 3. Group Adjacent Seats in Link Tickets Dialog

Detect adjacent seats (same section + row, consecutive seat numbers) and group them with a "Select Pair/Group" button.

**How it works:**
- After loading tickets, sort by section, row, seat number
- Identify groups of consecutive seats in the same section+row (e.g., Row 22, Seats 23-24)
- Display grouped tickets with a visual container and a "Select Pair" / "Select Group (N)" button that selects all tickets in the group at once
- Individual ticket checkboxes still work for manual selection
- Groups are labeled (e.g., "Pair - Row 22, Seats 23-24")

**Files:**
- Edit `src/components/LinkInventoryDialog.tsx` -- add face_value fetch, grouping logic, group select buttons

### Technical Details

**New file:** `src/components/EditOrderDialog.tsx`
- Accepts an `order` prop with all current values
- Loads platforms, events, contacts on mount (same as AddOrderDialog)
- Pre-fills form state from the order
- On submit: `supabase.from("orders").update({...}).eq("id", order.id)`
- Calls `onUpdated()` callback to refresh the parent

**EditOrderDialog fields:** platform_id, event_id, order_ref, buyer_name, buyer_phone, buyer_email, category, block, split_type, quantity, sale_price, delivery_type, device_type, notes

**LinkInventoryDialog changes:**
- Fetch inventory with additional `face_value` column
- Grouping: sort tickets by `section, row_name, seat`, then cluster consecutive seats into groups
- Each group gets a "Select All (N)" button
- Show `face_value` or `unit_cost` (whichever is available and non-zero)

**Orders.tsx changes:**
- Add `Pencil` icon import from lucide-react
- Add `editOrder` state to track which order is being edited
- Add edit button cell next to delete button
- Render `EditOrderDialog` when `editOrder` is set

