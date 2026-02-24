import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";

  const isMobile = /Mobi|Android/i.test(ua);
  return { browser, os, device: isMobile ? "Mobile" : "Desktop", user_agent: ua };
}

async function logAction(action: string, tableName: string, details?: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const metadata = { ...getDeviceInfo(), ...details };

  await supabase.from("audit_log").insert({
    table_name: tableName,
    action,
    user_id: user.id,
    new_values: details ? details : null,
    metadata,
  });
}

/** Tracks auth events (login/logout) and page navigation */
export function useAuditTracker() {
  const location = useLocation();
  const prevPath = useRef<string | null>(null);
  const pageEnteredAt = useRef<number>(Date.now());

  // Track auth events
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        logAction("LOGIN", "auth", { event: "login" });
      } else if (event === "SIGNED_OUT") {
        logAction("LOGOUT", "auth", { event: "logout" });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Track page navigation with time spent
  useEffect(() => {
    const now = Date.now();
    if (prevPath.current && prevPath.current !== location.pathname) {
      const secondsSpent = Math.round((now - pageEnteredAt.current) / 1000);
      logAction("PAGE_VIEW", "navigation", {
        page: prevPath.current,
        seconds_spent: secondsSpent,
      });
    }
    prevPath.current = location.pathname;
    pageEnteredAt.current = now;
  }, [location.pathname]);
}
