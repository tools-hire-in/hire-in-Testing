import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Plus, Send, Search } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FeedbackItem {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  type: "praise" | "constructive" | "general";
  message: string;
  goalId?: string;
  goalTitle?: string;
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Goal {
  id: string;
  title: string;
}

const feedbackTypeColors: Record<string, string> = {
  praise: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  constructive: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function Feedback() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("received");
  const [showSend, setShowSend] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ recipientId: "", type: "general", message: "", goalId: "" });

  const { data: receivedFeedback, isLoading: loadingReceived } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/performance/feedback/received"],
    enabled: isAuthenticated,
  });

  const { data: sentFeedback, isLoading: loadingSent } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/performance/feedback/sent"],
    enabled: isAuthenticated,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/hr/users"],
    enabled: isAuthenticated && showSend,
  });

  const { data: goals } = useQuery<Goal[]>({
    queryKey: ["/api/performance/goals"],
    enabled: isAuthenticated && showSend,
  });

  const sendFeedbackMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/performance/feedback", {
      recipientId: form.recipientId,
      type: form.type,
      message: form.message,
      goalId: form.goalId || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/feedback/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/feedback/sent"] });
      setShowSend(false);
      setForm({ recipientId: "", type: "general", message: "", goalId: "" });
      toast({ title: "Feedback sent successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to send feedback", variant: "destructive" }),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const filteredEmployees = employees?.filter(e =>
    e.id !== user?.id &&
    (`${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const renderFeedbackCard = (item: FeedbackItem, showSender: boolean) => (
    <div key={item.id} className="border rounded-lg p-4 space-y-2" data-testid={`feedback-card-${item.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {showSender ? item.senderName : item.recipientName}
          </span>
          <Badge variant="secondary" className={feedbackTypeColors[item.type]} data-testid={`badge-feedback-type-${item.id}`}>
            {item.type}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap" data-testid={`text-feedback-message-${item.id}`}>{item.message}</p>
      {item.goalTitle && (
        <p className="text-xs text-muted-foreground">
          Linked Goal: <span className="font-medium">{item.goalTitle}</span>
        </p>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-feedback-title">Feedback</h1>
            <p className="text-muted-foreground">Give and receive performance feedback</p>
          </div>
          <Button onClick={() => setShowSend(true)} data-testid="button-send-feedback">
            <Plus className="h-4 w-4 mr-2" />
            Send Feedback
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList data-testid="tabs-feedback">
                <TabsTrigger value="received" data-testid="tab-received">
                  Received ({receivedFeedback?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="sent" data-testid="tab-sent">
                  Sent ({sentFeedback?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="mt-4">
                {loadingReceived ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : receivedFeedback && receivedFeedback.length > 0 ? (
                  <div className="space-y-3">
                    {receivedFeedback.map(item => renderFeedbackCard(item, true))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No feedback received yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sent" className="mt-4">
                {loadingSent ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : sentFeedback && sentFeedback.length > 0 ? (
                  <div className="space-y-3">
                    {sentFeedback.map(item => renderFeedbackCard(item, false))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No feedback sent yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={showSend} onOpenChange={setShowSend}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Send Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recipient *</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search employees..."
                      className="pl-9"
                      data-testid="input-search-recipient"
                    />
                  </div>
                  {form.recipientId && (
                    <div className="text-sm text-green-600 font-medium">
                      Selected: {employees?.find(e => e.id === form.recipientId)?.firstName} {employees?.find(e => e.id === form.recipientId)?.lastName}
                    </div>
                  )}
                  {searchTerm && filteredEmployees.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {filteredEmployees.slice(0, 10).map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                          onClick={() => {
                            setForm(f => ({ ...f, recipientId: emp.id }));
                            setSearchTerm("");
                          }}
                          data-testid={`select-recipient-${emp.id}`}
                        >
                          <span>{emp.firstName} {emp.lastName}</span>
                          <span className="text-xs text-muted-foreground">{emp.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Feedback Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-feedback-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="praise">Praise</SelectItem>
                    <SelectItem value="constructive">Constructive</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Write your feedback..."
                  rows={4}
                  data-testid="input-feedback-message"
                />
              </div>
              {goals && goals.length > 0 && (
                <div className="space-y-2">
                  <Label>Link to Goal (optional)</Label>
                  <Select value={form.goalId} onValueChange={(v) => setForm(f => ({ ...f, goalId: v }))}>
                    <SelectTrigger data-testid="select-goal-link">
                      <SelectValue placeholder="Select a goal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No goal</SelectItem>
                      {goals.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSend(false)}>Cancel</Button>
              <Button
                onClick={() => sendFeedbackMutation.mutate()}
                disabled={!form.recipientId || !form.message || sendFeedbackMutation.isPending}
                data-testid="button-submit-feedback"
              >
                {sendFeedbackMutation.isPending ? "Sending..." : "Send Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}