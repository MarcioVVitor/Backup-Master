import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  X,
  RotateCcw,
  Play,
  Server,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

const MANUFACTURERS = [
  { value: "mikrotik", label: "Mikrotik" },
  { value: "huawei", label: "Huawei" },
  { value: "cisco", label: "Cisco" },
  { value: "nokia", label: "Nokia" },
  { value: "zte", label: "ZTE" },
  { value: "datacom", label: "Datacom" },
  { value: "datacom-dmos", label: "Datacom DMOS" },
  { value: "juniper", label: "Juniper" },
];

interface Firmware {
  id: number;
  name: string;
  version: string;
  manufacturer: string;
  filename: string;
  size: number;
  createdAt: string;
}

interface VendorScript {
  id: number;
  name: string;
  manufacturer: string;
  command: string;
  description: string | null;
  fileExtension: string;
  timeout: number;
  isDefault: boolean;
}

interface Equipment {
  id: number;
  name: string;
  ip: string;
  manufacturer: string;
  model: string | null;
}

export default function FirmwarePage() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firmwareName, setFirmwareName] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("all");
  
  const [recoveryManufacturer, setRecoveryManufacturer] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [selectedScript, setSelectedScript] = useState<VendorScript | null>(null);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);

  const { data: firmware = [], isLoading, error } = useQuery<Firmware[]>({
    queryKey: ["/api/firmware"],
  });

  const { data: scripts = [] } = useQuery<VendorScript[]>({
    queryKey: ["/api/scripts"],
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

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
        const err = await response.json();
        throw new Error(err.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firmware"] });
      setUploadDialogOpen(false);
      resetForm();
      toast({ title: "Firmware enviado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao enviar firmware", variant: "destructive" });
    }
  });

  const deleteFirmware = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/firmware/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Delete failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firmware"] });
      toast({ title: "Firmware excluído" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir firmware", variant: "destructive" });
    }
  });

  const executeRecovery = useMutation({
    mutationFn: async (data: { equipmentId: number; scriptId: number }) => {
      const response = await fetch("/api/execute/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Recovery failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setRecoveryDialogOpen(false);
      setSelectedEquipment("");
      setSelectedScript(null);
      toast({ title: "Recuperação iniciada com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Erro ao executar recuperação", variant: "destructive" });
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
      deleteFirmware.mutate(id);
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

  const handleDownload = async (fw: Firmware) => {
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
    } catch (err) {
      toast({ title: "Erro ao baixar firmware", variant: "destructive" });
    }
  };

  const handleExecuteRecovery = () => {
    if (selectedEquipment && selectedScript) {
      executeRecovery.mutate({
        equipmentId: parseInt(selectedEquipment),
        scriptId: selectedScript.id
      });
    }
  };

  const filteredFirmware = firmware.filter((fw) => {
    const matchesSearch = fw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (fw.version || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = filterManufacturer === "all" || fw.manufacturer === filterManufacturer;
    return matchesSearch && matchesManufacturer;
  });

  const updateScripts = scripts.filter(s => 
    s.name.toLowerCase().includes("atualiza") || 
    s.name.toLowerCase().includes("update") ||
    s.name.toLowerCase().includes("upgrade") ||
    s.name.toLowerCase().includes("recovery") ||
    s.name.toLowerCase().includes("recupera")
  );

  const filteredRecoveryScripts = recoveryManufacturer === "all" 
    ? scripts 
    : scripts.filter(s => s.manufacturer === recoveryManufacturer);

  const filteredEquipment = selectedScript 
    ? equipment.filter(e => e.manufacturer === selectedScript.manufacturer)
    : equipment;

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">
          <p className="text-red-500">Erro ao carregar firmwares</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firmware</h1>
          <p className="text-muted-foreground">Repositório de imagens e recuperação de sistema</p>
        </div>
      </div>

      <Tabs defaultValue="repository" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repository" data-testid="tab-repository">
            <FileCode className="h-4 w-4 mr-2" />
            Repositório
          </TabsTrigger>
          <TabsTrigger value="recovery" data-testid="tab-recovery">
            <RotateCcw className="h-4 w-4 mr-2" />
            Recuperação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repository" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
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
                    {MANUFACTURERS.map((mfr) => (
                      <SelectItem key={mfr.value} value={mfr.value}>
                        {mfr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                        {MANUFACTURERS.map((mfr) => (
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFirmware.length > 0 ? (
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
                        <span>{((fw.size || 0) / (1024 * 1024)).toFixed(2)} MB</span>
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
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Scripts de Atualização / Recuperação
              </CardTitle>
              <CardDescription>
                Selecione um script para executar a recuperação ou atualização de firmware em um equipamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={recoveryManufacturer} onValueChange={setRecoveryManufacturer}>
                    <SelectTrigger className="w-[180px]" data-testid="select-recovery-manufacturer">
                      <SelectValue placeholder="Filtrar por fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os fabricantes</SelectItem>
                      {MANUFACTURERS.map((mfr) => (
                        <SelectItem key={mfr.value} value={mfr.value}>
                          {mfr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredRecoveryScripts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRecoveryScripts.map((script) => (
                    <Card 
                      key={script.id} 
                      className={`cursor-pointer transition-all ${
                        selectedScript?.id === script.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedScript(selectedScript?.id === script.id ? null : script)}
                      data-testid={`card-script-${script.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="uppercase font-bold text-[10px]">
                            {script.manufacturer}
                          </Badge>
                          {selectedScript?.id === script.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <CardTitle className="text-base mt-2">{script.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {script.description || "Sem descrição"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted rounded-md p-2 font-mono text-xs overflow-hidden">
                          <code className="line-clamp-3">{script.command}</code>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Ext: <span className="font-medium text-foreground">{script.fileExtension}</span></span>
                          <span>Timeout: <span className="font-medium text-foreground">{script.timeout}ms</span></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum script de atualização encontrado</p>
                  <p className="text-sm mt-1">Adicione scripts na página de Scripts</p>
                </div>
              )}

              {selectedScript && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/20">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Executar em Equipamento
                  </h3>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Selecione o Equipamento</Label>
                      <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                        <SelectTrigger data-testid="select-equipment">
                          <SelectValue placeholder="Escolha um equipamento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredEquipment.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id.toString()}>
                              {eq.name} ({eq.ip}) - {eq.manufacturer.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filteredEquipment.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum equipamento {selectedScript.manufacturer.toUpperCase()} encontrado
                        </p>
                      )}
                    </div>
                    <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          disabled={!selectedEquipment}
                          data-testid="button-execute-recovery"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Executar Recuperação
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirmar Execução</DialogTitle>
                          <DialogDescription>
                            Você está prestes a executar o script de recuperação no equipamento selecionado.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-3">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Script:</p>
                            <p className="font-medium">{selectedScript.name}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Equipamento:</p>
                            <p className="font-medium">
                              {filteredEquipment.find(e => e.id.toString() === selectedEquipment)?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {filteredEquipment.find(e => e.id.toString() === selectedEquipment)?.ip}
                            </p>
                          </div>
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <AlertCircle className="h-4 w-4 inline mr-2" />
                              Esta ação pode reiniciar o equipamento. Certifique-se de que isso não afetará serviços críticos.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRecoveryDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleExecuteRecovery}
                            disabled={executeRecovery.isPending}
                            data-testid="button-confirm-recovery"
                          >
                            {executeRecovery.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-2" />
                            )}
                            Confirmar Execução
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
