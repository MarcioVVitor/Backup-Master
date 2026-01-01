import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Equipment, InsertEquipment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEquipment) => {
      const res = await apiRequest("POST", "/api/equipment", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }),
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertEquipment> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/equipment/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }),
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/equipment/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }),
  });
}
