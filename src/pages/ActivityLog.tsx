import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Activity, Monitor, LogIn, LogOut, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-600/20 text-green-400 border-green-600/30",
  UPDATE: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  DELETE: "bg-red-600/20 text-red-400 border-red-600/30",
  LOGIN: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
  LOGOUT: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  PAGE_VIEW: "bg-purple-600/20 text-purple-400 border-purple-600/30",
};

const TABLE_LABELS: Record<string, string> = {
  orders: "Order",
  purchases: "Purchase",
  events: "Event",
  inventory: "Inventory",
  platforms: "Platform",
  suppliers: "Supplier",
  balance_payments: "Balance Payment",
  payouts: "Payout",
  refunds: "Refund",
  transactions_ledger: "Transaction",
  org_members: "Team Member",
  invitations: "Invitation",
  organizations: "Organization",
  todos: "Task",
  invoices: "Invoice",
  invoice_settings: "Invoice Settings",
  email_rules: "Email Rule",
  sent_emails: "Email",
  profiles: "Profile",
  auth: "Authentication",
  navigation: "Page View",
};

function getActionIcon(action: string) {
  switch (action) {
    case "LOGIN": return <LogIn className="h-3.5 w-3.5" />;
    case "LOGOUT": return <LogOut className="h-3.5 w-3.5" />;
    case "PAGE_VIEW": return <Eye className="h-3.5 w-3.5" />;
    default: return null;
  }
}

function formatAction(action: string, tableName: string): string {
  const entity = TABLE_LABELS[tableName] || tableName;
  switch (action) {
    case "INSERT": return `Added ${entity}`;
    case "UPDATE": return `Updated ${entity}`;
    case "DELETE": return `Deleted ${entity}`;
    case "LOGIN": return "Logged In";
    case "LOGOUT": return "Logged Out";
    case "PAGE_VIEW": return "Viewed Page";
    default: return `${action} ${entity}`;
  }
}

function formatDetails(action: string, oldValues: any, newValues: any, metadata: any): string {
  if (action === "LOGIN" || action === "LOGOUT") {
    const m = metadata || {};
    return `${m.browser || "?"} on ${m.os || "?"} (${m.device || "?"})`;
  }
  if (action === "PAGE_VIEW") {
    const secs = newValues?.seconds_spent;
    const page = newValues?.page || "?";
    return `${page}${secs ? ` — ${secs}s` : ""}`;
  }
  if (action === "INSERT" && newValues) {
    const keys = Object.keys(newValues).filter(k => !["id", "org_id", "created_at", "updated_at", "user_id"].includes(k)).slice(0, 3);
    return keys.map(k => `${k}: ${newValues[k] ?? "N/A"}`).join(", ");
  }
  if (action === "UPDATE" && newValues && oldValues) {
    const changed = Object.keys(newValues).filter(k =>
      !["updated_at", "created_at"].includes(k) && JSON.stringify(newValues[k]) !== JSON.stringify(oldValues?.[k])
    );
    return changed.slice(0, 3).map(k => `${k}: ${oldValues?.[k] ?? "N/A"} → ${newValues[k] ?? "N/A"}`).join(", ");
  }
  if (action === "DELETE" && oldValues) {
    const keys = Object.keys(oldValues).filter(k => !["id", "org_id", "created_at", "updated_at"].includes(k)).slice(0, 3);
    return keys.map(k => `${k}: ${oldValues[k] ?? "N/A"}`).join(", ");
  }
  return "—";
}

function DeviceInfo({ metadata }: { metadata: any }) {
  if (!metadata?.browser) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Monitor className="h-3 w-3" />
      {metadata.browser}/{metadata.os} ({metadata.device})
    </span>
  );
}

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [limit, setLimit] = useState(200);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_log"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p: any) => { map[p.user_id] = p.display_name || "Unknown"; });
    return map;
  }, [profiles]);

  const uniqueTables = useMemo(() => [...new Set(logs.map((l: any) => l.table_name))].sort(), [logs]);
  const uniqueActions = useMemo(() => [...new Set(logs.map((l: any) => l.action))].sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l: any) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (tableFilter !== "all" && l.table_name !== tableFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const actionLabel = formatAction(l.action, l.table_name).toLowerCase();
        const user = (profileMap[l.user_id] || "").toLowerCase();
        const details = formatDetails(l.action, l.old_values, l.new_values, l.metadata).toLowerCase();
        if (!actionLabel.includes(s) && !user.includes(s) && !details.includes(s)) return false;
      }
      return true;
    });
  }, [logs, actionFilter, tableFilter, search, profileMap]);

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((l: any) => l.created_at?.startsWith(todayStr));
  const loginCount = logs.filter((l: any) => l.action === "LOGIN").length;
  const changeCount = logs.filter((l: any) => ["INSERT", "UPDATE", "DELETE"].includes(l.action)).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <Badge variant="secondary" className="ml-2">{filtered.length} entries</Badge>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Today's Activity</p>
          <p className="text-xl font-bold">{todayLogs.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Logins</p>
          <p className="text-xl font-bold">{loginCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Data Changes</p>
          <p className="text-xl font-bold">{changeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Logged</p>
          <p className="text-xl font-bold">{logs.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Action</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Entity</label>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {uniqueTables.map(t => (
                <SelectItem key={t} value={t}>{TABLE_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Timestamp</TableHead>
              <TableHead className="w-[130px]">User</TableHead>
              <TableHead className="w-[170px]">Action</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-[180px]">Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  Loading activity log...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "dd MMM yyyy, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {profileMap[log.user_id] || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${ACTION_COLORS[log.action] || ""} inline-flex items-center gap-1`}>
                      {getActionIcon(log.action)}
                      {formatAction(log.action, log.table_name)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">
                    {formatDetails(log.action, log.old_values, log.new_values, log.metadata)}
                  </TableCell>
                  <TableCell>
                    <DeviceInfo metadata={log.metadata} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length >= limit && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 200)}>
            <ChevronDown className="h-4 w-4 mr-1" /> Load More
          </Button>
        </div>
      )}
    </div>
  );
}
