import { useState, useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}

const COMP_DOT: Record<string, string> = {
  "Premier League": "bg-purple-500",
  "Champions League": "bg-blue-500",
  "Europa League": "bg-orange-500",
  "FA Cup": "bg-red-500",
  "Carabao Cup": "bg-green-500",
  "League Cup": "bg-green-500",
  "World Cup 2026": "bg-amber-500",
};

const getCompDot = (comp: string) => {
  for (const [key, cls] of Object.entries(COMP_DOT)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-primary";
};

interface TimelineCalendarProps {
  events: EventRow[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export default function TimelineCalendar({ events, selectedDate, onSelectDate, currentMonth, onMonthChange }: TimelineCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    events.forEach(e => {
      const key = format(new Date(e.event_date), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const today = new Date();

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between p-3 border-b">
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map(d => {
          const key = format(d, "yyyy-MM-dd");
          const dayEvents = eventsByDay[key] || [];
          const inMonth = isSameMonth(d, currentMonth);
          const isToday = isSameDay(d, today);
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={key}
              onClick={() => onSelectDate(d)}
              className={cn(
                "relative p-1.5 min-h-[3.5rem] md:min-h-[4.5rem] border-b border-r text-left transition-all hover:bg-muted/50",
                !inMonth && "opacity-30",
                isSelected && "bg-primary/10 ring-1 ring-primary/30",
                isToday && "bg-primary/5"
              )}
            >
              <span className={cn(
                "text-xs font-medium",
                isToday && "text-primary font-bold",
                !inMonth && "text-muted-foreground"
              )}>
                {format(d, "d")}
              </span>

              {/* Event dots / count */}
              {hasEvents && (
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.length <= 2 ? (
                    dayEvents.map(e => (
                      <div key={e.id} className="flex items-center gap-1">
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getCompDot(e.competition))} />
                        <span className="text-[8px] md:text-[9px] truncate text-foreground leading-tight">
                          {e.home_team.split(" ").pop()} v {e.away_team.split(" ").pop()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-0.5">
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} className={cn("h-1.5 w-1.5 rounded-full border border-card", getCompDot(e.competition))} />
                        ))}
                      </div>
                      <span className="text-[8px] font-bold text-primary">{dayEvents.length}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
