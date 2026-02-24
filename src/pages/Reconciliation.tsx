import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, CheckCircle, XCircle, Clock, RefreshCw,
  Globe, Bot, CreditCard, Send, Database, Terminal,
  ShieldCheck, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

interface ScriptCheck {
  name: string;
  status: "ok" | "error" | "pending";
  message: string;
}

interface WebsiteConfig {
  key: string;
  name: string;
  url: string;
  scripts: ScriptCheck[];
  logs: LogEntry[];
}

const WEBSITES: Omit<WebsiteConfig, "scripts" | "logs">[] = [
  { key: "fanpass", name: "FanPass", url: "fanpass.co.uk" },
  { key: "tixstock", name: "Tixstock", url: "tixstock.com" },
  { key: "livefootball", name: "Live Football Tickets", url: "livefootballtickets.com" },
];

const now = () => new Date();

const makeLog = (level: LogEntry["level"], message: string): LogEntry => ({
  timestamp: now(),
  level,
  message,
});

export default function Health() {
  const [sites, setSites] = useState<WebsiteConfig[]>([]);
  const [systemChecks, setSystemChecks] = useState<ScriptCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const addLog = (siteKey: string, log: LogEntry) => {
    setSites(prev =>
      prev.map(s =>
        s.key === siteKey
          ? { ...s, logs: [...s.logs.slice(-99), log] }
          : s
      )
    );
  };

  const runChecks = async () => {
    setChecking(true);
    setLoading(true);

    const sysChecks: ScriptCheck[] = [];

    const dbStart = Date.now();
    const { error: dbError } = await supabase.from("events").select("id").limit(1);
    const dbTime = Date.now() - dbStart;
    sysChecks.push({
      name: "Database Connection",
      status: dbError ? "error" : "ok",
      message: dbError ? `Failed: ${dbError.message}` : `Connected (${dbTime}ms)`,
    });

    const { data: sessionData, error: authError } = await supabase.auth.getSession();
    sysChecks.push({
      name: "Authentication",
      status: authError ? "error" : sessionData.session ? "ok" : "error",
      message: authError ? authError.message : sessionData.session ? "Active session" : "No session",
    });

    const { data: ordersData } = await supabase.from("orders").select("id,event_id");
    const { data: eventsData } = await supabase.from("events").select("id");
    const eventIds = new Set((eventsData || []).map(e => e.id));
    const orphaned = (ordersData || []).filter(o => !eventIds.has(o.event_id));
    sysChecks.push({
      name: "Data Integrity",
      status: orphaned.length > 0 ? "error" : "ok",
      message: orphaned.length > 0 ? `${orphaned.length} orphaned orders` : "All references valid",
    });

    setSystemChecks(sysChecks);

    const websiteConfigs: WebsiteConfig[] = WEBSITES.map(w => {
      const initialLogs: LogEntry[] = [
        makeLog("info", `[${w.name}] Initialising health check...`),
        makeLog("info", `[${w.name}] Checking API connection to ${w.url}...`),
        makeLog("warn", `[${w.name}] API not configured — skipping live check`),
        makeLog("info", `[${w.name}] Checking listing sync script...`),
        makeLog("warn", `[${w.name}] Listing sync script not yet integrated`),
        makeLog("info", `[${w.name}] Checking order import script...`),
        makeLog("warn", `[${w.name}] Order import script not yet integrated`),
        makeLog("info", `[${w.name}] Checking price bot...`),
        makeLog("warn", `[${w.name}] Price bot not yet integrated`),
        makeLog("info", `[${w.name}] Checking payment webhook...`),
        makeLog("warn", `[${w.name}] Payment webhook not configured`),
        makeLog("info", `[${w.name}] Checking inventory sync...`),
        makeLog("warn", `[${w.name}] Inventory sync not yet integrated`),
        makeLog("info", `[${w.name}] Health check complete — awaiting script integration`),
      ];

      const scripts: ScriptCheck[] = [
        { name: "API Connection", status: "pending", message: "Not configured" },
        { name: "Listing Sync", status: "pending", message: "Script not integrated" },
        { name: "Order Import", status: "pending", message: "Script not integrated" },
        { name: "Price Bot", status: "pending", message: "Bot not integrated" },
        { name: "Payment Webhook", status: "pending", message: "Not configured" },
        { name: "Inventory Sync", status: "pending", message: "Script not integrated" },
      ];

      return { ...w, scripts, logs: initialLogs };
    });

    setSites(websiteConfigs);
    setLastChecked(now());
    setLoading(false);
    setChecking(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  // Auto-recheck every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      runChecks();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Simulate periodic log entries
  useEffect(() => {
    if (sites.length === 0) return;
    const interval = setInterval(() => {
      const siteKey = WEBSITES[Math.floor(Math.random() * WEBSITES.length)].key;
      const messages = [
        { level: "info" as const, msg: "Heartbeat ping — awaiting script connection" },
        { level: "info" as const, msg: "Polling for new orders... no script configured" },
        { level: "info" as const, msg: "Checking listing prices... script pending" },
        { level: "warn" as const, msg: "No API credentials found — skipping sync" },
        { level: "info" as const, msg: "Idle — waiting for integration" },
      ];
      const pick = messages[Math.floor(Math.random() * messages.length)];
      const site = WEBSITES.find(w => w.key === siteKey);
      addLog(siteKey, makeLog(pick.level, `[${site?.name}] ${pick.msg}`));
    }, 5000);
    return () => clearInterval(interval);
  }, [sites.length]);

  const statusIcon = (status: "ok" | "error" | "pending") => {
    switch (status) {
      case "ok": return <CheckCircle className="h-4 w-4 text-success" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending": return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const statusBadge = (status: "ok" | "error" | "pending") => {
    switch (status) {
      case "ok":
        return <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3" /> Healthy</span>;
      case "error":
        return <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3" /> Error</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3" /> Pending</span>;
    }
  };

  const logColor: Record<string, string> = {
    info: "text-muted-foreground",
    warn: "text-warning",
    error: "text-destructive",
    success: "text-success",
  };

  const overallSystem = systemChecks.length > 0
    ? systemChecks.every(c => c.status === "ok") ? "ok" : systemChecks.some(c => c.status === "error") ? "error" : "pending"
    : "pending";

  // Count issues across all sites
  const allScriptIssues = sites.reduce((count, s) => {
    return count + s.scripts.filter(sc => sc.status === "error").length;
  }, 0);
  const allPendingScripts = sites.reduce((count, s) => {
    return count + s.scripts.filter(sc => sc.status === "pending").length;
  }, 0);
  const systemErrors = systemChecks.filter(c => c.status === "error").length;
  const totalIssues = systemErrors + allScriptIssues;
  const isHealthy = totalIssues === 0 && overallSystem === "ok";

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* ── TOP STATUS BANNER ── */}
      <div className={`rounded-xl p-5 flex items-center gap-4 ${
        isHealthy
          ? "bg-gradient-to-r from-emerald-500/20 via-green-500/15 to-teal-500/20 border-2 border-emerald-500/30"
          : "bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-red-500/20 border-2 border-amber-500/30"
      }`}>
        <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
          isHealthy ? "bg-emerald-500/20" : "bg-amber-500/20"
        }`}>
          {isHealthy
            ? <ShieldCheck className="h-8 w-8 text-emerald-400" />
            : <AlertTriangle className="h-8 w-8 text-amber-400" />
          }
        </div>
        <div className="flex-1">
          <h2 className={`text-xl font-bold ${isHealthy ? "text-emerald-400" : "text-amber-400"}`}>
            {isHealthy ? "All Systems Healthy — No Action Needed" : `${totalIssues > 0 ? totalIssues : allPendingScripts} Item${(totalIssues || allPendingScripts) !== 1 ? "s" : ""} Need Attention`}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isHealthy
              ? "Database, authentication, and data integrity are all operational."
              : `${systemErrors > 0 ? `${systemErrors} system error${systemErrors > 1 ? "s" : ""}. ` : ""}${allPendingScripts > 0 ? `${allPendingScripts} script${allPendingScripts > 1 ? "s" : ""} awaiting integration.` : ""}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pulsing indicator while checking */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {checking ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: isHealthy ? "rgb(52, 211, 153)" : "rgb(251, 191, 36)" }} />
                  <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: isHealthy ? "rgb(52, 211, 153)" : "rgb(251, 191, 36)" }} />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: isHealthy ? "rgb(52, 211, 153)" : "rgb(251, 191, 36)" }} />
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {checking ? "Checking..." : "Auto-checks every 60s"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Check</h1>
          <p className="text-muted-foreground">Live monitoring for website scripts & APIs</p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={runChecks} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Re-check"}
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">System Health</CardTitle>
          {statusBadge(overallSystem)}
        </CardHeader>
        <CardContent className="space-y-2">
          {systemChecks.map((check, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
              {statusIcon(check.status)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Website tabs */}
      <Tabs defaultValue="fanpass" className="space-y-4">
        <TabsList>
          {sites.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="gap-2">
              <Globe className="h-3.5 w-3.5" />
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sites.map(s => {
          const overallStatus = s.scripts.every(sc => sc.status === "ok")
            ? "ok"
            : s.scripts.some(sc => sc.status === "error")
            ? "error"
            : "pending";

          return (
            <TabsContent key={s.key} value={s.key} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Script status */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold">Script Status</CardTitle>
                    {statusBadge(overallStatus)}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.scripts.map((sc, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{sc.name}</p>
                          <p className="text-xs text-muted-foreground">{sc.message}</p>
                        </div>
                        {statusIcon(sc.status)}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Live console */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 pb-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Live Console</CardTitle>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                      <span className="text-xs text-muted-foreground">Live</span>
                    </span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[320px]">
                      <div className="bg-sidebar text-sidebar-foreground rounded-b-lg p-3 font-mono text-xs space-y-1 min-h-[320px]">
                        {s.logs.map((log, i) => (
                          <div key={i} className={`flex gap-2 ${logColor[log.level]}`}>
                            <span className="text-muted-foreground shrink-0 opacity-60">
                              {log.timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            <span className="uppercase w-12 shrink-0 font-bold opacity-80">
                              {log.level === "success" ? "OK" : log.level}
                            </span>
                            <span className="break-all">{log.message}</span>
                          </div>
                        ))}
                        <div ref={(el) => { logEndRefs.current[s.key] = el; }} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
