import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Upload, X, AlertTriangle, Ticket } from "lucide-react";

/** Normalize date strings to YYYY-MM-DD for Postgres */
function normalizeDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}

interface ImportMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  onComplete: () => void;
}

interface ParsedRow {
  id: number;
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
  pk_pass_file: File | null;
  pk_pass_filename: string;
  checked: boolean;
  isDuplicate: boolean;
  isValid: boolean;
}

const HEADER_MAP: Record<string, keyof Omit<ParsedRow, "id" | "pk_pass_file" | "pk_pass_filename" | "checked" | "isDuplicate" | "isValid"> | "ignore"> = {
  "wan": "ignore",
  "first name": "first_name",
  "last name": "last_name",
  "supporter id": "supporter_id",
  "email": "email",
  "member password": "member_password",
  "email password": "email_password",
  "phone number": "phone_number",
  "dob": "date_of_birth",
  "postcode": "postcode",
  "adress": "address",
  "address": "address",
  "iphone links": "iphone_pass_link",
  "android links": "android_pass_link",
};

function cleanPhone(val: string): string {
  let s = val.trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s;
}

function parseTSV(text: string): Omit<ParsedRow, "id" | "checked" | "isDuplicate" | "isValid" | "pk_pass_file" | "pk_pass_filename">[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map(h => h.trim().toLowerCase());
  const fieldMap: (keyof Omit<ParsedRow, "id" | "pk_pass_file" | "pk_pass_filename" | "checked" | "isDuplicate" | "isValid"> | "ignore" | null)[] =
    headers.map(h => HEADER_MAP[h] || null);

  return lines.slice(1).map(line => {
    const vals = line.split("\t").map(v => v.trim());
    const row: any = {
      first_name: "", last_name: "", supporter_id: "", email: "",
      member_password: "", email_password: "", phone_number: "",
      date_of_birth: "", postcode: "", address: "",
      iphone_pass_link: "", android_pass_link: "",
    };
    fieldMap.forEach((field, i) => {
      if (!field || field === "ignore" || !vals[i]) return;
      if (field === "phone_number") {
        row[field] = cleanPhone(vals[i]);
      } else {
        row[field] = vals[i];
      }
    });
    return row;
  });
}

