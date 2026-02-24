import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, MapPin, Ticket, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format, isThisWeek, isAfter, startOfToday, addDays, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}
interface OrderRow {
  id: string; event_id: string; status: string; delivery_status: string | null; quantity: number;
}

export default function EventTimeline() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("events").select("id,home_team,away_team,event_date,venue,city,competition,match_code").gte("event_date", startOfToday().toISOString()).order("event_date"),
      supabase.from("orders").select("id,event_id,status,delivery_status,quantity"),
    ]).then(([ev, ord]) => {
      setEvents(ev.data || []);
      setOrders(ord.data || []);
    });
  }, []);

  const ordersByEvent = useMemo(() => {
    const map: Record<string, OrderRow[]> = {};
    orders.forEach(o => {
      if (!map[o.event_id]) map[o.event_id] = [];
      map[o.event_id].push(o);
    });
    return map;
  }, [orders]);

  // Deduplicate by match_code
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

  // Group upcoming by week
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
    const evOrders = ordersByEvent[event.id] || [];
    // Also find orders for events with same match_code
    const allMatchEvents = events.filter(e => e.match_code === event.match_code);
    const allOrders = allMatchEvents.flatMap(e => ordersByEvent[e.id] || []);
    const totalOrders = allOrders.length;
    const totalQty = allOrders.reduce((s, o) => s + o.quantity, 0);
    const delivered = allOrders.filter(o => o.delivery_status === "delivered").length;
    const pending = allOrders.filter(o => o.status === "pending").length;
    const fulfilled = allOrders.filter(o => o.status === "fulfilled" || o.status === "delivered").length;
    const daysUntil = Math.ceil((new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isUrgent = daysUntil <= 2 && pending > 0;

    return (
      <div
        key={event.id}
        className={cn(
          "rounded-xl border bg-card p-4 transition-all hover:border-primary/30",
          featured && "p-5",
          isUrgent && "border-destructive/40 bg-destructive/5"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn("font-semibold truncate", featured ? "text-lg" : "text-sm")}>
                {event.home_team} vs {event.away_team}
              </h3>
              {isUrgent && (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Urgent
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {format(new Date(event.event_date), "EEE dd MMM yyyy, HH:mm")}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {event.venue}{event.city ? `, ${event.city}` : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className="text-[10px]">{event.competition}</Badge>
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

        {/* Fulfilment progress bar */}
        {totalOrders > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Fulfilment</span>
              <span>{delivered}/{totalOrders} delivered</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  delivered === totalOrders ? "bg-success" : "bg-primary"
                )}
                style={{ width: `${totalOrders > 0 ? (delivered / totalOrders) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
          {/* Vertical line */}
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-border" />

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
