import { useScripts, useCreateScript, useDeleteScript } from "@/hooks/use-scripts";
import { useManufacturers } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, ArrowUpDown, ChevronDown, ChevronRight, FolderOpen, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { type InsertVendorScript, type VendorScript } from "@shared/schema";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ITEMS_PER_PAGE = 30;

export default function ScriptsPage() {
  const { data: scripts, isLoading } = useScripts();
  const { data: manufacturers } = useManufacturers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortField, setSortField] = useState<"name" | "manufacturer" | "timeout">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<"none" | "manufacturer">("none");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const { mutate: deleteScript } = useDeleteScript();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleDelete = (id: number) => {
    if (confirm(t.common.confirm + "?")) {
      deleteScript(id, {
        onSuccess: () => toast({ title: t.common.success })
      });
    }
  };

  const getScriptName = (script: any) => {
    if (!script.isDefault) return script.name;
    const isUpdate = script.name === "Script de Atualizacao";
    return isUpdate ? t.scripts.defaultNames.updateScript : t.scripts.defaultNames.backupScript;
  };

  const getScriptDescription = (script: any) => {
    if (!script.isDefault || !script.description) return script.description;
    const manufacturer = script.manufacturer?.toLowerCase().replace("-", "");
    const isUpdate = script.name === "Script de Atualizacao";
    const key = `${manufacturer}${isUpdate ? "Update" : "Backup"}`;
    return t.scripts.defaultDescriptions[key] || script.description;
  };

  const filteredAndSortedScripts = useMemo(() => {
    let result = scripts?.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.command.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "manufacturer":
          comparison = a.manufacturer.localeCompare(b.manufacturer);
          break;
        case "timeout":
          comparison = (a.timeout || 0) - (b.timeout || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [scripts, searchTerm, sortField, sortOrder]);

  const groupedScripts = useMemo(() => {
    if (groupBy === "none") {
      return { all: filteredAndSortedScripts };
    }
    return filteredAndSortedScripts.reduce((acc, script) => {
      const key = script.manufacturer;
      if (!acc[key]) acc[key] = [];
      acc[key].push(script);
      return acc;
    }, {} as Record<string, VendorScript[]>);
  }, [filteredAndSortedScripts, groupBy]);

  const totalPages = Math.ceil(filteredAndSortedScripts.length / ITEMS_PER_PAGE);
  const paginatedScripts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedScripts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedScripts, currentPage]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleGroupByChange = (val: "none" | "manufacturer") => {
    setGroupBy(val);
    if (val !== "none") {
      const allKeys = new Set(filteredAndSortedScripts.map(s => s.manufacturer));
      setExpandedGroups(allKeys);
    } else {
      setExpandedGroups(new Set());
    }
  };

  const renderScriptCard = (script: VendorScript) => (
    <Card key={script.id} className="relative overflow-hidden hover-elevate">
      <div className="absolute top-0 right-0 p-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(script.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="uppercase font-bold text-[10px]">
            {script.manufacturer}
          </Badge>
          {script.isDefault && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">{t.scripts.default}</Badge>}
        </div>
        <CardTitle className="text-lg">{getScriptName(script)}</CardTitle>
        <CardDescription className="line-clamp-2">{getScriptDescription(script) || t.scripts.noDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-24">
          {script.command}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
          <div>{t.scripts.extension}: <span className="font-medium text-foreground">{script.fileExtension}</span></div>
          <div>{t.scripts.timeout}: <span className="font-medium text-foreground">{script.timeout}ms</span></div>
        </div>
      </CardContent>
    </Card>
  );

  const renderScriptListItem = (script: VendorScript) => (
    <div key={script.id} className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase text-[10px]">{script.manufacturer}</Badge>
          {script.isDefault && <Badge className="bg-blue-100 text-blue-800 text-[10px]">{t.scripts.default}</Badge>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{getScriptName(script)}</div>
          <div className="text-sm text-muted-foreground truncate">{getScriptDescription(script)}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground">{script.timeout}ms</span>
        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(script.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderTableView = () => (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("name")}>
              <div className="flex items-center gap-2">
                {t.scripts.scriptName}
                {sortField === "name" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("manufacturer")}>
              <div className="flex items-center gap-2">
                {t.equipment.manufacturer}
                {sortField === "manufacturer" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead>{t.scripts.command}</TableHead>
            <TableHead>{t.scripts.extension}</TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("timeout")}>
              <div className="flex items-center gap-2">
                {t.scripts.timeout}
                {sortField === "timeout" && <ArrowUpDown className="h-4 w-4" />}
              </div>
            </TableHead>
            <TableHead className="text-right">{t.common.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedScripts.map(script => (
            <TableRow key={script.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getScriptName(script)}</span>
                  {script.isDefault && <Badge className="bg-blue-100 text-blue-800 text-[10px]">{t.scripts.default}</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="uppercase">{script.manufacturer}</Badge>
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs truncate max-w-[200px]">{script.command}</div>
              </TableCell>
              <TableCell>{script.fileExtension}</TableCell>
              <TableCell>{script.timeout}ms</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(script.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!paginatedScripts.length && !isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                {t.scripts.noScripts || "Nenhum script encontrado"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderGroupedContent = () => {
    const groups = Object.entries(groupedScripts);
    if (groups.length === 1 && groups[0][0] === "all") {
      if (viewMode === "cards") {
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedScripts.map(renderScriptCard)}
          </div>
        );
      } else if (viewMode === "list") {
        return (
          <div className="space-y-2">
            {paginatedScripts.map(renderScriptListItem)}
          </div>
        );
      } else {
        return renderTableView();
      }
    }

    return (
      <div className="space-y-4">
        {groups.map(([groupName, groupItems]) => {
          const mfr = manufacturers?.find(m => m.value === groupName);
          const isExpanded = expandedGroups.has(groupName);
          
          return (
            <Collapsible key={groupName} open={isExpanded} onOpenChange={() => toggleGroup(groupName)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 h-12 px-4 bg-muted/50 hover:bg-muted">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">{mfr?.label || groupName}</span>
                  <Badge variant="secondary" className="ml-2">{groupItems.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                {viewMode === "cards" ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groupItems.map(renderScriptCard)}
                  </div>
                ) : viewMode === "list" ? (
                  <div className="space-y-2">
                    {groupItems.map(renderScriptListItem)}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.scripts.scriptName}</TableHead>
                          <TableHead>{t.equipment.manufacturer}</TableHead>
                          <TableHead>{t.scripts.command}</TableHead>
                          <TableHead>{t.scripts.extension}</TableHead>
                          <TableHead>{t.scripts.timeout}</TableHead>
                          <TableHead className="text-right">{t.common.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupItems.map(script => (
                          <TableRow key={script.id}>
                            <TableCell className="font-medium">{getScriptName(script)}</TableCell>
                            <TableCell><Badge variant="outline">{script.manufacturer}</Badge></TableCell>
                            <TableCell><div className="font-mono text-xs truncate max-w-[200px]">{script.command}</div></TableCell>
                            <TableCell>{script.fileExtension}</TableCell>
                            <TableCell>{script.timeout}ms</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(script.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.scripts.title}</h1>
          <p className="text-muted-foreground">{t.scripts.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search + "..."}
              className="pl-9 w-[250px] bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> {t.scripts.addScript}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <Select value={groupBy} onValueChange={handleGroupByChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agrupar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento</SelectItem>
              <SelectItem value="manufacturer">Por Fabricante</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedScripts.length} scripts
        </div>
      </div>

      {renderGroupedContent()}

      {groupBy === "none" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CreateScriptDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        manufacturers={manufacturers || []} 
      />
    </div>
  );
}

function CreateScriptDialog({ open, onOpenChange, manufacturers }: any) {
  const { register, handleSubmit, reset } = useForm<InsertVendorScript>();
  const { mutate, isPending } = useCreateScript();
  const { toast } = useToast();
  const { t } = useI18n();
  const [manufacturer, setManufacturer] = useState("");

  const onSubmit = (data: InsertVendorScript) => {
    mutate({ ...data, manufacturer, timeout: Number(data.timeout) || 30000 }, {
      onSuccess: () => {
        toast({ title: t.common.success });
        onOpenChange(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.scripts.addScript}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.scripts.scriptName}</Label>
              <Input {...register("name")} required />
            </div>
            <div className="space-y-2">
              <Label>{t.equipment.manufacturer}</Label>
              <Select onValueChange={setManufacturer} required>
                <SelectTrigger>
                  <SelectValue placeholder={t.common.filter + "..."} />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m: any) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>{t.scripts.command}</Label>
            <Textarea 
              {...register("command")} 
              placeholder="/export file=backup" 
              className="font-mono text-sm h-32" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>{t.scripts.fileExtension}</Label>
              <Input {...register("fileExtension")} placeholder=".rsc" defaultValue=".cfg" />
            </div>
            <div className="space-y-2">
              <Label>{t.scripts.timeout}</Label>
              <Input type="number" {...register("timeout")} defaultValue="30000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.common.description}</Label>
            <Input {...register("description")} />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? t.scripts.saving : t.scripts.saveScript}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
