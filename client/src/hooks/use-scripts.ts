import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VendorScript, InsertVendorScript } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useScripts() {
  return useQuery<VendorScript[]>({
    queryKey: ["/api/scripts"],
  });
}

export function useCreateScript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertVendorScript) => {
      const res = await apiRequest("POST", "/api/scripts", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scripts"] }),
  });
}

export function useUpdateScript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertVendorScript> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/scripts/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scripts"] }),
  });
}

export function useDeleteScript() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/scripts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scripts"] }),
  });
}
