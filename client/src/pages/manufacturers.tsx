import { useManufacturers, useCreateManufacturer, useDeleteManufacturer } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import {
  Dialog,
  DialogContent,
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

const ITEMS_PER_PAGE = 30;

export default function ManufacturersPage() {
  const { data: manufacturers, isLoading } = useManufacturers();
  const { mutate: deleteManufacturer } = useDeleteManufacturer();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortField, setSortField] = useState<"label" | "value">("label");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useI18n();

  const handleDelete = (id: number) => {
    if (confirm(`${t.common.confirm}?`)) {
      deleteManufacturer(id, {
        onSuccess: () => toast({ title: t.common.success })
      });
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredAndSortedManufacturers = useMemo(() => {
    let result = manufacturers?.filter(m =>
      m.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.value.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "label":
          comparison = a.label.localeCompare(b.label);
          break;
        case "value":
          comparison = a.value.localeCompare(b.value);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [manufacturers, searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedManufacturers.length / ITEMS_PER_PAGE);
  const paginatedManufacturers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedManufacturers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedManufacturers, currentPage]);

  const renderCardView = () => (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      {paginatedManufacturers.map((m) => (
        <Card key={m.id} className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
              style={{ backgroundColor: m.color || '#64748b' }}
            >
              {m.label[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{m.label}</p>
              <p className="text-xs text-muted-foreground font-mono">{m.value}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} data-testid={`button-delete-manufacturer-${m.id}`}>
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </Card>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-16"></TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("label")}>
              <div className="flex items-center gap-1">
                {t.manufacturers.manufacturerName}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => toggleSort("value")}>
              <div className="flex items-center gap-1">
                {t.common.type}
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead>{t.admin.primaryColor}</TableHead>
            <TableHead className="w-20 text-right">{t.common.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedManufacturers.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div 
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold shadow-sm"
                  style={{ backgroundColor: m.color || '#64748b' }}
                >
                  {m.label[0].toUpperCase()}
                </div>
              </TableCell>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">{m.value}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-5 h-5 rounded border"
                    style={{ backgroundColor: m.color || '#64748b' }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">{m.color || '#64748b'}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} data-testid={`button-delete-manufacturer-${m.id}`}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {paginatedManufacturers.map((m) => (
        <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold shadow-sm"
              style={{ backgroundColor: m.color || '#64748b' }}
            >
              {m.label[0].toUpperCase()}
            </div>
            <div className="flex items-center gap-4">
              <span className="font-medium">{m.label}</span>
              <span className="text-sm font-mono text-muted-foreground">{m.value}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} data-testid={`button-delete-manufacturer-${m.id}`}>
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.manufacturers.title}</h1>
          <p className="text-muted-foreground">{t.manufacturers.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search + "..."}
              className="pl-9 w-[250px] bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-manufacturers"
            />
          </div>
          <Button onClick={() => setIsOpen(true)} data-testid="button-add-manufacturer">
            <Plus className="h-4 w-4 mr-2" /> {t.manufacturers.addManufacturer}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedManufacturers.length} {t.manufacturers.title.toLowerCase()}
        </div>
      </div>

      {viewMode === "cards" && renderCardView()}
      {viewMode === "table" && renderTableView()}
      {viewMode === "list" && renderListView()}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
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
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CreateManufacturerDialog open={isOpen} onOpenChange={setIsOpen} />
    </div>
  );
}

function CreateManufacturerDialog({ open, onOpenChange }: any) {
  const { register, handleSubmit, reset } = useForm();
  const { mutate, isPending } = useCreateManufacturer();
  const { toast } = useToast();
  const { t } = useI18n();

  const onSubmit = (data: any) => {
    mutate(data, {
      onSuccess: () => {
        toast({ title: t.common.success });
        onOpenChange(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.manufacturers.addManufacturer}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.manufacturers.manufacturerName}</Label>
            <Input {...register("label")} placeholder="Cisco Systems" required data-testid="input-manufacturer-label" />
          </div>
          <div className="space-y-2">
            <Label>{t.common.type}</Label>
            <Input {...register("value")} placeholder="cisco" required className="lowercase" data-testid="input-manufacturer-value" />
          </div>
          <div className="space-y-2">
            <Label>{t.admin.primaryColor}</Label>
            <div className="flex gap-2">
              <Input {...register("color")} type="color" className="w-12 h-10 p-1" defaultValue="#3b82f6" data-testid="input-manufacturer-color-picker" />
              <Input {...register("color")} placeholder="#3b82f6" defaultValue="#3b82f6" className="flex-1" data-testid="input-manufacturer-color-text" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-manufacturer">
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
