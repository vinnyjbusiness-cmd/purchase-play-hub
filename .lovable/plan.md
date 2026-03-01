

## Members Pass Links Enhancement

### Overview
Add iPhone, Android, and PK Pass support to the Members page with file upload for .pkpass files, pass indicator icons in the table, and full edit support.

### 1. Database Changes

**Members table** -- add three new columns:
- `iphone_pass_link` (text, nullable) -- URL for iPhone wallet pass
- `android_pass_link` (text, nullable) -- URL for Android wallet pass  
- `pk_pass_url` (text, nullable) -- Supabase Storage URL for uploaded .pkpass file

**Storage** -- create a `pkpass-files` bucket (public) with RLS policies allowing authenticated users to upload/read and admins to delete.

### 2. Add/Edit Member Modal Updates

**File: `src/pages/Members.tsx`**

- Add `iphone_pass_link`, `android_pass_link`, `pk_pass_url` to `EMPTY_FORM` and `Member` interface
- Add a "Pass Links" section below the Address field with:
  - iPhone Pass Link: URL input with Apple icon and copy button
  - Android Pass Link: URL input with Smartphone icon and copy button  
  - PK Pass: drag-and-drop file upload zone accepting `.pkpass` files only. Shows filename + remove/download buttons after upload. Uploads to `pkpass-files/{member_id}/{filename}` in Storage.
- When editing, pre-fill all three fields; PK Pass shows the existing filename with Download/Replace/Remove options
- `handleSave` updated to include the three new fields in the payload and handle file upload before saving
- Modal uses `max-h-[90vh] overflow-y-auto` with sticky footer on mobile via `sm:max-w-lg w-full h-full sm:h-auto`

### 3. Members Table -- Passes Column

Add a "Passes" column after Address showing three icon badges per row:
- Apple icon (lit/dimmed based on `iphone_pass_link`)
- Smartphone icon (lit/dimmed based on `android_pass_link`)
- Ticket icon (lit/dimmed based on `pk_pass_url`)

Desktop: hovering a lit badge shows a Tooltip with the link type. Clicking copies the link (or triggers download for PK pass) with a toast confirmation.

Update `colSpan` values for empty/loading states to account for the new column.

### 4. Inventory Integration

The inventory system already stores `iphone_pass_link`, `android_pass_link`, and `pk_pass_url` per ticket, and the `AddInventoryDialog` already auto-fills from member data. Update the member query in `AddInventoryDialog.tsx` to also fetch `iphone_pass_link`, `android_pass_link`, and `pk_pass_url` from members, and propagate those to inventory tickets when a member is assigned.

### 5. Files Summary

| File | Action |
|---|---|
| Migration SQL | Add 3 columns to members, create pkpass-files bucket + RLS |
| `src/pages/Members.tsx` | Add pass fields to form, Passes column to table, file upload logic |
| `src/components/AddInventoryDialog.tsx` | Fetch new pass fields from members, auto-fill to tickets |

### 6. Responsive Behaviour
- Modal: full-screen on mobile (`h-[100dvh] sm:h-auto sm:max-w-lg`), scrollable body, sticky footer
- Pass fields stack to single column on mobile (`grid-cols-1 sm:grid-cols-2`)
- Upload zone full-width on all breakpoints
- Pass indicator icons use `min-w-[44px] min-h-[44px]` touch targets on mobile

