/**
 * Canonical event deduplication utility.
 * Many events exist as duplicates in the DB (truncated vs full match_code).
 * This groups them by home_team + away_team + date so every page shows each match once.
 */

export function getEventKey(homeTeam: string, awayTeam: string, eventDate: string): string {
  return `${homeTeam.toLowerCase().trim()}|${awayTeam.toLowerCase().trim()}|${eventDate.substring(0, 10)}`;
}

export interface MinimalEvent {
  id: string;
  home_team: string;
  away_team: string;
  event_date: string;
  [key: string]: any;
}

/**
 * Given an array of events, returns:
 * - `unique`: deduplicated events (one per canonical match, preferring richer data)
 * - `idMap`: maps every event_id → canonical event_id
 * - `groupedIds`: maps canonical event_id → all event_ids for that match
 */
export function deduplicateEvents<T extends MinimalEvent>(events: T[]): {
  unique: T[];
  idMap: Record<string, string>;
  groupedIds: Record<string, string[]>;
} {
  const groups = new Map<string, { canonical: T; ids: string[] }>();
  const idMap: Record<string, string> = {};

  for (const ev of events) {
    const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);

    if (!groups.has(key)) {
      groups.set(key, { canonical: ev, ids: [ev.id] });
    } else {
      const group = groups.get(key)!;
      group.ids.push(ev.id);
      // Prefer event with venue, longer match_code, etc.
      if (ev.venue && !group.canonical.venue) {
        group.canonical = { ...group.canonical, venue: ev.venue };
      }
      if (ev.match_code && (!group.canonical.match_code || ev.match_code.length > group.canonical.match_code.length)) {
        group.canonical = { ...group.canonical, match_code: ev.match_code };
      }
    }
    idMap[ev.id] = groups.get(key)!.canonical.id;
  }

  const groupedIds: Record<string, string[]> = {};
  for (const { canonical, ids } of groups.values()) {
    groupedIds[canonical.id] = ids;
  }

  return {
    unique: [...groups.values()].map(g => g.canonical),
    idMap,
    groupedIds,
  };
}
