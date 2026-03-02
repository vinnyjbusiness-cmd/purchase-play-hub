import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarItemConfig {
  path: string;
  visible: boolean;
  order: number;
}

export type SidebarConfig = SidebarItemConfig[];

export function useSidebarConfig() {
  const [config, setConfig] = useState<SidebarConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("user_preferences")
        .select("sidebar_config")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.sidebar_config && Array.isArray(data.sidebar_config)) {
        setConfig(data.sidebar_config as unknown as SidebarConfig);
      }
      setLoading(false);
    }
    load();
  }, []);

  const saveConfig = useCallback(async (newConfig: SidebarConfig) => {
    setConfig(newConfig);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, sidebar_config: newConfig as any },
        { onConflict: "user_id" }
      );
  }, []);

  const resetConfig = useCallback(async () => {
    setConfig(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, sidebar_config: {} as any },
        { onConflict: "user_id" }
      );
  }, []);

  return { config, loading, saveConfig, resetConfig };
}
