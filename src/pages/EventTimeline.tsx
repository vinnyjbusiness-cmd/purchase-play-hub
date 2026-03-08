import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Filter, ChevronDown, X } from "lucide-react";
import { format, isSameDay, startOfDay, addDays, isThisWeek, isThisMonth, startOfWeek, addMonths, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TimelineCalendar from "@/components/timeline/TimelineCalendar";
import TimelineEventCard from "@/components/timeline/TimelineEventCard";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}
interface OrderRow {
  id: string; event_id: string; status: string; delivery_status: string | null;
  quantity: number; order_date: string; platform_id: string | null; sale_price?: number;
}

const KNOWN_CLUBS = ["Liverpool", "Arsenal", "Chelsea", "Man United", "Manchester United", "Man City", "Manchester City", "Tottenham"];

const COMP_COLORS: Record<string, string> = {
  "Premier League": "bg-purple-500/20 text-purple-400 border-purple-500/40",
  "Champions League": "bg-blue-500/20 text-blue-400 border-blue-500/40",
  "Europa League": "bg-orange-500/20 text-orange-400 border-orange-500/40",
  "FA Cup": "bg-red-500/20 text-red-400 border-red-500/40",
  "Carabao Cup": "bg-green-500/20 text-green-400 border-green-500/40",
  "World Cup 2026": "bg-amber-500/20 text-amber-400 border-amber-500/40",
};

