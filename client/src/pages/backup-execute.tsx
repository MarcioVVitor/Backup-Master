import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Play, 
  Search, 
  Server, 
  Network, 
  Wifi, 
  List,
  CheckSquare,
  Globe,
  HelpCircle
} from "lucide-react";
import { Link } from "wouter";
import type { Equipment, Manufacturer } from "@shared/schema";

interface BackupProgress {
  current: number;
  total: number;
  percentage: number;
  currentEquipment: string | null;
  logs: string[];
  isRunning: boolean;
  completed: boolean;
}

const manufacturerIcons: Record<string, typeof Server> = {
  mikrotik: Server,
  huawei: Network,
  cisco: Wifi,
  nokia: Network,
  zte: Network,
  datacom: Server,
  "datacom-dmos": Server,
  juniper: Network,
};

const manufacturerColors: Record<string, string> = {
  mikrotik: "bg-red-500",
  huawei: "bg-red-600",
  cisco: "bg-blue-500",
  nokia: "bg-blue-700",
  zte: "bg-cyan-500",
  datacom: "bg-emerald-500",
  "datacom-dmos": "bg-teal-500",
  juniper: "bg-green-500",
};

export default function BackupExecutePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<BackupProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    currentEquipment: null,
    logs: [],
    isRunning: false,
    completed: false,
  });
  const logRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: manufacturers = [] } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });

  const filteredEquipment = equipment.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.model?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesManufacturer =
      selectedManufacturer === "all" || e.manufacturer === selectedManufacturer;
    const matchesModel = selectedModel === "all" || e.model === selectedModel;
    return matchesSearch && matchesManufacturer && matchesModel;
  });

  const uniqueModels = Array.from(new Set(equipment.map((e) => e.model).filter((m): m is string => m !== null && m !== undefined)));

  const manufacturerCounts = equipment.reduce((acc, e) => {
    acc[e.manufacturer] = (acc[e.manufacturer] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toggleEquipment = (id: number) => {
    setSelectedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    if (selectedEquipment.size === filteredEquipment.length) {
      setSelectedEquipment(new Set());
    } else {
      setSelectedEquipment(new Set(filteredEquipment.map((e) => e.id)));
    }
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress.logs]);

  const formatTime = (date: Date) => {
    return date.toTimeString().split(" ")[0];
  };

  const addLog = (message: string) => {
    const timestamp = formatTime(new Date());
    setProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${timestamp}] ${message}`],
    }));
  };

  const executeBackup = async () => {
    const equipmentIds = Array.from(selectedEquipment);
    if (equipmentIds.length === 0) return;

    setProgress({
      current: 0,
      total: equipmentIds.length,
      percentage: 0,
      currentEquipment: null,
      logs: [],
      isRunning: true,
      completed: false,
    });

    addLog(`${t.executeBackup.startingBackup} ${equipmentIds.length} ${t.executeBackup.equipmentCount}...`);

    for (let i = 0; i < equipmentIds.length; i++) {
      const eq = equipment.find((e) => e.id === equipmentIds[i]);
      if (!eq) continue;

      setProgress((prev) => ({
        ...prev,
        current: i + 1,
        percentage: Math.round(((i + 1) / equipmentIds.length) * 100),
        currentEquipment: eq.name,
      }));

      addLog(`[${i + 1}/${equipmentIds.length}] ${t.executeBackup.startingBackup}: ${eq.name} (${eq.ip})`);

      try {
        const response = await fetch(`/api/backup/execute/${eq.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();
          addLog(`\u2713 ${eq.name}: ${t.executeBackup.backupOf} ${eq.name} ${t.executeBackup.backupCompleted}`);
        } else {
          const error = await response.json().catch(() => ({ message: t.common.unknown }));
          addLog(`\u2717 ${eq.name}: ${t.executeBackup.backupError} - ${error.message || t.common.unknown}`);
        }
      } catch (error) {
        addLog(`\u2717 ${eq.name}: ${t.executeBackup.connectionError}`);
      }
    }

    setProgress((prev) => ({
      ...prev,
      isRunning: false,
      completed: true,
      currentEquipment: null,
    }));

    addLog(`${t.executeBackup.backupFinished}. Total: ${equipmentIds.length} ${t.executeBackup.equipmentCount}.`);
  };

  const getEquipmentIcon = (manufacturer: string) => {
    const Icon = manufacturerIcons[manufacturer.toLowerCase()] || HelpCircle;
    return Icon;
  };

  const getManufacturerColor = (manufacturer: string) => {
    return manufacturerColors[manufacturer.toLowerCase()] || "bg-gray-500";
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div className="flex items-center gap-3">
          <Play className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.executeBackup.title}</h1>
            <p className="text-sm text-muted-foreground">{t.executeBackup.subtitle}</p>
          </div>
        </div>
        <Link href="/backups">
          <Button variant="outline" data-testid="button-view-backups">
            <List className="h-4 w-4 mr-2" />
            {t.executeBackup.viewBackups}
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">{t.executeBackup.filterByManufacturer}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          <Card
            className={`cursor-pointer transition-all ${
              selectedManufacturer === "all"
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedManufacturer("all")}
            data-testid="filter-all"
          >
            <CardContent className="p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium text-sm">{t.common.all}</span>
                <div className="w-full bg-blue-500 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: "100%" }} />
                </div>
                <span className="text-xs text-muted-foreground">{equipment.length}</span>
              </div>
            </CardContent>
          </Card>

          {manufacturers.map((mfr) => {
            const count = manufacturerCounts[mfr.value] || 0;
            const Icon = manufacturerIcons[mfr.value] || Server;
            const colorClass = manufacturerColors[mfr.value] || "bg-gray-500";

            return (
              <Card
                key={mfr.value}
                className={`cursor-pointer transition-all ${
                  selectedManufacturer === mfr.value
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedManufacturer(mfr.value)}
                data-testid={`filter-${mfr.value}`}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`p-3 rounded-lg ${colorClass}/10`}
                      style={{ backgroundColor: mfr.color ? `${mfr.color}20` : undefined }}
                    >
                      <Icon
                        className="h-6 w-6"
                        style={{ color: mfr.color || undefined }}
                      />
                    </div>
                    <span className="font-medium text-sm">{mfr.label}</span>
                    <div className="w-full rounded-full h-1.5 bg-muted">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: count > 0 ? "100%" : "0%",
                          backgroundColor: mfr.color || undefined,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.executeBackup.searchPlaceholder}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-equipment"
          />
        </div>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-model">
            <SelectValue placeholder={t.executeBackup.allModels} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.executeBackup.allModels}</SelectItem>
            {uniqueModels.map((model) => (
              <SelectItem key={model} value={model!}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={selectAllVisible}
          data-testid="button-select-all"
        >
          <CheckSquare className="h-4 w-4 mr-2" />
          {selectedEquipment.size === filteredEquipment.length && filteredEquipment.length > 0
            ? t.executeBackup.deselectAll
            : t.executeBackup.selectAllVisible}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{t.menu.equipment}</span>
        <Badge variant="secondary" className="text-xs">
          {selectedEquipment.size} {t.executeBackup.selected}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingEquipment ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            {t.executeBackup.loadingEquipment}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            {t.executeBackup.noEquipmentFound}
          </div>
        ) : (
          filteredEquipment.map((eq) => {
            const isSelected = selectedEquipment.has(eq.id);
            const mfr = manufacturers.find((m) => m.value === eq.manufacturer);
            const Icon = getEquipmentIcon(eq.manufacturer);

            return (
              <Card
                key={eq.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "ring-2 ring-primary border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => toggleEquipment(eq.id)}
                data-testid={`equipment-card-${eq.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleEquipment(eq.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                      data-testid={`checkbox-equipment-${eq.id}`}
                    />
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${mfr?.color || "#6b7280"}20` }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: mfr?.color || "#6b7280" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{eq.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Network className="h-3 w-3" />
                        <span>{eq.ip}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Server className="h-3 w-3" />
                        <span>{eq.model || t.executeBackup.noModel}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {progress.isRunning || progress.completed ? (
        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span className="font-medium">{t.executeBackup.backupProgress}</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress.percentage}%</span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <Progress value={progress.percentage} className="h-3" />
          </div>

          <ScrollArea className="h-48 border rounded-lg bg-zinc-900 dark:bg-black">
            <div
              ref={logRef}
              className="p-4 font-mono text-xs text-green-400 whitespace-pre-wrap"
            >
              {progress.logs.map((log, i) => (
                <div key={i} className="py-0.5">
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {selectedEquipment.size > 0 && !progress.isRunning && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            onClick={executeBackup}
            disabled={progress.isRunning}
            className="shadow-lg"
            data-testid="button-execute-backup"
          >
            <Play className="h-5 w-5 mr-2" />
            {t.executeBackup.executeNow} ({selectedEquipment.size})
          </Button>
        </div>
      )}
    </div>
  );
}
