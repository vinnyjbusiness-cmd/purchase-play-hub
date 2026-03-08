import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInSeconds, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { deduplicateEvents } from "@/lib/eventDedup";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import Lottie from "lottie-react";
import {
  BarChart3, ShoppingCart, CalendarDays, CheckSquare,
  Plus, FileText, TrendingUp, CalendarPlus, Package,
  ChevronDown, ArrowRight, Zap, Link2Off, Truck,
  ClipboardList, Activity, ShoppingBag, Users, Eye,
  Clock,
} from "lucide-react";

/* ── colour tokens (dark override) ── */
const C = {
  bg: "#0a0a0f",
  card: "#111318",
  border: "#1e2028",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  text: "#ffffff",
  muted: "#6b7280",
} as const;

/* ── types ── */
interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; venue?: string | null; competition?: string; }
interface OrderInfo { id: string; status: string; delivery_status: string | null; event_id: string; quantity: number; platform_id: string | null; }
interface PlatformInfo { id: string; name: string; }
interface AuditEntry { id: string; table_name: string; action: string; created_at: string; new_values: any; old_values: any; }
interface OrderLineInfo { order_id: string; inventory_id: string; }
interface InventoryInfo { id: string; event_id: string; status: string; purchase_id: string | null; }
interface ListingInfo { id: string; event_id: string; platform: string; quantity: number; status: string; }
interface TodoInfo { id: string; status: string; due_date: string | null; title: string; }

/* ── count-up hook ── */
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current && target === 0) return;
    started.current = true;
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setVal(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ── live clock hook ── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ── lottie widget ── */
function LottieWidget() {
  const [animData, setAnimData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("https://assets10.lottiefiles.com/packages/lf20_ksgyxaxy.json");
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) setAnimData(d);
      } catch {
        try {
          const r2 = await fetch("https://assets9.lottiefiles.com/packages/lf20_qforpkhe.json");
          if (!r2.ok) throw new Error();
          const d2 = await r2.json();
          if (!cancelled) setAnimData(d2);
        } catch {
          if (!cancelled) setFailed(true);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(hovered ? 2 : 1);
    }
  }, [hovered]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl flex items-center justify-center"
      style={{
        width: 120, height: 120,
        background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: `0 0 20px ${C.emerald}22, 0 0 40px ${C.emerald}11`,
      }}
    >
      {animData ? (
        <Lottie lottieRef={lottieRef} animationData={animData} loop style={{ width: 100, height: 100 }} />
      ) : failed ? (
        <span className="text-4xl animate-bounce" style={{ animationDuration: "2s" }}>⚽</span>
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: C.emerald, borderTopColor: "transparent" }} />
      )}
    </div>
  );
}

