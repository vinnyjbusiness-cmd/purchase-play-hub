import { useState, useEffect } from "react";
import { X, GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SidebarConfig, SidebarItemConfig } from "@/hooks/useSidebarConfig";

interface NavItemDef {
  path: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  allItems: NavItemDef[];
  config: SidebarConfig | null;
  onSave: (config: SidebarConfig) => void;
  onReset: () => void;
}

export default function SidebarCustomisePanel({ open, onClose, allItems, config, onSave, onReset }: Props) {
  const [items, setItems] = useState<(NavItemDef & { visible: boolean; order: number })[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    const mapped = allItems.map((item, i) => {
      const cfg = config?.find(c => c.path === item.path);
      return {
        ...item,
        visible: cfg ? cfg.visible : true,
        order: cfg ? cfg.order : i,
      };
    });
    mapped.sort((a, b) => a.order - b.order);
    setItems(mapped);
  }, [allItems, config, open]);

  const toggleVisibility = (path: string) => {
    setItems(prev => prev.map(it => it.path === path ? { ...it, visible: !it.visible } : it));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleSave = () => {
    const cfg: SidebarConfig = items.map((it, i) => ({
      path: it.path,
      visible: it.visible,
      order: i,
    }));
    onSave(cfg);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-sidebar border-l border-sidebar-border h-full flex flex-col animate-in slide-in-from-right-full duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <h2 className="text-base font-semibold text-sidebar-primary-foreground">Customise Navigation</h2>
          <button onClick={onClose} className="text-sidebar-foreground hover:text-sidebar-primary-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-hide">
          {items.map((item, idx) => (
            <div
              key={item.path}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing",
                dragIdx === idx ? "bg-sidebar-accent/80 scale-[1.02]" : "hover:bg-sidebar-accent/40"
              )}
            >
              <GripVertical className="h-4 w-4 text-sidebar-muted shrink-0" />
              <span className={cn(
                "flex-1 text-sm font-medium",
                item.visible ? "text-sidebar-foreground" : "text-sidebar-muted line-through"
              )}>
                {item.label}
              </span>
              <Switch
                checked={item.visible}
                onCheckedChange={() => toggleVisibility(item.path)}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          ))}
        </div>

        <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
          <Button onClick={handleSave} className="w-full" size="sm">
            Save Changes
          </Button>
          <Button onClick={handleReset} variant="ghost" size="sm" className="w-full text-sidebar-muted hover:text-sidebar-foreground">
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Reset to Default
          </Button>
        </div>
      </div>
    </div>
  );
}
