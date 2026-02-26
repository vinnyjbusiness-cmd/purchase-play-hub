import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface IJKRow {
  inventoryId: string;
  event: string;
  eventDate: string;
  section: string;
  seat: string;
  costPrice: number;
  salePrice: number;
  fees: number;
  netProfit: number;
  ijkShare: number;
  status: string;
}

export default function IJKAccount() {
  const [rows, setRows] = useState<IJKRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Get all IJK-sourced inventory with event info
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, section, block, row_name, seat, face_value, status, purchase_id, event_id, events(home_team, away_team, event_date)")
      .eq("source", "IJK");

    if (!inv || inv.length === 0) { setRows([]); setLoading(false); return; }

    const invIds = inv.map(i => i.id);

    // Get order_lines for these inventory items
    const { data: orderLines } = await supabase
      .from("order_lines")
      .select("inventory_id, order_id")
      .in("inventory_id", invIds);

    // Get unique order IDs
    const orderIds = [...new Set((orderLines || []).map(ol => ol.order_id))];
    const orderMap = new Map<string, { sale_price: number; fees: number; quantity: number }>();
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, sale_price, fees, quantity")
        .in("id", orderIds);
      (orders || []).forEach(o => orderMap.set(o.id, { sale_price: o.sale_price, fees: o.fees, quantity: o.quantity }));
    }

    // Map inventory_id -> order
    const invToOrder = new Map<string, { sale_price: number; fees: number; quantity: number }>();
    (orderLines || []).forEach(ol => {
      const order = orderMap.get(ol.order_id);
      if (order) invToOrder.set(ol.inventory_id, order);
    });

    // Get purchase costs
    const purchaseIds = [...new Set(inv.map(i => i.purchase_id).filter(Boolean))] as string[];
    const purchaseMap = new Map<string, number>();
    if (purchaseIds.length > 0) {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, unit_cost")
        .in("id", purchaseIds);
      (purchases || []).forEach(p => purchaseMap.set(p.id, p.unit_cost));
    }

    const result: IJKRow[] = inv.map(item => {
      const evt = item.events as any;
      const order = invToOrder.get(item.id);
      const costPrice = item.purchase_id ? (purchaseMap.get(item.purchase_id) || 0) : (item.face_value || 0);
      const perTicketSale = order ? (order.sale_price - order.fees) / order.quantity : 0;
      const netProfit = perTicketSale - costPrice;

      return {
        inventoryId: item.id,
        event: evt ? `${evt.home_team} vs ${evt.away_team}` : "Unknown",
        eventDate: evt?.event_date || "",
        section: [item.section, item.block, item.row_name].filter(Boolean).join(" / "),
        seat: item.seat || "—",
        costPrice,
        salePrice: perTicketSale,
        fees: order ? order.fees / order.quantity : 0,
        netProfit,
        ijkShare: netProfit > 0 ? netProfit * 0.5 : 0,
        status: order ? "Sold" : item.status,
      };
    });

    setRows(result.sort((a, b) => a.event.localeCompare(b.event)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCost = rows.reduce((s, r) => s + r.costPrice, 0);
  const totalSale = rows.reduce((s, r) => s + r.salePrice, 0);
  const totalProfit = rows.reduce((s, r) => s + r.netProfit, 0);
  const totalIJK = rows.reduce((s, r) => s + r.ijkShare, 0);
  const soldRows = rows.filter(r => r.status === "Sold");

  const exportCSV = () => {
    const headers = ["Event", "Date", "Section", "Seat", "Cost Price", "Sale Price", "Fees", "Net Profit", "IJK Share (50%)"];
    const csvRows = rows.map(r => [
      r.event, r.eventDate ? format(new Date(r.eventDate), "dd/MM/yyyy") : "", r.section, r.seat,
      r.costPrice.toFixed(2), r.salePrice.toFixed(2), r.fees.toFixed(2), r.netProfit.toFixed(2), r.ijkShare.toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ijk-account-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("IJK report exported");
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IJK Account</h1>
          <p className="text-muted-foreground text-sm">Itemised profit split for IJK-sourced inventory</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Tickets</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold font-mono">{rows.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold font-mono">£{totalSale.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Net Profit</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold font-mono">£{totalProfit.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-destructive">IJK Owed (50%)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold font-mono text-destructive">£{totalIJK.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead className="text-right">Net Profit</TableHead>
              <TableHead className="text-right">IJK 50%</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No IJK-sourced inventory found</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.inventoryId}>
                <TableCell className="font-medium text-sm">{r.event}</TableCell>
                <TableCell className="text-sm">{r.section || "—"}</TableCell>
                <TableCell className="font-mono text-sm">{r.seat}</TableCell>
                <TableCell className="text-right font-mono text-sm">£{r.costPrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm">£{r.salePrice.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm">£{r.netProfit.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-bold">£{r.ijkShare.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "Sold" ? "default" : "outline"} className="text-[10px]">{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/30 font-bold">
                <TableCell colSpan={3}>Totals</TableCell>
                <TableCell className="text-right font-mono">£{totalCost.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">£{totalSale.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">£{totalProfit.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">£{totalIJK.toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{soldRows.length} sold</Badge></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
