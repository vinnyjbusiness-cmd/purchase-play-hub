

## Password Vault — PIN-Protected Credential Manager

### Overview
A new "Password Vault" page accessible from the sidebar, protected by its own separate PIN (stored in a new `vault_settings` table). Once unlocked, users can manage saved credentials displayed as styled cards with show/hide, copy, edit, and delete functionality. The vault auto-locks after 5 minutes of inactivity.

### 1. Database Changes (2 migrations)

**Table: `password_vault`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| org_id | uuid | NOT NULL |
| site_name | text | NOT NULL |
| url | text | nullable |
| username | text | NOT NULL |
| password | text | NOT NULL (stored as-is; encrypted at app level is optional) |
| icon_color | text | default random color |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Admin-only full access, authenticated users SELECT.

**Table: `vault_settings`**
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| org_id | uuid | NOT NULL, unique |
| vault_pin | text | NOT NULL |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Admin-only full access.

### 2. New Page: `src/pages/PasswordVault.tsx`

**PIN Gate (separate from Finance PIN):**
- On load, fetch `vault_pin` from `vault_settings` for the org.
- If no PIN set, prompt admin to create one (reuses the same pattern as `FinancePinGate`).
- PIN stored in sessionStorage under `vjx_vault_unlocked` with a timestamp.
- Auto-lock: on every interaction, check if 5 minutes have elapsed since last activity. If so, clear session and show PIN screen.

**Unlocked View:**
- Header with title "Password Vault", a settings icon (to change PIN), and "Add New" button.
- Cards displayed in a responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop).
- Each card styled like the balance/wallet cards: dark gradient background, coloured circle with site initials on the left, site name as title, username beneath, password hidden with eye toggle, copy button, edit/delete dropdown.
- Card colours cycle through a palette similar to `cardGradients` from Wallet.tsx.

**Add/Edit Modal:**
- Fields: Site Name, URL (optional), Username, Password.
- Icon colour auto-assigned (can be changed).

### 3. Routing and Sidebar

**`src/App.tsx`:**
- Add route `/vault-passwords` wrapped in `<AdminOnly>` (no finance PIN — vault has its own PIN).
- Import new `PasswordVault` page.

**`src/components/AppSidebar.tsx`:**
- Add nav item `{ to: "/vault-passwords", icon: KeyRound, label: "Password Vault" }` in the admin bottom items section.

### 4. Auto-Lock Logic

- Track `lastActivity` timestamp in a ref, updated on click/keydown/mousemove events.
- A `setInterval` every 30 seconds checks if `Date.now() - lastActivity > 300000` (5 min). If so, clear sessionStorage key and set `unlocked = false`.
- Cleanup interval and event listeners on unmount.

### Files Summary
| File | Action |
|---|---|
| Database migration | Create `password_vault` and `vault_settings` tables with RLS |
| `src/pages/PasswordVault.tsx` | New page with PIN gate, card grid, add/edit/delete modals, auto-lock |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add sidebar link |

