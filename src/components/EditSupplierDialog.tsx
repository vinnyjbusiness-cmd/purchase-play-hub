import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
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

interface Props {
  supplier: Supplier;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditSupplierDialog({ supplier, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(supplier.logo_url);
  const [form, setForm] = useState({
    name: supplier.name,
    contact_name: supplier.contact_name || "",
    contact_phone: supplier.contact_phone || "",
    notes: supplier.notes || "",
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("suppliers").update({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        notes: form.notes.trim() || null,
        logo_url: logoUrl,
      }).eq("id", supplier.id);
      if (error) throw error;
      toast.success("Contact updated");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center">
            <LogoAvatar
              name={form.name || supplier.name}
              logoUrl={logoUrl}
              entityType="supplier"
              entityId={supplier.id}
              editable
              size="lg"
              onLogoUpdated={(url) => setLogoUrl(url)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Person Name</Label>
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+44 7700 900000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !form.name.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
