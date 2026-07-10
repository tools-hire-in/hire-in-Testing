import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  NOTIFICATION_CATEGORIES,
  categoryForType,
  type NotificationCategory,
} from "@shared/notificationTypes";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface HistoryResponse {
  items: NotificationItem[];
  total: number;
  unread: number;
}

const PAGE_SIZE = 20;

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  studio: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  hr: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  payroll: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  performance: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  system: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

function formatWhen(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationCentre() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<NotificationCategory | "all">("all");

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/notifications/history", { page, pageSize: PAGE_SIZE }],
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/mark-all-read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const items = data?.items ?? [];
  const filtered = category === "all"
    ? items
    : items.filter((n) => categoryForType(n.type) === category);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold" data-testid="text-notification-centre-title">
              Notifications
            </h1>
            {(data?.unread ?? 0) > 0 && (
              <Badge variant="secondary" data-testid="badge-unread-total">
                {data!.unread} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/admin/hr/profile?tab=notifications")}
              data-testid="button-notification-preferences"
            >
              <Settings className="h-4 w-4 mr-1" />
              Preferences
            </Button>
            {(data?.unread ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-centre-mark-all-read"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={category === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory("all")}
            data-testid="chip-category-all"
          >
            All
          </Button>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <Button
              key={c.value}
              variant={category === c.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c.value)}
              data-testid={`chip-category-${c.value}`}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-centre-empty">
              {category === "all" ? "No notifications yet." : "No notifications in this category on this page."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const cat = categoryForType(n.type);
              const link = (n.metadata as Record<string, unknown> | null)?.link;
              return (
                <Card
                  key={n.id}
                  className={`cursor-pointer transition-colors hover-elevate ${!n.isRead ? "border-primary/40 bg-primary/5" : ""}`}
                  onClick={() => {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                    if (typeof link === "string" && link) setLocation(link);
                  }}
                  data-testid={`centre-notification-${n.id}`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${!n.isRead ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat]}`}>
                            {NOTIFICATION_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatWhen(n.createdAt)}
                        </span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-centre-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground" data-testid="text-centre-page">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="button-centre-next-page"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
