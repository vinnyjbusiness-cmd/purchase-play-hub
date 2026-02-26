import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function downloadCSV(filename: string, headers: string[], rows?: string[][]) {
  const content = rows ? [headers, ...rows] : [headers];
  const csv = content.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

const MEMBER_HEADERS = ["First Name", "Last Name", "Supporter ID", "Email", "Member Password", "Email Password", "Phone", "DOB", "Postcode", "Address"];
const SALES_HEADERS = ["Event", "Match Date", "Ticket Category", "Seat Details", "Cost Price", "Sale Price", "Platform Sold On", "Buyer Name", "Sale Date", "Profit", "Source", "IJK 50% Split Amount"];
const IJK_HEADERS = ["Event", "Tickets Sold", "Total Revenue", "Total Cost", "Net Profit", "IJK Share (50%)"];

export default function SpreadsheetTemplates() {
  const [loading, setLoading] = useState<string | null>(null);

  const fillMembers = async () => {
    setLoading("members");
    const { data } = await supabase.from("members").select("*").order("last_name");
    const rows = (data || []).map(m => [
      m.first_name, m.last_name, m.supporter_id || "", m.email || "",
      m.member_password || "", m.email_password || "", m.phone_number || "",
      m.date_of_birth || "", m.postcode || "", m.address || "",
    ]);
    downloadCSV(`members-export-${format(new Date(), "yyyy-MM-dd")}.csv`, MEMBER_HEADERS, rows);
    setLoading(null);
  };

  const fillSales = async () => {
    setLoading("sales");
    // Get inventory with events, order_lines->orders, purchases
    const { data: inv } = await supabase
      .from("inventory")
      .select("*, events(home_team, away_team, event_date)");

    const invIds = (inv || []).map(i => i.id);
    const { data: orderLines } = await supabase.from("order_lines").select("inventory_id, order_id").in("inventory_id", invIds.length ? invIds : ["none"]);

    const orderIds = [...new Set((orderLines || []).map(ol => ol.order_id))];
    const orderMap = new Map<string, any>();
    if (orderIds.length) {
      const { data: orders } = await supabase.from("orders").select("id, sale_price, fees, quantity, buyer_name, order_date, platform_id").in("id", orderIds);
      (orders || []).forEach(o => orderMap.set(o.id, o));
    }
    const invToOrder = new Map<string, any>();
    (orderLines || []).forEach(ol => { const o = orderMap.get(ol.order_id); if (o) invToOrder.set(ol.inventory_id, o); });

    // Platforms
    const platformIds = [...new Set([...orderMap.values()].map(o => o.platform_id).filter(Boolean))];
    const platformMap = new Map<string, string>();
    if (platformIds.length) {
      const { data: plats } = await supabase.from("platforms").select("id, name").in("id", platformIds);
      (plats || []).forEach(p => platformMap.set(p.id, p.name));
    }

    // Purchases
    const purchaseIds = [...new Set((inv || []).map(i => i.purchase_id).filter(Boolean))] as string[];
    const purchaseMap = new Map<string, number>();
    if (purchaseIds.length) {
      const { data: purch } = await supabase.from("purchases").select("id, unit_cost").in("id", purchaseIds);
      (purch || []).forEach(p => purchaseMap.set(p.id, p.unit_cost));
    }

    const rows = (inv || []).map(item => {
      const evt = item.events as any;
      const order = invToOrder.get(item.id);
      const costPrice = item.purchase_id ? (purchaseMap.get(item.purchase_id) || 0) : (item.face_value || 0);
      const perTicketSale = order ? (order.sale_price - order.fees) / order.quantity : 0;
      const profit = perTicketSale - costPrice;
      const source = (item as any).source || "IJK";
      const ijkSplit = source === "IJK" && profit > 0 ? (profit * 0.5).toFixed(2) : "0.00";

      return [
        evt ? `${evt.home_team} vs ${evt.away_team}` : "",
        evt?.event_date ? format(new Date(evt.event_date), "dd/MM/yyyy") : "",
        item.category || "",
        [item.section, item.block, item.row_name, item.seat].filter(Boolean).join(" / "),
        costPrice.toFixed(2),
        perTicketSale.toFixed(2),
        order?.platform_id ? (platformMap.get(order.platform_id) || "") : "",
        order?.buyer_name || "",
        order?.order_date ? format(new Date(order.order_date), "dd/MM/yyyy") : "",
        profit.toFixed(2),
        source,
        ijkSplit,
      ];
    });

    downloadCSV(`inventory-sales-export-${format(new Date(), "yyyy-MM-dd")}.csv`, SALES_HEADERS, rows);
    setLoading(null);
  };

  const fillIJK = async () => {
    setLoading("ijk");
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, face_value, purchase_id, event_id, events(home_team, away_team)")
      .eq("source", "IJK");

    const invIds = (inv || []).map(i => i.id);
    const { data: orderLines } = await supabase.from("order_lines").select("inventory_id, order_id").in("inventory_id", invIds.length ? invIds : ["none"]);
    const orderIds = [...new Set((orderLines || []).map(ol => ol.order_id))];
    const orderMap = new Map<string, any>();
    if (orderIds.length) {
      const { data: orders } = await supabase.from("orders").select("id, sale_price, fees, quantity").in("id", orderIds);
      (orders || []).forEach(o => orderMap.set(o.id, o));
    }
    const invToOrder = new Map<string, any>();
    (orderLines || []).forEach(ol => { const o = orderMap.get(ol.order_id); if (o) invToOrder.set(ol.inventory_id, o); });

    const purchaseIds = [...new Set((inv || []).map(i => i.purchase_id).filter(Boolean))] as string[];
    const purchaseMap = new Map<string, number>();
    if (purchaseIds.length) {
      const { data: purch } = await supabase.from("purchases").select("id, unit_cost").in("id", purchaseIds);
      (purch || []).forEach(p => purchaseMap.set(p.id, p.unit_cost));
    }

    // Group by event
    const eventGroups = new Map<string, { event: string; sold: number; revenue: number; cost: number }>();
    (inv || []).forEach(item => {
      const evt = item.events as any;
      const eventName = evt ? `${evt.home_team} vs ${evt.away_team}` : "Unknown";
      if (!eventGroups.has(eventName)) eventGroups.set(eventName, { event: eventName, sold: 0, revenue: 0, cost: 0 });
      const g = eventGroups.get(eventName)!;
      const order = invToOrder.get(item.id);
      const costPrice = item.purchase_id ? (purchaseMap.get(item.purchase_id) || 0) : (item.face_value || 0);
      g.cost += costPrice;
      if (order) {
        g.sold += 1;
        g.revenue += (order.sale_price - order.fees) / order.quantity;
      }
    });

    const rows = [...eventGroups.values()].map(g => {
      const profit = g.revenue - g.cost;
      return [g.event, String(g.sold), g.revenue.toFixed(2), g.cost.toFixed(2), profit.toFixed(2), (profit > 0 ? profit * 0.5 : 0).toFixed(2)];
    });

    downloadCSV(`ijk-profit-split-${format(new Date(), "yyyy-MM-dd")}.csv`, IJK_HEADERS, rows);
    setLoading(null);
  };

  const templates = [
    {
      key: "members",
      title: "Member Export",
      description: "All member fields — First Name, Last Name, Supporter ID, Email, Passwords, Phone, DOB, Postcode, Address.",
      headers: MEMBER_HEADERS,
      fill: fillMembers,
    },
    {
      key: "sales",
      title: "Inventory / Sales Export",
      description: "Full inventory with sales data, platform, buyer, profit, source, and IJK split amounts.",
      headers: SALES_HEADERS,
      fill: fillSales,
    },
    {
      key: "ijk",
      title: "IJK Profit Split Report",
      description: "Filtered to IJK-sourced inventory only, grouped by event with revenue, cost, profit, and IJK's 50% share.",
      headers: IJK_HEADERS,
      fill: fillIJK,
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Spreadsheet Templates</h1>
        <p className="text-muted-foreground text-sm">Download blank templates or export live data as CSV</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <Card key={t.key} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end gap-2">
              <p className="text-[10px] text-muted-foreground font-mono truncate">{t.headers.join(" · ")}</p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadCSV(`${t.key}-template.csv`, t.headers)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Blank
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={t.fill}
                  disabled={loading === t.key}
                >
                  {loading === t.key ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  Fill & Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
