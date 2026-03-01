import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Minus, Trash2 } from "lucide-react";

interface BulkAddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  onComplete: () => void;
}

interface BulkRow {
  first_name: string;
  last_name: string;
  supporter_id: string;
  email: string;
  member_password: string;
  email_password: string;
  phone_number: string;
  date_of_birth: string;
  postcode: string;
  address: string;
  iphone_pass_link: string;
  android_pass_link: string;
}

const EMPTY_ROW: BulkRow = {
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
};

const COLUMNS: { key: keyof BulkRow; label: string; width: string }[] = [
  { key: "first_name", label: "First Name", width: "min-w-[120px]" },
  { key: "last_name", label: "Last Name", width: "min-w-[120px]" },
  { key: "supporter_id", label: "Supporter ID", width: "min-w-[110px]" },
  { key: "email", label: "Email", width: "min-w-[180px]" },
  { key: "member_password", label: "Member Pwd", width: "min-w-[110px]" },
  { key: "email_password", label: "Email Pwd", width: "min-w-[110px]" },
  { key: "phone_number", label: "Phone", width: "min-w-[120px]" },
  { key: "date_of_birth", label: "DOB", width: "min-w-[110px]" },
  { key: "postcode", label: "Postcode", width: "min-w-[100px]" },
  { key: "address", label: "Address", width: "min-w-[160px]" },
  { key: "iphone_pass_link", label: "iPhone Link", width: "min-w-[140px]" },
  { key: "android_pass_link", label: "Android Link", width: "min-w-[140px]" },
];

function createRows(count: number): BulkRow[] {
  return Array.from({ length: count }, () => ({ ...EMPTY_ROW }));
}

export default function BulkAddMembersDialog({ open, onOpenChange, orgId, onComplete }: BulkAddMembersDialogProps) {
  const [rowCount, setRowCount] = useState(10);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [started, setStarted] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleGenerate = () => {
    setRows(createRows(rowCount));
    setStarted(true);
  };

  const handleCellChange = (rowIdx: number, key: keyof BulkRow, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  };

  const handlePaste = (e: React.ClipboardEvent, rowIdx: number, colIdx: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single cell, let default handle it
    e.preventDefault();

    const pastedLines = text.split(/\r?\n/).filter(l => l.length > 0);
    setRows(prev => {
      const next = [...prev];
      // Add more rows if paste exceeds current count
      while (next.length < rowIdx + pastedLines.length) {
        next.push({ ...EMPTY_ROW });
      }
      pastedLines.forEach((line, li) => {
        const cells = line.split("\t");
        cells.forEach((cell, ci) => {
          const targetCol = colIdx + ci;
          if (targetCol < COLUMNS.length) {
            const ri = rowIdx + li;
            next[ri] = { ...next[ri], [COLUMNS[targetCol].key]: cell.trim() };
          }
        });
      });
      return next;
    });
  };

  const addRows = (count: number) => {
    setRows(prev => [...prev, ...createRows(count)]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setRows(prev => prev.map(() => ({ ...EMPTY_ROW })));
  };

  const validRows = rows.filter(r => r.first_name.trim() && r.last_name.trim());

  const handleImport = async () => {
    if (!orgId || !validRows.length) return;
    setImporting(true);

    // Duplicate check
    const emails = validRows.map(r => r.email?.trim().toLowerCase()).filter(Boolean);
    let existingEmails = new Set<string>();
    if (emails.length) {
      const { data } = await supabase
        .from("members")
        .select("email")
        .eq("org_id", orgId)
        .not("email", "is", null);
      if (data) existingEmails = new Set(data.map(d => (d.email || "").toLowerCase()).filter(Boolean));
    }

    const toInsert = validRows.filter(r => {
      if (!r.email?.trim()) return true; // no email = not a duplicate
      return !existingEmails.has(r.email.trim().toLowerCase());
    });

    const skipped = validRows.length - toInsert.length;

    if (!toInsert.length) {
      toast({ title: "All rows are duplicates", description: "No new members to import", variant: "destructive" });
      setImporting(false);
      return;
    }

    const inserts = toInsert.map(r => ({
      org_id: orgId,
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      supporter_id: r.supporter_id.trim() || null,
      email: r.email.trim() || null,
      member_password: r.member_password.trim() || null,
      email_password: r.email_password.trim() || null,
      phone_number: r.phone_number.trim() || null,
      date_of_birth: r.date_of_birth.trim() || null,
      postcode: r.postcode.trim() || null,
      address: r.address.trim() || null,
      iphone_pass_link: r.iphone_pass_link.trim() || null,
      android_pass_link: r.android_pass_link.trim() || null,
    }));

    const { error } = await supabase.from("members").insert(inserts as any);

    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } else {
      const parts: string[] = [`✅ ${inserts.length} members added`];
      if (skipped) parts.push(`⚠️ ${skipped} skipped (duplicate email)`);
      toast({ title: "Bulk Add Complete", description: parts.join("\n") });
      setStarted(false);
      setRows([]);
      onComplete();
      onOpenChange(false);
    }
    setImporting(false);
  };

  const handleReset = () => {
    setStarted(false);
    setRows([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 shrink-0">
          <DialogTitle>Bulk Add Members</DialogTitle>
          <DialogDescription className="text-xs">
            Enter data directly or paste from a spreadsheet (multi-cell paste supported)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-4">
          {!started ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground">How many member rows do you want to add?</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setRowCount(c => Math.max(1, c - 5))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={rowCount}
                  onChange={e => setRowCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center"
                />
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setRowCount(c => Math.min(500, c + 5))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleGenerate}>Generate {rowCount} Rows</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{rows.length} rows</Badge>
                  <Badge variant="outline" className="text-xs">
                    {validRows.length} valid (have first &amp; last name)
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={clearAll}>Clear All</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => addRows(10)}>
                    <Plus className="h-3 w-3 mr-1" /> Add 10 Rows
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={handleReset}>← Back</Button>
                </div>
              </div>

              <div className="rounded-lg border bg-card overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-1 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                      {COLUMNS.map(col => (
                        <th key={col.key} className={`px-1 py-2 text-left font-medium text-muted-foreground ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-1 py-0.5 text-muted-foreground">{ri + 1}</td>
                        {COLUMNS.map((col, ci) => (
                          <td key={col.key} className="px-0.5 py-0.5">
                            <input
                              type="text"
                              value={row[col.key]}
                              onChange={e => handleCellChange(ri, col.key, e.target.value)}
                              onPaste={e => handlePaste(e, ri, ci)}
                              className={`w-full bg-muted/30 border border-border/50 focus:border-primary focus:bg-background rounded px-1.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground/40 ${
                                (col.key === "first_name" || col.key === "last_name") && !row[col.key].trim() && rows.some(r => r.first_name || r.last_name || r.email)
                                  ? "border-destructive/30"
                                  : ""
                              }`}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="px-0.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => removeRow(ri)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 sticky bottom-0 bg-background">
          <div className="flex items-center justify-between w-full gap-2">
            <Badge variant="outline" className="text-xs">
              {validRows.length} member{validRows.length !== 1 ? "s" : ""} ready
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {started && (
                <Button onClick={handleImport} disabled={importing || !validRows.length}>
                  {importing ? "Adding…" : `Add ${validRows.length} Member${validRows.length !== 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
