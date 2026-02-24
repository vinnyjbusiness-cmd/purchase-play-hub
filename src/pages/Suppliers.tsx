import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LogoAvatar from "@/components/LogoAvatar";
import AddSupplierDialog from "@/components/AddSupplierDialog";
import SupplierDetailSheet from "@/components/SupplierDetailSheet";

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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, SupplierStats>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (data as Supplier[]) || [];
    setSuppliers(list);

    if (list.length > 0) {
      const ids = list.map(s => s.id);

      const [purchRes, orderRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("supplier_id, quantity, unit_cost, total_cost_gbp, supplier_paid")
          .in("supplier_id", ids),
        supabase
          .from("orders")
          .select("id, event_id, status")
          .in("status", ["pending", "fulfilled"]),
      ]);

      // Build purchase-to-supplier mapping for orders via inventory
      const { data: invData } = await supabase
        .from("inventory")
        .select("id, purchase_id")
        .in("purchase_id", (purchRes.data || []).map(p => (p as any).supplier_id ? undefined : "").filter(Boolean));

      const statsMap: Record<string, SupplierStats> = {};
      ids.forEach(id => { statsMap[id] = { totalOwed: 0, activeOrders: 0, totalPurchases: 0 }; });

      (purchRes.data || []).forEach((p: any) => {
        if (!statsMap[p.supplier_id]) return;
        statsMap[p.supplier_id].totalPurchases++;
        if (!p.supplier_paid) {
          const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
          statsMap[p.supplier_id].totalOwed += cost;
        }
      });

      // Count active orders linked to each supplier via inventory -> purchase
      const { data: orderInvData } = await supabase
        .from("inventory")
        .select("purchase_id, status")
        .in("purchase_id", (purchRes.data || []).map((p: any) => p.supplier_id).filter(Boolean));

      // Simpler: count orders by supplier through purchases' events
      const purchBySupplier: Record<string, Set<string>> = {};
      (purchRes.data || []).forEach((p: any) => {
        if (!purchBySupplier[p.supplier_id]) purchBySupplier[p.supplier_id] = new Set();
      });

      // For active orders, we count inventory items that are 'sold' or 'reserved' per supplier
      const { data: soldInv } = await supabase
        .from("inventory")
        .select("purchase_id")
        .in("status", ["sold", "reserved"]);

      const purchSupplierMap: Record<string, string> = {};
      (purchRes.data || []).forEach((p: any) => {
        // We need purchase id -> supplier id mapping
      });

      // Re-fetch with purchase IDs
      const { data: purchFull } = await supabase
        .from("purchases")
        .select("id, supplier_id")
        .in("supplier_id", ids);

      const pidToSid: Record<string, string> = {};
      (purchFull || []).forEach((p: any) => { pidToSid[p.id] = p.supplier_id; });

      (soldInv || []).forEach((inv: any) => {
        const sid = pidToSid[inv.purchase_id];
        if (sid && statsMap[sid]) statsMap[sid].activeOrders++;
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
      (s.contact_email || "").toLowerCase().includes(q)
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

  const selected = suppliers.find(s => s.id === selectedId) || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} in database
          </p>
        </div>
        <AddSupplierDialog onCreated={load} />
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
          {filtered.map(s => {
            const st = stats[s.id] || { totalOwed: 0, activeOrders: 0, totalPurchases: 0 };
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="group relative rounded-xl border bg-card p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-3 right-3 h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                  onClick={(e) => handleDelete(s.id, e)}
                  title="Delete supplier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-3 mb-4">
                  <LogoAvatar
                    name={s.name}
                    logoUrl={s.logo_url}
                    entityType="supplier"
                    entityId={s.id}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{s.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{s.display_id || "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Owed</p>
                    <p className="text-sm font-bold font-mono">
                      £{st.totalOwed.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-center rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
                    <p className="text-sm font-bold font-mono">{st.activeOrders}</p>
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
        stats={stats[selectedId || ""] || { totalOwed: 0, activeOrders: 0, totalPurchases: 0 }}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </div>
  );
}
