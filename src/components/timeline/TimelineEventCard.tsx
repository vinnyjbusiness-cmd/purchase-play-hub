import { format, differenceInDays, startOfDay } from "date-fns";
import { CalendarClock, MapPin, Ticket, Banknote, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}
interface OrderRow {
  id: string; event_id: string; status: string; delivery_status: string | null;
  quantity: number; order_date: string; platform_id: string | null; sale_price?: number;
}

interface TimelineEventCardProps {
  event: EventRow;
  allMatchEvents: EventRow[];
  orders: OrderRow[];
}

const CLUB_BORDER: Record<string, string> = {
  Liverpool: "border-l-red-600",
  Arsenal: "border-l-red-700",
  Chelsea: "border-l-blue-600",
  "Man United": "border-l-red-800",
  "Manchester United": "border-l-red-800",
  "Manchester City": "border-l-sky-400",
  "Man City": "border-l-sky-400",
  Tottenham: "border-l-slate-400",
};

const COMP_BADGE: Record<string, { bg: string; text: string }> = {
  "Premier League": { bg: "bg-purple-500/15", text: "text-purple-400" },
  "Champions League": { bg: "bg-blue-500/15", text: "text-blue-400" },
  "Europa League": { bg: "bg-orange-500/15", text: "text-orange-400" },
  "FA Cup": { bg: "bg-red-500/15", text: "text-red-400" },
  "Carabao Cup": { bg: "bg-green-500/15", text: "text-green-400" },
  "League Cup": { bg: "bg-green-500/15", text: "text-green-400" },
  "World Cup 2026": { bg: "bg-amber-500/15", text: "text-amber-400" },
};

const getClubBorder = (home: string, away: string) => {
  for (const [club, cls] of Object.entries(CLUB_BORDER)) {
    if (home.toLowerCase().includes(club.toLowerCase()) || away.toLowerCase().includes(club.toLowerCase())) return cls;
  }
  if (home.toLowerCase().includes("world cup") || away.toLowerCase().includes("world cup")) return "border-l-amber-500";
  return "border-l-muted-foreground/30";
};

const getCompBadge = (comp: string) => {
  for (const [key, val] of Object.entries(COMP_BADGE)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { bg: "bg-muted", text: "text-muted-foreground" };
};

export default function TimelineEventCard({ event, allMatchEvents, orders }: TimelineEventCardProps) {
  const allOrders = allMatchEvents.flatMap(e => orders.filter(o => o.event_id === e.id));
  const activeOrders = allOrders.filter(o => o.status !== "cancelled" && o.status !== "refunded");
  const totalQty = activeOrders.reduce((s, o) => s + o.quantity, 0);
  const totalValue = activeOrders.reduce((s, o) => s + Number((o as any).sale_price || 0), 0);
  const hasActivity = activeOrders.length > 0;

  const today = startOfDay(new Date());
  const eventDate = new Date(event.event_date);
  const daysUntil = differenceInDays(startOfDay(eventDate), today);

  const compBadge = getCompBadge(event.competition);
  const clubBorder = getClubBorder(event.home_team, event.away_team);

  // Determine home/away (heuristic: if a known club is in home_team position)
  const isHome = Object.keys(CLUB_BORDER).some(c => event.home_team.toLowerCase().includes(c.toLowerCase()));

  const countdownColor = daysUntil <= 1
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : daysUntil <= 3
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : daysUntil <= 7
        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : "bg-muted text-muted-foreground border-border";

  const countdownText = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d away`;

  return (
    <div
      className={cn(
        "rounded-xl border-l-4 border border-border bg-card overflow-hidden transition-all hover:shadow-md group",
        clubBorder,
        hasActivity && "ring-1 ring-primary/10 border-border/80"
      )}
    >
      <div className="p-4 flex gap-4">
        {/* Left section */}
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="font-bold text-base truncate">
            {event.home_team} vs {event.away_team}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">
              {format(eventDate, "EEE dd MMM yyyy, HH:mm")}
            </span>
          </div>

          {event.venue && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{event.venue}{event.city ? `, ${event.city}` : ""}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] border", compBadge.bg, compBadge.text)}>
              {event.competition}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] border", isHome ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30")}>
              {isHome ? "HOME" : "AWAY"}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] border", countdownColor)}>
              {countdownText}
            </Badge>
          </div>
        </div>

        {/* Right section */}
        <div className="flex flex-col items-end justify-between shrink-0 text-right">
          {hasActivity ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 justify-end">
                <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-bold">{totalQty}</span>
                <span className="text-xs text-muted-foreground">tickets</span>
              </div>
              <div className="text-xs text-muted-foreground">{activeOrders.length} order{activeOrders.length !== 1 ? "s" : ""}</div>
              {totalValue > 0 && (
                <div className="flex items-center gap-1 justify-end text-xs">
                  <Banknote className="h-3 w-3 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">£{totalValue.toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/60 italic">No sales yet</span>
          )}

          {/* Source indicator */}
          <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground/40">
            <Globe className="h-2.5 w-2.5" />
            <span>Manual</span>
          </div>
        </div>
      </div>
    </div>
  );
}
