import { useState, useEffect, useMemo, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Upload, Download, Search, Pencil, Trash2, Users, Apple, Smartphone,
  Ticket, Copy, ExternalLink, X, FileDown, TableProperties,
} from "lucide-react";
import ImportMembersDialog from "@/components/ImportMembersDialog";

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
  iphone_pass_link: string | null;
  android_pass_link: string | null;
  pk_pass_url: string | null;
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
  iphone_pass_link: "",
  android_pass_link: "",
  pk_pass_url: "",
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

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast({ title: `${label} copied!` });
}

/* ─── Pass Badge Icon ─── */
function PassBadge({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  const btn = (
    <button
      type="button"
      onClick={active ? onClick : undefined}
      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-7 sm:h-7 rounded-md transition-colors ${
        active
          ? "text-primary hover:bg-primary/10 cursor-pointer"
          : "text-muted-foreground/30 cursor-default"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  if (!active) return btn;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="top"><p className="text-xs">{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
  const [pkPassFile, setPkPassFile] = useState<File | null>(null);
  const [pkPassFileName, setPkPassFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPkPassFile(null);
    setPkPassFileName(null);
    setFormOpen(true);
  };

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
      iphone_pass_link: m.iphone_pass_link || "",
      android_pass_link: m.android_pass_link || "",
      pk_pass_url: m.pk_pass_url || "",
    });
    setPkPassFile(null);
    setPkPassFileName(m.pk_pass_url ? m.pk_pass_url.split("/").pop() || "pass.pkpass" : null);
    setFormOpen(true);
  };

  const uploadPkPass = async (memberId: string, file: File): Promise<string | null> => {
    const path = `${memberId}/${file.name}`;
    const { error } = await supabase.storage.from("pkpass-files").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "PK Pass upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from("pkpass-files").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    setSaving(true);

    let pkPassUrl = form.pk_pass_url || null;

    // For new members, we need to insert first to get ID for file path
    if (!editingId && pkPassFile) {
      // Insert member first without pk_pass_url
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        supporter_id: form.supporter_id || null,
        email: form.email || null,
        member_password: form.member_password || null,
        email_password: form.email_password || null,
        phone_number: form.phone_number || null,
        date_of_birth: form.date_of_birth || null,
        postcode: form.postcode || null,
        address: form.address || null,
        iphone_pass_link: form.iphone_pass_link || null,
        android_pass_link: form.android_pass_link || null,
        pk_pass_url: null,
        org_id: orgId,
      };

      const { data: inserted, error: insertErr } = await supabase.from("members").insert(payload).select("id").single();
      if (insertErr) {
        toast({ title: "Error adding member", description: insertErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      // Now upload file with member ID
      const url = await uploadPkPass(inserted.id, pkPassFile);
      if (url) {
        await supabase.from("members").update({ pk_pass_url: url }).eq("id", inserted.id);
      }
      toast({ title: "Member added" });
      setSaving(false);
      setFormOpen(false);
      fetchMembers();
      return;
    }

    // Handle pk pass upload for edits
    if (editingId && pkPassFile) {
      const url = await uploadPkPass(editingId, pkPassFile);
      if (url) pkPassUrl = url;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      supporter_id: form.supporter_id || null,
      email: form.email || null,
      member_password: form.member_password || null,
      email_password: form.email_password || null,
      phone_number: form.phone_number || null,
      date_of_birth: form.date_of_birth || null,
      postcode: form.postcode || null,
      address: form.address || null,
      iphone_pass_link: form.iphone_pass_link || null,
      android_pass_link: form.android_pass_link || null,
      pk_pass_url: pkPassUrl,
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

  const handleDeleteAll = async () => {
    if (!orgId) return;
    setDeleting(true);
    const { error } = await supabase.from("members").delete().eq("org_id", orgId);
    if (error) toast({ title: "Error deleting members", description: error.message, variant: "destructive" });
    else { toast({ title: `All members deleted` }); fetchMembers(); }
    setDeleting(false);
  };

  const removePkPass = () => {
    setPkPassFile(null);
    setPkPassFileName(null);
    setForm(prev => ({ ...prev, pk_pass_url: "" }));
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
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <TableProperties className="h-4 w-4 mr-1" /> Import from Google Sheets
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!members.length}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {members.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all {members.length} members?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove all members from your database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} disabled={deleting}>
                    {deleting ? "Deleting…" : `Delete All ${members.length} Members`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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
              <TableHead>Passes</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No members found</TableCell></TableRow>
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
                  <div className="flex gap-0.5">
                    <PassBadge
                      active={!!m.iphone_pass_link}
                      icon={Apple}
                      label="iPhone Pass Link"
                      onClick={() => m.iphone_pass_link && copyToClipboard(m.iphone_pass_link, "iPhone pass link")}
                    />
                    <PassBadge
                      active={!!m.android_pass_link}
                      icon={Smartphone}
                      label="Android Pass Link"
                      onClick={() => m.android_pass_link && copyToClipboard(m.android_pass_link, "Android pass link")}
                    />
                    <PassBadge
                      active={!!m.pk_pass_url}
                      icon={Ticket}
                      label="PK Pass File"
                      onClick={() => {
                        if (m.pk_pass_url) {
                          window.open(m.pk_pass_url, "_blank");
                          toast({ title: "Downloading PK Pass…" });
                        }
                      }}
                    />
                  </div>
                </TableCell>
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
        <DialogContent className="sm:max-w-lg w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 shrink-0">
            <DialogTitle>{editingId ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
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
              <div className="col-span-1 sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address} onChange={e => updateField("address", e.target.value)} />
              </div>
            </div>

            {/* Pass Links Section */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Pass Links</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* iPhone Pass Link */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Apple className="h-3.5 w-3.5" /> iPhone Pass Link
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={form.iphone_pass_link}
                      onChange={e => updateField("iphone_pass_link", e.target.value)}
                      className="flex-1"
                    />
                    {form.iphone_pass_link && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:h-10 sm:w-10"
                        onClick={() => copyToClipboard(form.iphone_pass_link, "iPhone pass link")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Android Pass Link */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Smartphone className="h-3.5 w-3.5" /> Android Pass Link
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={form.android_pass_link}
                      onChange={e => updateField("android_pass_link", e.target.value)}
                      className="flex-1"
                    />
                    {form.android_pass_link && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:h-10 sm:w-10"
                        onClick={() => copyToClipboard(form.android_pass_link, "Android pass link")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* PK Pass Upload */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Ticket className="h-3.5 w-3.5" /> PK Pass (.pkpass)
                </Label>

                {pkPassFileName ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                    <Ticket className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{pkPassFileName}</span>
                    <div className="flex gap-1 shrink-0">
                      {form.pk_pass_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                          onClick={() => window.open(form.pk_pass_url, "_blank")}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                        onClick={removePkPass}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.name.endsWith(".pkpass")) {
                        setPkPassFile(file);
                        setPkPassFileName(file.name);
                      } else {
                        toast({ title: "Only .pkpass files are accepted", variant: "destructive" });
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/30 rounded-md p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  >
                    <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Drag & drop .pkpass file or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pkpass"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPkPassFile(file);
                          setPkPassFileName(file.name);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Edit mode: show external links for existing pass links */}
              {editingId && (form.iphone_pass_link || form.android_pass_link) && (
                <div className="flex flex-wrap gap-2">
                  {form.iphone_pass_link && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => window.open(form.iphone_pass_link, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" /> Open iPhone Pass
                    </Button>
                  )}
                  {form.android_pass_link && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => window.open(form.android_pass_link, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" /> Open Android Pass
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 sticky bottom-0 bg-background">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportMembersDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={orgId}
        onComplete={fetchMembers}
      />
    </div>
  );
}
