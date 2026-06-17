import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, Users, Loader2 } from "lucide-react";

export function NewsletterSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/studio/newsletter-flag"],
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/admin/studio/newsletter-flag", { enabled });
      return (await res.json()) as { enabled: boolean };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/admin/studio/newsletter-flag"], result);
      toast({
        title: result.enabled ? "Notifications enabled" : "Notifications disabled",
        description: result.enabled
          ? "Subscribers will be emailed when new articles go live."
          : "New-content emails are paused.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not change the notification setting. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card data-testid="card-newsletter-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-primary" />
          Newsletter Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="font-medium">Email subscribers on new content</p>
            <p className="text-sm text-muted-foreground">
              When enabled, active subscribers receive an email each time an article is published to
              the public Insights page.
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={!!data?.enabled}
              onCheckedChange={(v) => mutation.mutate(v)}
              disabled={mutation.isPending}
              data-testid="switch-newsletter-flag"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="font-medium">Subscribers</p>
            <p className="text-sm text-muted-foreground">
              View, search, and export the newsletter subscriber list.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/studio/subscribers")}
            data-testid="button-view-subscribers"
          >
            <Users className="mr-2 h-4 w-4" />
            Manage subscribers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
