import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  match_code: string;
  competition: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  city: string | null;
}

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .then(({ data }) => setEvents(data || []));
  }, []);

  const filtered = events.filter(
    (e) =>
      e.match_code.toLowerCase().includes(search.toLowerCase()) ||
      e.home_team.toLowerCase().includes(search.toLowerCase()) ||
      e.away_team.toLowerCase().includes(search.toLowerCase()) ||
      e.competition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">All matches and fixtures</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => (
          <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">{event.match_code}</Badge>
                <Badge variant="outline" className="text-xs">{event.competition}</Badge>
              </div>
              <CardTitle className="text-base mt-2">
                {event.home_team} vs {event.away_team}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}
              </div>
              {event.venue && <p>{event.venue}{event.city ? `, ${event.city}` : ""}</p>}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">No events found</p>
        )}
      </div>
    </div>
  );
}
