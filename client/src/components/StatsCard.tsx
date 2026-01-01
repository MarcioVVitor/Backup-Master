import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  color?: string; // Tailwind color class, e.g. "text-blue-500"
}

export function StatsCard({ title, value, description, icon: Icon, trend, className, color = "text-primary" }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn("p-2 rounded-full bg-muted/50", color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
          {trend && (
            <p className={cn("text-xs font-medium mt-1 flex items-center", trend.value >= 0 ? "text-green-500" : "text-red-500")}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
              <span className="text-muted-foreground ml-1 font-normal">{trend.label}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
