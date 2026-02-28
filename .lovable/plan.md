

## Plan: Link Orders to Contacts with Auto Balance Updates

### Overview
When creating an order, users will be able to select "Contact" as the source (alongside platforms like WhatsApp, Tixstock). Selecting "Contact" reveals a searchable contact picker. Saving the order automatically creates a balance entry on the Balances page showing what that contact owes. Editing or deleting the order updates/removes the balance entry.

### 1. Database Migration

Add a `contact_id` column to the `orders` table to permanently store which contact is linked to the order:

```sql
ALTER TABLE public.orders ADD COLUMN contact_id uuid REFERENCES public.suppliers(id);
```

No new tables needed -- balance tracking will use the existing `balance_payments` table with `party_type = 'supplier'` and `type = 'adjustment'`, linking via the order's reference_id pattern.

### 2. Update AddOrderDialog

**File: `src/components/AddOrderDialog.tsx`**

- Change the Platform dropdown to include a special "Contact" option at the top of the list
- When "Contact" is selected, hide the platform dropdown value and show the existing contact searchable picker (already in the dialog for "Customer")
- Store the selected contact ID in `form.contact_id`
- On submit:
  - Set `platform_id = null` and `contact_id = selected contact ID`
  - After inserting the order, insert a `balance_payments` record:
    - `party_type: "supplier"`, `party_id: contact_id`
    - `amount: sale_price` (positive, meaning they owe this amount)
    - `type: "adjustment"`
    - `notes: "Order [order_ref] - auto balance"`
    - `contact_name: contact name`

### 3. Update EditOrderDialog

**File: `src/components/EditOrderDialog.tsx`**

- When saving edits to an order that has a `contact_id`:
  - Look up the existing balance_payment for this order (matched by notes pattern or a reference approach)
  - Update the amount if `sale_price` changed
  - If the contact is removed (switched to a platform), delete the balance entry
- To reliably link balance entries to orders, store a reference in the notes field like `"Auto: Order [order_id]"` so we can find and update it

### 4. Update Order Delete Logic

**Files: `src/pages/Orders.tsx`, `src/pages/WorldCup.tsx`**

- Before deleting an order, check if it has a `contact_id`
- If yes, delete any `balance_payments` where notes match `"Auto: Order [order_id]"`

### 5. Display on Orders Page

The existing Platform column already shows contact names when linked through purchases. For contact-sourced orders, display the contact name as the primary label with "Contact" as the secondary label underneath (same pattern as "John Smith (WhatsApp)").

### 6. Balance Page

No changes needed to the Balance page itself -- it already reads from `balance_payments` and groups by `party_type = "supplier"`. The auto-inserted balance entries will appear automatically in the "I'm Owed" section under the contact's name.

### Technical Flow

```text
User creates order with Contact selected
        |
        v
INSERT into orders (contact_id = supplier.id, platform_id = null)
        |
        v
INSERT into balance_payments (party_type='supplier', party_id=contact_id,
  amount=sale_price, type='adjustment', notes='Auto: Order <order_id>')
        |
        v
Balance page auto-shows contact in "I'm Owed" column
```

### Files to Change
- **Migration**: Add `contact_id` column to `orders`
- `src/components/AddOrderDialog.tsx`: Add "Contact" option, auto-create balance entry
- `src/components/EditOrderDialog.tsx`: Handle balance updates on edit
- `src/pages/Orders.tsx`: Delete balance entry on order delete, show contact in Platform column
- `src/pages/WorldCup.tsx`: Same delete logic update
- `src/integrations/supabase/types.ts`: Auto-updated after migration

