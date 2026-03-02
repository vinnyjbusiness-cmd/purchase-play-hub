import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, CalendarDays, TrendingUp, TrendingDown, Package, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { CLUBS } from "@/lib/seatingSections";
import { getMatchBadge } from "@/lib/eventDisplay";
import { getEventKey } from "@/lib/eventDedup";
import EventDrilldownSheet from "@/components/EventDrilldownSheet";
import type { AnalyticsEvent, AnalyticsOrder, AnalyticsPurchase } from "@/pages/Analytics";

interface Props {
  events: AnalyticsEvent[];
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
}

interface EventWithPL extends AnalyticsEvent {
  revenue: number;
  costs: number;
  fees: number;
  profit: number;
  totalInventory: number;
  soldCount: number;
  availableCount: number;
}

const CLUB_FILTERS = [{ value: "all", label: "All" }, ...CLUBS];

const COUNTRY_FLAGS: Record<string, string> = {
  "mexico": "🇲🇽", "colombia": "🇨🇴", "argentina": "🇦🇷", "brazil": "🇧🇷",
  "usa": "🇺🇸", "united states": "🇺🇸", "canada": "🇨🇦", "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "france": "🇫🇷", "germany": "🇩🇪", "spain": "🇪🇸", "italy": "🇮🇹",
  "portugal": "🇵🇹", "netherlands": "🇳🇱", "belgium": "🇧🇪", "croatia": "🇭🇷",
  "japan": "🇯🇵", "south korea": "🇰🇷", "australia": "🇦🇺", "saudi arabia": "🇸🇦",
  "uruguay": "🇺🇾", "chile": "🇨🇱", "ecuador": "🇪🇨", "peru": "🇵🇪",
  "costa rica": "🇨🇷", "panama": "🇵🇦", "jamaica": "🇯🇲", "serbia": "🇷🇸",
  "switzerland": "🇨🇭", "poland": "🇵🇱", "denmark": "🇩🇰", "sweden": "🇸🇪",
  "norway": "🇳🇴", "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "ireland": "🇮🇪",
  "turkey": "🇹🇷", "morocco": "🇲🇦", "ghana": "🇬🇭", "senegal": "🇸🇳",
  "cameroon": "🇨🇲", "nigeria": "🇳🇬", "tbc": "🏳️",
};

