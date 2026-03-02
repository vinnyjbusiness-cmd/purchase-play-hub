import { useState } from "react";
import { PERMISSION_PAGES, type Permissions, defaultPermissions } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Shield, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permissions;
  onSave: (perms: Permissions) => void;
  memberName?: string;
}

export default function PermissionsEditor({ open, onOpenChange, permissions, onSave, memberName }: Props) {
  const [perms, setPerms] = useState<Permissions>(() => ({
    ...defaultPermissions(),
    ...permissions,
  }));

  const toggle = (key: string) => {
    setPerms((p) => ({ ...p, [key]: !p[key as keyof Permissions] }));
  };

  const enableAll = () => setPerms(defaultPermissions(true));
  const disableAll = () => setPerms(defaultPermissions(false));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissions {memberName && `— ${memberName}`}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={enableAll}>Enable All</Button>
            <Button variant="outline" size="sm" onClick={disableAll}>Disable All</Button>
          </div>

          <div className="space-y-3">
            {PERMISSION_PAGES.map((page) => (
              <div key={page.key} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                <Label htmlFor={`perm-${page.key}`} className="text-sm font-medium cursor-pointer">
                  {page.label}
                </Label>
                <Switch
                  id={`perm-${page.key}`}
                  checked={!!perms[page.key]}
                  onCheckedChange={() => toggle(page.key)}
                />
              </div>
            ))}
          </div>

          <div className="pt-4 flex gap-2">
            <Button className="flex-1" onClick={() => { onSave(perms); onOpenChange(false); }}>
              Save Permissions
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