/* ── card wrapper ── */
function DCard({ children, className = "", onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── main component ── */
export default function Dashboard() {
  const navigate = useNavigate();
  const now = useClock();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("there");
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLineInfo[]>([]);
  const [inventory, setInventory] = useState<InventoryInfo[]>([]);
  const [listings, setListings] = useState<ListingInfo[]>([]);
  const [todos, setTodos] = useState<TodoInfo[]>([]);
  const [activityFilter, setActivityFilter] = useState("All");
  const [opsOpen, setOpsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const [profileRes, eventsRes, ordersRes, platformsRes, auditRes, olRes, invRes, listRes, todoRes] = await Promise.all([
        supabase.from("profiles").select("display_name").limit(1).single(),
        supabase.from("events").select("id,match_code,home_team,away_team,event_date,venue,competition").order("event_date"),
        supabase.from("orders").select("id,status,delivery_status,event_id,quantity,platform_id"),
        supabase.from("platforms").select("id,name"),
        supabase.from("audit_log").select("id,table_name,action,created_at,new_values,old_values").order("created_at", { ascending: false }).limit(50),
        supabase.from("order_lines").select("order_id,inventory_id"),
        supabase.from("inventory").select("id,event_id,status,purchase_id"),
        supabase.from("listings").select("id,event_id,platform,quantity,status"),
        supabase.from("todos").select("id,status,due_date,title"),
      ]);

      if (profileRes.data?.display_name) {
        const first = profileRes.data.display_name.split(" ")[0];
        setDisplayName(first);
      }
      setEvents(eventsRes.data || []);
      setOrders((ordersRes.data as any) || []);
      setPlatforms(platformsRes.data || []);
      setOrderLines((olRes.data as any) || []);
      setInventory((invRes.data as any) || []);
      setListings((listRes.data as any) || []);
      setTodos((todoRes.data as any) || []);

      // Filter audit logs - remove navigation, PAGE_VIEW, LOGIN, LOGOUT
      const filtered = (auditRes.data || []).filter((l: any) =>
        l.table_name !== "navigation" &&
        l.action !== "PAGE_VIEW" &&
        l.action !== "LOGIN" &&
        l.action !== "LOGOUT"
      );
      setAuditLogs(filtered);
      setLoading(false);
    }
    load();
  }, []);

  /* ── derived data ── */
  const { unique: allDedupedEvents, groupedIds } = useMemo(() => deduplicateEvents(events), [events]);
  // Exclude World Cup events from the dashboard — they have their own page
  const dedupedEvents = useMemo(() => allDedupedEvents.filter(e => e.competition !== "World Cup 2026"), [allDedupedEvents]);
  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p.name])), [platforms]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const nextEvent = useMemo(() => {
    return dedupedEvents.find(e => new Date(e.event_date) > new Date()) || null;
  }, [dedupedEvents]);

  const countdown = useMemo(() => {
    if (!nextEvent) return "";
    const diff = differenceInSeconds(new Date(nextEvent.event_date), now);
    if (diff <= 0) return "NOW";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return { d, h, m, s, text: `${d}d ${h}h ${m}m ${s}s` };
  }, [nextEvent, now]);

  const isEventToday = useMemo(() => {
    if (!nextEvent) return false;
    const ed = new Date(nextEvent.event_date);
    return ed.toDateString() === now.toDateString();
  }, [nextEvent, now]);

  // KPI data
  const activeListings = useMemo(() => {
    const active = listings.filter(l => l.status === "published" || l.status === "active");
    const totalQty = active.reduce((s, l) => s + l.quantity, 0);
    const platformCount = new Set(active.map(l => l.platform)).size;
    return { totalQty, platformCount };
  }, [listings]);

  const orderStats = useMemo(() => {
    const pending = orders.filter(o => o.status === "pending" || o.status === "fulfilled");
    const awaitingDelivery = pending.filter(o => o.delivery_status !== "delivered");
    return { count: pending.length, awaiting: awaitingDelivery.length };
  }, [orders]);

  const upcomingEventCount = useMemo(() => {
    const thirtyDays = new Date(Date.now() + 30 * 86400000);
    return dedupedEvents.filter(e => {
      const d = new Date(e.event_date);
      return d > new Date() && d <= thirtyDays;
    }).length;
  }, [dedupedEvents]);

  const todoStats = useMemo(() => {
    const open = todos.filter(t => t.status !== "done");
    const overdue = open.filter(t => t.due_date && new Date(t.due_date) < new Date());
    return { count: open.length, overdue: overdue.length };
  }, [todos]);

  // Next event details
  const nextEventDetails = useMemo(() => {
    if (!nextEvent) return null;
    const allIds = groupedIds[nextEvent.id] || [nextEvent.id];
    const evInventory = inventory.filter(i => allIds.includes(i.event_id));
    const totalTickets = evInventory.length;
    const soldTickets = evInventory.filter(i => i.status === "sold" || i.status === "reserved").length;
    const evListings = listings.filter(l => allIds.includes(l.event_id) && (l.status === "published" || l.status === "active"));
    const platformNames = [...new Set(evListings.map(l => l.platform))];
    return { totalTickets, soldTickets, platformNames };
  }, [nextEvent, groupedIds, inventory, listings]);

  // Upcoming events list (next 6)
  const upcomingEventsList = useMemo(() => {
    return dedupedEvents
      .filter(e => new Date(e.event_date) > new Date())
      .slice(0, 6)
      .map(ev => {
        const allIds = groupedIds[ev.id] || [ev.id];
        const evInv = inventory.filter(i => allIds.includes(i.event_id));
        const total = evInv.length;
        const sold = evInv.filter(i => i.status === "sold" || i.status === "reserved").length;
        const daysUntil = differenceInDays(new Date(ev.event_date), new Date());
        return { ...ev, total, sold, daysUntil };
      });
  }, [dedupedEvents, groupedIds, inventory]);

  // Activity feed
  const filteredActivity = useMemo(() => {
    let logs = auditLogs;
    if (activityFilter === "Sales") logs = logs.filter(l => l.table_name === "orders" && l.action === "INSERT");
    else if (activityFilter === "Orders") logs = logs.filter(l => l.table_name === "orders");
    else if (activityFilter === "Inventory") logs = logs.filter(l => l.table_name === "inventory");
    else if (activityFilter === "Team") logs = logs.filter(l => l.table_name === "team_members" || l.table_name === "team_invites");
    return logs.slice(0, 8);
  }, [auditLogs, activityFilter]);

  const formatActivityItem = useCallback((log: AuditEntry) => {
    const nv = log.new_values || {};
    if (log.table_name === "orders" && log.action === "INSERT") {
      const qty = nv.quantity || "";
      const eventId = nv.event_id;
      const ev = eventId ? eventMap[eventId] : null;
      const matchName = ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown match";
      const platId = nv.platform_id;
      const platName = platId ? platformMap[platId] || "platform" : "";
      return `${qty}x ${matchName}${platName ? ` sold on ${platName}` : " order created"}`;
    }
    if (log.table_name === "inventory" && log.action === "INSERT") {
      const eventId = nv.event_id;
      const ev = eventId ? eventMap[eventId] : null;
      const matchName = ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown match";
      return `${matchName} inventory added`;
    }
    if (log.table_name === "orders" && log.action === "UPDATE") {
      const eventId = nv.event_id;
      const ev = eventId ? eventMap[eventId] : null;
      const matchName = ev ? `${ev.home_team} vs ${ev.away_team}` : "Order";
      return `${matchName} order updated`;
    }
    const entity = log.table_name === "orders" ? "Order" : log.table_name === "inventory" ? "Inventory" :
      log.table_name === "purchases" ? "Purchase" : log.table_name === "todos" ? "Task" :
      log.table_name === "team_members" ? "Team member" : log.table_name;
    const verb = log.action === "INSERT" ? "added" : log.action === "UPDATE" ? "updated" : "removed";
    return `${entity} ${verb}`;
  }, [eventMap, platformMap]);

  const getActivityIcon = (log: AuditEntry) => {
    if (log.table_name === "orders") return ShoppingBag;
    if (log.table_name === "inventory") return Package;
    if (log.table_name === "team_members" || log.table_name === "team_invites") return Users;
    return Activity;
  };

  const relativeTime = useCallback((dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }, []);

  // Ops checklist
  const opsIssues = useMemo(() => {
    const nowDate = new Date();
    const urgent: { event: string; date: string; desc: string; action: string; path: string }[] = [];
    const today: typeof urgent = [];
    const upcoming: typeof urgent = [];

    const orderLinesByOrder = new Map<string, string[]>();
    orderLines.forEach(ol => {
      if (!orderLinesByOrder.has(ol.order_id)) orderLinesByOrder.set(ol.order_id, []);
      orderLinesByOrder.get(ol.order_id)!.push(ol.inventory_id);
    });

    for (const ev of dedupedEvents) {
      const allIds = groupedIds[ev.id] || [ev.id];
      const evDate = new Date(ev.event_date);
      const matchName = `${ev.home_team} vs ${ev.away_team}`;
      const dateStr = format(evDate, "dd MMM");
      const isPast = evDate < nowDate;
      const isToday = evDate.toDateString() === nowDate.toDateString();
      const isTomorrow = differenceInDays(evDate, nowDate) <= 1 && !isPast && !isToday;

      const evOrders = orders.filter(o => allIds.includes(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");

      // Unlinked orders
      const unlinked = evOrders.filter(o => {
        const linked = orderLinesByOrder.get(o.id) || [];
        return linked.length < o.quantity;
      });
      if (unlinked.length > 0) {
        const item = { event: matchName, date: dateStr, desc: `${unlinked.length} order${unlinked.length > 1 ? "s" : ""} not linked to inventory`, action: "Link Inventory", path: "/orders" };
        if (isPast) urgent.push(item);
        else if (isToday || isTomorrow) today.push(item);
        else upcoming.push(item);
      }

      // Undelivered orders
      const undelivered = evOrders.filter(o => o.delivery_status !== "delivered" && (o.status === "pending" || o.status === "fulfilled" || o.status === "outstanding" || o.status === "partially_delivered"));
      if (undelivered.length > 0) {
        const item = { event: matchName, date: dateStr, desc: `${undelivered.length} order${undelivered.length > 1 ? "s" : ""} not delivered`, action: "Mark Delivered", path: "/orders" };
        if (isPast) urgent.push(item);
        else if (isToday || isTomorrow) today.push(item);
        else upcoming.push(item);
      }

      // Unlisted inventory
      const evInv = inventory.filter(i => allIds.includes(i.event_id) && i.status === "available");
      const evListings = listings.filter(l => allIds.includes(l.event_id));
      if (evInv.length > 0 && evListings.length === 0 && !isPast) {
        const item = { event: matchName, date: dateStr, desc: `${evInv.length} ticket${evInv.length > 1 ? "s" : ""} not listed on any platform`, action: "View Event", path: "/analytics?tab=events" };
        if (isToday || isTomorrow) today.push(item);
        else upcoming.push(item);
      }
    }
    return { urgent, today, upcoming, total: urgent.length + today.length + upcoming.length };
  }, [dedupedEvents, groupedIds, orders, orderLines, inventory, listings]);

  // Count-up values
  const animListings = useCountUp(loading ? 0 : activeListings.totalQty);
  const animOrders = useCountUp(loading ? 0 : orderStats.count);
  const animEvents = useCountUp(loading ? 0 : upcomingEventCount);
  const animTodos = useCountUp(loading ? 0 : todoStats.count);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: C.bg }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4" style={{ borderColor: C.emerald, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const pendingOrderCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="min-h-screen font-sans" style={{ background: C.bg, color: C.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* ══ HEADER ══ */}
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {greeting}, Vinny
          </h1>
          <p className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: C.muted, fontFamily: "Inter, system-ui, sans-serif" }}>
            {format(now, "EEEE, d MMMM yyyy")} · {format(now, "HH:mm")}
          </p>
          {nextEvent && (
            <p className="text-lg font-medium" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
              <span style={{ color: C.muted }}>{nextEvent.home_team} vs {nextEvent.away_team} · </span>
              {typeof countdown === "object" ? (
                <span style={{ color: C.emerald, fontWeight: 700 }}>
                  {countdown.d}d {countdown.h}h {countdown.m}m
                </span>
              ) : (
                <span style={{ color: C.emerald, fontWeight: 700 }}>{countdown}</span>
              )}
            </p>
          )}
        </div>

        {/* ══ ROW 1 — KPI Cards ══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Active Listings",
              value: animListings,
              icon: BarChart3,
              sub: `${activeListings.platformCount} platform${activeListings.platformCount !== 1 ? "s" : ""} active`,
              subColor: C.muted,
            },
            {
              label: "Orders",
              value: animOrders,
              icon: ShoppingCart,
              sub: orderStats.awaiting > 0 ? `${orderStats.awaiting} awaiting delivery` : "All clear",
              subColor: orderStats.awaiting > 0 ? C.amber : C.emerald,
            },
            {
              label: "Upcoming Events",
              value: animEvents,
              icon: CalendarDays,
              sub: nextEvent ? `Next: ${nextEvent.home_team} vs ${nextEvent.away_team}` : "No upcoming",
              subColor: C.muted,
            },
            {
              label: "Open Tasks",
              value: animTodos,
              icon: CheckSquare,
              sub: todoStats.overdue > 0 ? `${todoStats.overdue} overdue` : "All clear",
              subColor: todoStats.overdue > 0 ? C.red : C.emerald,
            },
          ].map((kpi) => (
            <DCard key={kpi.label} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{kpi.label}</span>
                <kpi.icon size={16} style={{ color: C.muted }} />
              </div>
              <p className="text-3xl font-bold">{kpi.value}</p>
              <p className="text-xs mt-1 truncate" style={{ color: kpi.subColor }}>{kpi.sub}</p>
            </DCard>
          ))}
        </div>

        {/* ══ ROW 2 — Next Event + Quick Actions ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Next Event Card (3/5) */}
          <DCard className="lg:col-span-3 p-5">
            {nextEvent ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{nextEvent.home_team} vs {nextEvent.away_team}</h2>
                  <p className="text-sm mt-1" style={{ color: C.muted }}>
                    {nextEvent.venue || "Venue TBC"} · {format(new Date(nextEvent.event_date), "EEEE, d MMMM yyyy · HH:mm")}
                  </p>
                </div>
                {typeof countdown === "object" && (
                  <div className="flex items-baseline gap-1">
                    {[
                      { v: countdown.d, l: "d" },
                      { v: countdown.h, l: "h" },
                      { v: countdown.m, l: "m" },
                      { v: countdown.s, l: "s" },
                    ].map(({ v, l }) => (
                      <span key={l}>
                        <span className="text-2xl font-bold" style={{ color: C.emerald }}>{v}</span>
                        <span className="text-sm" style={{ color: C.muted }}>{l} </span>
                      </span>
                    ))}
                  </div>
                )}
                {nextEventDetails && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: C.muted }}>Sell-through</span>
                        <span style={{ color: C.text }}>{nextEventDetails.soldTickets} of {nextEventDetails.totalTickets} tickets</span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ background: C.border }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${nextEventDetails.totalTickets > 0 ? (nextEventDetails.soldTickets / nextEventDetails.totalTickets) * 100 : 0}%`,
                            background: C.emerald,
                          }}
                        />
                      </div>
                    </div>
                    {nextEventDetails.platformNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {nextEventDetails.platformNames.map(p => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${C.emerald}15`, color: C.emerald, border: `1px solid ${C.emerald}30` }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={() => navigate("/analytics?tab=events")}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ background: `${C.emerald}15`, color: C.emerald }}
                >
                  View Event <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32" style={{ color: C.muted }}>
                <p className="text-sm">No upcoming events</p>
              </div>
            )}
          </DCard>

          {/* Quick Actions (2/5) */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-2">
            {[
              { label: "Add Inventory", icon: Plus, bg: C.emerald, path: "/stock?tab=inventory" },
              { label: "Add Purchase", icon: Package, bg: "#3b82f6", path: "/stock?tab=purchases" },
              { label: "Create Invoice", icon: FileText, bg: C.card, path: "/invoices" },
              { label: "View Analytics", icon: TrendingUp, bg: C.card, path: "/analytics" },
              { label: "Add Event", icon: CalendarPlus, bg: C.card, path: "/analytics?tab=events" },
              { label: "Check Orders", icon: ShoppingCart, bg: C.card, path: "/orders", badge: pendingOrderCount > 0 ? pendingOrderCount : undefined },
            ].map(qa => (
              <button
                key={qa.label}
                onClick={() => navigate(qa.path)}
                className="rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 relative"
                style={{
                  background: qa.bg === C.card ? C.card : `${qa.bg}20`,
                  border: `1px solid ${qa.bg === C.card ? C.border : qa.bg}30`,
                  color: qa.bg === C.card ? C.text : qa.bg,
                }}
              >
                <qa.icon size={18} />
                {qa.label}
                {qa.badge && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: C.amber }}>
                    {qa.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ══ ROW 3 — Activity Feed + Upcoming Events ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Activity Feed */}
          <DCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity size={16} style={{ color: C.emerald }} />
                <span className="text-sm font-bold">Recent Activity</span>
              </div>
              <button onClick={() => navigate("/activity")} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.emerald }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {["All", "Sales", "Orders", "Inventory", "Team"].map(f => (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className="text-[10px] px-2 py-1 rounded-full font-semibold transition-colors"
                  style={{
                    background: activityFilter === f ? `${C.emerald}20` : "transparent",
                    color: activityFilter === f ? C.emerald : C.muted,
                    border: `1px solid ${activityFilter === f ? `${C.emerald}40` : C.border}`,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {filteredActivity.length > 0 ? filteredActivity.map(log => {
                const Icon = getActivityIcon(log);
                return (
                  <div key={log.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: `${C.border}50` }}>
                    <Icon size={14} style={{ color: C.muted }} className="shrink-0" />
                    <span className="text-xs flex-1 truncate">{formatActivityItem(log)}</span>
                    <span className="text-[10px] shrink-0" style={{ color: C.muted }}>{relativeTime(log.created_at)}</span>
                  </div>
                );
              }) : (
                <p className="text-xs text-center py-6" style={{ color: C.muted }}>No recent activity</p>
              )}
            </div>
          </DCard>

          {/* Upcoming Events */}
          <DCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} style={{ color: C.emerald }} />
                <span className="text-sm font-bold">Upcoming Events</span>
              </div>
            </div>
            <div className="space-y-2">
              {upcomingEventsList.length > 0 ? upcomingEventsList.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: `${C.border}50` }}
                  onClick={() => navigate("/analytics?tab=events")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ev.home_team} vs {ev.away_team}</p>
                    <p className="text-[10px]" style={{ color: C.muted }}>
                      {format(new Date(ev.event_date), "EEE d MMM · HH:mm")} {ev.venue ? `· ${ev.venue}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: C.border }}>
                        <div className="h-full rounded-full" style={{ width: `${ev.total > 0 ? (ev.sold / ev.total) * 100 : 0}%`, background: C.emerald }} />
                      </div>
                      <span className="text-[10px]" style={{ color: C.muted }}>{ev.sold} / {ev.total}</span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: ev.daysUntil < 3 ? `${C.red}20` : ev.daysUntil < 7 ? `${C.amber}20` : `${C.emerald}20`,
                      color: ev.daysUntil < 3 ? C.red : ev.daysUntil < 7 ? C.amber : C.emerald,
                    }}
                  >
                    {ev.daysUntil <= 0 ? "TODAY" : `${ev.daysUntil}d`}
                  </span>
                </div>
              )) : (
                <p className="text-xs text-center py-6" style={{ color: C.muted }}>No upcoming events</p>
              )}
            </div>
          </DCard>
        </div>

        {/* ══ ROW 4 — Ops Checklist ══ */}
        <Collapsible open={opsOpen} onOpenChange={setOpsOpen}>
          <DCard>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Zap size={16} style={{ color: C.emerald }} />
                  <span className="text-sm font-bold">Ops Checklist</span>
                  <span className="text-sm" style={{ color: C.muted }}>— {opsIssues.total} issue{opsIssues.total !== 1 ? "s" : ""}</span>
                  {opsIssues.urgent.length > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.red}20`, color: C.red }}>{opsIssues.urgent.length} urgent</span>
                  ) : opsIssues.today.length > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.amber}20`, color: C.amber }}>{opsIssues.today.length} today</span>
                  ) : null}
                </div>
                <ChevronDown size={16} style={{ color: C.muted, transform: opsOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {opsIssues.urgent.length > 0 && (
                  <OpsSection title="URGENT" color={C.red} items={opsIssues.urgent} navigate={navigate} />
                )}
                {opsIssues.today.length > 0 && (
                  <OpsSection title="TODAY" color={C.amber} items={opsIssues.today} navigate={navigate} />
                )}
                {opsIssues.upcoming.length > 0 && (
                  <OpsSection title="UPCOMING" color={C.muted} items={opsIssues.upcoming} navigate={navigate} />
                )}
                {opsIssues.total === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: C.muted }}>All clear — no operational issues</p>
                )}
              </div>
            </CollapsibleContent>
          </DCard>
        </Collapsible>
      </div>
    </div>
  );
}

/* ── Ops section sub-component ── */
function OpsSection({ title, color, items, navigate }: {
  title: string;
  color: string;
  items: { event: string; date: string; desc: string; action: string; path: string }[];
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(title === "URGENT");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 py-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-xs font-bold" style={{ color }}>{title}</span>
          <span className="text-[10px]" style={{ color: C.muted }}>({items.length})</span>
          <ChevronDown size={12} style={{ color: C.muted, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms", marginLeft: "auto" }} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: `${C.border}50` }}>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">{item.event}</span>
                <span className="text-[10px] ml-1.5" style={{ color: C.muted }}>{item.date}</span>
                <p className="text-[10px]" style={{ color: C.muted }}>{item.desc}</p>
              </div>
              <button
                onClick={() => navigate(item.path)}
                className="text-[10px] font-semibold px-2 py-1 rounded-md shrink-0 transition-colors"
                style={{ background: `${color}15`, color }}
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
