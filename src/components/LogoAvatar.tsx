import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogoAvatarProps {
  name: string;
  logoUrl: string | null;
  entityType: "supplier" | "platform";
  entityId: string;
  editable?: boolean;
  size?: "sm" | "md" | "lg";
  onLogoUpdated?: (url: string) => void;
}

const COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-purple-600",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const sizeClasses = {
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-lg",
};

export default function LogoAvatar({ name, logoUrl, entityType, entityId, editable = false, size = "md", onLogoUpdated }: LogoAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${entityType}s/${entityId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      const urlWithCache = `${publicUrl}?t=${Date.now()}`;
      const table = entityType === "supplier" ? "suppliers" : "platforms";
      const { error: updateError } = await supabase.from(table).update({ logo_url: urlWithCache } as any).eq("id", entityId);
      if (updateError) throw updateError;
      onLogoUpdated?.(urlWithCache);
      toast.success("Logo updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={cn("rounded-xl object-cover bg-muted", sizeClasses[size])}
        />
      ) : (
        <div className={cn("rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-white", sizeClasses[size], getColor(name))}>
          {getInitials(name)}
        </div>
      )}
      {editable && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            {uploading ? <Upload className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </>
      )}
    </div>
  );
}
