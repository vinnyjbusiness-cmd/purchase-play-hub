/**
 * Utility for displaying event names with match numbers.
 * World Cup events have match_code like "#M73---(..." or "WC2026-M73"
 */

export function getMatchNumber(matchCode: string | undefined | null): string | null {
  if (!matchCode) return null;
  // Handle both formats: "WC2026-M73" and "#M73---(..."
  const m = matchCode.match(/^(?:WC2026-M|#M)(\d+)/);
  return m ? m[1] : null;
}

export function isWorldCupMatchCode(matchCode: string | undefined | null): boolean {
  if (!matchCode) return false;
  return matchCode.startsWith("WC2026-") || matchCode.startsWith("#M");
}

/**
 * Format event label for dropdowns/selectors
 * WC: "M73 — Team A vs Team B — 28 Jun"
 * Regular: "28 Jun — Team A vs Team B"
 */
export function formatEventLabel(
  homeTeam: string,
  awayTeam: string,
  eventDate: string,
  matchCode?: string | null,
  dateFormat: "short" | "long" = "short"
): string {
  const matchNum = getMatchNumber(matchCode);
  const d = new Date(eventDate);
  const dateStr = dateFormat === "long"
    ? d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

  if (matchNum) {
    return `M${matchNum} — ${homeTeam} vs ${awayTeam} — ${dateStr}`;
  }
  return `${dateStr} — ${homeTeam} vs ${awayTeam}`;
}

/**
 * Format event title for headers/detail views
 * WC: "Match 73 — Team A vs Team B"
 * Regular: "Team A vs Team B"
 */
export function formatEventTitle(
  homeTeam: string,
  awayTeam: string,
  matchCode?: string | null
): string {
  const matchNum = getMatchNumber(matchCode);
  if (matchNum) {
    return `Match ${matchNum} — ${homeTeam} vs ${awayTeam}`;
  }
  return `${homeTeam} vs ${awayTeam}`;
}

/**
 * Get a short match badge label like "M73" for WC events
 */
export function getMatchBadge(matchCode: string | undefined | null): string | null {
  const num = getMatchNumber(matchCode);
  return num ? `M${num}` : null;
}
