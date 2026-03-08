// All permissionable pages in the sidebar
export const PERMISSION_PAGES = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "orders", label: "Orders", path: "/orders" },
  { key: "purchases", label: "Purchases", path: "/purchases" },
  { key: "inventory", label: "Inventory", path: "/inventory" },
  { key: "events", label: "Events", path: "/events" },
  { key: "suppliers", label: "Contacts", path: "/suppliers" },
  { key: "members", label: "Members", path: "/members" },
  { key: "balance", label: "Balances", path: "/balance" },
  { key: "wallet", label: "Wallet", path: "/wallet" },
  { key: "platforms", label: "Platforms", path: "/platforms" },
  { key: "analytics", label: "Analytics", path: "/analytics" },
  { key: "cashflow", label: "Cashflow", path: "/cashflow" },
  { key: "invoices", label: "Invoices", path: "/invoices" },
  { key: "health", label: "Health", path: "/health" },
  { key: "todos", label: "To-Do List", path: "/todos" },
  { key: "communications", label: "Communications", path: "/team/communications" },
  { key: "templates", label: "Templates", path: "/templates" },
  { key: "spreadsheets", label: "Spreadsheets", path: "/spreadsheet-templates" },
  { key: "activity", label: "Activity Log", path: "/activity" },
  { key: "vault", label: "Password Vault", path: "/vault-passwords" },
  { key: "listings", label: "Listings", path: "/listings" },
  { key: "finance", label: "Finance", path: "/finance" },
  { key: "warroom", label: "Focus Room", path: "/warroom" },
  { key: "worldcup", label: "World Cup 2026", path: "/world-cup" },
  { key: "timeline", label: "Event Timeline", path: "/timeline" },
  { key: "ijk", label: "IJK Account", path: "/ijk-account" },
] as const;

export type PermissionKey = (typeof PERMISSION_PAGES)[number]["key"];
export type Permissions = Record<PermissionKey, boolean>;

export function defaultPermissions(allOn = false): Permissions {
  const perms = {} as Permissions;
  for (const p of PERMISSION_PAGES) {
    perms[p.key] = allOn;
  }
  return perms;
}

export function getPageDescription(key: string): string {
  const descriptions: Record<string, string> = {
    dashboard: "Overview of key metrics — total revenue, active orders, upcoming events, and quick-access shortcuts.",
    orders: "Track all customer sales. Update order status, delivery type, link inventory tickets, and view profit/loss per order.",
    purchases: "Record supplier ticket buys with cost, quantity, and category. Purchases auto-generate inventory items.",
    inventory: "Manage all ticket stock. View seating details, login credentials, and ticket pass links.",
    events: "Create and manage events with match codes, venues, and dates. All orders and inventory link to events.",
    suppliers: "Manage supplier contacts, payment terms, logos, and track purchase history per supplier.",
    members: "Directory of individual members with their credentials and pass links.",
    balance: "Track what you owe suppliers and what platforms owe you. Partial payments and history.",
    wallet: "Quick snapshot of total accessible liquid funds across all platforms and suppliers.",
    platforms: "Configure selling platforms. Track fees, payout schedules, and per-platform performance.",
    analytics: "Deep-dive metrics: margin %, average ticket price, and side-by-side event comparison.",
    cashflow: "Calendar view of expected income and outflows. Recurring payout markers.",
    invoices: "Generate professional invoices with saved business details, line items, tax, and bank info.",
    health: "Automated system checks with live status banner.",
    todos: "Team task management with priorities, assignees, due dates, and completion celebrations.",
    communications: "Send team emails and set up automated rules for alerts.",
    templates: "Message templates for quick communication.",
    spreadsheets: "Downloadable spreadsheet templates for data management.",
    activity: "Full audit trail of all actions taken across the platform.",
    vault: "Securely store and manage passwords for various platforms and services.",
    listings: "Manage ticket listings across multiple selling platforms.",
    finance: "PIN-protected financial overview — profit/loss, revenue breakdown, and transaction ledger.",
    warroom: "Real-time operations dashboard for match-day focus and urgent actions.",
    worldcup: "Dedicated World Cup 2026 event management and tracking.",
    timeline: "Visual timeline of all events with key dates and milestones.",
    ijk: "IJK partnership account management, payments, and settlements.",
  };
  return descriptions[key] || "This page helps you manage your operations.";
}
