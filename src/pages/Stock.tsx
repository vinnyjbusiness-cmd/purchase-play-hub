import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { Boxes, Package } from "lucide-react";
import InventoryPage from "./Inventory";
import PurchasesPage from "./Purchases";

export default function Stock() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "inventory";

  return (
    <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })} className="w-full">
      <div className="px-6 pt-6">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Boxes className="h-4 w-4" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2">
            <Package className="h-4 w-4" /> Purchases
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="inventory" className="mt-0">
        <InventoryPage />
      </TabsContent>
      <TabsContent value="purchases" className="mt-0">
        <PurchasesPage />
      </TabsContent>
    </Tabs>
  );
}