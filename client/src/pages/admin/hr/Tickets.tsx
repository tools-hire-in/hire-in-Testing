import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Info } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function TicketsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-tickets-title">Attendance Regularization</h1>
        <p className="text-muted-foreground text-sm mt-1">Moved to the Attendance tab</p>
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold text-foreground">The Tickets system has been replaced</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Attendance regularization requests are now handled directly from the{" "}
                <strong>My Work → Attendance</strong> tab. Click "Report Issue" on any
                recent attendance row to raise a correction request within the policy window.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your manager will receive the request for review. You can track all your
                requests on the <strong>My Regularizations</strong> tab.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="gap-2 w-full sm:w-auto"
              onClick={() => setLocation("/admin/hr?tab=attendance")}
              data-testid="button-go-to-attendance"
            >
              Go to Attendance
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => setLocation("/admin/hr?tab=regularizations")}
              data-testid="button-go-to-regularizations"
            >
              My Regularizations
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Tickets() {
  return (
    <AdminLayout>
      <TicketsContent />
    </AdminLayout>
  );
}
