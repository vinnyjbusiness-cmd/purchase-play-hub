import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Pencil, Download, Phone } from "lucide-react";
import { toast } from "sonner";
import LogoAvatar from "@/components/LogoAvatar";
import AddSupplierDialog from "@/components/AddSupplierDialog";
import SupplierDetailSheet from "@/components/SupplierDetailSheet";
import EditSupplierDialog from "@/components/EditSupplierDialog";

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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [stats, setStats] = useState<Record<string, SupplierStats>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: true });
    // Filter out "websites" supplier type
    const list = ((data as Supplier[]) || []).filter(
      s => s.name.toLowerCase() !== "websites"
    );
    setSuppliers(list);

    if (list.length > 0) {
      const ids = list.map(s => s.id);

      const [purchRes, balRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("id, supplier_id, quantity, unit_cost, total_cost_gbp, supplier_paid")
          .in("supplier_id", ids),
        supabase
          .from("balance_payments")
          .select("party_id, amount, type")
          .eq("party_type", "supplier")
          .in("party_id", ids),
      ]);

      const statsMap: Record<string, SupplierStats> = {};
      ids.forEach(id => { statsMap[id] = { totalOwed: 0, totalPaid: 0, totalPurchases: 0, ticketsBought: 0 }; });

      (purchRes.data || []).forEach((p: any) => {
        if (!statsMap[p.supplier_id]) return;
        statsMap[p.supplier_id].totalPurchases++;
        statsMap[p.supplier_id].ticketsBought += p.quantity;
        const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
        statsMap[p.supplier_id].totalOwed += cost;
        if (p.supplier_paid) statsMap[p.supplier_id].totalPaid += cost;
      });

      (balRes.data || []).forEach((b: any) => {
        if (!statsMap[b.party_id]) return;
        if (b.type === "payment") statsMap[b.party_id].totalPaid += b.amount;
      });

      setStats(statsMap);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.display_id || "").toLowerCase().includes(q) ||
      (s.contact_name || "").toLowerCase().includes(q) ||
      (s.contact_phone || "").toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supplier deleted");
    load();
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Contact", "Phone", "Total Owed", "Total Paid", "Balance", "Purchases", "Tickets Bought"];
    const rows = suppliers.map(s => {
      const st = stats[s.id] || { totalOwed: 0, totalPaid: 0, totalPurchases: 0, ticketsBought: 0 };
      return [
        s.display_id || "",
        s.name,
        s.contact_name || "",
        s.contact_phone || "",
        st.totalOwed.toFixed(2),
        st.totalPaid.toFixed(2),
        (st.totalOwed - st.totalPaid).toFixed(2),
        st.totalPurchases.toString(),
        st.ticketsBought.toString(),
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const selected = suppliers.find(s => s.id === selectedId) || null;

  // Generate a premium-style display code
  const getDisplayCode = (s: Supplier, index: number) => {
    if (s.display_id) return s.display_id;
    return `VJX-${String(index + 1).padStart(3, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} in database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <AddSupplierDialog onCreated={load} />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No suppliers found
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s, idx) => {
            const st = stats[s.id] || { totalOwed: 0, totalPaid: 0, totalPurchases: 0, ticketsBought: 0 };
            const balance = st.totalOwed - st.totalPaid;
            const code = getDisplayCode(s, suppliers.indexOf(s));
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="group relative rounded-xl border bg-card p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              >
                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); }}
                    title="Edit supplier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(s.id, e)}
                    title="Delete supplier"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <LogoAvatar
                    name={s.name}
                    logoUrl={s.logo_url}
                    entityType="supplier"
                    entityId={s.id}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{s.name}</h3>
                      {s.contact_phone && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5" /> {s.contact_phone}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="mt-0.5 text-[10px] font-mono font-bold tracking-wider bg-primary/5 text-primary border-primary/20">
                      {code}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                    <p className={`text-sm font-bold font-mono ${balance > 0 ? "text-destructive" : "text-success"}`}>
                      £{Math.abs(balance).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-center rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p>
                    <p className="text-sm font-bold font-mono">{st.ticketsBought}</p>
                  </div>
                  <div className="text-center rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Purchases</p>
                    <p className="text-sm font-bold font-mono">{st.totalPurchases}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SupplierDetailSheet
        supplier={selected}
        stats={stats[selectedId || ""] || { totalOwed: 0, totalPaid: 0, totalPurchases: 0, ticketsBought: 0 }}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />

      {editingSupplier && (
        <EditSupplierDialog
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onUpdated={() => { setEditingSupplier(null); load(); }}
        />
      )}
    </div>
  );
}
