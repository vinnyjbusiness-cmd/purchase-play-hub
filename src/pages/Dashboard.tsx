import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, differenceInSeconds } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  CalendarDays,
  ShoppingCart,
  ArrowRight,
  Send,
  AlertTriangle,
  Zap,
  Package,
  CircleDot,
  Bell,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Link2Off,
  DollarSign,
  Truck,
  ClipboardList,
} from "lucide-react";
import { deduplicateEvents } from "@/lib/eventDedup";
import { Button } from "@/components/ui/button";

interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; }
interface OrderInfo { id: string; order_ref: string | null; status: string; delivery_status: string | null; event_id: string; quantity: number; sale_price: number; order_date: string; platform_id: string | null; }
interface PlatformInfo { id: string; name: string; }
interface AuditEntry { id: string; table_name: string; action: string; created_at: string; new_values: any; old_values: any; user_id: string | null; }
interface OrderLineInfo { order_id: string; inventory_id: string; }
interface PurchaseInfo { id: string; event_id: string; supplier_id: string; supplier_paid: boolean; unit_cost: number; quantity: number; status: string; }
interface InventoryInfo { id: string; event_id: string; status: string; face_value: number | null; purchase_id: string | null; }
interface SupplierInfo { id: string; name: string; }

const TABLE_LABELS: Record<string, string> = {
  orders: "Order", purchases: "Purchase", events: "Event", inventory: "Inventory",
  suppliers: "Contact", balance_payments: "Payment", todos: "To-Do",
  order_status_history: "Order Status", platforms: "Platform", refunds: "Refund",
};

function formatAuditAction(action: string, table: string): string {
  const entity = TABLE_LABELS[table] || table;
  if (action === "INSERT") return `New ${entity}`;
  if (action === "UPDATE") return `Updated ${entity}`;
  if (action === "DELETE") return `Removed ${entity}`;
  return `${action} ${entity}`;
}

