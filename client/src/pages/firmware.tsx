import { useState } from "react";
import { useFirmware, useDeleteFirmware } from "@/hooks/use-settings";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Trash2, 
  FileCode, 
  Download, 
  Search,
  Filter,
  Loader2,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { SUPPORTED_MANUFACTURERS } from "@shared/schema";

export default function FirmwarePage() {
  const { data: firmware, isLoading } = useFirmware();
  const { mutate: deleteFirmware } = useDeleteFirmware();
  const { toast } = useToast();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firmwareName, setFirmwareName] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("all");

  const uploadFirmware = useMutation({
    mutationFn: async (data: { file: File; name: string; version: string; manufacturer: string }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("name", data.name);
      formData.append("version", data.version);
      formData.append("manufacturer", data.manufacturer);
      
      const response = await fetch("/api/firmware", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firmware"] });
      setUploadDialogOpen(false);
      resetForm();
      toast({ title: "Firmware enviado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao enviar firmware", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedFile(null);
    setFirmwareName("");
    setFirmwareVersion("");
    setManufacturer("");
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este firmware?")) {
      deleteFirmware(id, {
        onSuccess: () => toast({ title: "Firmware excluído" })
      });
    }
  };

  const handleUpload = () => {
    if (selectedFile && firmwareName && firmwareVersion && manufacturer) {
      uploadFirmware.mutate({
        file: selectedFile,
        name: firmwareName,
        version: firmwareVersion,
        manufacturer
      });
    }
  };

  const handleDownload = async (fw: any) => {
    try {
      const response = await fetch(`/api/firmware/${fw.id}/download`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fw.filename || `${fw.name}-${fw.version}.bin`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Download iniciado" });
    } catch (error) {
      toast({ title: "Erro ao baixar firmware", variant: "destructive" });
    }
  };

  const filteredFirmware = firmware?.filter((fw) => {
    const matchesSearch = fw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (fw.version || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = filterManufacturer === "all" || fw.manufacturer === filterManufacturer;
    return matchesSearch && matchesManufacturer;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firmware</h1>
          <p className="text-muted-foreground">Repositório de imagens de sistema</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-firmware">
              <Upload className="h-4 w-4 mr-2" /> Upload Firmware
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload de Firmware</DialogTitle>
              <DialogDescription>
                Envie um novo arquivo de firmware para o repositório
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="firmwareName">Nome do Firmware</Label>
                <Input 
                  id="firmwareName"
                  value={firmwareName}
                  onChange={(e) => setFirmwareName(e.target.value)}
                  placeholder="Ex: RouterOS"
                  data-testid="input-firmware-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firmwareVersion">Versão</Label>
                <Input 
                  id="firmwareVersion"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  placeholder="Ex: 7.12.1"
                  data-testid="input-firmware-version"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Select value={manufacturer} onValueChange={setManufacturer}>
                  <SelectTrigger data-testid="select-manufacturer">
                    <SelectValue placeholder="Selecione o fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_MANUFACTURERS.map((mfr) => (
                      <SelectItem key={mfr.value} value={mfr.value}>
                        {mfr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firmwareFile">Arquivo</Label>
                <Input 
                  id="firmwareFile"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-firmware-file"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || !firmwareName || !firmwareVersion || !manufacturer || uploadFirmware.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadFirmware.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar firmware..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-firmware"
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-manufacturer">
              <SelectValue placeholder="Filtrar por fabricante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fabricantes</SelectItem>
              {SUPPORTED_MANUFACTURERS.map((mfr) => (
                <SelectItem key={mfr.value} value={mfr.value}>
                  {mfr.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredFirmware?.length ? (
          filteredFirmware.map((fw) => (
            <Card key={fw.id} data-testid={`card-firmware-${fw.id}`}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                    <FileCode className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{fw.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{fw.version}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fabricante:</span>
                    <span className="font-medium uppercase">{fw.manufacturer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tamanho:</span>
                    <span>{(fw.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span>{fw.createdAt ? format(new Date(fw.createdAt), "dd/MM/yyyy") : "-"}</span>
                  </div>
                  <div className="pt-3 flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownload(fw)}
                      data-testid={`button-download-${fw.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500" 
                      onClick={() => handleDelete(fw.id)}
                      data-testid={`button-delete-${fw.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum firmware disponível</p>
            <p className="text-sm mt-1">Clique em "Upload Firmware" para adicionar</p>
          </div>
        )}
      </div>
    </div>
  );
}
