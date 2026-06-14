import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, MessageSquare, Clock, Bell, Heart, Trophy, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AnnouncementBlock {
  icon: string;
  title: string;
  body: string;
  cta_label: string;
  cta_path: string;
}

interface AnnouncementContent {
  title: string;
  subtitle: string;
  blocks: AnnouncementBlock[];
}

interface AnnouncementStatus {
  hasNew: boolean;
  version: string;
  content: AnnouncementContent | null;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  message: MessageSquare,
  clock: Clock,
  bell: Bell,
  heart: Heart,
  award: Trophy,
};

const ICON_COLORS: Record<string, string> = {
  star: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
  message: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
  clock: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
  bell: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
  heart: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
  award: "text-orange-500 bg-orange-50 dark:bg-orange-950/40",
};

const TARGET_ROLES = ["employee", "manager"];

export function AnnouncementModal() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const isTargetRole = user?.role ? TARGET_ROLES.includes(user.role) : false;

  const { data: announcementStatus, isLoading } = useQuery<AnnouncementStatus>({
    queryKey: ["/api/hr/announcements/status"],
    enabled: isAuthenticated && !!user && isTargetRole,
    retry: false,
  });

  const dismissMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hr/announcements/dismiss"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/announcements/status"] });
      setDismissed(true);
    },
    onError: () => {
      toast({
        title: "Could not record dismissal",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || !user || !isTargetRole || isLoading || dismissed) return null;
  if (!announcementStatus?.hasNew || !announcementStatus.content) return null;

  const { content } = announcementStatus;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-modal-title"
      data-testid="modal-whats-new"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-b border-border px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">What's New</span>
          </div>
          <h2 id="announcement-modal-title" className="text-xl font-bold text-foreground">
            {content.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{content.subtitle}</p>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {content.blocks.map((block, idx) => {
            const IconComponent = ICON_MAP[block.icon] || Star;
            const colorClass = ICON_COLORS[block.icon] || "text-primary bg-primary/10";
            return (
              <div key={idx} className="flex items-start gap-3.5" data-testid={`announcement-block-${idx}`}>
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 ${colorClass}`}>
                  <IconComponent className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{block.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{block.body}</p>
                  {block.cta_path && block.cta_label && (
                    <Link
                      href={block.cta_path}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1.5"
                      data-testid={`announcement-cta-${idx}`}
                    >
                      {block.cta_label}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            v{announcementStatus.version}
          </p>
          <Button
            onClick={() => dismissMutation.mutate()}
            disabled={dismissMutation.isPending}
            data-testid="button-announcement-dismiss"
          >
            {dismissMutation.isPending ? "Saving..." : "Got it — let me explore"}
          </Button>
        </div>
      </div>
    </div>
  );
}
