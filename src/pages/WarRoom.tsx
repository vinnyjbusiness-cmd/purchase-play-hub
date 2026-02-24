import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  X, Clock, Ticket, CheckCircle2, AlertTriangle, Package,
  Send, Phone, MapPin, CalendarClock, Eye,
} from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { cn } from "@/lib/utils";
import { deduplicateEvents } from "@/lib/eventDedup";
import OrderDetailSheet from "@/components/OrderDetailSheet";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}
interface OrderRow {
  id: string; event_id: string; status: string; delivery_status: string | null;
  quantity: number; order_ref: string | null; buyer_ref: string | null;
  notes: string | null; category: string;
}
interface InventoryRow {
  id: string; event_id: string; status: string;
}
interface TodoRow {
  id: string; title: string; priority: string; status: string;
}

export default function WarRoom() {
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryRow[]>([]);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [eventsRes, ordersRes, invRes, todosRes] = await Promise.all([
      supabase.from("events").select("id,home_team,away_team,event_date,venue,city,competition,match_code").order("event_date"),
      supabase.from("orders").select("id,event_id,status,delivery_status,quantity,order_ref,buyer_ref,notes,category"),
      supabase.from("inventory").select("id,event_id,status"),
      supabase.from("todos").select("id,title,priority,status").eq("status", "pending").order("sort_order").limit(10),
    ]);

    setAllEvents(eventsRes.data || []);
    setAllOrders(ordersRes.data || []);
    setAllInventory(invRes.data || []);
    setTodos(todosRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Deduplicated upcoming events
  const { unique: dedupedEvents, groupedIds } = useMemo(() => {
    const now = new Date();
    const future = allEvents.filter(e => new Date(e.event_date) > now);
    return deduplicateEvents(future);
  }, [allEvents]);

  // Auto-select first upcoming event if none selected
  useEffect(() => {
    if (!selectedEventId && dedupedEvents.length > 0) {
      setSelectedEventId(dedupedEvents[0].id);
    }
  }, [dedupedEvents, selectedEventId]);

  const event = useMemo(() => dedupedEvents.find(e => e.id === selectedEventId) || null, [dedupedEvents, selectedEventId]);

  // Get all event IDs for the selected canonical event (handles duplicates)
  const eventIds = useMemo(() => {
    if (!selectedEventId) return new Set<string>();
    return new Set(groupedIds[selectedEventId] || [selectedEventId]);
  }, [selectedEventId, groupedIds]);

  const orders = useMemo(() => allOrders.filter(o => eventIds.has(o.event_id)), [allOrders, eventIds]);
  const inventory = useMemo(() => allInventory.filter(i => eventIds.has(i.event_id)), [allInventory, eventIds]);

  // Countdown timer
  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const diff = differenceInSeconds(new Date(event.event_date), new Date());
      if (diff <= 0) { setCountdown("NOW"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const totalOrders = orders.length;
  const totalTickets = orders.reduce((s, o) => s + o.quantity, 0);
  const fulfilled = orders.filter(o => o.status === "fulfilled" || o.status === "delivered").length;
  const pending = orders.filter(o => o.status === "pending").length;
  const delivered = orders.filter(o => o.delivery_status === "delivered").length;
  const awaitingDelivery = orders.filter(o => o.delivery_status !== "delivered" && o.status !== "cancelled" && o.status !== "refunded");
  const invAvailable = inventory.filter(i => i.status === "available").length;
  const invSold = inventory.filter(i => i.status === "sold").length;
  const invTotal = inventory.length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (dedupedEvents.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <CalendarClock className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">No Upcoming Events</h2>
          <p className="text-muted-foreground">There are no future events to focus on.</p>
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const daysUntil = event ? Math.ceil(differenceInSeconds(new Date(event.event_date), new Date()) / 86400) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-destructive">War Room</span>
            </div>
            {/* Event Picker */}
            <Select value={selectedEventId || ""} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[320px] h-8 text-xs">
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                {dedupedEvents.map(ev => (
                  <SelectItem key={ev.id} value={ev.id} className="text-xs">
                    {ev.home_team} vs {ev.away_team} — {format(new Date(ev.event_date), "dd MMM")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {event && (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* Event Hero */}
          <div className="text-center space-y-3 animate-fade-in">
            <Badge variant="outline" className="text-xs">{event.competition}</Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              {event.home_team} vs {event.away_team}
            </h1>
            <div className="flex items-center justify-center gap-4 text-muted-foreground text-sm">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                {format(new Date(event.event_date), "EEEE, dd MMMM yyyy · HH:mm")}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {event.venue}{event.city ? `, ${event.city}` : ""}
                </span>
              )}
            </div>

            {/* Countdown */}
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Countdown to Kick-Off</p>
              <p className={cn(
                "text-5xl md:text-6xl font-mono font-black tracking-wide",
                daysUntil <= 1 ? "text-destructive" : daysUntil <= 3 ? "text-warning" : "text-primary"
              )}>
                {countdown}
              </p>
            </div>
          </div>

          <Separator />

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Orders", value: totalOrders, sub: `${totalTickets} tickets`, icon: Ticket, color: "text-primary" },
              { label: "Fulfilled", value: fulfilled, sub: `of ${totalOrders}`, icon: CheckCircle2, color: "text-success" },
              { label: "Pending", value: pending, sub: "awaiting action", icon: AlertTriangle, color: pending > 0 ? "text-warning" : "text-success" },
              { label: "Delivered", value: delivered, sub: `of ${totalOrders}`, icon: Send, color: "text-primary" },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl border bg-card p-4 text-center">
                <kpi.icon className={cn("h-5 w-5 mx-auto mb-2", kpi.color)} />
                <p className="text-3xl font-mono font-bold">{kpi.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{kpi.label}</p>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Inventory Status */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" /> Inventory Status
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-mono font-bold">{invTotal}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Stock</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-mono font-bold text-success">{invSold}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sold</p>
              </div>
              <div className="text-center">
                <p className={cn("text-2xl font-mono font-bold", invAvailable > 0 ? "text-warning" : "text-success")}>{invAvailable}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</p>
              </div>
            </div>
            {invTotal > 0 && (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all" style={{ width: `${(invSold / invTotal) * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round((invSold / invTotal) * 100)}% sold</p>
              </div>
            )}
          </div>

          {/* Awaiting Delivery */}
          {awaitingDelivery.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" /> Awaiting Delivery ({awaitingDelivery.length})
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {awaitingDelivery.map(o => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedOrderId(o.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{o.order_ref || o.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{o.category} · {o.quantity} ticket{o.quantity !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        o.status === "pending" ? "bg-warning/10 text-warning border-warning/20" : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {o.status}
                      </Badge>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outstanding Actions (To-Dos) */}
          {todos.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Outstanding Actions
              </h2>
              <div className="space-y-2">
                {todos.map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full flex-shrink-0",
                      t.priority === "urgent" ? "bg-destructive" :
                      t.priority === "high" ? "bg-warning" :
                      t.priority === "medium" ? "bg-primary" : "bg-muted-foreground"
                    )} />
                    <p className="text-sm font-medium flex-1">{t.title}</p>
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Clear State */}
          {pending === 0 && awaitingDelivery.length === 0 && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
              <h2 className="text-xl font-bold text-success">All Clear</h2>
              <p className="text-sm text-muted-foreground mt-1">All orders are fulfilled and delivered. You're ready for game day.</p>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={() => load()}
      />
    </div>
  );
}
