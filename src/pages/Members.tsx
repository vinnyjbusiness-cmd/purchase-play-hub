import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Upload, Download, Search, Pencil, Trash2, Users } from "lucide-react";

interface Member {
  id: string;
  org_id: string | null;
  first_name: string;
  last_name: string;
  supporter_id: string | null;
  email: string | null;
  member_password: string | null;
  email_password: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  postcode: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  supporter_id: "",
  email: "",
  member_password: "",
  email_password: "",
  phone_number: "",
  date_of_birth: "",
  postcode: "",
  address: "",
};

const CSV_HEADERS = [
  "First Name", "Last Name", "Supporter ID", "Email",
  "Member Password", "Email Password", "Phone Number",
  "Date of Birth", "Postcode", "Address",
];

const CSV_FIELD_MAP: Record<string, keyof typeof EMPTY_FORM> = {
  "First Name": "first_name",
  "Last Name": "last_name",
  "Supporter ID": "supporter_id",
  "Email": "email",
  "Member Password": "member_password",
  "Email Password": "email_password",
  "Phone Number": "phone_number",
  "Date of Birth": "date_of_birth",
  "Postcode": "postcode",
  "Address": "address",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
}

export default function MembersPage() {
  const { orgId } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchMembers = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error loading members", description: error.message, variant: "destructive" });
    else setMembers((data as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [orgId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      [m.first_name, m.last_name, m.supporter_id, m.email, m.phone_number, m.postcode, m.address]
        .some(v => v && v.toLowerCase().includes(q))
    );
  }, [members, search]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (m: Member) => {
    setEditingId(m.id);
    setForm({
      first_name: m.first_name || "",
      last_name: m.last_name || "",
      supporter_id: m.supporter_id || "",
      email: m.email || "",
      member_password: m.member_password || "",
      email_password: m.email_password || "",
      phone_number: m.phone_number || "",
      date_of_birth: m.date_of_birth || "",
      postcode: m.postcode || "",
      address: m.address || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      supporter_id: form.supporter_id || null,
      email: form.email || null,
      member_password: form.member_password || null,
      email_password: form.email_password || null,
      phone_number: form.phone_number || null,
      date_of_birth: form.date_of_birth || null,
      postcode: form.postcode || null,
      address: form.address || null,
      org_id: orgId,
    };

    if (editingId) {
      const { error } = await supabase.from("members").update(payload).eq("id", editingId);
      if (error) toast({ title: "Error updating member", description: error.message, variant: "destructive" });
      else toast({ title: "Member updated" });
    } else {
      const { error } = await supabase.from("members").insert(payload);
      if (error) toast({ title: "Error adding member", description: error.message, variant: "destructive" });
      else toast({ title: "Member added" });
    }
    setSaving(false);
    setFormOpen(false);
    fetchMembers();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) toast({ title: "Error deleting member", description: error.message, variant: "destructive" });
    else { toast({ title: "Member deleted" }); fetchMembers(); }
  };

  const downloadTemplate = () => {
    const csv = CSV_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "members_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const rows = members.map(m =>
      [m.first_name, m.last_name, m.supporter_id || "", m.email || "",
       m.member_password || "", m.email_password || "", m.phone_number || "",
       m.date_of_birth || "", m.postcode || "", m.address || ""]
        .map(v => `"${(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = CSV_HEADERS.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "members_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { toast({ title: "No valid rows found in CSV", variant: "destructive" }); return; }

    const inserts = rows.map(row => {
      const entry: Record<string, any> = { org_id: orgId };
      Object.entries(CSV_FIELD_MAP).forEach(([header, field]) => {
        entry[field] = row[header]?.trim() || null;
      });
      if (!entry.first_name || !entry.last_name) return null;
      return entry;
    }).filter((x): x is { org_id: string | null; first_name: string; last_name: string; [k: string]: any } => x !== null && !!x.first_name && !!x.last_name);

    if (!inserts.length) { toast({ title: "No valid members in CSV (first & last name required)", variant: "destructive" }); return; }

    const { error } = await supabase.from("members").insert(inserts as any);
    if (error) toast({ title: "Import failed", description: error.message, variant: "destructive" });
    else { toast({ title: `${inserts.length} members imported` }); fetchMembers(); }
    e.target.value = "";
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Members
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your member database
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" /> Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!members.length}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Member
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Badge variant="secondary" className="text-xs">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</Badge>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Supporter ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Member Password</TableHead>
              <TableHead>Email Password</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No members found</TableCell></TableRow>
            ) : filtered.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.first_name}</TableCell>
                <TableCell>{m.last_name}</TableCell>
                <TableCell>{m.supporter_id || "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate">{m.email || "—"}</TableCell>
                <TableCell>{m.member_password || "—"}</TableCell>
                <TableCell>{m.email_password || "—"}</TableCell>
                <TableCell>{m.phone_number || "—"}</TableCell>
                <TableCell>{m.date_of_birth || "—"}</TableCell>
                <TableCell>{m.postcode || "—"}</TableCell>
                <TableCell className="max-w-[140px] truncate">{m.address || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {m.first_name} {m.last_name} from your members list.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(m.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={e => updateField("first_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input value={form.last_name} onChange={e => updateField("last_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Supporter ID</Label>
              <Input value={form.supporter_id} onChange={e => updateField("supporter_id", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => updateField("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Member Password</Label>
              <Input value={form.member_password} onChange={e => updateField("member_password", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email Password</Label>
              <Input value={form.email_password} onChange={e => updateField("email_password", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input value={form.phone_number} onChange={e => updateField("phone_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={e => updateField("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={e => updateField("postcode", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => updateField("address", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
