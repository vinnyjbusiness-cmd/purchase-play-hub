import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, MapPin, Ticket, CheckCircle2, Clock, AlertTriangle, Banknote } from "lucide-react";
import { format, isThisWeek, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}
interface OrderRow {
  id: string; event_id: string; status: string; delivery_status: string | null; quantity: number;
  order_date: string; platform_id: string | null;
}
interface PlatformRow {
  id: string; name: string; payout_days: number;
}

const COMP_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; gradient: string }> = {
  "Premier League": { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", dot: "bg-purple-500", gradient: "from-purple-500/20 to-purple-500/5" },
  "Champions League": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-500", gradient: "from-blue-500/20 to-blue-500/5" },
  "FA Cup": { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-500", gradient: "from-red-500/20 to-red-500/5" },
  "Carabao Cup": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", dot: "bg-green-500", gradient: "from-green-500/20 to-green-500/5" },
  "World Cup 2026": { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500", gradient: "from-emerald-500/20 to-emerald-500/5" },
  "Europa League": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-500", gradient: "from-orange-500/20 to-orange-500/5" },
};

const getCompColors = (comp: string) => {
  for (const key of Object.keys(COMP_COLORS)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return COMP_COLORS[key];
  }
  return { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", dot: "bg-primary", gradient: "from-primary/20 to-primary/5" };
};

export default function EventTimeline() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("events").select("id,home_team,away_team,event_date,venue,city,competition,match_code").gte("event_date", new Date().toISOString()).order("event_date"),
      supabase.from("orders").select("id,event_id,status,delivery_status,quantity,order_date,platform_id"),
      supabase.from("platforms").select("id,name,payout_days"),
    ]).then(([ev, ord, plat]) => {
      setEvents(ev.data || []);
      setOrders(ord.data || []);
      setPlatforms(plat.data || []);
    });
  }, []);

  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  const ordersByEvent = useMemo(() => {
    const map: Record<string, OrderRow[]> = {};
    orders.forEach(o => {
      if (!map[o.event_id]) map[o.event_id] = [];
      map[o.event_id].push(o);
    });
    return map;
  }, [orders]);

  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.match_code)) return false;
      seen.add(e.match_code);
      return true;
    });
  }, [events]);

  const thisWeekEvents = dedupedEvents.filter(e => isThisWeek(new Date(e.event_date), { weekStartsOn: 1 }));
  const upcomingEvents = dedupedEvents.filter(e => !isThisWeek(new Date(e.event_date), { weekStartsOn: 1 }));

  const upcomingGrouped = useMemo(() => {
    const groups: { label: string; events: EventRow[] }[] = [];
    let currentWeekStart: Date | null = null;
    let currentGroup: EventRow[] = [];

    upcomingEvents.forEach(e => {
      const d = new Date(e.event_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      if (!currentWeekStart || weekStart.getTime() !== currentWeekStart.getTime()) {
        if (currentGroup.length > 0 && currentWeekStart) {
          groups.push({ label: `Week of ${format(currentWeekStart, "dd MMM")}`, events: currentGroup });
        }
        currentWeekStart = weekStart;
        currentGroup = [e];
      } else {
        currentGroup.push(e);
      }
    });
    if (currentGroup.length > 0 && currentWeekStart) {
      groups.push({ label: `Week of ${format(currentWeekStart, "dd MMM")}`, events: currentGroup });
    }
    return groups;
  }, [upcomingEvents]);

  const renderEventCard = (event: EventRow, featured: boolean = false) => {
    const allMatchEvents = events.filter(e => e.match_code === event.match_code);
    const allOrders = allMatchEvents.flatMap(e => ordersByEvent[e.id] || []);
    const totalOrders = allOrders.length;
    const totalQty = allOrders.reduce((s, o) => s + o.quantity, 0);
    const delivered = allOrders.filter(o => o.delivery_status === "delivered").length;
    const pending = allOrders.filter(o => o.status === "pending").length;
    const daysUntil = Math.ceil((new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isUrgent = daysUntil <= 2 && pending > 0;
    const colors = getCompColors(event.competition);

    // Compute payout dates from orders
    const payoutDates = allOrders
      .filter(o => o.platform_id && platformMap[o.platform_id])
      .map(o => {
        const plat = platformMap[o.platform_id!];
        const eventDate = new Date(event.event_date);
        const payoutDate = new Date(eventDate);
        payoutDate.setDate(payoutDate.getDate() + plat.payout_days);
        return { platform: plat.name, date: payoutDate, days: plat.payout_days };
      });
    // Deduplicate by platform
    const uniquePayouts = Array.from(new Map(payoutDates.map(p => [p.platform, p])).values());

    return (
      <div
        key={event.id}
        className={cn(
          "rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md hover:border-opacity-60",
          colors.border,
          featured && "ring-1 ring-primary/10",
          isUrgent && "border-destructive/40"
        )}
      >
        {/* Gradient header */}
        <div className={cn("bg-gradient-to-r p-4", colors.gradient)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn("font-bold truncate", featured ? "text-lg" : "text-sm")}>
                  {event.home_team} vs {event.away_team}
                </h3>
                {isUrgent && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    <AlertTriangle className="h-3 w-3 mr-0.5" /> Urgent
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {format(new Date(event.event_date), "EEE dd MMM yyyy, HH:mm")}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {event.venue}{event.city ? `, ${event.city}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="outline" className={cn("text-[10px]", colors.bg, colors.text, colors.border)}>
                  {event.competition}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d away`}
                </Badge>
              </div>
            </div>

            {/* Order stats */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-bold">{totalQty}</span>
                <span className="text-xs text-muted-foreground">tickets</span>
              </div>
              <span className="text-xs text-muted-foreground">{totalOrders} order{totalOrders !== 1 ? "s" : ""}</span>
              {totalOrders > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  {delivered > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-success">
                      <CheckCircle2 className="h-3 w-3" /> {delivered}
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-warning">
                      <Clock className="h-3 w-3" /> {pending}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 pt-2 space-y-2">
          {/* Fulfilment progress bar */}
          {totalOrders > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Fulfilment</span>
                <span>{delivered}/{totalOrders} delivered</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all",
                    delivered === totalOrders ? "bg-success" : colors.dot
                  )}
                  style={{ width: `${totalOrders > 0 ? (delivered / totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Payout dates */}
          {uniquePayouts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {uniquePayouts.map(p => (
                <div key={p.platform} className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded-md px-2 py-0.5">
                  <Banknote className="h-3 w-3" />
                  <span>{p.platform}:</span>
                  <span className="font-medium text-foreground">{format(p.date, "dd MMM")}</span>
                  <span>({p.days}d post)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Event Timeline</h1>
        <Badge variant="secondary">{dedupedEvents.length} upcoming</Badge>
      </div>

      {/* This Week */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">This Week</h2>
        </div>
        {thisWeekEvents.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No events this week
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {thisWeekEvents.map(e => renderEventCard(e, true))}
          </div>
        )}
      </div>

      {/* Timeline */}
      {upcomingGrouped.length > 0 && (
        <div className="relative">
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/40 via-border to-border" />

          <div className="space-y-6">
            {upcomingGrouped.map((group, gi) => (
              <div key={gi} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-border flex items-center justify-center z-10">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  </div>
                  <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
                  <Badge variant="outline" className="text-[10px]">{group.events.length} event{group.events.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="ml-9 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {group.events.map(e => renderEventCard(e))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dedupedEvents.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No upcoming events</p>
          <p className="text-sm text-muted-foreground mt-1">Events will appear here once added.</p>
        </div>
      )}
    </div>
  );
}
