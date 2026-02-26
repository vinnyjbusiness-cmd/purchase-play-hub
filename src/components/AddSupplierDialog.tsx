import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCreated: () => void;
}

export default function AddSupplierDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("suppliers").insert({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Contact added");
      setForm({ name: "", contact_name: "", contact_phone: "", notes: "" });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. StubHub, Viagogo" />
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
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional info..." rows={2} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !form.name.trim()}>
            {loading ? "Saving..." : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
