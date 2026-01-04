import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Company {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

interface UserCompanyInfo {
  companyId: number;
  companyName?: string;
  role: string;
}

interface CompanyContextType {
  selectedCompanyId: number | null;
  selectedCompany: Company | null;
  companies: Company[];
  isServerAdmin: boolean;
  isLoading: boolean;
  setSelectedCompanyId: (id: number | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = "nbm-selected-company";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<number | null>(null);

  const { data: serverAdminCheck, isLoading: adminLoading } = useQuery<{ 
    isServerAdmin: boolean; 
    serverRole: string | null;
    userCompanies?: UserCompanyInfo[];
  }>({
    queryKey: ["/api/server/check-admin"],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/server/companies"],
    enabled: !!serverAdminCheck?.isServerAdmin,
  });

  const isServerAdmin = serverAdminCheck?.isServerAdmin ?? false;
  
  const companies = useMemo(() => {
    if (isServerAdmin) {
      return companiesData ?? [];
    }
    if (serverAdminCheck?.userCompanies?.length) {
      return serverAdminCheck.userCompanies.map(uc => ({
        id: uc.companyId,
        name: uc.companyName || `Company ${uc.companyId}`,
        slug: `company-${uc.companyId}`,
        active: true,
      }));
    }
    return [];
  }, [isServerAdmin, companiesData, serverAdminCheck?.userCompanies]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        setSelectedCompanyIdState(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (companies.length === 0) return;
    
    const isValidSelection = selectedCompanyId !== null && 
      companies.some(c => c.id === selectedCompanyId);
    
    if (!isValidSelection) {
      if (!isServerAdmin && companies.length > 0) {
        setSelectedCompanyIdState(companies[0].id);
      } else if (isServerAdmin && selectedCompanyId !== null) {
        const stillExists = companies.some(c => c.id === selectedCompanyId);
        if (!stillExists) {
          setSelectedCompanyIdState(null);
        }
      }
    }
  }, [isServerAdmin, companies, selectedCompanyId]);

  const setSelectedCompanyId = (id: number | null) => {
    setSelectedCompanyIdState(id);
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/backup-history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId) ?? null;

  return (
    <CompanyContext.Provider 
      value={{ 
        selectedCompanyId, 
        selectedCompany,
        companies,
        isServerAdmin,
        isLoading: adminLoading || companiesLoading,
        setSelectedCompanyId 
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
