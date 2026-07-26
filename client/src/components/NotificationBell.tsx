import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, CheckCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudioTip } from "@/components/studio/StudioTip";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [confirmedTimesheets, setConfirmedTimesheets] = useState<Set<string>>(new Set());

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/mark-all-read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Confirm contractor hours directly from the notification — avoids having
  // to navigate to the Contracts Hub to complete this action.
  const confirmTimesheetMutation = useMutation({
    mutationFn: async ({ contractId, notificationId }: { contractId: string; notificationId: string }) => {
      await apiRequest("PATCH", `/api/contracts/${contractId}/confirm-timesheet`, {});
      if (!notifications.find(n => n.id === notificationId)?.isRead) {
        await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      }
    },
    onSuccess: (_data, { notificationId, contractId }) => {
      setConfirmedTimesheets(prev => new Set(prev).add(contractId));
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-bell"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
              data-testid="badge-notification-count"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold" data-testid="text-notifications-title">
            Notifications
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {unreadCount > 5 && (
          <div className="px-2 py-1.5">
            <StudioTip
              id="notifications-overload"
              title="Drowning in notifications?"
              body="You can choose which events notify you — trim the noise in your notification preferences."
              action={{ label: "Notification settings", href: "/admin/hr/profile?tab=notifications" }}
            />
          </div>
        )}
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
            No notifications
          </div>
        ) : (
          notifications.slice(0, 20).map((n) => {
            const meta = n.metadata as Record<string, unknown> | null;
            const link = meta?.link;
            const isTimesheetRequest = n.type === "contract_billing_timesheet_request";
            const contractId = isTimesheetRequest ? (meta?.contractId as string | undefined) : undefined;
            const timesheetAlreadyConfirmed = contractId ? confirmedTimesheets.has(contractId) : false;

            return (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-1 px-3 py-2 cursor-pointer ${
                  !n.isRead ? "bg-blue-50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => {
                  if (isTimesheetRequest) return; // action button handles this type
                  if (!n.isRead) markReadMutation.mutate(n.id);
                  if (typeof link === "string" && link) {
                    setOpen(false);
                    setLocation(link);
                  }
                }}
                data-testid={`notification-item-${n.id}`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className={`text-sm ${!n.isRead ? "font-semibold" : "font-normal"}`}>
                    {n.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(n.createdAt)}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {n.message}
                </span>
                {isTimesheetRequest && contractId && (
                  <Button
                    size="sm"
                    variant={timesheetAlreadyConfirmed ? "outline" : "default"}
                    className="mt-1 h-7 text-xs gap-1"
                    disabled={timesheetAlreadyConfirmed || confirmTimesheetMutation.isPending}
                    data-testid={`button-confirm-hours-${n.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!timesheetAlreadyConfirmed) {
                        confirmTimesheetMutation.mutate({ contractId, notificationId: n.id });
                      }
                    }}
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    {timesheetAlreadyConfirmed ? "Hours confirmed" : "Confirm hours"}
                  </Button>
                )}
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm font-medium text-primary cursor-pointer"
          onClick={() => {
            setOpen(false);
            setLocation("/admin/notifications");
          }}
          data-testid="link-view-all-notifications"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