export default function EventTimeline() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("events").select("id,home_team,away_team,event_date,venue,city,competition,match_code").order("event_date"),
      supabase.from("orders").select("id,event_id,status,delivery_status,quantity,order_date,platform_id,sale_price"),
    ]).then(([ev, ord]) => {
      setEvents(ev.data || []);
      setAllOrders(ord.data || []);
    });
  }, []);

  const today = startOfDay(new Date());

  // Dedupe
  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.match_code)) return false;
      seen.add(e.match_code);
      return true;
    });
  }, [events]);

  // Available filters
  const availableCompetitions = useMemo(() => [...new Set(dedupedEvents.map(e => e.competition))].sort(), [dedupedEvents]);
  const availableClubs = useMemo(() => {
    const clubs = new Set<string>();
    dedupedEvents.forEach(e => {
      KNOWN_CLUBS.forEach(c => {
        if (e.home_team.toLowerCase().includes(c.toLowerCase()) || e.away_team.toLowerCase().includes(c.toLowerCase())) clubs.add(c);
      });
      if (e.competition.toLowerCase().includes("world cup")) clubs.add("World Cup 2026");
    });
    return Array.from(clubs).sort();
  }, [dedupedEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = dedupedEvents;
    if (selectedCompetitions.length > 0) result = result.filter(e => selectedCompetitions.includes(e.competition));
    if (selectedClubs.length > 0) {
      result = result.filter(e => selectedClubs.some(c => {
        if (c === "World Cup 2026") return e.competition.toLowerCase().includes("world cup");
        return e.home_team.toLowerCase().includes(c.toLowerCase()) || e.away_team.toLowerCase().includes(c.toLowerCase());
      }));
    }
    return result;
  }, [dedupedEvents, selectedCompetitions, selectedClubs]);

  // Events for selected date (or nearby range: selected day ± 3 days)
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const rangeStart = addDays(selectedDate, -3);
    const rangeEnd = addDays(selectedDate, 3);
    return filteredEvents
      .filter(e => {
        const d = new Date(e.event_date);
        return d >= rangeStart && d <= rangeEnd;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [filteredEvents, selectedDate]);

  // Events grouped by day for the selected range
  const groupedByDay = useMemo(() => {
    if (!selectedDate) return [];
    const groups: { date: Date; label: string; events: EventRow[]; isSelectedDay: boolean }[] = [];
    const rangeStart = addDays(selectedDate, -3);

    for (let i = 0; i < 7; i++) {
      const d = addDays(rangeStart, i);
      const dayEvents = selectedDateEvents.filter(e => isSameDay(new Date(e.event_date), d));
      if (dayEvents.length > 0) {
        groups.push({
          date: d,
          label: isSameDay(d, today) ? "Today" : isSameDay(d, addDays(today, 1)) ? "Tomorrow" : format(d, "EEE dd MMM"),
          events: dayEvents,
          isSelectedDay: isSameDay(d, selectedDate),
        });
      }
    }
    return groups;
  }, [selectedDateEvents, selectedDate, today]);

  // Stats
  const upcomingCount = dedupedEvents.filter(e => new Date(e.event_date) >= today).length;
  const thisWeekCount = dedupedEvents.filter(e => isThisWeek(new Date(e.event_date), { weekStartsOn: 1 })).length;

  const toggleComp = (comp: string) => setSelectedCompetitions(prev => prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]);
  const toggleClub = (club: string) => setSelectedClubs(prev => prev.includes(club) ? prev.filter(c => c !== club) : [...prev, club]);
  const clearFilters = () => { setSelectedCompetitions([]); setSelectedClubs([]); };
  const hasFilters = selectedCompetitions.length > 0 || selectedClubs.length > 0;

  const getMatchEvents = (event: EventRow) => events.filter(e => e.match_code === event.match_code);
  const getMatchOrders = (event: EventRow) => {
    const matchEvents = getMatchEvents(event);
    return allOrders.filter(o => matchEvents.some(e => e.id === o.event_id));
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Event Timeline</h1>
          <Badge variant="secondary" className="text-xs">{upcomingCount} upcoming · {thisWeekCount} this week</Badge>
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              filtersOpen || hasFilters ? "bg-primary/10 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilters && <Badge variant="default" className="h-4 w-4 p-0 text-[9px] rounded-full flex items-center justify-center">{selectedCompetitions.length + selectedClubs.length}</Badge>}
            <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Collapsible filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            {/* Competitions */}
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Competition</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {availableCompetitions.map(comp => (
                  <button
                    key={comp}
                    onClick={() => toggleComp(comp)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                      selectedCompetitions.includes(comp)
                        ? COMP_COLORS[comp] || "bg-primary/20 text-primary border-primary/40"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </div>

            {/* Clubs */}
            <div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Club / Team</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {availableClubs.map(club => (
                  <button
                    key={club}
                    onClick={() => toggleClub(club)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                      selectedClubs.includes(club)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {club}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Calendar + Detail side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        {/* Calendar */}
        <TimelineCalendar
          events={filteredEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />

        {/* Selected day detail panel */}
        <div className="space-y-3">
          {selectedDate ? (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Around {format(selectedDate, "EEE dd MMM yyyy")}
                </h2>
                <Badge variant="outline" className="text-[10px]">{selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""} nearby</Badge>
              </div>

              {groupedByDay.length === 0 ? (
                <div className="rounded-xl border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">No events around this date</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try selecting a different day on the calendar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedByDay.map(group => (
                    <div key={group.date.toISOString()}>
                      <div className={cn(
                        "flex items-center gap-2 mb-2 px-2 py-1 rounded-md",
                        group.isSelectedDay && "bg-primary/10"
                      )}>
                        <div className={cn("h-2 w-2 rounded-full", group.isSelectedDay ? "bg-primary" : "bg-muted-foreground/40")} />
                        <span className={cn("text-xs font-semibold", group.isSelectedDay ? "text-primary" : "text-muted-foreground")}>
                          {group.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{group.events.length} event{group.events.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="space-y-2">
                        {group.events.map(e => (
                          <TimelineEventCard key={e.id} event={e} allMatchEvents={getMatchEvents(e)} orders={getMatchOrders(e)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border bg-card p-8 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Select a date</p>
              <p className="text-xs text-muted-foreground mt-1">Click any day on the calendar to see events around that date</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