function getFlag(teamName: string): string {
  const lower = teamName.toLowerCase().trim();
  for (const [key, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return "";
}

const CLUB_COLORS: Record<string, { home: string; away: string }> = {
  liverpool: { home: "border-l-4 border-l-red-600 bg-red-600/5", away: "border-l-4 border-l-blue-500 bg-blue-500/5" },
  arsenal: { home: "border-l-4 border-l-red-500 bg-red-500/5", away: "border-l-4 border-l-yellow-500 bg-yellow-500/5" },
  "manchester-united": { home: "border-l-4 border-l-red-700 bg-red-700/5", away: "border-l-4 border-l-slate-400 bg-slate-400/5" },
  "world-cup": { home: "border-l-4 border-l-emerald-500 bg-emerald-500/5", away: "border-l-4 border-l-emerald-500 bg-emerald-500/5" },
};

function getClubKey(teamName: string): string | null {
  const lower = teamName.toLowerCase();
  if (lower.includes("liverpool")) return "liverpool";
  if (lower.includes("arsenal")) return "arsenal";
  if (lower.includes("manchester united") || lower.includes("man utd") || lower.includes("man united")) return "manchester-united";
  return null;
}

function isWorldCupEvent(event: { competition: string; home_team: string; away_team: string }): boolean {
  return event.competition.toLowerCase().includes("world cup") || event.home_team.toLowerCase().includes("stadium") || event.away_team === "TBC";
}

function getCardColor(event: EventWithPL): string {
  if (isWorldCupEvent(event)) return CLUB_COLORS["world-cup"].home;
  const homeClub = getClubKey(event.home_team);
  if (homeClub && CLUB_COLORS[homeClub]) return CLUB_COLORS[homeClub].home;
  const awayClub = getClubKey(event.away_team);
  if (awayClub && CLUB_COLORS[awayClub]) return CLUB_COLORS[awayClub].away;
  return "";
}

function getHomeAwayLabel(event: EventWithPL): { label: string; className: string } | null {
  if (isWorldCupEvent(event)) return null;
  const homeClub = getClubKey(event.home_team);
  if (homeClub) return { label: "HOME", className: "bg-red-600/20 text-red-400 border-red-600/30" };
  const awayClub = getClubKey(event.away_team);
  if (awayClub) return { label: "AWAY", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  return null;
}

function getWorldCupGroup(event: EventWithPL): string {
  return (event.venue || event.home_team || "").trim() || "Other Venues";
}

export default function EventsTab({ events, orders, purchases }: Props) {
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const enrichedEvents = useMemo(() => {
    const rawEvents = events;
    const eventIdsWithOrders = new Set(orders.map(o => o.event_id));
    const eventsWithOrders = rawEvents.filter(ev => eventIdsWithOrders.has(ev.id));
    const seen = new Set<string>();
    const uniqueEvents = eventsWithOrders.filter(ev => {
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const keyToIds = new Map<string, string[]>();
    eventsWithOrders.forEach(ev => {
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      if (!keyToIds.has(key)) keyToIds.set(key, []);
      keyToIds.get(key)!.push(ev.id);
    });

    return uniqueEvents.map(ev => {
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      const allIds = keyToIds.get(key) || [ev.id];
      const evOrders = orders.filter(o => allIds.includes(o.event_id));
      const evPurchases = purchases.filter(p => allIds.includes(p.event_id));
      const revenue = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
      const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
      const costs = evPurchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
      const soldCount = evOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
      const purchasedCount = evPurchases.reduce((s, p) => s + Number(p.quantity || 0), 0);
      return {
        ...ev,
        revenue, costs, fees, profit: revenue - costs - fees,
        totalInventory: purchasedCount, soldCount, availableCount: Math.max(0, purchasedCount - soldCount),
        _allIds: allIds,
      };
    }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events, orders, purchases]);

  const filtered = enrichedEvents.filter(e => {
    if (clubFilter !== "all") {
      const clubLabel = CLUBS.find(c => c.value === clubFilter)?.label.toLowerCase() || "";
      const matches = e.home_team.toLowerCase().includes(clubLabel) || e.away_team.toLowerCase().includes(clubLabel) || (clubFilter === "world-cup" && isWorldCupEvent(e));
      if (!matches) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return e.home_team.toLowerCase().includes(s) || e.away_team.toLowerCase().includes(s) || e.competition.toLowerCase().includes(s) || (e.venue || "").toLowerCase().includes(s);
    }
    return true;
  });

  const worldCupEvents = filtered.filter(isWorldCupEvent);
  const regularEvents = filtered.filter(e => !isWorldCupEvent(e));

  const wcGroups = useMemo(() => {
    const groups = new Map<string, EventWithPL[]>();
    worldCupEvents.forEach(ev => {
      const group = getWorldCupGroup(ev as EventWithPL);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(ev as EventWithPL);
    });
    return [...groups.entries()].sort((a, b) => {
      const dateA = Math.min(...a[1].map(e => new Date(e.event_date).getTime()));
      const dateB = Math.min(...b[1].map(e => new Date(e.event_date).getTime()));
      return dateA - dateB;
    });
  }, [worldCupEvents]);

  const totalProfit = filtered.reduce((s, e) => s + e.profit, 0);
  const totalRevenue = filtered.reduce((s, e) => s + e.revenue, 0);

  const selectedEvent = selectedEventId ? enrichedEvents.find(e => e.id === selectedEventId) : null;
  const selectedEventOrders = selectedEvent ? orders.filter(o => (selectedEvent as any)._allIds?.includes(o.event_id) || o.event_id === selectedEvent.id) : [];
  const selectedEventPurchases = selectedEvent ? purchases.filter(p => (selectedEvent as any)._allIds?.includes(p.event_id) || p.event_id === selectedEvent.id) : [];

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {filtered.length} events · Revenue: £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })} · Profit: <span className={totalProfit >= 0 ? "text-success" : "text-destructive"}>£{totalProfit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CLUB_FILTERS.map(club => (
          <Button key={club.value} variant={clubFilter === club.value ? "default" : "outline"} size="sm" onClick={() => setClubFilter(club.value)} className="text-xs">
            {club.label}
          </Button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Regular Events */}
      {regularEvents.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regularEvents.map(event => {
            const ev = event as EventWithPL;
            const colorClass = getCardColor(ev);
            const haLabel = getHomeAwayLabel(ev);
            return (
              <Card key={ev.id} className={`hover:shadow-md transition-shadow cursor-pointer ${colorClass}`} onClick={() => setSelectedEventId(ev.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    {haLabel ? (
                      <Badge variant="outline" className={`text-[10px] font-bold ${haLabel.className}`}>{haLabel.label}</Badge>
                    ) : <span />}
                    <Badge variant="outline" className={ev.profit >= 0 ? "bg-success/10 text-success border-success/20 text-xs" : "bg-destructive/10 text-destructive border-destructive/20 text-xs"}>
                      {ev.profit >= 0 ? "+" : ""}£{ev.profit.toFixed(2)}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{ev.home_team} <span className="text-muted-foreground mx-1.5">vs</span> {ev.away_team}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(ev.event_date), "dd MMM yyyy, HH:mm")}</div>
                    {ev.venue && <p className="text-xs">{ev.venue}{ev.city ? `, ${ev.city}` : ""}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><ShoppingCart className="h-3 w-3" /> Revenue</div>
                      <p className="text-sm font-semibold">£{ev.revenue.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Package className="h-3 w-3" /> Costs</div>
                      <p className="text-sm font-semibold">£{ev.costs.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">{ev.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Profit</div>
                      <p className={`text-sm font-semibold ${ev.profit >= 0 ? "text-success" : "text-destructive"}`}>£{ev.profit.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{ev.totalInventory} tickets total</span>
                    <span className="text-success">{ev.soldCount} sold</span>
                    <span>{ev.availableCount} available</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* World Cup Section */}
      {worldCupEvents.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <h2 className="text-xl font-bold tracking-tight">FIFA World Cup 2026</h2>
            <Badge variant="outline" className="text-xs bg-emerald-600/10 text-emerald-400 border-emerald-600/20">{worldCupEvents.length} matches</Badge>
          </div>
          {wcGroups.map(([groupName, groupEvents]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-2">📍 {groupName}</h3>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupEvents.map(event => {
                  const homeFlag = getFlag(event.home_team);
                  const awayFlag = getFlag(event.away_team);
                  return (
                    <Card key={event.id} className={`hover:shadow-md transition-shadow cursor-pointer ${getCardColor(event)}`} onClick={() => setSelectedEventId(event.id)}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-bold bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                            🏆 {getMatchBadge(event.match_code) || "WC 2026"}
                          </Badge>
                          <Badge variant="outline" className={event.profit >= 0 ? "bg-success/10 text-success border-success/20 text-xs" : "bg-destructive/10 text-destructive border-destructive/20 text-xs"}>
                            {event.profit >= 0 ? "+" : ""}£{event.profit.toFixed(2)}
                          </Badge>
                        </div>
                        <CardTitle className="text-base mt-2">
                          {homeFlag && <span className="mr-1.5 text-lg">{homeFlag}</span>}{event.home_team}
                          <span className="text-muted-foreground mx-1.5">vs</span>
                          {awayFlag && <span className="mr-1.5 text-lg">{awayFlag}</span>}{event.away_team}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}</div>
                          {event.venue && <p className="text-xs">{event.venue}{event.city ? `, ${event.city}` : ""}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><ShoppingCart className="h-3 w-3" /> Revenue</div>
                            <p className="text-sm font-semibold">£{event.revenue.toFixed(0)}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Package className="h-3 w-3" /> Costs</div>
                            <p className="text-sm font-semibold">£{event.costs.toFixed(0)}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">{event.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Profit</div>
                            <p className={`text-sm font-semibold ${event.profit >= 0 ? "text-success" : "text-destructive"}`}>£{event.profit.toFixed(0)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <span>{event.totalInventory} tickets total</span>
                          <span className="text-success">{event.soldCount} sold</span>
                          <span>{event.availableCount} available</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-12">No events found</p>
      )}

      {/* Event Drilldown Sheet */}
      <EventDrilldownSheet
        open={!!selectedEventId}
        onOpenChange={(open) => { if (!open) setSelectedEventId(null); }}
        event={selectedEvent || null}
        orders={selectedEventOrders}
        purchases={selectedEventPurchases}
      />
    </div>
  );
}
