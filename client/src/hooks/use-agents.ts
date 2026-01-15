import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent, InsertAgent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });
}

export function useAgent(id: number) {
  return useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });
}

export function useAgentMetrics(id: number, limit = 100) {
  return useQuery({
    queryKey: ["/api/agents", id, "metrics"],
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAgent) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertAgent> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/agents/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
  });
}
