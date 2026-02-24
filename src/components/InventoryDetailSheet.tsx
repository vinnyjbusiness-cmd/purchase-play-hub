import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Upload, Apple, Smartphone, Download, ChevronDown, ChevronRight } from "lucide-react";

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
  ticket_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  password: string | null;
  supporter_id: string | null;
  iphone_pass_link: string | null;
  android_pass_link: string | null;
  pk_pass_url: string | null;
  status: string;
  created_at: string;
  events: { match_code: string; home_team: string; away_team: string } | null;
}

export default function InventoryDetailSheet({ inventoryId, onClose, onUpdated }: Props) {
  const [item, setItem] = useState<InvDetail | null>(null);
  const [category, setCategory] = useState("");
  const [section, setSection] = useState("");
  const [block, setBlock] = useState("");
  const [rowName, setRowName] = useState("");
  const [seat, setSeat] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [supporterId, setSupporterId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [iphonePassLink, setIphonePassLink] = useState("");
  const [androidPassLink, setAndroidPassLink] = useState("");
  const [pkPassUrl, setPkPassUrl] = useState("");
  const [status, setStatus] = useState("");
  const [pkPassFile, setPkPassFile] = useState<File | null>(null);
  const [loginOpen, setLoginOpen] = useState(true);
  const [ticketOpen, setTicketOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!inventoryId) return;
    const { data } = await supabase
      .from("inventory")
      .select("*, events(match_code, home_team, away_team)")
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
      setFirstName(d.first_name || "");
      setLastName(d.last_name || "");
      setSupporterId(d.supporter_id || "");
      setEmail(d.email || "");
      setPassword(d.password || "");
      setIphonePassLink(d.iphone_pass_link || "");
      setAndroidPassLink(d.android_pass_link || "");
      setPkPassUrl(d.pk_pass_url || "");
      setStatus(d.status);
    }
  }, [inventoryId]);

  useEffect(() => { if (inventoryId) load(); }, [inventoryId, load]);

  const handleSave = async () => {
    if (!inventoryId) return;

    let finalPkPassUrl = pkPassUrl;
    if (pkPassFile) {
      const path = `pk-passes/${Date.now()}-${pkPassFile.name}`;
      const { error } = await supabase.storage.from("logos").upload(path, pkPassFile);
      if (error) { toast.error("Failed to upload PK pass"); return; }
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      finalPkPassUrl = data.publicUrl;
    }

    const { error } = await supabase.from("inventory").update({
      category,
      section: section || null,
      block: block || null,
      row_name: rowName || null,
      seat: seat || null,
      face_value: faceValue ? parseFloat(faceValue) : null,
      ticket_name: [firstName, lastName].filter(Boolean).join(" ") || null,
      first_name: firstName || null,
      last_name: lastName || null,
      supporter_id: supporterId || null,
      email: email || null,
      password: password || null,
      iphone_pass_link: iphonePassLink || null,
      android_pass_link: androidPassLink || null,
      pk_pass_url: finalPkPassUrl || null,
      status: status as any,
    }).eq("id", inventoryId);
    if (error) { toast.error(error.message); return; }
    toast.success("Inventory updated");
    setPkPassFile(null);
    load();
    onUpdated();
  };

  if (!item) return null;

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

            {/* Seating Info */}
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

            {/* Login Details — Collapsible */}
            <Collapsible open={loginOpen} onOpenChange={setLoginOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2 border-t border-border">
                {loginOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Login Details
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Supporter ID</Label>
                  <Input value={supporterId} onChange={e => setSupporterId(e.target.value)} placeholder="e.g. LFC-12345" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Ticket Details — Collapsible */}
            <Collapsible open={ticketOpen} onOpenChange={setTicketOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2 border-t border-border">
                {ticketOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Ticket Details
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {/* Pass links display */}
                {(item.iphone_pass_link || item.android_pass_link || item.pk_pass_url) && (
                  <div className="flex items-center gap-3 mb-2">
                    {item.iphone_pass_link && (
                      <a href={item.iphone_pass_link} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Apple className="h-3.5 w-3.5" /> iPhone Pass
                      </a>
                    )}
                    {item.android_pass_link && (
                      <a href={item.android_pass_link} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Smartphone className="h-3.5 w-3.5" /> Android Pass
                      </a>
                    )}
                    {item.pk_pass_url && (
                      <a href={item.pk_pass_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Download className="h-3.5 w-3.5" /> PK Pass
                      </a>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>iPhone Pass Link</Label>
                    <Input value={iphonePassLink} onChange={e => setIphonePassLink(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Android Pass Link</Label>
                    <Input value={androidPassLink} onChange={e => setAndroidPassLink(e.target.value)} placeholder="https://..." />
                  </div>
                </div>

                {/* PK Pass upload */}
                <div className="space-y-1.5">
                  <Label>PK Pass File</Label>
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && (file.name.endsWith(".pkpass") || file.name.endsWith(".pk"))) setPkPassFile(file);
                      else toast.error("Please drop a .pkpass file");
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pkpass,.pk"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setPkPassFile(f); }}
                    />
                    {pkPassFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="font-medium">{pkPassFile.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setPkPassFile(null); }} className="text-muted-foreground hover:text-destructive ml-2">✕</button>
                      </div>
                    ) : pkPassUrl ? (
                      <div className="text-sm text-primary">PK Pass uploaded — drop new file to replace</div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <Upload className="h-4 w-4 mx-auto mb-1 opacity-50" />
                        Drag & drop .pkpass or click to browse
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button onClick={handleSave} className="w-full">Save Changes</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
