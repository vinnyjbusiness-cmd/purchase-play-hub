import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCreated: (contact: { id: string; name: string; contact_phone: string | null; contact_email: string | null }) => void;
  onCancel: () => void;
}

export default function InlineAddContact({ onCreated, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: name.trim(),
          contact_phone: phone.trim() || null,
          contact_email: email.trim() || null,
        })
        .select("id, name, contact_phone, contact_email")
        .single();
      if (error) throw error;
      toast.success("Contact created");
      onCreated(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">New Contact</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" className="h-8 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900000" className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-sm" />
        </div>
      </div>
      <Button type="button" size="sm" className="w-full" disabled={loading || !name.trim()} onClick={handleSave}>
        {loading ? "Saving..." : "Create Contact"}
      </Button>
    </div>
  );
}
