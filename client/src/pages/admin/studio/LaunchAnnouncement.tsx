import { useQuery, useMutation } from "@tanstack/react-query";
import { Megaphone, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface LaunchStatus {
  announced: boolean;
  canSend: boolean;
}

export function LaunchAnnouncement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<LaunchStatus>({
    queryKey: ["/api/admin/studio/insights-launch/status"],
  });

  const announce = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/studio/insights-launch/announce");
      return res.json();
    },
    onSuccess: (data: { notified?: number; recipients?: number }) => {
      toast({
        title: "Launch announcement sent",
        description: `Notified ${data?.notified ?? 0} of ${data?.recipients ?? 0} team members.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/insights-launch/status"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not send announcement",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (user?.role !== "super_admin") return null;

  const alreadySent = !!status?.announced;

  return (
    <div className="border-t pt-4" data-testid="section-launch-announcement">
      <h2 className="text-lg font-semibold" data-testid="text-announcement-heading">
        Hire'in Insights Launch
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Send a one-time internal announcement to the whole team (founder CC'd) with an in-app
        notification for every active user. This does not publish any article or social post.
      </p>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : alreadySent ? (
        <Badge variant="secondary" className="gap-1" data-testid="badge-announcement-sent">
          <CheckCircle2 className="h-3.5 w-3.5" /> Announcement already sent
        </Badge>
      ) : (
        <Button
          onClick={() => announce.mutate()}
          disabled={announce.isPending}
          data-testid="button-send-launch-announcement"
        >
          {announce.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="mr-2 h-4 w-4" />
          )}
          Send launch announcement
        </Button>
      )}
    </div>
  );
}
