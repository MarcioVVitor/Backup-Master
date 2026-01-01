import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FileRecord, BackupHistoryRecord } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useFiles() {
  return useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });
}

export function useBackupHistory() {
  return useQuery<BackupHistoryRecord[]>({
    queryKey: ["/api/backups/history"],
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backups/history"] });
    },
  });
}

export function useExecuteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipmentIds: number[]) => {
      const res = await apiRequest("POST", "/api/backups/execute", { equipmentIds });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/backups/history"] }),
  });
}
