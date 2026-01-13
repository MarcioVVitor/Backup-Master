import { useFiles, useDeleteFile } from "@/hooks/use-files";
import { useEquipment } from "@/hooks/use-equipment";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Download, Trash2, FileText, Calendar, HardDrive, Search, Eye, Loader2, Server, Filter, ArrowUpDown, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { ViewToggle, ViewMode } from "@/components/view-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Manufacturer, Equipment, File } from "@shared/schema";

interface BackupContent {
  success: boolean;
  filename: string;
  size: number;
  content: string;
  truncated: boolean;
  totalSize: number;
}

type SortField = "name" | "date" | "size" | "manufacturer";
type SortOrder = "asc" | "desc";
type GroupBy = "none" | "manufacturer" | "date";

export default function BackupsPage() {
  const { data: files, isLoading } = useFiles();
  const { data: equipment } = useEquipment();
  const { data: manufacturers = [] } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });
  const { t } = useI18n();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const { mutate: deleteFile } = useDeleteFile();
  const { toast } = useToast();
  const [selectedBackups, setSelectedBackups] = useState<Set<number>>(new Set());
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingBackup, setViewingBackup] = useState<{ id: number; filename: string } | null>(null);
  const [backupContent, setBackupContent] = useState<BackupContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["all"]));
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const getEquipment = (id: number | null): Equipment | undefined => {
    if (!id) return undefined;
    return equipment?.find(e => e.id === id);
  };

  const getEquipmentName = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.name || t.common.unknown;
  };

  const getEquipmentManufacturer = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.manufacturer || "";
  };

  const getEquipmentModel = (id: number | null) => {
    const eq = getEquipment(id);
    return eq?.model || "";
  };

  const uniqueModels = Array.from(
    new Set(
      equipment
        ?.map((e) => e.model)
        .filter((m): m is string => m !== null && m !== undefined)
    )
  );

  const filteredAndSortedFiles = useMemo(() => {
    if (!files) return [];
    
    let result = files.filter(file => {
      const matchesSearch = 
        file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEquipmentName(file.equipmentId).toLowerCase().includes(searchTerm.toLowerCase());
      
      const equipManufacturer = getEquipmentManufacturer(file.equipmentId);
      const matchesManufacturer = selectedManufacturer === "all" || equipManufacturer === selectedManufacturer;
      
      const equipModel = getEquipmentModel(file.equipmentId);
      const matchesModel = selectedModel === "all" || equipModel === selectedModel;
      
      return matchesSearch && matchesManufacturer && matchesModel;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.filename.localeCompare(b.filename);
          break;
        case "date":
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "manufacturer":
          comparison = getEquipmentManufacturer(a.equipmentId).localeCompare(getEquipmentManufacturer(b.equipmentId));
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [files, searchTerm, selectedManufacturer, selectedModel, sortField, sortOrder, equipment]);

  const groupedFiles = useMemo(() => {
    if (groupBy === "none") {
      return { "all": filteredAndSortedFiles };
    }

    const groups: Record<string, File[]> = {};
    filteredAndSortedFiles.forEach(file => {
      let key: string;
      if (groupBy === "manufacturer") {
        key = getEquipmentManufacturer(file.equipmentId) || "Desconhecido";
      } else {
        key = file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy") : "Sem data";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    });
    return groups;
  }, [filteredAndSortedFiles, groupBy]);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedFiles.slice(start, start + itemsPerPage);
  }, [filteredAndSortedFiles, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedFiles.length / itemsPerPage);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleDelete = (id: number) => {
    deleteFile(id, {
      onSuccess: () => {
        toast({ title: t.backups.fileDeleted, description: t.backups.removedSuccess });
        setSelectedBackups(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      onError: () => toast({ title: t.common.error, description: t.backups.deleteError, variant: "destructive" })
    });
  };

  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    const ids = Array.from(selectedBackups);
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        const response = await fetch(`/api/backups/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }
    
    setIsDeletingBulk(false);
    setBulkDeleteOpen(false);
    setSelectedBackups(new Set());
    
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    
    if (successCount > 0) {
      toast({ 
        title: `${successCount} ${t.backups.backupsDeleted}`, 
        description: errorCount > 0 ? `${errorCount} ${t.backups.deleteError}` : t.backups.removedSuccess 
      });
    } else if (errorCount > 0) {
      toast({ 
        title: t.common.error, 
        description: t.backups.deleteError,
        variant: "destructive"
      });
    }
  };

  const handleDownload = (id: number, filename: string) => {
    window.open(`/api/backups/${id}/download`, '_blank');
  };

  const handleView = async (id: number, filename: string, full: boolean = true) => {
    setViewingBackup({ id, filename });
    setViewDialogOpen(true);
    setIsLoadingContent(true);
    setBackupContent(null);
    
    try {
      const response = await fetch(`/api/backups/${id}/view?full=${full}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setBackupContent(data);
      } else {
        toast({ title: t.backups.contentError, variant: "destructive" });
      }
    } catch {
      toast({ title: t.backups.contentError, variant: "destructive" });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedBackups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBackups.size === filteredAndSortedFiles.length) {
      setSelectedBackups(new Set());
    } else {
      setSelectedBackups(new Set(filteredAndSortedFiles.map(f => f.id)));
    }
  };

  const getManufacturerLabel = (value: string) => {
    return manufacturers.find(m => m.value === value)?.label || value;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const renderCard = (file: File) => {
    const eq = getEquipment(file.equipmentId);
    const mfr = manufacturers.find(m => m.value === eq?.manufacturer);
    
    return (
      <Card 
        key={file.id} 
        className={`group transition-colors ${
          selectedBackups.has(file.id) 
            ? 'border-primary bg-primary/5' 
            : 'hover:border-primary/50'
        }`}
      >
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedBackups.has(file.id)}
              onCheckedChange={() => toggleSelection(file.id)}
              data-testid={`checkbox-backup-${file.id}`}
            />
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-base font-medium line-clamp-1" title={file.filename}>
                {file.filename}
              </CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.backups.equipmentLabel}:</span>
              <span className="font-medium">{getEquipmentName(file.equipmentId)}</span>
            </div>
            {eq && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">{t.backups.manufacturerLabel}:</span>
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  style={{ 
                    backgroundColor: mfr?.color ? `${mfr.color}20` : undefined,
                    color: mfr?.color || undefined
                  }}
                >
                  {mfr?.label || eq.manufacturer}
                </Badge>
              </div>
            )}
            {eq?.model && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.backups.modelLabel}:</span>
                <span className="text-xs">{eq.model}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {t.common.date}:
              </span>
              <span>
                {file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy HH:mm") : "-"}
              </span>
            </div>
            
            <div className="pt-2 flex gap-2">
              <Button 
                className="flex-1" 
                variant="outline" 
                size="sm"
                onClick={() => handleView(file.id, file.filename)}
                data-testid={`button-view-${file.id}`}
              >
                <Eye className="h-4 w-4 mr-2" /> {t.common.view}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => handleDownload(file.id, file.filename)}
                data-testid={`button-download-${file.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    data-testid={`button-delete-${file.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.backups.deleteBackup}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.backups.confirmDeleteSingle} <strong>{file.filename}</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700" 
                      onClick={() => handleDelete(file.id)}
                    >
                      {t.common.delete}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderListItem = (file: File) => {
    const eq = getEquipment(file.equipmentId);
    const mfr = manufacturers.find(m => m.value === eq?.manufacturer);
    
    return (
      <div 
        key={file.id} 
        className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
          selectedBackups.has(file.id) 
            ? 'border-primary bg-primary/5' 
            : 'hover:border-primary/50'
        }`}
      >
        <Checkbox 
          checked={selectedBackups.has(file.id)}
          onCheckedChange={() => toggleSelection(file.id)}
          data-testid={`checkbox-backup-${file.id}`}
        />
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{file.filename}</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{getEquipmentName(file.equipmentId)}</span>
            <span>{(file.size / 1024).toFixed(1)} KB</span>
            <span>{file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy HH:mm") : "-"}</span>
          </div>
        </div>
        {mfr && (
          <Badge 
            variant="secondary" 
            className="text-xs shrink-0"
            style={{ 
              backgroundColor: mfr?.color ? `${mfr.color}20` : undefined,
              color: mfr?.color || undefined
            }}
          >
            {mfr.label}
          </Badge>
        )}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleView(file.id, file.filename)}
            data-testid={`button-view-${file.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleDownload(file.id, file.filename)}
            data-testid={`button-download-${file.id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-red-500 hover:text-red-600"
                data-testid={`button-delete-${file.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.backups.deleteBackup}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.backups.confirmDeleteSingle} <strong>{file.filename}</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={() => handleDelete(file.id)}
                >
                  {t.common.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedBackups.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Arquivo
                  {sortField === "name" && <ArrowUpDown className="h-4 w-4" />}
                </div>
              </TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("manufacturer")}
              >
                <div className="flex items-center gap-2">
                  Fabricante
                  {sortField === "manufacturer" && <ArrowUpDown className="h-4 w-4" />}
                </div>
              </TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("size")}
              >
                <div className="flex items-center gap-2">
                  Tamanho
                  {sortField === "size" && <ArrowUpDown className="h-4 w-4" />}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSort("date")}
              >
                <div className="flex items-center gap-2">
                  Data
                  {sortField === "date" && <ArrowUpDown className="h-4 w-4" />}
                </div>
              </TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFiles.map(file => {
              const eq = getEquipment(file.equipmentId);
              const mfr = manufacturers.find(m => m.value === eq?.manufacturer);
              
              return (
                <TableRow 
                  key={file.id}
                  className={selectedBackups.has(file.id) ? "bg-primary/5" : ""}
                >
                  <TableCell>
                    <Checkbox 
                      checked={selectedBackups.has(file.id)}
                      onCheckedChange={() => toggleSelection(file.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={file.filename}>
                    {file.filename}
                  </TableCell>
                  <TableCell>{getEquipmentName(file.equipmentId)}</TableCell>
                  <TableCell>
                    {mfr && (
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{ 
                          backgroundColor: mfr?.color ? `${mfr.color}20` : undefined,
                          color: mfr?.color || undefined
                        }}
                      >
                        {mfr.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eq?.model || "-"}</TableCell>
                  <TableCell className="text-sm">{(file.size / 1024).toFixed(1)} KB</TableCell>
                  <TableCell className="text-sm">
                    {file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleView(file.id, file.filename)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDownload(file.id, file.filename)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.backups.deleteBackup}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t.backups.confirmDeleteSingle} <strong>{file.filename}</strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-red-600 hover:bg-red-700" 
                              onClick={() => handleDelete(file.id)}
                            >
                              {t.common.delete}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderGroupedContent = () => {
    const groups = Object.entries(groupedFiles);
    if (groups.length === 1 && groups[0][0] === "all") {
      if (viewMode === "cards") {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedFiles.map(renderCard)}
          </div>
        );
      } else if (viewMode === "list") {
        return (
          <div className="space-y-2">
            {paginatedFiles.map(renderListItem)}
          </div>
        );
      } else {
        return renderTableView();
      }
    }

    return (
      <div className="space-y-4">
        {groups.map(([groupName, groupFiles]) => {
          const mfr = manufacturers.find(m => m.value === groupName);
          const isExpanded = expandedGroups.has(groupName);
          
          return (
            <Collapsible key={groupName} open={isExpanded} onOpenChange={() => toggleGroup(groupName)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 h-12 px-4 bg-muted/50 hover:bg-muted">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">
                    {mfr?.label || groupName}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {groupFiles.length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupFiles.map(renderCard)}
                  </div>
                ) : viewMode === "list" ? (
                  <div className="space-y-2">
                    {groupFiles.map(renderListItem)}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox />
                          </TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-32 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupFiles.map(file => {
                          const eq = getEquipment(file.equipmentId);
                          return (
                            <TableRow key={file.id}>
                              <TableCell>
                                <Checkbox 
                                  checked={selectedBackups.has(file.id)}
                                  onCheckedChange={() => toggleSelection(file.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{file.filename}</TableCell>
                              <TableCell>{getEquipmentName(file.equipmentId)}</TableCell>
                              <TableCell>{(file.size / 1024).toFixed(1)} KB</TableCell>
                              <TableCell>
                                {file.createdAt ? format(new Date(file.createdAt), "dd/MM/yyyy HH:mm") : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleView(file.id, file.filename)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDownload(file.id, file.filename)}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.backups.title}</h1>
          <p className="text-muted-foreground">{t.backups.subtitle}</p>
        </div>
        <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t.backups.searchPlaceholder}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-backups"
          />
        </div>
        
        <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-manufacturer">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t.equipment.manufacturer} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.allManufacturers}</SelectItem>
            {manufacturers.map((mfr) => (
              <SelectItem key={mfr.value} value={mfr.value}>
                {mfr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-model">
            <Server className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t.equipment.model} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.allModels}</SelectItem>
            {uniqueModels.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-group">
            <FolderOpen className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Agrupar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem agrupamento</SelectItem>
            <SelectItem value="manufacturer">Por fabricante</SelectItem>
            <SelectItem value="date">Por data</SelectItem>
          </SelectContent>
        </Select>

        <Select value={`${sortField}-${sortOrder}`} onValueChange={(v) => {
          const [field, order] = v.split("-") as [SortField, SortOrder];
          setSortField(field);
          setSortOrder(order);
        }}>
          <SelectTrigger className="w-full md:w-[180px]" data-testid="select-sort">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Mais recentes</SelectItem>
            <SelectItem value="date-asc">Mais antigos</SelectItem>
            <SelectItem value="name-asc">Nome A-Z</SelectItem>
            <SelectItem value="name-desc">Nome Z-A</SelectItem>
            <SelectItem value="size-desc">Maior tamanho</SelectItem>
            <SelectItem value="size-asc">Menor tamanho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAndSortedFiles && filteredAndSortedFiles.length > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedBackups.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
              onCheckedChange={toggleSelectAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedBackups.size > 0 
                ? `${selectedBackups.size} ${t.backups.selectedOf} ${filteredAndSortedFiles.length}`
                : `${filteredAndSortedFiles.length} ${t.backups.availableBackups}`
              }
            </span>
          </div>
          {selectedBackups.size > 0 && (
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t.backups.deleteSelected} ({selectedBackups.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.backups.confirmDeleteMultiple} ({selectedBackups.size})?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.backups.deleteWarning}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingBulk}>{t.common.cancel}</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-red-600 hover:bg-red-700" 
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    {isDeletingBulk ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t.common.deleting}
                      </>
                    ) : (
                      t.common.delete
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {renderGroupedContent()}

      {groupBy === "none" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Anterior
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
            Próxima
          </Button>
        </div>
      )}
        
      {!filteredAndSortedFiles?.length && !isLoading && (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          <HardDrive className="h-12 w-12 mb-4 opacity-20" />
          <p>{t.backups.noBackups}</p>
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingBackup?.filename}
            </DialogTitle>
            <DialogDescription>
              {t.backups.fullContent}
              {backupContent && (
                <span className="ml-2 text-muted-foreground">
                  ({(backupContent.totalSize / 1024).toFixed(1)} KB)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t.backups.loadingContent}</span>
              </div>
            ) : backupContent ? (
              <pre className="text-sm font-mono bg-muted/50 p-4 rounded-lg whitespace-pre-wrap break-words">
                {backupContent.content}
              </pre>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {t.backups.contentError}
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline"
              onClick={() => viewingBackup && handleDownload(viewingBackup.id, viewingBackup.filename)}
            >
              <Download className="h-4 w-4 mr-2" />
              {t.common.download}
            </Button>
            <Button onClick={() => setViewDialogOpen(false)}>
              {t.common.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedBackups.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {selectedBackups.size} selecionados
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {selectedBackups.size === 1 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = Array.from(selectedBackups)[0];
                      const file = files?.find(f => f.id === id);
                      if (file) handleView(id, file.filename);
                    }}
                    data-testid="button-fixed-view"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {t.common.view}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = Array.from(selectedBackups)[0];
                      const file = files?.find(f => f.id === id);
                      if (file) handleDownload(id, file.filename);
                    }}
                    data-testid="button-fixed-download"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t.common.download}
                  </Button>
                </>
              )}
              <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive"
                    data-testid="button-fixed-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t.common.delete} ({selectedBackups.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.backups.confirmDeleteMultiple} ({selectedBackups.size})?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.backups.deleteWarning}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingBulk}>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700" 
                      onClick={handleBulkDelete}
                      disabled={isDeletingBulk}
                    >
                      {isDeletingBulk ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.common.deleting}
                        </>
                      ) : (
                        t.common.delete
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                onClick={() => setSelectedBackups(new Set())}
                data-testid="button-clear-selection"
              >
                Limpar seleção
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