export default function ImportMembersDialog({ open, onOpenChange, orgId, onComplete }: ImportMembersDialogProps) {
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState(false);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleParse = useCallback(async (text: string) => {
    setRawText(text);
    const parsed = parseTSV(text);
    if (!parsed.length) {
      setRows([]);
      setParsed(false);
      return;
    }

    // Check duplicates
    let existingEmails = new Set<string>();
    if (orgId) {
      const { data } = await supabase
        .from("members")
        .select("email")
        .eq("org_id", orgId)
        .not("email", "is", null);
      if (data) {
        existingEmails = new Set(data.map(d => (d.email || "").toLowerCase()).filter(Boolean));
      }
    }

    const newRows: ParsedRow[] = parsed.map((r, i) => {
      const isValid = !!(r.first_name && r.last_name && r.email);
      const isDuplicate = !!(r.email && existingEmails.has(r.email.toLowerCase()));
      return {
        ...r,
        id: i,
        pk_pass_file: null,
        pk_pass_filename: "",
        checked: isValid && !isDuplicate,
        isDuplicate,
        isValid,
      };
    });

    setRows(newRows);
    setParsed(true);
  }, [orgId]);

  const toggleRow = (id: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  };

  const removeRow = (id: number) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const selectAll = () => setRows(prev => prev.map(r => ({ ...r, checked: r.isValid && !r.isDuplicate })));
  const deselectAll = () => setRows(prev => prev.map(r => ({ ...r, checked: false })));

  const attachPkPass = (id: number, file: File) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, pk_pass_file: file, pk_pass_filename: file.name } : r));
  };

  const removePkPass = (id: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, pk_pass_file: null, pk_pass_filename: "" } : r));
  };

  const readyRows = rows.filter(r => r.checked && r.isValid && !r.isDuplicate);
  const duplicateCount = rows.filter(r => r.isDuplicate).length;

  const handleImport = async () => {
    if (!orgId || !readyRows.length) return;
    setImporting(true);

    let imported = 0;
    let failed = 0;

    // Build insert payload
    const inserts = readyRows.map(r => ({
      org_id: orgId,
      first_name: r.first_name,
      last_name: r.last_name,
      supporter_id: r.supporter_id || null,
      email: r.email || null,
      member_password: r.member_password || null,
      email_password: r.email_password || null,
      phone_number: r.phone_number || null,
      date_of_birth: normalizeDate(r.date_of_birth),
      postcode: r.postcode || null,
      address: r.address || null,
      iphone_pass_link: r.iphone_pass_link || null,
      android_pass_link: r.android_pass_link || null,
      pk_pass_url: null as string | null,
    }));

    // Bulk insert
    const { data: insertedData, error } = await supabase
      .from("members")
      .insert(inserts as any)
      .select("id");

    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      setImporting(false);
      return;
    }

    imported = insertedData?.length || 0;

    // Upload pk pass files for rows that have them
    if (insertedData) {
      const rowsWithFiles = readyRows
        .map((r, i) => ({ row: r, memberId: insertedData[i]?.id }))
        .filter(x => x.row.pk_pass_file && x.memberId);

      for (const { row, memberId } of rowsWithFiles) {
        const file = row.pk_pass_file!;
        const path = `${memberId}/${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("pkpass-files")
          .upload(path, file, { upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("pkpass-files").getPublicUrl(path);
          await supabase.from("members").update({ pk_pass_url: urlData.publicUrl }).eq("id", memberId);
        } else {
          failed++;
        }
      }
    }

    const skipped = duplicateCount;
    const parts: string[] = [];
    if (imported) parts.push(`✅ ${imported} members imported`);
    if (skipped) parts.push(`⚠️ ${skipped} skipped (duplicate)`);
    if (failed) parts.push(`❌ ${failed} file uploads failed`);

    toast({ title: "Import Complete", description: parts.join("\n") });

    setImporting(false);
    setRawText("");
    setRows([]);
    setParsed(false);
    onComplete();
    onOpenChange(false);
  };

  const handleReset = () => {
    setRawText("");
    setRows([]);
    setParsed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 shrink-0">
          <DialogTitle>Import Members from Google Sheets</DialogTitle>
          <DialogDescription className="text-xs">
            Copy data from Google Sheets (Cmd+A, Cmd+C) and paste below
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-4">
          {/* Paste Area */}
          {!parsed && (
            <Textarea
              placeholder={"Copy your data from Google Sheets and paste it here...\n\nExpected columns: First Name, Last Name, Supporter Id, Email, Member password, Email password, Phone Number, DOB, Postcode, Address, iPhone Links, Android Links"}
              value={rawText}
              onChange={e => handleParse(e.target.value)}
              onPaste={e => {
                e.preventDefault();
                const text = e.clipboardData.getData("text");
                handleParse(text);
              }}
              className="min-h-[180px] font-mono text-xs"
            />
          )}

          {/* Preview */}
          {parsed && rows.length > 0 && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="secondary">{rows.length} members detected</Badge>
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                  ← Back to paste
                </Button>
              </div>

              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">✓</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Supporter ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Email Pwd</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>DOB</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>iPhone</TableHead>
                      <TableHead>Android</TableHead>
                      <TableHead>PK Pass</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow
                        key={r.id}
                        className={
                          r.isDuplicate
                            ? "bg-yellow-500/10"
                            : !r.isValid
                            ? "bg-destructive/10"
                            : ""
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={r.checked}
                            onCheckedChange={() => toggleRow(r.id)}
                            disabled={r.isDuplicate}
                          />
                        </TableCell>
                        <TableCell className={!r.first_name ? "text-destructive font-medium" : ""}>
                          {r.first_name || (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={!r.last_name ? "text-destructive font-medium" : ""}>
                          {r.last_name || (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.supporter_id || "—"}</TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          <div className="flex items-center gap-1">
                            {!r.email ? (
                              <span className="text-destructive flex items-center gap-1 font-medium">
                                <AlertTriangle className="h-3 w-3" /> Missing
                              </span>
                            ) : (
                              <span className="truncate text-xs">{r.email}</span>
                            )}
                            {r.isDuplicate && (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 whitespace-nowrap">
                                Already exists — will skip
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{r.member_password || "—"}</TableCell>
                        <TableCell className="text-xs">{r.email_password || "—"}</TableCell>
                        <TableCell className="text-xs">{r.phone_number || "—"}</TableCell>
                        <TableCell className="text-xs">{r.date_of_birth || "—"}</TableCell>
                        <TableCell className="text-xs">{r.postcode || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">{r.address || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[80px] truncate">{r.iphone_pass_link || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[80px] truncate">{r.android_pass_link || "—"}</TableCell>
                        <TableCell>
                          {r.pk_pass_filename ? (
                            <div className="flex items-center gap-1">
                              <Ticket className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-[10px] truncate max-w-[60px]">{r.pk_pass_filename}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => removePkPass(r.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] h-6 px-1.5"
                                onClick={() => fileRefs.current[r.id]?.click()}
                              >
                                <Upload className="h-3 w-3 mr-0.5" /> .pkpass
                              </Button>
                              <input
                                ref={el => { fileRefs.current[r.id] = el; }}
                                type="file"
                                accept=".pkpass"
                                className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) attachPkPass(r.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeRow(r.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {parsed && rows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No valid rows detected. Make sure your data includes a header row with tab-separated columns.
              <Button variant="link" size="sm" onClick={handleReset} className="block mx-auto mt-2">
                Try again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 sticky bottom-0 bg-background">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {parsed && rows.length > 0 && (
                <>
                  <Badge variant="outline" className="text-xs">
                    {readyRows.length} member{readyRows.length !== 1 ? "s" : ""} ready to import
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2 self-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {parsed && (
                <Button
                  onClick={handleImport}
                  disabled={importing || !readyRows.length}
                >
                  {importing ? "Importing…" : `Import ${readyRows.length} Member${readyRows.length !== 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
