import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import IJKBalanceCard, { GameBalance } from "@/components/ijk/IJKBalanceCard";
import IJKGameCard, { IJKGameData, IJKTicket, IJKReplacement } from "@/components/ijk/IJKGameCard";
import IJKRecordPaymentDialog from "@/components/ijk/IJKRecordPaymentDialog";
import IJKMemberSheetDialog from "@/components/ijk/IJKMemberSheetDialog";

export default function IJKAccount() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [replacements, setReplacements] = useState<any[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [invRes, olRes, settRes, payRes, repRes] = await Promise.all([
      supabase
        .from("inventory")
        .select("id, first_name, last_name, email, section, block, row_name, seat, face_value, status, source, event_id, purchase_id, events(home_team, away_team, event_date, match_code)")
        .eq("source", "IJK"),
      supabase.from("order_lines").select("inventory_id, order_id"),
      supabase.from("ijk_settlements" as any).select("*"),
      supabase.from("ijk_payments" as any).select("*"),
      supabase.from("ijk_replacements" as any).select("*"),
    ]);

    const inv = (invRes.data || []) as any[];
    const ol = (olRes.data || []) as any[];
    setInventory(inv);
    setOrderLines(ol);
    setSettlements((settRes.data || []) as any[]);
    setPayments((payRes.data || []) as any[]);
    setReplacements((repRes.data || []) as any[]);

    // Fetch orders for sold tickets
    const invIds = inv.map(i => i.id);
    const relevantOL = ol.filter(l => invIds.includes(l.inventory_id));
    const orderIds = [...new Set(relevantOL.map(l => l.order_id))];

    if (orderIds.length > 0) {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, sale_price, fees, quantity")
        .in("id", orderIds);
      setOrders(ordersData || []);
    } else {
      setOrders([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build order lookup: inventory_id -> per-ticket sale price
  const invSaleMap = useMemo(() => {
    const orderMap = new Map(orders.map(o => [o.id, o]));
    const m = new Map<string, number>();
    for (const ol of orderLines) {
      const order = orderMap.get(ol.order_id);
      if (order) {
        m.set(ol.inventory_id, (order.sale_price - order.fees) / order.quantity);
      }
    }
    return m;
  }, [orders, orderLines]);

  // Group inventory by event
  const games: IJKGameData[] = useMemo(() => {
    const eventMap = new Map<string, any[]>();
    for (const item of inventory) {
      const list = eventMap.get(item.event_id) || [];
      list.push(item);
      eventMap.set(item.event_id, list);
    }

    const settlementMap = new Map(settlements.map((s: any) => [s.event_id, s]));

    return Array.from(eventMap.entries()).map(([eventId, items]) => {
      const evt = items[0]?.events as any;
      const settlement = settlementMap.get(eventId);

      const tickets: IJKTicket[] = items.map(item => ({
        id: item.id,
        firstName: item.first_name,
        lastName: item.last_name,
        email: item.email,
        section: item.section,
        block: item.block,
        rowName: item.row_name,
        seat: item.seat,
        faceValue: item.face_value || 0,
        salePrice: invSaleMap.get(item.id) || 0,
        status: invSaleMap.has(item.id) ? "sold" : item.status,
        isBanned: item.status === "cancelled",
      }));

      const gameReplacements: IJKReplacement[] = (replacements as any[])
        .filter((r: any) => r.event_id === eventId)
        .map((r: any) => ({
          id: r.id,
          bannedInventoryId: r.banned_inventory_id,
          replacementInventoryId: r.replacement_inventory_id,
          replacementCost: r.replacement_cost,
          originalCost: r.original_cost,
        }));

      return {
        eventId,
        matchName: evt ? `${evt.home_team} vs ${evt.away_team}` : "Unknown",
        eventDate: evt?.event_date || "",
        tickets,
        replacements: gameReplacements,
        settlementStatus: (settlement?.status || "pending") as "pending" | "balance_added" | "settled",
        settlementId: settlement?.id || null,
      };
    }).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [inventory, invSaleMap, settlements, replacements]);

  // Balance calculations
  const gameBalances: GameBalance[] = useMemo(() =>
    games.map(g => {
      const totalCost = g.tickets.reduce((s, t) => s + t.faceValue, 0);
      const totalRevenue = g.tickets.filter(t => t.status === "sold").reduce((s, t) => s + t.salePrice, 0);
      const repExtra = g.replacements.reduce((s, r) => s + Math.max(0, r.replacementCost - r.originalCost), 0);
      const netProfit = totalRevenue - totalCost - repExtra;
      const ijkShare = netProfit / 2;
      return {
        eventId: g.eventId,
        matchName: g.matchName,
        eventDate: g.eventDate,
        ijkShare,
        status: g.settlementStatus,
      };
    }), [games]);

  const totalPayments = useMemo(() =>
    (payments as any[]).reduce((s: number, p: any) =>
      s + (p.direction === "to_ijk" ? p.amount : -p.amount), 0
    ), [payments]);

  const gameOptions = useMemo(() =>
    games.map(g => ({ eventId: g.eventId, label: g.matchName, date: g.eventDate })),
    [games]);

  const exportFullCSV = () => {
    const headers = ["Event", "Date", "Name", "Email", "Section", "Block", "Row", "Seat", "Face Value", "Sale Price", "Status", "IJK Share"];
    const rows = games.flatMap(g => {
      const totalCost = g.tickets.reduce((s, t) => s + t.faceValue, 0);
      const totalRevenue = g.tickets.filter(t => t.status === "sold").reduce((s, t) => s + t.salePrice, 0);
      const repExtra = g.replacements.reduce((s, r) => s + Math.max(0, r.replacementCost - r.originalCost), 0);
      const netProfit = totalRevenue - totalCost - repExtra;
      const ijkShare = netProfit / 2;
      return g.tickets.map((t, i) => [
        g.matchName,
        g.eventDate ? format(new Date(g.eventDate), "dd/MM/yyyy") : "",
        [t.firstName, t.lastName].filter(Boolean).join(" "),
        t.email || "",
        t.section || "",
        t.block || "",
        t.rowName || "",
        t.seat || "",
        t.faceValue.toFixed(2),
        t.status === "sold" ? t.salePrice.toFixed(2) : "",
        t.isBanned ? "Banned" : t.status,
        i === 0 ? ijkShare.toFixed(2) : "",
      ]);
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ijk-full-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("IJK report exported");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground animate-pulse">Loading IJK data…</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IJK Account</h1>
          <p className="text-muted-foreground text-sm">50/50 profit split · Auto-populated from inventory</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setSheetDialogOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Generate Member Sheet
          </Button>
          <Button variant="outline" size="sm" onClick={exportFullCSV} disabled={games.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Running Balance */}
      <IJKBalanceCard
        gameBalances={gameBalances}
        totalPayments={totalPayments}
        onRecordPayment={() => setPaymentDialogOpen(true)}
      />

      {/* Game Cards */}
      {games.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No IJK-sourced inventory found</p>
          <p className="text-sm mt-1">Tickets with Source = "IJK" will automatically appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Games ({games.length})</h2>
          {games.map((g, i) => (
            <IJKGameCard key={g.eventId} game={g} index={i} orgId={orgId} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <IJKRecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        orgId={orgId}
        onSaved={load}
      />
      <IJKMemberSheetDialog
        open={sheetDialogOpen}
        onOpenChange={setSheetDialogOpen}
        games={gameOptions}
      />
    </div>
  );
}
