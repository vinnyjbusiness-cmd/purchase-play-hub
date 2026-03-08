import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export type TimeFilter = "this-week" | "next-week" | "this-month" | "next-30" | "all";
export type HomeAwayFilter = "all" | "home" | "away";

interface TimelineFiltersProps {
  timeFilter: TimeFilter;
  onTimeFilter: (f: TimeFilter) => void;
  selectedClubs: string[];
  onToggleClub: (club: string) => void;
  selectedCompetitions: string[];
  onToggleCompetition: (comp: string) => void;
  selectedDays: number[];
  onToggleDay: (day: number) => void;
  homeAwayFilter: HomeAwayFilter;
  onHomeAwayFilter: (f: HomeAwayFilter) => void;
  availableClubs: string[];
  availableCompetitions: string[];
}

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "next-week", label: "Next Week" },
  { value: "this-month", label: "This Month" },
  { value: "next-30", label: "Next 30 Days" },
  { value: "all", label: "All Upcoming" },
];

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const CLUB_COLORS: Record<string, string> = {
  Liverpool: "bg-red-600 text-white border-red-600",
  Arsenal: "bg-red-700 text-white border-red-700",
  Chelsea: "bg-blue-700 text-white border-blue-700",
  "Man United": "bg-red-800 text-white border-red-800",
  "Manchester United": "bg-red-800 text-white border-red-800",
  "World Cup 2026": "bg-amber-500 text-black border-amber-500",
  Tottenham: "bg-slate-200 text-slate-900 border-slate-400",
  "Man City": "bg-sky-400 text-white border-sky-400",
  "Manchester City": "bg-sky-400 text-white border-sky-400",
};

const COMP_COLORS: Record<string, string> = {
  "Premier League": "bg-purple-500/20 text-purple-400 border-purple-500/40",
  "Champions League": "bg-blue-500/20 text-blue-400 border-blue-500/40",
  "Europa League": "bg-orange-500/20 text-orange-400 border-orange-500/40",
  "FA Cup": "bg-red-500/20 text-red-400 border-red-500/40",
  "Carabao Cup": "bg-green-500/20 text-green-400 border-green-500/40",
  "League Cup": "bg-green-500/20 text-green-400 border-green-500/40",
  "World Cup 2026": "bg-amber-500/20 text-amber-400 border-amber-500/40",
};

const HOME_AWAY_OPTIONS: { value: HomeAwayFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];

const Pill = ({ active, onClick, className, children }: { active: boolean; onClick: () => void; className?: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all",
      active
        ? className || "bg-primary text-primary-foreground border-primary"
        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
    )}
  >
    {children}
  </button>
);

export default function TimelineFilters({
  timeFilter, onTimeFilter,
  selectedClubs, onToggleClub,
  selectedCompetitions, onToggleCompetition,
  selectedDays, onToggleDay,
  homeAwayFilter, onHomeAwayFilter,
  availableClubs, availableCompetitions,
}: TimelineFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Time filter */}
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-1">
          {TIME_OPTIONS.map(o => (
            <Pill key={o.value} active={timeFilter === o.value} onClick={() => onTimeFilter(o.value)}>
              {o.label}
            </Pill>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Club filter */}
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-1">
          <Pill active={selectedClubs.length === 0} onClick={() => onToggleClub("__all__")}>All</Pill>
          {availableClubs.map(club => (
            <Pill
              key={club}
              active={selectedClubs.includes(club)}
              onClick={() => onToggleClub(club)}
              className={CLUB_COLORS[club] || "bg-primary text-primary-foreground border-primary"}
            >
              {club}
            </Pill>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Competition + Home/Away + Day of week row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* Competition */}
        <ScrollArea className="max-w-full flex-shrink-0">
          <div className="flex gap-1.5 pb-1">
            <Pill active={selectedCompetitions.length === 0} onClick={() => onToggleCompetition("__all__")}>All Comps</Pill>
            {availableCompetitions.map(comp => (
              <Pill
                key={comp}
                active={selectedCompetitions.includes(comp)}
                onClick={() => onToggleCompetition(comp)}
                className={COMP_COLORS[comp] || "bg-primary/20 text-primary border-primary/40"}
              >
                {comp}
              </Pill>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* Home/Away */}
        <div className="flex gap-1.5">
          {HOME_AWAY_OPTIONS.map(o => (
            <Pill
              key={o.value}
              active={homeAwayFilter === o.value}
              onClick={() => onHomeAwayFilter(o.value)}
              className={o.value === "home" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : o.value === "away" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : undefined}
            >
              {o.label}
            </Pill>
          ))}
        </div>

        {/* Day of week */}
        <div className="flex gap-1.5">
          {DAY_OPTIONS.map(d => (
            <Pill key={d.value} active={selectedDays.includes(d.value)} onClick={() => onToggleDay(d.value)}>
              {d.label}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  );
}
