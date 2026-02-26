

## Plan: Add Contact On-The-Fly from Order and Purchase Forms

### Overview
Add a "+ Add New Contact" option to the contact selection in both the Add Order and Add Purchase dialogs. Clicking it reveals an inline mini-form to create a new contact without leaving the current form.

### Changes

**1. Create a reusable InlineAddContact component**
- New file: `src/components/InlineAddContact.tsx`
- A small inline form with three fields: Name (required), Phone, Email
- On save, inserts into the `suppliers` table and calls an `onCreated` callback with the new contact's ID and name
- Shows a loading state while saving, displays toast on success/error
- Can be toggled open/closed from the parent

**2. Update Add Purchase Dialog (`src/components/AddPurchaseDialog.tsx`)**
- Add a "+ Add New Contact" item at the bottom of the existing `CommandGroup` in the contact dropdown
- Clicking it closes the popover and shows the `InlineAddContact` component below the dropdown
- On successful creation, the new contact is added to the local suppliers list, auto-selected in the dropdown, and the inline form hides
- Contact details (name, phone) auto-populate as they already do via the `set("supplier_id", ...)` logic

**3. Update Add Order Dialog (`src/components/AddOrderDialog.tsx`)**
- Replace the plain text "Customer Name" and "Customer Phone" inputs with a contact selection approach:
  - Add a searchable contact dropdown (using Popover + Command, same pattern as purchases)
  - Include a "+ Add New Contact" option at the bottom
  - When a contact is selected, auto-fill `buyer_name` and `buyer_phone` from the contact record
  - Keep the name/phone fields visible and editable so users can override if needed
- Add the same `InlineAddContact` mini-form toggle
- On creation, auto-select the new contact and fill the buyer fields
- Load contacts from `suppliers` table when the dialog opens

### Technical Details

**Files to create:**
- `src/components/InlineAddContact.tsx` -- reusable inline contact creation form

**Files to modify:**
- `src/components/AddOrderDialog.tsx` -- add contact dropdown with "+ Add New" option, auto-fill buyer fields
- `src/components/AddPurchaseDialog.tsx` -- add "+ Add New Contact" item to existing command list

**No database changes required** -- uses the existing `suppliers` table.

**Flow:**
1. User opens Add Order or Add Purchase
2. In the contact dropdown, they see existing contacts plus "+ Add New Contact" at the bottom
3. Clicking "+ Add New Contact" reveals an inline form (name, phone, email)
4. Saving inserts into `suppliers` table, returns the new record
5. The new contact is auto-selected in the dropdown
6. The Contacts page will dynamically show Buyer/Supplier tags based on the resulting order/purchase records -- no manual tagging needed

