

## Plan: Inventory Source & Profit Split + Spreadsheet Templates

This plan covers two major features: (1) adding a "Source" field to inventory with IJK profit splitting, and (2) a Spreadsheet Templates page.

---

### Part 1: Inventory Source & IJK Profit Split

**Database Migration**
- Add a `source` column to the `inventory` table (text, default `'IJK'`)
- This tracks where each ticket was sourced from

**UI Changes to Inventory**
- Add a "Source" dropdown to `AddInventoryDialog` and `InventoryDetailSheet` with options: "IJK", "Own", and a free-text option for other suppliers
- Display the source badge on each ticket chip in the Inventory page

**IJK Account Page**
- Create a new page at `/ijk-account` that shows a full itemised breakdown of all IJK-sourced inventory
- For each ticket, calculate: Sale Price (from linked order), Cost Price (face value or purchase unit cost), Net Profit, and IJK's 50% cut
- Data is pulled by joining `inventory` (where source = 'IJK') with `order_lines` and `orders` to get sale prices, and with `purchases` to get cost prices
- Include a summary row showing totals
- Add a "Export CSV" button that exports the full IJK report with columns: Event, Section, Seat, Cost Price, Sale Price, Net Profit, IJK Share (50%)
- Add navigation link in the sidebar under a logical grouping (near Suppliers)

**Automatic Balance Tracking**
- When the IJK report is viewed, it calculates IJK's 50% share of net profit on each sold ticket
- This total can be cross-referenced with the Balances page (the user can manually add/reconcile payments to IJK there)

---

### Part 2: Spreadsheet Templates Page

**New Page at `/spreadsheet-templates`**
- Create `src/pages/SpreadsheetTemplates.tsx` with three template cards:
  1. **Member Export** -- columns: First Name, Last Name, Supporter ID, Email, Member Password, Email Password, Phone, DOB, Postcode, Address
  2. **Inventory/Sales Export** -- columns: Event, Match Date, Ticket Category, Seat Details, Cost Price, Sale Price, Platform Sold On, Buyer Name, Sale Date, Profit, Source, IJK 50% Split Amount
  3. **IJK Profit Split Report** -- filtered to only IJK-sourced inventory with columns: Event, Tickets Sold, Total Revenue, Total Cost, Net Profit, IJK Share (50%)

- Each template card has two buttons:
  - **Download Blank Template**: generates a CSV with just the headers (no data)
  - **Fill and Export**: fetches live data from the database, populates the template, and downloads as CSV

**Navigation**
- Add "Spreadsheets" link to sidebar (Admin only) with a `FileSpreadsheet` icon
- Add route `/spreadsheet-templates` in `App.tsx`

---

### Technical Details

**Files to create:**
- `src/pages/IJKAccount.tsx` -- IJK account breakdown page
- `src/pages/SpreadsheetTemplates.tsx` -- spreadsheet templates page

**Files to modify:**
- `src/components/AddInventoryDialog.tsx` -- add Source dropdown
- `src/components/InventoryDetailSheet.tsx` -- add Source field
- `src/pages/Inventory.tsx` -- show source badge on ticket chips
- `src/App.tsx` -- add two new routes
- `src/components/AppSidebar.tsx` -- add two new nav items

**Database migration:**
- `ALTER TABLE public.inventory ADD COLUMN source text NOT NULL DEFAULT 'IJK';`

**Data flow for IJK profit calculation:**
- Join inventory (source='IJK') -> order_lines -> orders (to get sale_price, fees)
- Join inventory -> purchases (to get unit_cost)
- Net Profit = (sale_price - fees) / order_quantity - unit_cost per ticket
- IJK Share = Net Profit * 0.5

