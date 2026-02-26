

## Plan: Add Split Type Dropdown and Block Field

### Overview
Add a "Split Type" dropdown (Singles, Pairs, Trios, Quads, All Together) to the Add Order, Add Purchase, and Add Inventory forms. Also add a "Block" field to the Add Order dialog, which currently only has Category with no block/section specificity.

### Database Migration
Add new columns to the relevant tables:
- `orders` table: add `split_type` (text, nullable) and `block` (text, nullable)
- `purchases` table: add `split_type` (text, nullable) -- already has `section` for block
- `inventory` table: add `split_type` (text, nullable) -- already has `block`

### UI Changes

**1. Add Order Dialog (`AddOrderDialog.tsx`)**
- Add a "Block" text input field next to or below the Category dropdown
- Add a "Split Type" dropdown with options: Singles, Pairs, Trios, Quads, All Together
- Save both new fields to the `orders` table on submit

**2. Add Purchase Dialog (`AddPurchaseDialog.tsx`)**
- Add a "Split Type" dropdown with the same options (Singles, Pairs, Trios, Quads, All Together)
- Place it near the Quantity field
- Save to the `purchases` table on submit

**3. Add Inventory Dialog (`AddInventoryDialog.tsx`)**
- Add a "Split Type" dropdown with the same options
- Place it near the Quantity/Category area
- Save to the `inventory` table on submit

### Split Type Options
The dropdown will offer these values:
- `singles` -- Singles
- `pairs` -- Pairs
- `trios` -- Trios
- `quads` -- Quads
- `all_together` -- All Together

### Technical Details

**Files to modify:**
- `src/components/AddOrderDialog.tsx` -- add Block input + Split Type dropdown, update form state and submit
- `src/components/AddPurchaseDialog.tsx` -- add Split Type dropdown, update form state and submit
- `src/components/AddInventoryDialog.tsx` -- add Split Type dropdown, update form state and submit

**Database migration:**
- ALTER TABLE orders ADD COLUMN split_type text, ADD COLUMN block text
- ALTER TABLE purchases ADD COLUMN split_type text
- ALTER TABLE inventory ADD COLUMN split_type text

