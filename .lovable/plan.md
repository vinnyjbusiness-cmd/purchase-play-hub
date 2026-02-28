

## Plan: Auto-Create Inventory from Purchases

### Problem
Currently, adding a purchase does NOT create inventory records. Users must manually add inventory separately, which is redundant since a purchase already contains all the info needed (event, quantity, category, section, cost).

### Solution

#### 1. Auto-create inventory when a purchase is added

**File: `src/components/AddPurchaseDialog.tsx`**

After the purchase is successfully inserted, immediately create `quantity` inventory records linked to that purchase:

- Query the newly inserted purchase to get its `id`
- Insert N inventory rows (one per ticket in the quantity) with:
  - `event_id` from the purchase
  - `purchase_id` set to the new purchase ID
  - `category` from the purchase
  - `section` from the purchase (block field)
  - `face_value` set to the purchase `unit_cost`
  - `source` set to the supplier name
  - `status` = "available"
  - `split_type` from the purchase

The insert call will change from a simple `.insert()` to `.insert().select()` to get the new purchase ID back, then batch-insert the inventory rows.

#### 2. Show supplier name as "Source" on Inventory page

**File: `src/pages/Inventory.tsx`**

- Update the inventory query to also join through `purchases` to get the supplier name: fetch `purchase_id` then use a separate query to get supplier names for purchases
- Alternatively, since the `source` field on inventory already exists (defaults to "IJK"), we'll set it to the supplier name when auto-creating from a purchase -- so no extra join needed. The existing `source` column display can be added to the ticket chips or section headers.
- Add a small "Source" label on each ticket group showing the supplier name (from the `source` field)

#### 3. Handle the World Cup page's purchase additions too

**File: `src/pages/WorldCup.tsx`**

The World Cup page has its own inline purchase-adding logic. Apply the same auto-inventory-creation pattern there -- after inserting a purchase, auto-create the corresponding inventory records.

### Technical Details

**AddPurchaseDialog changes (lines ~128-147):**
```typescript
// Change: insert().select() to get the purchase ID back
const { data: inserted, error } = await supabase
  .from("purchases")
  .insert({ ... })
  .select("id")
  .single();

if (error) throw error;

// Auto-create inventory records
const inventoryRows = Array.from({ length: parseInt(form.quantity) }, () => ({
  event_id: form.event_id,
  purchase_id: inserted.id,
  category,
  section: section,
  face_value: parseFloat(form.unit_cost),
  source: selectedSupplier?.name || "IJK",
  split_type: form.split_type || null,
  status: "available" as const,
}));

await supabase.from("inventory").insert(inventoryRows as any);
```

**Inventory page:** Add the `source` field display in the ticket chip UI, showing it as a small label (e.g., "via ContactName") on each group header where source is not "IJK".