// Typewriter hook
function useTypewriter(text: string, speed = 50) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return displayed;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("VJX");
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [awaitingDelivery, setAwaitingDelivery] = useState<OrderInfo[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventInfo[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [orderLines, setOrderLines] = useState<OrderLineInfo[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInfo[]>([]);
  const [inventory, setInventory] = useState<InventoryInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);

  useEffect(() => {
    async function load() {
      const [profileRes, eventsRes, ordersRes, platformsRes, auditRes, profilesRes, olRes, purchRes, invRes, supRes] = await Promise.all([
        supabase.from("profiles").select("display_name").limit(1).single(),
        supabase.from("events").select("id,match_code,home_team,away_team,event_date").order("event_date"),
        supabase.from("orders").select("id,order_ref,status,delivery_status,event_id,quantity,sale_price,order_date,platform_id"),
        supabase.from("platforms").select("id,name"),
        supabase.from("audit_log").select("id,table_name,action,created_at,new_values,old_values,user_id").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("user_id,display_name"),
        supabase.from("order_lines").select("order_id,inventory_id"),
        supabase.from("purchases").select("id,event_id,supplier_id,supplier_paid,unit_cost,quantity,status"),
        supabase.from("inventory").select("id,event_id,status,face_value,purchase_id"),
        supabase.from("suppliers").select("id,name"),
      ]);

      if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);

      const allEvents = eventsRes.data || [];
      const allOrders = ordersRes.data || [];
      const allPlatforms = platformsRes.data || [];

      setEvents(allEvents);
      setOrders(allOrders);
      setPlatforms(allPlatforms);
      setAuditLogs(auditRes.data || []);
      setOrderLines((olRes.data as any) || []);
      setPurchases((purchRes.data as any) || []);
      setInventory((invRes.data as any) || []);
      setSuppliers((supRes.data as any) || []);

      const pMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { pMap[p.user_id] = p.display_name || "Unknown"; });
      setProfiles(pMap);

      const awaiting = allOrders.filter(o =>
        (o.status === "pending" || o.status === "fulfilled") &&
        o.delivery_status !== "delivered"
      );
      setAwaitingDelivery(awaiting);

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { unique: dedupedEvents } = deduplicateEvents(allEvents);
      setUpcomingEvents(dedupedEvents.filter(e => {
        const d = new Date(e.event_date);
        return d >= now && d <= sevenDays;
      }));

      setOpenOrders(allOrders.filter(o => o.status === "pending" || o.status === "fulfilled").length);
      setLoading(false);
    }
    load();
  }, []);

  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const greetingText = `${greeting()}, ${displayName}`;
  const typedGreeting = useTypewriter(loading ? "" : greetingText, 40);

  // Next upcoming event (overall, not just 7 days)
  const nextEvent = useMemo(() => {
    const now = new Date();
    const { unique } = deduplicateEvents(events);
    return unique.find(e => new Date(e.event_date) > now) || null;
  }, [events]);

  // Countdown for next event
  useEffect(() => {
    if (!nextEvent) return;
    const tick = () => {
      const diff = differenceInSeconds(new Date(nextEvent.event_date), new Date());
      if (diff <= 0) { setCountdown("NOW"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextEvent]);

  // Notifications summary
  const notifications = useMemo(() => {
    const items: { label: string; time: string }[] = [];
    auditLogs.slice(0, 3).forEach(log => {
      items.push({
        label: formatAuditAction(log.action, log.table_name),
        time: format(new Date(log.created_at), "HH:mm"),
      });
    });
    return items;
  }, [auditLogs]);

  // Goal celebration animation
  const celebrationFired = useRef(false);
  useEffect(() => {
    if (loading || celebrationFired.current) return;
    celebrationFired.current = true;
    const timer = setTimeout(() => {
      // Football-style burst from left and right
      const defaults = { startVelocity: 30, spread: 60, ticks: 80, zIndex: 100 };
      confetti({ ...defaults, particleCount: 50, origin: { x: 0.2, y: 0.6 }, colors: ["#22c55e", "#3b82f6", "#ffffff"] });
      confetti({ ...defaults, particleCount: 50, origin: { x: 0.8, y: 0.6 }, colors: ["#22c55e", "#3b82f6", "#ffffff"] });
    }, 800);
    return () => clearTimeout(timer);
  }, [loading]);

  // Urgent actions
  const urgentActions = useMemo(() => {
    const actions: { label: string; count: number; color: string; path: string }[] = [];
    if (awaitingDelivery.length > 0) actions.push({ label: "Deliveries pending", count: awaitingDelivery.length, color: "text-warning", path: "/orders" });
    const openCount = orders.filter(o => o.status === "pending").length;
    if (openCount > 0) actions.push({ label: "Orders need action", count: openCount, color: "text-destructive", path: "/orders" });
    return actions;
  }, [awaitingDelivery, orders]);

  // Ops Checklist — per-event issues
  const opsChecklist = useMemo(() => {
    const now = new Date();
    const { unique: dedupedEvts, groupedIds } = deduplicateEvents(events);
    // Only future events (or events in past 7 days for cleanup)
    const relevantEvents = dedupedEvts.filter(e => {
      const d = new Date(e.event_date);
      return d.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000;
    });

    const orderLinesByOrder = new Map<string, string[]>();
    orderLines.forEach(ol => {
      if (!orderLinesByOrder.has(ol.order_id)) orderLinesByOrder.set(ol.order_id, []);
      orderLinesByOrder.get(ol.order_id)!.push(ol.inventory_id);
    });

    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

    interface EventIssue {
      event: EventInfo;
      issues: { icon: string; label: string; severity: "red" | "amber" | "blue"; path: string }[];
    }

    const results: EventIssue[] = [];

    for (const ev of relevantEvents) {
      const allIds = groupedIds[ev.id] || [ev.id];
      const evOrders = orders.filter(o => allIds.includes(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");
      const evPurchases = purchases.filter(p => allIds.includes(p.event_id) && p.status !== "cancelled");
      const evInventory = inventory.filter(i => allIds.includes(i.event_id) && i.status !== "cancelled");
      const issues: EventIssue["issues"] = [];

      // 1. Orders without linked inventory
      const unlinkedOrders = evOrders.filter(o => {
        const linked = orderLinesByOrder.get(o.id) || [];
        return linked.length < o.quantity;
      });
      if (unlinkedOrders.length > 0) {
        issues.push({
          icon: "link",
          label: `${unlinkedOrders.length} order${unlinkedOrders.length !== 1 ? "s" : ""} not fully linked to inventory`,
          severity: "red",
          path: "/orders",
        });
      }

      // 2. Orders not delivered (outstanding/partially)
      const undelivered = evOrders.filter(o => o.status === "outstanding" || o.status === "partially_delivered" || o.status === "pending");
      if (undelivered.length > 0) {
        const isPast = new Date(ev.event_date) < now;
        issues.push({
          icon: "truck",
          label: `${undelivered.length} order${undelivered.length !== 1 ? "s" : ""} not delivered`,
          severity: isPast ? "red" : "amber",
          path: "/orders",
        });
      }

      // 3. Suppliers not paid
      const unpaidPurchases = evPurchases.filter(p => !p.supplier_paid);
      if (unpaidPurchases.length > 0) {
        const supplierNames = [...new Set(unpaidPurchases.map(p => supplierMap[p.supplier_id] || "Unknown"))];
        issues.push({
          icon: "dollar",
          label: `${supplierNames.length} supplier${supplierNames.length !== 1 ? "s" : ""} unpaid (${supplierNames.slice(0, 2).join(", ")}${supplierNames.length > 2 ? "…" : ""})`,
          severity: "amber",
          path: "/purchases",
        });
      }

      // 4. Orders with £0 sale price
      const zeroPriceOrders = evOrders.filter(o => !o.sale_price || o.sale_price === 0);
      if (zeroPriceOrders.length > 0) {
        issues.push({
          icon: "dollar",
          label: `${zeroPriceOrders.length} order${zeroPriceOrders.length !== 1 ? "s" : ""} missing sale price`,
          severity: "red",
          path: "/orders",
        });
      }

      // 5. Available inventory not assigned to any order
      const assignedInvIds = new Set(orderLines.map(ol => ol.inventory_id));
      const unassignedInv = evInventory.filter(i => i.status === "available" && !assignedInvIds.has(i.id));
      if (unassignedInv.length > 0 && evOrders.length > 0) {
        issues.push({
          icon: "clipboard",
          label: `${unassignedInv.length} ticket${unassignedInv.length !== 1 ? "s" : ""} available but unassigned`,
          severity: "blue",
          path: "/inventory",
        });
      }

      if (issues.length > 0) {
        results.push({ event: ev, issues });
      }
    }

    // Sort: most issues first, then by date
    return results.sort((a, b) => {
      const severityWeight = (issues: EventIssue["issues"]) => issues.filter(i => i.severity === "red").length * 10 + issues.filter(i => i.severity === "amber").length * 5 + issues.length;
      return severityWeight(b.issues) - severityWeight(a.issues);
    });
  }, [events, orders, orderLines, purchases, inventory, suppliers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Upcoming with fulfillment using dedup
  const { groupedIds } = deduplicateEvents(events);
  const upcomingWithFulfillment = upcomingEvents
    .map(ev => {
      const allIds = groupedIds[ev.id] || [ev.id];
      const eventOrders = orders.filter(o => allIds.includes(o.event_id));
      const unfulfilled = eventOrders.filter(o => o.delivery_status !== "delivered");
      const daysUntil = Math.ceil((new Date(ev.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { ...ev, eventOrders, unfulfilled, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Welcome header with typewriter + next game inline */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-4 md:p-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 mb-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight min-h-[1.75rem] md:min-h-[2.25rem]">
              {typedGreeting}
              <span className="inline-block w-0.5 h-5 md:h-7 bg-primary ml-1 animate-pulse align-middle" />
            </h1>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
              </span>
              <span className="text-xs text-success font-semibold tracking-wide">LIVE</span>
            </span>
            {nextEvent && (
              <span className="text-sm md:text-lg font-bold text-foreground">
                <span className="hidden md:inline">| </span>
                <span className="text-xs md:text-sm font-semibold">Upcoming:</span>{" "}
                <span className="text-xs md:text-sm">{nextEvent.home_team} vs {nextEvent.away_team}</span>{" "}
                <span className="font-mono text-xs md:text-sm text-primary font-black">{countdown}</span>
              </span>
            )}
          </div>
        </div>
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-base font-bold text-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="font-mono text-sm font-bold text-foreground">{format(new Date(), "HH:mm")}</span>
        </p>
      </div>

      {/* Goal celebration animation */}
      <div className="rounded-xl border bg-gradient-to-r from-success/5 via-primary/5 to-success/5 p-6 text-center animate-fade-in overflow-hidden relative" style={{ animationDelay: "0.05s" }}>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl animate-bounce" style={{ animationDuration: "1.5s" }}>⚽</span>
          <div>
            <p className="text-xl font-black tracking-tight text-foreground">GOOOAAL!</p>
            <p className="text-xs text-muted-foreground font-mono">Welcome back — let's smash it today 🎉</p>
          </div>
          <span className="text-4xl animate-bounce" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }}>🥅</span>
        </div>
      </div>

      {/* Smart Summary — Next Game + KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>

        {/* Open Orders */}
        <div className={`rounded-xl border p-4 ${openOrders > 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Open Orders</span>
            <ShoppingCart className={`h-4 w-4 ${openOrders > 0 ? "text-warning" : "text-success"}`} />
          </div>
          <p className={`font-mono text-2xl font-bold ${openOrders > 0 ? "text-warning" : "text-success"}`}>{openOrders}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{awaitingDelivery.length} awaiting delivery</p>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border bg-primary/5 border-primary/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Notifications</span>
            <Bell className="h-4 w-4 text-primary" />
          </div>
          {notifications.length > 0 ? (
            <div className="space-y-1.5">
              {notifications.map((n, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{n.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">{n.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No new notifications</p>
          )}
        </div>

        {/* Urgent Actions */}
        <div className={`rounded-xl border p-4 ${urgentActions.length > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Urgent Actions</span>
            {urgentActions.length > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Zap className="h-4 w-4 text-success" />}
          </div>
          {urgentActions.length > 0 ? (
            <div className="space-y-1">
              {urgentActions.map((a, i) => (
                <button key={i} onClick={() => navigate(a.path)} className={`text-xs font-semibold ${a.color} hover:underline block`}>
                  {a.count} {a.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="font-mono text-2xl font-bold text-success">✓</p>
          )}
          {urgentActions.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">All clear</p>}
        </div>
      </div>

      {/* Ops Checklist — What Needs Doing */}
      {opsChecklist.length > 0 && (
        <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10">
                <ClipboardList className="h-4 w-4 text-destructive" />
              </div>
              <span className="font-semibold text-sm">Ops Checklist</span>
              <Badge variant="outline" className="text-[9px] font-bold bg-destructive/10 text-destructive border-destructive/20">
                {opsChecklist.reduce((s, e) => s + e.issues.length, 0)} issues
              </Badge>
            </div>
          </div>
          <CardContent className="pt-2 space-y-2">
            {opsChecklist.map(({ event: ev, issues }) => {
              const eventDate = new Date(ev.event_date);
              const isPast = eventDate < new Date();
              const redCount = issues.filter(i => i.severity === "red").length;
              const amberCount = issues.filter(i => i.severity === "amber").length;

              return (
                <div key={ev.id} className="rounded-xl border overflow-hidden">
                  {/* Event gradient header */}
                  <div className={cn(
                    "px-4 py-3 bg-gradient-to-r",
                    redCount > 0
                      ? "from-destructive/20 to-destructive/5 border-l-4 border-l-destructive"
                      : amberCount > 0
                        ? "from-warning/20 to-warning/5 border-l-4 border-l-warning"
                        : "from-primary/20 to-primary/5 border-l-4 border-l-primary"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">{ev.home_team} vs {ev.away_team}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {format(eventDate, "EEE dd MMM, HH:mm")}
                          {isPast && <span className="text-destructive ml-1 font-bold">• PAST</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {redCount > 0 && (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold">{redCount}</span>
                        )}
                        {amberCount > 0 && (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-warning/20 text-warning text-[10px] font-bold">{amberCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Issues list */}
                  <div className="px-4 py-2 space-y-1.5">
                    {issues.map((issue, i) => (
                      <button
                        key={i}
                        onClick={() => navigate(issue.path)}
                        className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/50 transition-colors group"
                      >
                        <span className={cn(
                          "flex items-center justify-center h-5 w-5 rounded shrink-0",
                          issue.severity === "red" ? "bg-destructive/10" :
                          issue.severity === "amber" ? "bg-warning/10" : "bg-primary/10"
                        )}>
                          {issue.icon === "link" && <Link2Off className={cn("h-3 w-3", issue.severity === "red" ? "text-destructive" : issue.severity === "amber" ? "text-warning" : "text-primary")} />}
                          {issue.icon === "truck" && <Truck className={cn("h-3 w-3", issue.severity === "red" ? "text-destructive" : issue.severity === "amber" ? "text-warning" : "text-primary")} />}
                          {issue.icon === "dollar" && <DollarSign className={cn("h-3 w-3", issue.severity === "red" ? "text-destructive" : issue.severity === "amber" ? "text-warning" : "text-primary")} />}
                          {issue.icon === "clipboard" && <ClipboardList className={cn("h-3 w-3", issue.severity === "red" ? "text-destructive" : issue.severity === "amber" ? "text-warning" : "text-primary")} />}
                        </span>
                        <span className="text-xs font-medium flex-1">{issue.label}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Live Activity Feed + Delivery Queue side by side */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {/* Live Activity Feed */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">Live Activity</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/activity")} className="text-xs gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <CardContent className="pt-2">
            {auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                      log.action === "INSERT" ? "bg-success" : log.action === "UPDATE" ? "bg-primary" : "bg-destructive"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatAuditAction(log.action, log.table_name)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {profiles[log.user_id || ""] || "System"} · {format(new Date(log.created_at), "HH:mm")}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${
                      log.action === "INSERT" ? "bg-success/10 text-success border-success/20" :
                      log.action === "UPDATE" ? "bg-primary/10 text-primary border-primary/20" :
                      "bg-destructive/10 text-destructive border-destructive/20"
                    }`}>
                      {log.action}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Queue */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning/10">
                <Package className="h-4 w-4 text-warning" />
              </div>
              <span className="font-semibold text-sm">Delivery Queue</span>
            </div>
            {awaitingDelivery.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                <CircleDot className="h-3 w-3" /> Action Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                Clear
              </span>
            )}
          </div>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="font-mono text-2xl font-bold">{awaitingDelivery.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Orders</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="font-mono text-2xl font-bold">{awaitingDelivery.reduce((s, o) => s + o.quantity, 0)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Tickets</p>
              </div>
            </div>
            {awaitingDelivery.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center font-mono">ALL DELIVERIES COMPLETE</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Fixtures */}
      <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Next 7 Days — Fixtures & Fulfillment</span>
            <span className="font-mono text-[10px] text-muted-foreground ml-1">({upcomingWithFulfillment.length} events)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/events")} className="text-xs gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <CardContent className="p-0">
          {upcomingWithFulfillment.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground font-mono">NO FIXTURES IN NEXT 7 DAYS</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingWithFulfillment.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/events/${ev.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-center min-w-[48px] font-mono text-sm font-bold ${
                      ev.daysUntil <= 1 ? "text-destructive" : ev.daysUntil <= 3 ? "text-warning" : "text-muted-foreground"
                    }`}>
                      {ev.daysUntil <= 0 ? "TODAY" : `${ev.daysUntil}d`}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{ev.home_team} vs {ev.away_team}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "EEE dd MMM, HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold">{ev.eventOrders.length} orders</span>
                    {ev.unfulfilled.length > 0 ? (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                        <AlertTriangle className="h-3 w-3 mr-1" />{ev.unfulfilled.length} pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                        ✓ clear
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
