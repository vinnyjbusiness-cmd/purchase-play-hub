import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronDown, ChevronRight, Flame, ChevronsUpDown } from "lucide-react";
import { format, isThisWeek, isThisMonth, startOfDay, addDays, isSameDay, isBefore, startOfWeek, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import TimelineFilters, { type TimeFilter, type HomeAwayFilter } from "@/components/timeline/TimelineFilters";
import WeekAtAGlance from "@/components/timeline/WeekAtAGlance";
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

const matchesClub = (event: EventRow, club: string) => {
  const lc = club.toLowerCase();
  if (lc === "world cup 2026") return event.competition.toLowerCase().includes("world cup");
  return event.home_team.toLowerCase().includes(lc) || event.away_team.toLowerCase().includes(lc);
};

export default function EventTimeline() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [expandAll, setExpandAll] = useState(false);
  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");

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

  // Dedupe by match_code
  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.match_code)) return false;
      seen.add(e.match_code);
      return true;
    });
  }, [events]);

  // Split upcoming vs recently passed (last 7 days)
  const upcomingAll = useMemo(() => dedupedEvents.filter(e => !isBefore(startOfDay(new Date(e.event_date)), today)), [dedupedEvents, today]);
  const recentlyPassed = useMemo(() => {
    const sevenAgo = addDays(today, -7);
    return dedupedEvents.filter(e => {
      const d = startOfDay(new Date(e.event_date));
      return isBefore(d, today) && !isBefore(d, sevenAgo);
    }).reverse();
  }, [dedupedEvents, today]);

  // Available clubs and competitions
  const availableClubs = useMemo(() => {
    const clubs = new Set<string>();
    upcomingAll.forEach(e => {
      KNOWN_CLUBS.forEach(c => {
        if (e.home_team.toLowerCase().includes(c.toLowerCase()) || e.away_team.toLowerCase().includes(c.toLowerCase())) clubs.add(c);
      });
      if (e.competition.toLowerCase().includes("world cup")) clubs.add("World Cup 2026");
    });
    return Array.from(clubs).sort();
  }, [upcomingAll]);

  const availableCompetitions = useMemo(() => {
    const comps = new Set<string>();
    upcomingAll.forEach(e => comps.add(e.competition));
    return Array.from(comps).sort();
  }, [upcomingAll]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = upcomingAll;

    // Time filter
    if (timeFilter === "this-week") result = result.filter(e => isThisWeek(new Date(e.event_date), { weekStartsOn: 1 }));
    else if (timeFilter === "next-week") {
      const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
      const nextWeekEnd = addDays(nextWeekStart, 7);
      result = result.filter(e => { const d = new Date(e.event_date); return d >= nextWeekStart && d < nextWeekEnd; });
    } else if (timeFilter === "this-month") result = result.filter(e => isThisMonth(new Date(e.event_date)));
    else if (timeFilter === "next-30") result = result.filter(e => differenceInDays(new Date(e.event_date), today) <= 30);

    // Club filter
    if (selectedClubs.length > 0) result = result.filter(e => selectedClubs.some(c => matchesClub(e, c)));

    // Competition filter
    if (selectedCompetitions.length > 0) result = result.filter(e => selectedCompetitions.includes(e.competition));

    // Day of week filter
    if (selectedDays.length > 0) result = result.filter(e => selectedDays.includes(new Date(e.event_date).getDay()));

    // Home/Away filter
    if (homeAwayFilter === "home") {
      result = result.filter(e => KNOWN_CLUBS.some(c => e.home_team.toLowerCase().includes(c.toLowerCase())));
    } else if (homeAwayFilter === "away") {
      result = result.filter(e => KNOWN_CLUBS.some(c => e.away_team.toLowerCase().includes(c.toLowerCase())));
    }

    return result;
  }, [upcomingAll, timeFilter, selectedClubs, selectedCompetitions, selectedDays, homeAwayFilter, today]);

  // Stats
  const thisWeekCount = useMemo(() => upcomingAll.filter(e => isThisWeek(new Date(e.event_date), { weekStartsOn: 1 })).length, [upcomingAll]);
  const thisMonthCount = useMemo(() => upcomingAll.filter(e => isThisMonth(new Date(e.event_date))).length, [upcomingAll]);

  // Today's events
  const todayEvents = useMemo(() => filteredEvents.filter(e => isSameDay(new Date(e.event_date), today)), [filteredEvents, today]);
  const nextEvent = useMemo(() => filteredEvents.find(e => !isBefore(new Date(e.event_date), today)), [filteredEvents, today]);

  // Group by week
  const weeklyGroups = useMemo(() => {
    const nonToday = filteredEvents.filter(e => !isSameDay(new Date(e.event_date), today));
    const groups: { key: string; label: string; days: string; events: EventRow[]; isBusy: boolean; isCurrentWeek: boolean; isNextWeek: boolean }[] = [];
    let currentWeekStart: Date | null = null;
    let currentGroup: EventRow[] = [];

    const flush = () => {
      if (currentGroup.length > 0 && currentWeekStart) {
        const uniqueDays = [...new Set(currentGroup.map(e => format(new Date(e.event_date), "EEE")))];
        const isCurrentWeek = isThisWeek(currentWeekStart, { weekStartsOn: 1 });
        const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
        const isNextWeek = isSameDay(currentWeekStart, nextWeekStart);
        groups.push({
          key: currentWeekStart.toISOString(),
          label: `Week of ${format(currentWeekStart, "dd MMM")}`,
          days: uniqueDays.join(", "),
          events: currentGroup,
          isBusy: currentGroup.length >= 3,
          isCurrentWeek,
          isNextWeek,
        });
      }
    };

    nonToday.forEach(e => {
      const d = new Date(e.event_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      if (!currentWeekStart || ws.getTime() !== currentWeekStart.getTime()) {
        flush();
        currentWeekStart = ws;
        currentGroup = [e];
      } else {
        currentGroup.push(e);
      }
    });
    flush();
    return groups;
  }, [filteredEvents, today]);

  const toggleClub = (club: string) => {
    if (club === "__all__") { setSelectedClubs([]); return; }
    setSelectedClubs(prev => prev.includes(club) ? prev.filter(c => c !== club) : [...prev, club]);
  };
  const toggleCompetition = (comp: string) => {
    if (comp === "__all__") { setSelectedCompetitions([]); return; }
    setSelectedCompetitions(prev => prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]);
  };
  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleDayClick = (date: Date) => {
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const ref = weekRefs.current[ws.toISOString()];
    if (ref) ref.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getMatchEvents = (event: EventRow) => events.filter(e => e.match_code === event.match_code);
  const getMatchOrders = (event: EventRow) => {
    const matchEvents = getMatchEvents(event);
    return allOrders.filter(o => matchEvents.some(e => e.id === o.event_id));
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarClock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Event Timeline</h1>
        <Badge variant="secondary" className="text-xs">
          {upcomingAll.length} upcoming · {thisWeekCount} this week · {thisMonthCount} this month
        </Badge>
      </div>

      {/* Filters */}
      <TimelineFilters
        timeFilter={timeFilter} onTimeFilter={setTimeFilter}
        selectedClubs={selectedClubs} onToggleClub={toggleClub}
        selectedCompetitions={selectedCompetitions} onToggleCompetition={toggleCompetition}
        selectedDays={selectedDays} onToggleDay={toggleDay}
        homeAwayFilter={homeAwayFilter} onHomeAwayFilter={setHomeAwayFilter}
        availableClubs={availableClubs} availableCompetitions={availableCompetitions}
      />

      {/* Week at a glance */}
      <WeekAtAGlance events={filteredEvents} onDayClick={handleDayClick} />

      {/* Today section */}
      {todayEvents.length > 0 ? (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Today</h2>
            <Badge variant="secondary" className="text-[10px]">{todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {todayEvents.map(e => (
              <TimelineEventCard key={e.id} event={e} allMatchEvents={getMatchEvents(e)} orders={getMatchOrders(e)} />
            ))}
          </div>
        </div>
      ) : nextEvent ? (
        <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Next event: <span className="font-semibold text-foreground">{nextEvent.home_team} vs {nextEvent.away_team}</span>
            {" "}in {differenceInDays(new Date(nextEvent.event_date), today)}d
          </span>
        </div>
      ) : null}

      {/* Week groups */}
      {weeklyGroups.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-end">
            <button onClick={() => setExpandAll(prev => !prev)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <div className="relative">
            <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/40 via-border to-border" />
            <div className="space-y-4">
              {weeklyGroups.map(group => {
                const defaultOpen = group.isCurrentWeek || group.isNextWeek || expandAll;
                return (
                  <div key={group.key} ref={el => { weekRefs.current[group.key] = el; }}>
                    <Collapsible defaultOpen={defaultOpen} open={expandAll ? true : undefined}>
                      <CollapsibleTrigger className="flex items-center gap-3 mb-2 w-full text-left group/trigger">
                        <div className="h-6 w-6 rounded-full bg-muted border-2 border-border flex items-center justify-center z-10 shrink-0">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <h2 className="text-sm font-semibold text-muted-foreground group-hover/trigger:text-foreground transition-colors">{group.label}</h2>
                          <Badge variant="outline" className="text-[10px]">{group.events.length} event{group.events.length !== 1 ? "s" : ""}</Badge>
                          <span className="text-[10px] text-muted-foreground">{group.days}</span>
                          {group.isBusy && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
                              <Flame className="h-3 w-3" /> Busy
                            </span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]/trigger:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-9 grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {group.events.map(e => (
                            <TimelineEventCard key={e.id} event={e} allMatchEvents={getMatchEvents(e)} orders={getMatchOrders(e)} />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {filteredEvents.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No events match your filters</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters to see more events.</p>
        </div>
      )}

      {/* Recently passed */}
      {recentlyPassed.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
            <span>Recently Passed ({recentlyPassed.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 opacity-60">
              {recentlyPassed.map(e => (
                <TimelineEventCard key={e.id} event={e} allMatchEvents={getMatchEvents(e)} orders={getMatchOrders(e)} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
