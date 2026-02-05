import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ticket as TicketIcon, Plus } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TicketData {
  id: string;
  userId: string;
  type: string;
  attendanceId: string | null;
  date: string;
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  reviewComment: string | null;
  createdAt: string;
}

export default function Tickets() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    reason: "",
    requestedPunchIn: "",
    requestedPunchOut: "",
  });

  const { data: tickets, isLoading } = useQuery<TicketData[]>({
    queryKey: ["/api/hr/tickets/my"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const body: any = {
        type: "regularization",
        date: data.date,
        reason: data.reason,
      };
      if (data.requestedPunchIn) {
        body.requestedPunchIn = new Date(`${data.date}T${data.requestedPunchIn}`).toISOString();
      }
      if (data.requestedPunchOut) {
        body.requestedPunchOut = new Date(`${data.date}T${data.requestedPunchOut}`).toISOString();
      }
      return apiRequest("POST", "/api/hr/tickets", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/tickets/my"] });
      setShowCreate(false);
      setFormData({ date: "", reason: "", requestedPunchIn: "", requestedPunchOut: "" });
      toast({ title: "Ticket Created", description: "Your regularization request has been submitted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-tickets-title">Tickets</h1>
            <p className="text-muted-foreground">Attendance regularization requests</p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Raise Ticket
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} className="border-b last:border-0" data-testid={`ticket-row-${t.id}`}>
                        <td className="py-2 px-2">{t.date}</td>
                        <td className="py-2 px-2 capitalize">{t.type}</td>
                        <td className="py-2 px-2 max-w-[200px] truncate">{t.reason}</td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary" className={statusColors[t.status] || ""}>
                            {t.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{t.reviewComment || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <TicketIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tickets raised yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Raise Regularization Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-ticket-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Correct Punch In Time</Label>
                  <Input
                    type="time"
                    value={formData.requestedPunchIn}
                    onChange={(e) => setFormData(prev => ({ ...prev, requestedPunchIn: e.target.value }))}
                    data-testid="input-ticket-punch-in"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correct Punch Out Time</Label>
                  <Input
                    type="time"
                    value={formData.requestedPunchOut}
                    onChange={(e) => setFormData(prev => ({ ...prev, requestedPunchOut: e.target.value }))}
                    data-testid="input-ticket-punch-out"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain the reason..."
                  data-testid="input-ticket-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.date || !formData.reason || createMutation.isPending}
                data-testid="button-submit-ticket"
              >
                {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
