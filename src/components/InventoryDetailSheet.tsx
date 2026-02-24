import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Props {
  inventoryId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

interface InvDetail {
  id: string;
  category: string;
  section: string | null;
  block: string | null;
  row_name: string | null;
  seat: string | null;
  face_value: number | null;
  status: string;
  created_at: string;
  events: { match_code: string; home_team: string; away_team: string } | null;
  purchases: { unit_cost: number; currency: string; suppliers: { name: string } | null } | null;
}

export default function InventoryDetailSheet({ inventoryId, onClose, onUpdated }: Props) {
  const [item, setItem] = useState<InvDetail | null>(null);
  const [category, setCategory] = useState("");
  const [section, setSection] = useState("");
  const [block, setBlock] = useState("");
  const [rowName, setRowName] = useState("");
  const [seat, setSeat] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!inventoryId) return;
    const { data } = await supabase
      .from("inventory")
      .select("*, events(match_code, home_team, away_team), purchases(unit_cost, currency, suppliers(name))")
      .eq("id", inventoryId)
      .single();
    if (data) {
      const d = data as any;
      setItem(d);
      setCategory(d.category);
      setSection(d.section || "");
      setBlock(d.block || "");
      setRowName(d.row_name || "");
      setSeat(d.seat || "");
      setFaceValue(d.face_value != null ? String(d.face_value) : "");
      setStatus(d.status);
    }
  }, [inventoryId]);

  useEffect(() => { if (inventoryId) load(); }, [inventoryId, load]);

  const handleSave = async () => {
    if (!inventoryId) return;
    const { error } = await supabase.from("inventory").update({
      category,
      section: section || null,
      block: block || null,
      row_name: rowName || null,
      seat: seat || null,
      face_value: faceValue ? parseFloat(faceValue) : null,
      status: status as any,
    }).eq("id", inventoryId);
    if (error) { toast.error(error.message); return; }
    toast.success("Inventory updated");
    load();
    onUpdated();
  };

  if (!item) return null;

  const purchase = item.purchases as any;
  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");

  return (
    <Sheet open={!!inventoryId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Inventory Item
            <Badge variant="outline">{item.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Event</p>
              <p className="font-medium">{item.events?.home_team} vs {item.events?.away_team}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-medium">{purchase?.suppliers?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost</p>
              <p className="font-medium">{purchase ? `${sym(purchase.currency)}${Number(purchase.unit_cost).toFixed(2)}` : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Face Value</p>
              <p className="font-medium">{item.face_value != null ? `£${Number(item.face_value).toFixed(2)}` : "—"}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Input value={section} onChange={e => setSection(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Block</Label>
                <Input value={block} onChange={e => setBlock(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Row</Label>
                <Input value={rowName} onChange={e => setRowName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Seat</Label>
                <Input value={seat} onChange={e => setSeat(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Face Value (£)</Label>
                <Input type="number" min={0} step="0.01" value={faceValue} onChange={e => setFaceValue(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">Save Changes</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
