import { useCompany } from "@/contexts/company-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function CompanySelector() {
  const { 
    selectedCompanyId, 
    selectedCompany, 
    companies, 
    isServerAdmin, 
    isLoading,
    setSelectedCompanyId 
  } = useCompany();

  if (isLoading) {
    return null;
  }

  if (!isServerAdmin) {
    if (selectedCompany) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{selectedCompany.name}</span>
        </div>
      );
    }
    return null;
  }

  if (companies.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
        Server Admin
      </Badge>
      <Select
        value={selectedCompanyId?.toString() ?? "all"}
        onValueChange={(value) => {
          if (value === "all") {
            setSelectedCompanyId(null);
          } else {
            setSelectedCompanyId(parseInt(value, 10));
          }
        }}
      >
        <SelectTrigger 
          className="w-[200px]" 
          data-testid="select-company-trigger"
        >
          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Todas as empresas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="select-company-all">
            Todas as empresas
          </SelectItem>
          {companies.map((company) => (
            <SelectItem 
              key={company.id} 
              value={company.id.toString()}
              data-testid={`select-company-${company.id}`}
            >
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
