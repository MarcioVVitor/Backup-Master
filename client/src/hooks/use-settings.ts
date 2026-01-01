import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Manufacturer, InsertManufacturer, Firmware, InsertFirmware, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Manufacturers
export function useManufacturers() {
  return useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });
}

export function useCreateManufacturer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertManufacturer) => {
      const res = await apiRequest("POST", "/api/manufacturers", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] }),
  });
}

export function useDeleteManufacturer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/manufacturers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] }),
  });
}

// Firmware
export function useFirmware() {
  return useQuery<Firmware[]>({
    queryKey: ["/api/firmware"],
  });
}

export function useDeleteFirmware() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/firmware/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/firmware"] }),
  });
}

// Users
export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, isAdmin }: { id: number; role: string; isAdmin: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, { role, isAdmin });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });
}
