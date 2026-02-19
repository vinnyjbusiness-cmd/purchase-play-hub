import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Globe, Bot, CreditCard, Send, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformInfo {
  id: string;
  name: string;
}

interface HealthCheck {
  name: string;
  status: "ok" | "error" | "pending";
  message: string;
  icon: typeof Activity;
}

interface PlatformHealth {
  platform: PlatformInfo;
  checks: HealthCheck[];
}

export default function Health() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [systemChecks, setSystemChecks] = useState<HealthCheck[]>([]);
  const [platformHealths, setPlatformHealths] = useState<PlatformHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runChecks = async () => {
    setLoading(true);

    // Fetch platforms
    const { data: platData, error: platError } = await supabase.from("platforms").select("id,name").order("name");
    const plats = platData || [];
    setPlatforms(plats);

    // System-level checks
    const sysChecks: HealthCheck[] = [];

    // 1. Database connectivity
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from("events").select("id").limit(1);
    const dbTime = Date.now() - dbStart;
    sysChecks.push({
      name: "Database Connection",
      status: dbError ? "error" : "ok",
      message: dbError ? `Connection failed: ${dbError.message}` : `Connected (${dbTime}ms)`,
      icon: Database,
    });

    // 2. Auth service
    const { data: sessionData, error: authError } = await supabase.auth.getSession();
    sysChecks.push({
      name: "Authentication Service",
      status: authError ? "error" : sessionData.session ? "ok" : "error",
      message: authError ? `Auth error: ${authError.message}` : sessionData.session ? "Authenticated & active" : "No active session",
      icon: Activity,
    });

    // 3. Data integrity - orders with events
    const { data: ordersData } = await supabase.from("orders").select("id,event_id");
    const { data: eventsData } = await supabase.from("events").select("id");
    const eventIds = new Set((eventsData || []).map(e => e.id));
    const orphanedOrders = (ordersData || []).filter(o => !eventIds.has(o.event_id));
    sysChecks.push({
      name: "Data Integrity",
      status: orphanedOrders.length > 0 ? "error" : "ok",
      message: orphanedOrders.length > 0 ? `${orphanedOrders.length} orders with missing events` : "All references valid",
      icon: Database,
    });

    setSystemChecks(sysChecks);

    // Per-platform checks
    const platHealths: PlatformHealth[] = plats.map((p) => {
      const checks: HealthCheck[] = [];

      // API Connection placeholder
      checks.push({
        name: "API Connection",
        status: "pending",
        message: "Not configured — connect API to enable",
        icon: Globe,
      });

      // Listing Sync script placeholder
      checks.push({
        name: "Listing Sync Script",
        status: "pending",
        message: "Placeholder — script not yet integrated",
        icon: RefreshCw,
      });

      // Order Import script placeholder
      checks.push({
        name: "Order Import Script",
        status: "pending",
        message: "Placeholder — script not yet integrated",
        icon: Send,
      });

      // Payment Webhook placeholder
      checks.push({
        name: "Payment Webhook",
        status: "pending",
        message: "Placeholder — webhook not yet configured",
        icon: CreditCard,
      });

      // Price Bot placeholder
      checks.push({
        name: "Price Bot / Auto-Pricer",
        status: "pending",
        message: "Placeholder — bot not yet integrated",
        icon: Bot,
      });

      return { platform: p, checks };
    });

    setPlatformHealths(platHealths);
    setLastChecked(new Date());
    setLoading(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const statusBadge = (status: "ok" | "error" | "pending") => {
    switch (status) {
      case "ok":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle className="h-3 w-3" /> Healthy</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const overallSystemStatus = systemChecks.length > 0
    ? systemChecks.every(c => c.status === "ok") ? "ok" : systemChecks.some(c => c.status === "error") ? "error" : "pending"
    : "pending";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Check</h1>
          <p className="text-muted-foreground">
            System status, API connections & script monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={runChecks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Checking..." : "Re-check"}
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">System Health</CardTitle>
          {statusBadge(overallSystemStatus)}
        </CardHeader>
        <CardContent className="space-y-3">
          {systemChecks.map((check, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <check.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
              {statusBadge(check.status)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Per-platform health */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Platform Scripts & APIs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformHealths.map((ph) => {
            const overallPlatStatus = ph.checks.every(c => c.status === "ok")
              ? "ok"
              : ph.checks.some(c => c.status === "error")
              ? "error"
              : "pending";

            return (
              <Card key={ph.platform.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {ph.platform.name}
                  </CardTitle>
                  {statusBadge(overallPlatStatus)}
                </CardHeader>
                <CardContent className="space-y-2">
                  {ph.checks.map((check, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <check.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{check.name}</span>
                      </div>
                      {check.status === "ok" ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : check.status === "error" ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
