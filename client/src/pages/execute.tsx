import { useEquipment } from "@/hooks/use-equipment";
import { useExecuteBackup } from "@/hooks/use-files";
import { Button } from "@/components/ui/button";
import { Play, CheckSquare, Square, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/i18n-context";

export default function ExecutePage() {
  const { data: equipment } = useEquipment();
  const { mutate: executeBackup, isPending } = useExecuteBackup();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { t } = useI18n();

  const filteredEquipment = equipment?.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.ip.includes(searchTerm)
  );

  const handleSelectAll = () => {
    if (selectedIds.length === filteredEquipment?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEquipment?.map(e => e.id) || []);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExecute = () => {
    if (selectedIds.length === 0) return;
    executeBackup(selectedIds, {
      onSuccess: () => {
        toast({ title: t.executeBackup.startingBackup, description: `${t.executeBackup.startingBackup} ${selectedIds.length} ${t.executeBackup.equipmentCount}.` });
        setSelectedIds([]);
      },
      onError: () => {
        toast({ title: t.common.error, description: t.executeBackup.executionFailed, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.executeBackup.title}</h1>
          <p className="text-muted-foreground">{t.executeBackup.selectEquipment}</p>
        </div>
        <div className="flex items-center gap-2">
           <Input 
             placeholder={`${t.common.filter}...`}
             className="w-[200px]" 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
           <Button onClick={handleExecute} disabled={isPending || selectedIds.length === 0} className="w-full md:w-auto">
            <Play className="h-4 w-4 mr-2" />
            {isPending ? t.executeBackup.executing : `${t.common.execute} (${selectedIds.length})`}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{t.equipment.title}</CardTitle>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedIds.length === filteredEquipment?.length ? (
                <>
                  <Square className="h-4 w-4 mr-2" /> {t.executeBackup.deselectAll}
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" /> {t.executeBackup.selectAllVisible}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment?.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div 
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`
                    cursor-pointer p-4 rounded-lg border flex items-center justify-between transition-all
                    ${isSelected 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-border hover:border-primary/30 hover:bg-muted/50"}
                  `}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium truncate">{item.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.ip}</span>
                      <span className="uppercase">{item.manufacturer}</span>
                    </div>
                  </div>
                  <div className={`
                    w-5 h-5 rounded border flex items-center justify-center
                    ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}
                  `}>
                    {isSelected && <Play className="h-3 w-3 fill-current" />}
                  </div>
                </div>
              );
            })}
            {!filteredEquipment?.length && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                {t.executeBackup.noEquipmentFound}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
