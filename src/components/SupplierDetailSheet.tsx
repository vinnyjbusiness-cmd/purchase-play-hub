import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Package, Banknote, Clock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import LogoAvatar from "@/components/LogoAvatar";

interface Supplier {
  id: string;
  display_id: string | null;
  name: string;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

interface SupplierStats {
  totalOwed: number;
  totalPaid: number;
  totalPurchases: number;
  ticketsBought: number;
}

interface Props {
  supplier: Supplier | null;
  stats: SupplierStats;
  onClose: () => void;
  onUpdated: () => void;
}

interface PurchaseRow {
  id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
  total_cost_gbp: number | null;
  status: string;
  purchase_date: string;
  category: string;
  supplier_paid: boolean;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
}

interface BalanceRow {
  id: string;
  amount: number;
  type: string;
  payment_date: string;
  notes: string | null;
}

export default function SupplierDetailSheet({ supplier, stats, onClose, onUpdated }: Props) {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [balancePayments, setBalancePayments] = useState<BalanceRow[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supplier) return;
    setLogoUrl(supplier.logo_url);

    Promise.all([
      supabase
        .from("purchases")
        .select("id, quantity, unit_cost, total_cost, total_cost_gbp, status, purchase_date, category, supplier_paid, events(match_code, home_team, away_team, event_date)")
        .eq("supplier_id", supplier.id)
        .order("purchase_date", { ascending: false }),
      supabase
        .from("balance_payments")
        .select("id, amount, type, payment_date, notes")
        .eq("party_type", "supplier")
        .eq("party_id", supplier.id)
        .order("payment_date", { ascending: false }),
    ]).then(([purchRes, balRes]) => {
      setPurchases((purchRes.data as PurchaseRow[]) || []);
      setBalancePayments((balRes.data as BalanceRow[]) || []);
    });
  }, [supplier]);

  const statusColor: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    received: "bg-success/10 text-success border-success/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const totalSpent = purchases.reduce((s, p) => s + (p.total_cost_gbp || p.total_cost || p.quantity * p.unit_cost), 0);
  const totalTickets = purchases.reduce((s, p) => s + p.quantity, 0);
  const balance = stats.totalOwed - stats.totalPaid;

  // Timeline: combine purchases and balance payments
  const timeline = useMemo(() => {
    const items: { date: string; label: string; detail: string; type: "purchase" | "payment" }[] = [];
    purchases.forEach(p => {
      const ev = p.events ? `${p.events.home_team} vs ${p.events.away_team}` : "Unknown";
      items.push({
        date: p.purchase_date,
        label: `Purchase — ${ev}`,
        detail: `${p.quantity} × £${Number(p.unit_cost).toFixed(2)} (${p.category})`,
        type: "purchase",
      });
    });
    balancePayments.forEach(b => {
      const typeLabel = b.type === "payment" ? "Payment" : b.type === "opening_balance" ? "Opening Balance" : "Adjustment";
      items.push({
        date: b.payment_date,
        label: typeLabel,
        detail: `£${Number(b.amount).toFixed(2)}${b.notes ? ` — ${b.notes}` : ""}`,
        type: "payment",
      });
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, balancePayments]);

  return (
    <Sheet open={!!supplier} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {supplier && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <LogoAvatar
                  name={supplier.name}
                  logoUrl={logoUrl}
                  entityType="supplier"
                  entityId={supplier.id}
                  editable
                  size="lg"
                  onLogoUpdated={(url) => setLogoUrl(url)}
                />
                <div>
                  <SheetTitle className="text-lg">{supplier.name}</SheetTitle>
                  {supplier.contact_name && <p className="text-xs text-muted-foreground">{supplier.contact_name}</p>}
                  {supplier.contact_phone && <p className="text-xs text-muted-foreground">{supplier.contact_phone}</p>}
                </div>
              </div>
            </SheetHeader>

            {/* Financial summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <CreditCard className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Spent</p>
                <p className="text-sm font-bold font-mono">£{totalSpent.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Banknote className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Paid</p>
                <p className="text-sm font-bold font-mono text-success">£{stats.totalPaid.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Banknote className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                <p className={`text-sm font-bold font-mono ${balance > 0 ? "text-destructive" : "text-success"}`}>
                  £{Math.abs(balance).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p>
                <p className="text-sm font-bold font-mono">{totalTickets}</p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* All Purchases */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> All Purchases ({purchases.length})
              </h3>
              {purchases.length === 0 ? (
                <p className="text-xs text-muted-foreground">No purchases linked</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Event</TableHead>
                        <TableHead className="text-[10px] text-right">Qty</TableHead>
                        <TableHead className="text-[10px] text-right">Cost</TableHead>
                        <TableHead className="text-[10px]">Status</TableHead>
                        <TableHead className="text-[10px]">Paid</TableHead>
                        <TableHead className="text-[10px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">
                            {p.events ? `${p.events.home_team} vs ${p.events.away_team}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right">{p.quantity}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            £{Number(p.total_cost_gbp || p.total_cost || p.quantity * p.unit_cost).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${statusColor[p.status] || ""}`}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${p.supplier_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                              {p.supplier_paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(p.purchase_date), "dd MMM yy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Balance Payments */}
            {balancePayments.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Balance Payments ({balancePayments.length})
                  </h3>
                  <div className="space-y-2">
                    {balancePayments.map(b => (
                      <div key={b.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                        <div>
                          <span className="font-medium">{b.type === "payment" ? "Payment" : b.type === "opening_balance" ? "Opening Balance" : "Adjustment"}</span>
                          {b.notes && <span className="text-muted-foreground ml-2">— {b.notes}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-success">£{Number(b.amount).toFixed(2)}</span>
                          <span className="text-muted-foreground">{format(new Date(b.payment_date), "dd MMM yy")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator className="my-4" />

            {/* Transaction Timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Transaction Timeline ({timeline.length})
              </h3>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${item.type === "purchase" ? "bg-primary" : "bg-success"}`} />
                      <div className="min-w-0">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-muted-foreground">{item.detail}</p>
                        <p className="text-muted-foreground/60">{format(new Date(item.date), "dd MMM yyyy, HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
