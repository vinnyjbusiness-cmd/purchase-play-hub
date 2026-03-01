

## Import Members from Google Sheets

### Overview
Create a new `ImportMembersDialog` component accessible from the Members page via a prominent button. Users paste tab-separated data copied from Google Sheets, preview and edit rows, optionally upload `.pkpass` files per row, then bulk import.

### 1. New Component: `src/components/ImportMembersDialog.tsx`

**Paste Area**
- Large textarea with placeholder instructions ("Copy your data from Google Sheets and paste it here...")
- On paste/change, parse tab-separated values (TSV): split by newlines, split each line by `\t`
- Read first row as headers, map case-insensitively with whitespace trimming:

| Sheet Header | DB Field |
|---|---|
| first name | first_name |
| last name | last_name |
| supporter id | supporter_id |
| email | email |
| member password | member_password |
| email password | email_password |
| phone number | phone_number |
| dob | date_of_birth |
| postcode | postcode |
| adress / address | address |
| iphone links | iphone_pass_link |
| android links | android_pass_link |

**Preview Table**
- Rendered after parsing, with a live badge counter ("32 members detected")
- Each row has: checkbox (include/exclude), all mapped fields in columns, inline remove button
- Validation highlights: red background + warning icon on rows missing first_name, last_name, or email
- Duplicate detection: query existing member emails from Supabase on parse, show yellow "Already exists -- will skip" badge on matching rows; auto-uncheck duplicates
- PK Pass column: small "Upload .pkpass" button per row opening a file picker (accept=".pkpass"), shows filename + remove once uploaded

**Footer (sticky on mobile)**
- Live count: "X members ready to import"
- Select All / Deselect All toggle
- "Import X Members" button that:
  1. Uploads any `.pkpass` files to the `pkpass-files` storage bucket
  2. Bulk inserts all checked, valid, non-duplicate rows into the `members` table
  3. Shows summary toast: imported count, skipped duplicates, failures

### 2. Members Page Update: `src/pages/Members.tsx`

- Add an "Import from Google Sheets" button in the header button group (with a spreadsheet/table icon)
- Wire it to open/close state for `ImportMembersDialog`
- Pass `orgId` and `onComplete` callback (to refresh member list) as props

### 3. Responsive Behavior

- Mobile: textarea full-width, preview table scrolls horizontally, footer is sticky at bottom with `position: sticky`
- iPad: comfortable padding, horizontal scroll on table if needed
- Desktop: all columns visible with comfortable spacing

### Technical Notes

- No database migration needed -- all columns already exist on the `members` table
- The `pkpass-files` storage bucket already exists and is public
- TSV parsing handles Google Sheets copy format (tab-delimited); the existing CSV import remains unchanged
- Duplicate check uses a single `.select("email")` query against existing members for the org before import
- Bulk insert uses `.insert()` with an array of row objects
