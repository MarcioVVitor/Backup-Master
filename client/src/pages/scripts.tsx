import { useScripts, useCreateScript, useDeleteScript } from "@/hooks/use-scripts";
import { useManufacturers } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
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
  const { t } = useI18n();

  const handleDelete = (id: number) => {
    if (confirm(t.common.confirm + "?")) {
      deleteScript(id, {
        onSuccess: () => toast({ title: t.common.success })
      });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.scripts.title}</h1>
          <p className="text-muted-foreground">{t.scripts.subtitle}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t.scripts.addScript}
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
                {script.isDefault && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">{t.scripts.default}</Badge>}
              </div>
              <CardTitle className="text-lg">{script.name}</CardTitle>
              <CardDescription className="line-clamp-2">{script.description || t.scripts.noDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                {script.command}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <div>{t.scripts.extension}: <span className="font-medium text-foreground">{script.fileExtension}</span></div>
                <div>{t.scripts.timeout}: <span className="font-medium text-foreground">{script.timeout}ms</span></div>
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
