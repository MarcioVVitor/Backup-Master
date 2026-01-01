import { useScripts, useCreateScript, useDeleteScript } from "@/hooks/use-scripts";
import { useManufacturers } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Plus, Terminal, Trash2 } from "lucide-react";
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { type InsertVendorScript } from "@shared/schema";

export default function ScriptsPage() {
  const { data: scripts, isLoading } = useScripts();
  const { data: manufacturers } = useManufacturers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { mutate: deleteScript } = useDeleteScript();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Excluir este script?")) {
      deleteScript(id, {
        onSuccess: () => toast({ title: "Script removido" })
      });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scripts</h1>
          <p className="text-muted-foreground">Comandos de backup por fabricante</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Script
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scripts?.map((script) => (
          <Card key={script.id} className="relative overflow-hidden">
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
                {script.isDefault && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">Padrão</Badge>}
              </div>
              <CardTitle className="text-lg">{script.name}</CardTitle>
              <CardDescription className="line-clamp-2">{script.description || "Sem descrição"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                {script.command}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <div>Ext: <span className="font-medium text-foreground">{script.fileExtension}</span></div>
                <div>Timeout: <span className="font-medium text-foreground">{script.timeout}ms</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
  const [manufacturer, setManufacturer] = useState("");

  const onSubmit = (data: InsertVendorScript) => {
    mutate({ ...data, manufacturer, timeout: Number(data.timeout) || 30000 }, {
      onSuccess: () => {
        toast({ title: "Script criado" });
        onOpenChange(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Script</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...register("name")} placeholder="Backup Diário" required />
            </div>
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Select onValueChange={setManufacturer} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
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
            <Label>Comando</Label>
            <Textarea 
              {...register("command")} 
              placeholder="/export file=backup" 
              className="font-mono text-sm h-32" 
              required 
            />
            <p className="text-[10px] text-muted-foreground">O comando a ser enviado via SSH/Telnet.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Extensão do Arquivo</Label>
              <Input {...register("fileExtension")} placeholder=".rsc" defaultValue=".cfg" />
            </div>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input type="number" {...register("timeout")} defaultValue="30000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input {...register("description")} placeholder="Descrição opcional" />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar Script"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
