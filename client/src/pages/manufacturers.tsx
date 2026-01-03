import { useManufacturers, useCreateManufacturer, useDeleteManufacturer } from "@/hooks/use-settings";
import { useI18n } from "@/contexts/i18n-context";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManufacturersPage() {
  const { data: manufacturers, isLoading } = useManufacturers();
  const { mutate: deleteManufacturer } = useDeleteManufacturer();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useI18n();

  const handleDelete = (id: number) => {
    if (confirm(`${t.common.confirm}?`)) {
      deleteManufacturer(id, {
        onSuccess: () => toast({ title: t.common.success })
      });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-enter">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.manufacturers.title}</h1>
          <p className="text-muted-foreground">{t.manufacturers.subtitle}</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t.manufacturers.addManufacturer}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {manufacturers?.map((m) => (
          <Card key={m.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
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
            <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
            </Button>
          </Card>
        ))}
      </div>

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
            <Input {...register("label")} placeholder="Cisco Systems" required />
          </div>
          <div className="space-y-2">
            <Label>{t.common.type}</Label>
            <Input {...register("value")} placeholder="cisco" required className="lowercase" />
          </div>
          <div className="space-y-2">
            <Label>{t.admin.primaryColor}</Label>
            <div className="flex gap-2">
              <Input {...register("color")} type="color" className="w-12 h-10 p-1" defaultValue="#3b82f6" />
              <Input {...register("color")} placeholder="#3b82f6" defaultValue="#3b82f6" className="flex-1" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
