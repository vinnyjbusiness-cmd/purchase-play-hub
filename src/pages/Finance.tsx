import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

interface LedgerEntry {
  id: string;
  transaction_type: string;
  description: string;
  amount: number;
  currency: string;
  amount_gbp: number;
  transaction_date: string;
}

const typeColor: Record<string, string> = {
  sale: "bg-success/10 text-success border-success/20",
  purchase: "bg-primary/10 text-primary border-primary/20",
  fee: "bg-warning/10 text-warning border-warning/20",
  refund: "bg-destructive/10 text-destructive border-destructive/20",
  payout: "bg-primary/10 text-primary border-primary/20",
  supplier_payment: "bg-muted text-muted-foreground",
  adjustment: "bg-muted text-muted-foreground",
};

export default function Finance() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("transactions_ledger")
      .select("*")
      .order("transaction_date", { ascending: false })
      .then(({ data }) => setEntries(data || []));
  }, []);

  const filtered = entries.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.transaction_type.toLowerCase().includes(search.toLowerCase())
  );

  const totalIn = filtered.filter((e) => e.amount_gbp > 0).reduce((s, e) => s + e.amount_gbp, 0);
  const totalOut = filtered.filter((e) => e.amount_gbp < 0).reduce((s, e) => s + e.amount_gbp, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">Transaction ledger and financial overview</p>
      </div>

      <div className="flex gap-4">
        <div className="rounded-lg border bg-card p-4 flex-1">
          <p className="text-sm text-muted-foreground">Money In</p>
          <p className="text-xl font-bold text-success">£{totalIn.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 flex-1">
          <p className="text-sm text-muted-foreground">Money Out</p>
          <p className="text-xl font-bold text-destructive">£{Math.abs(totalOut).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 flex-1">
          <p className="text-sm text-muted-foreground">Net</p>
          <p className="text-xl font-bold">£{(totalIn + totalOut).toFixed(2)}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Amount (GBP)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{format(new Date(e.transaction_date), "dd MMM yy")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={typeColor[e.transaction_type] || ""}>{e.transaction_type}</Badge>
                </TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="text-right">{e.currency === "GBP" ? "£" : e.currency === "USD" ? "$" : "€"}{Number(e.amount).toFixed(2)}</TableCell>
                <TableCell>{e.currency}</TableCell>
                <TableCell className={`text-right font-medium ${e.amount_gbp >= 0 ? "text-success" : "text-destructive"}`}>
                  £{Number(e.amount_gbp).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
