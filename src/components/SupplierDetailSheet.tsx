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
import { Save, Package, ShoppingCart, Banknote, Clock } from "lucide-react";
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
  activeOrders: number;
  totalPurchases: number;
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
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    payment_terms: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [balancePayments, setBalancePayments] = useState<BalanceRow[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supplier) return;
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name || "",
      contact_email: supplier.contact_email || "",
      contact_phone: supplier.contact_phone || "",
      payment_terms: supplier.payment_terms || "",
      notes: supplier.notes || "",
    });
    setLogoUrl(supplier.logo_url);

    // Load linked data
    Promise.all([
      supabase
        .from("purchases")
        .select("id, quantity, unit_cost, total_cost, status, purchase_date, category, supplier_paid, events(match_code, home_team, away_team, event_date)")
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

  const handleSave = async () => {
    if (!supplier) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("suppliers").update({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        notes: form.notes.trim() || null,
      }).eq("id", supplier.id);
      if (error) throw error;
      toast.success("Supplier updated");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const statusColor: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    confirmed: "bg-primary/10 text-primary border-primary/20",
    received: "bg-success/10 text-success border-success/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  // Activity timeline: combine purchases and balance payments
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
                  name={form.name || supplier.name}
                  logoUrl={logoUrl}
                  entityType="supplier"
                  entityId={supplier.id}
                  editable
                  size="lg"
                  onLogoUpdated={(url) => setLogoUrl(url)}
                />
                <div>
                  <SheetTitle className="text-lg">{form.name || supplier.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground font-mono">{supplier.display_id || "—"}</p>
                </div>
              </div>
            </SheetHeader>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Banknote className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Owed</p>
                <p className="text-sm font-bold font-mono">£{stats.totalOwed.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
                <p className="text-sm font-bold font-mono">{stats.activeOrders}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Purchases</p>
                <p className="text-sm font-bold font-mono">{stats.totalPurchases}</p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Edit form */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Supplier Name</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input value={form.payment_terms} onChange={e => set("payment_terms", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <Separator className="my-4" />

            {/* Purchases linked */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Purchases ({purchases.length})
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
                        <TableHead className="text-[10px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.slice(0, 10).map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">
                            {p.events ? `${p.events.home_team} vs ${p.events.away_team}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right">{p.quantity}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            £{Number(p.total_cost || p.quantity * p.unit_cost).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${statusColor[p.status] || ""}`}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(p.purchase_date), "dd MMM yy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {purchases.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      +{purchases.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Activity timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Activity ({timeline.length})
              </h3>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {timeline.slice(0, 20).map((item, i) => (
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
