import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface EventRow {
  id: string; home_team: string; away_team: string; event_date: string;
  venue: string | null; city: string | null; competition: string; match_code: string;
}

interface WeekAtAGlanceProps {
  events: EventRow[];
  onDayClick: (date: Date) => void;
}

const abbreviate = (team: string) => {
  const map: Record<string, string> = {
    Liverpool: "LIV", Arsenal: "ARS", Chelsea: "CHE",
    "Manchester United": "MUN", "Man United": "MUN",
    "Manchester City": "MCI", "Man City": "MCI",
    Tottenham: "TOT", "West Ham": "WHU", Newcastle: "NEW",
    "Aston Villa": "AVL", Everton: "EVE", Brighton: "BHA",
    Galatasaray: "GAL", "Bayern Munich": "BAY", "Real Madrid": "RMA",
    Barcelona: "BAR", "AC Milan": "MIL", Juventus: "JUV",
    "PSG": "PSG", "Inter Milan": "INT", Benfica: "BEN",
    Dortmund: "BVB", "Atletico Madrid": "ATM",
  };
  for (const [key, abbr] of Object.entries(map)) {
    if (team.toLowerCase().includes(key.toLowerCase())) return abbr;
  }
  return team.slice(0, 3).toUpperCase();
};

export default function WeekAtAGlance({ events, onDayClick }: WeekAtAGlanceProps) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {days.map(day => {
          const dayEvents = events.filter(e => isSameDay(new Date(e.event_date), day));
          const hasEvents = dayEvents.length > 0;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "flex-shrink-0 w-24 rounded-lg border p-2 text-center transition-all hover:border-primary/50",
                hasEvents
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "bg-card border-border text-muted-foreground",
                isToday && "ring-2 ring-primary/40"
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider">
                {format(day, "EEE")}
              </div>
              <div className={cn("text-lg font-bold", isToday && "text-primary")}>
                {format(day, "dd")}
              </div>
              <div className="text-[10px] text-muted-foreground">{format(day, "MMM")}</div>
              <div className="mt-1 min-h-[1.25rem]">
                {dayEvents.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground/50">—</span>
                ) : dayEvents.length <= 2 ? (
                  dayEvents.map(e => (
                    <div key={e.id} className="text-[9px] font-medium truncate">
                      {abbreviate(e.home_team)} v {abbreviate(e.away_team)}
                    </div>
                  ))
                ) : (
                  <span className="text-[10px] font-semibold text-primary">{dayEvents.length} games</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
