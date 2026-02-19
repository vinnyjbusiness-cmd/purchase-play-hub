import { addDays, nextFriday, isFriday, isWeekend, getDay, previousFriday } from "date-fns";

/**
 * Platform-specific payout date calculators.
 *
 * Tixstock: Every Friday batch. After an event, the next Friday is the payout.
 *
 * FootballTicketNet: 1 week after event. But if the event is Tue–Fri,
 * it misses that week's Friday payout → pushed to the following Friday.
 * If Mon, payout is that same Friday (5 days later).
 *
 * FanPass: 5 calendar days after event to initiate payment.
 * If initiation lands on Sat/Sun, push to Monday.
 * Then allow +1 day for processing → final payout is initiation day + 1
 * (if that's also a weekend, push again).
 */

export type PlatformPayoutRule = "tixstock" | "footballticketnet" | "fanpass" | "default";

/** Normalise a platform name to a known rule key */
export function getPlatformRule(name: string | null): PlatformPayoutRule {
  if (!name) return "default";
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  if (n.includes("tixstock")) return "tixstock";
  if (n.includes("footballticketnet") || n.includes("ftn")) return "footballticketnet";
  if (n.includes("fanpass")) return "fanpass";
  return "default";
}

/** Push a date forward if it falls on a weekend → Monday */
function skipWeekend(d: Date): Date {
  const day = d.getDay();
  if (day === 6) return addDays(d, 2); // Sat → Mon
  if (day === 0) return addDays(d, 1); // Sun → Mon
  return d;
}

/** Get the next Friday on or after a given date */
function nextFridayOnOrAfter(d: Date): Date {
  if (isFriday(d)) return d;
  return nextFriday(d);
}

export function calculatePayoutDate(eventDate: Date, rule: PlatformPayoutRule): Date {
  switch (rule) {
    case "tixstock": {
      // Payout is the next Friday after the event
      return nextFridayOnOrAfter(addDays(eventDate, 1)); // at least 1 day after
    }
    case "footballticketnet": {
      // Event on Monday (1) → payout same week Friday
      // Event on Tue(2)-Fri(5) → misses that week, payout NEXT Friday
      const dow = getDay(eventDate); // 0=Sun 1=Mon
      if (dow === 1) {
        // Monday event → this Friday (4 days later)
        return addDays(eventDate, 4);
      }
      // Tue-Sun: next Friday after the event + 7 days (skip a week)
      const oneWeekLater = addDays(eventDate, 7);
      return nextFridayOnOrAfter(oneWeekLater);
    }
    case "fanpass": {
      // 5 days after event to initiate
      let initiation = addDays(eventDate, 5);
      initiation = skipWeekend(initiation);
      // +1-2 days processing, skip weekend
      let payout = addDays(initiation, 1);
      payout = skipWeekend(payout);
      return payout;
    }
    default: {
      // Generic: 7 days after event, skip weekend
      return skipWeekend(addDays(eventDate, 7));
    }
  }
}

/** Platform brand colors (HSL-based tailwind classes) */
export const PLATFORM_COLORS: Record<PlatformPayoutRule, { bg: string; border: string; text: string; dot: string; label: string }> = {
  tixstock: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    dot: "bg-blue-500",
    label: "Tixstock",
  },
  footballticketnet: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-500",
    label: "FootballTicketNet",
  },
  fanpass: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
    label: "FanPass",
  },
  default: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    dot: "bg-purple-500",
    label: "Other",
  },
};
