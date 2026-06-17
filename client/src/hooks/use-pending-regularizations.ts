import { useQuery } from "@tanstack/react-query";

export interface PendingRegularization {
  id: string;
  employeeId: string;
  employeeName?: string;
  attendanceDate: string;
  requestType: string;
  status: string;
}

/**
 * Lightweight hook returning the count of pending regularization requests
 * scoped to the current user's team (manager) or org (hr/admin).
 * Shared by the sidebar badge and the manager dashboard card.
 */
export function usePendingRegularizationCount(enabled: boolean = true) {
  const query = useQuery<number>({
    queryKey: ["/api/hr/attendance/regularization", "pending-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/attendance/regularization?status=pending", {
          credentials: "include",
        });
        if (!res.ok) return 0;
        const data = await res.json();
        return Array.isArray(data) ? data.length : 0;
      } catch {
        return 0;
      }
    },
    enabled,
    refetchInterval: 30000,
    staleTime: 30000,
  });

  return query.data ?? 0;
}
