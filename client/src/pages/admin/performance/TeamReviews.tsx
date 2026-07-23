import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Star, Loader2, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TeamReview {
  id: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  selfReviewStatus: "pending" | "submitted";
  managerReviewStatus: "pending" | "submitted";
  selfReview?: {
    goalsReflection: string;
    strengths: string;
    improvements: string;
    developmentNeeds: string;
    selfRating: number;
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  submitted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface EmployeeAccess {
  ops001Active: boolean;
  raised: number;
  approved: number;
  pending: number;
  rejected: number;
  hasApprovedAccess: boolean;
  requests: Array<{ id: string; requestNumber: string; system: string | null; accessLevel: string | null; decision: "approved" | "rejected" | "pending"; createdAt: string }>;
}

// OPS-001 access-responsibility scorecard item (Task #665). Shown to the manager
// during a review: did this employee self-serve required tool access (raised +
// approved) as OPS-001 requires, or are they operating without proper access?
function AccessResponsibilityReviewItem({ employeeId }: { employeeId: string }) {
  const { data } = useQuery<EmployeeAccess>({
    queryKey: ["/api/sops/ops001/employee-access", employeeId],
    enabled: !!employeeId,
  });

  if (!data) return null;

  const compliant = data.hasApprovedAccess;
  const noneRaised = data.raised === 0;

  return (
    <div className="space-y-2 text-sm bg-muted/30 p-4 rounded-lg" data-testid="review-access-responsibility">
      <div className="flex items-center gap-2">
        <ShieldCheck className={`h-4 w-4 ${compliant ? "text-green-600" : "text-amber-600"}`} />
        <span className="font-medium">OPS-001 Access Responsibility</span>
        {data.ops001Active && (
          <Badge variant={compliant ? "default" : "secondary"} data-testid="badge-access-compliant">
            {compliant ? "Self-served" : noneRaised ? "No requests raised" : "Awaiting approval"}
          </Badge>
        )}
      </div>
      {data.ops001Active ? (
        <>
          <p className="text-muted-foreground text-xs">
            After training, requesting tool access is the employee's own responsibility (raise → manager approval → access).
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span data-testid="text-access-raised">Raised: <strong>{data.raised}</strong></span>
            <span data-testid="text-access-approved">Approved: <strong>{data.approved}</strong></span>
            <span data-testid="text-access-pending">Pending: <strong>{data.pending}</strong></span>
            {data.rejected > 0 && <span data-testid="text-access-rejected">Rejected: <strong>{data.rejected}</strong></span>}
          </div>
          {data.requests.length > 0 && (
            <ul className="mt-1 space-y-1">
              {data.requests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs" data-testid={`access-req-${r.id}`}>
                  <span className="truncate">{r.system || r.requestNumber}{r.accessLevel ? ` · ${r.accessLevel}` : ""}</span>
                  <Badge variant={r.decision === "approved" ? "default" : r.decision === "rejected" ? "destructive" : "secondary"} className="shrink-0 capitalize">{r.decision}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-xs">OPS-001 is not yet active for this employee.</p>
      )}
    </div>
  );
}

function StarRating({ value, onChange, readOnly = false }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          data-testid={`star-${star}`}
        >
          <Star
            className={`h-6 w-6 ${star <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
    </div>
  );
}

export function TeamReviewsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const [selectedReview, setSelectedReview] = useState<TeamReview | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [managerForm, setManagerForm] = useState({
    rating: 0,
    strengths: "",
    improvements: "",
    comments: "",
    recommendation: "meets_expectations",
  });

  const isManager = ["super_admin", "admin", "hr", "manager"].includes(user?.role || "");

  const { data: teamReviews, isLoading } = useQuery<TeamReview[]>({
    queryKey: ["/api/performance/team-reviews"],
    enabled: isAuthenticated && isManager,
  });

  const submitManagerReviewMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/performance/reviews/${selectedReview?.id}/manager-review`, managerForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/team-reviews"] });
      setSelectedReview(null);
      setShowConfirm(false);
      setManagerForm({ rating: 0, strengths: "", improvements: "", comments: "", recommendation: "meets_expectations" });
      toast({ title: "Manager review submitted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" }),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  if (!isManager) {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground" data-testid="text-no-access">You don't have access to this page.</p>
        </div>
    );
  }

  const handleSubmit = () => {
    if (managerForm.rating === 0 || !managerForm.strengths || !managerForm.improvements) {
      toast({ title: "Please fill all required fields and select a rating", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const openManagerReview = (review: TeamReview) => {
    setSelectedReview(review);
    setManagerForm({ rating: 0, strengths: "", improvements: "", comments: "", recommendation: "meets_expectations" });
  };

  const groupedByCycle = (teamReviews || []).reduce((acc, review) => {
    if (!acc[review.cycleName]) acc[review.cycleName] = [];
    acc[review.cycleName].push(review);
    return acc;
  }, {} as Record<string, TeamReview[]>);

  return (
      <div className="v2-surface space-y-6">
        {newLook ? (
          <V2PageHeader
            icon={Users}
            eyebrow="Performance"
            title="Team Reviews"
            subtitle="Review your direct reports' performance"
            testId="text-team-reviews-title"
          />
        ) : (
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-team-reviews-title">Team Reviews</h1>
            <p className="text-muted-foreground">Review your direct reports' performance</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : Object.keys(groupedByCycle).length > 0 ? (
          Object.entries(groupedByCycle).map(([cycleName, reviews]) => (
            <Card key={cycleName}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {cycleName} ({reviews.length} reports)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Self-Review</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Manager Review</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((review) => (
                        <tr key={review.id} className="border-b last:border-0" data-testid={`team-review-row-${review.id}`}>
                          <td className="py-2 px-2 font-medium">{review.employeeName}</td>
                          <td className="py-2 px-2">
                            <Badge variant="secondary" className={statusColors[review.selfReviewStatus]}>
                              {review.selfReviewStatus}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="secondary" className={statusColors[review.managerReviewStatus]}>
                              {review.managerReviewStatus}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            {review.selfReviewStatus === "submitted" && review.managerReviewStatus === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => openManagerReview(review)}
                                data-testid={`button-review-${review.id}`}
                              >
                                Write Review
                              </Button>
                            )}
                            {review.selfReviewStatus === "pending" && (
                              <span className="text-xs text-muted-foreground">Awaiting self-review</span>
                            )}
                            {review.managerReviewStatus === "submitted" && (
                              <span className="text-xs text-green-600">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active review cycles for your team</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manager Assessment — {selectedReview?.employeeName}</DialogTitle>
            </DialogHeader>
            {selectedReview && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Employee's Self-Review (Read-Only)</h3>
                  <Separator />
                  {selectedReview.selfReview ? (
                    <div className="space-y-3 text-sm bg-muted/30 p-4 rounded-lg">
                      <div>
                        <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">Goals Reflection</span>
                        <p>{selectedReview.selfReview.goalsReflection}</p>
                      </div>
                      <div>
                        <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">Strengths</span>
                        <p>{selectedReview.selfReview.strengths}</p>
                      </div>
                      <div>
                        <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">Areas for Improvement</span>
                        <p>{selectedReview.selfReview.improvements}</p>
                      </div>
                      <div>
                        <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">Development Needs</span>
                        <p>{selectedReview.selfReview.developmentNeeds}</p>
                      </div>
                      <div>
                        <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">Self-Rating</span>
                        <StarRating value={selectedReview.selfReview.selfRating} readOnly />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Self-review not yet submitted.</p>
                  )}
                  <AccessResponsibilityReviewItem employeeId={selectedReview.employeeId} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Your Assessment</h3>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Rating *</Label>
                      <StarRating value={managerForm.rating} onChange={(v) => setManagerForm(f => ({ ...f, rating: v }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Strengths *</Label>
                      <Textarea
                        value={managerForm.strengths}
                        onChange={(e) => setManagerForm(f => ({ ...f, strengths: e.target.value }))}
                        placeholder="Employee's key strengths..."
                        rows={3}
                        data-testid="input-manager-strengths"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Areas for Improvement *</Label>
                      <Textarea
                        value={managerForm.improvements}
                        onChange={(e) => setManagerForm(f => ({ ...f, improvements: e.target.value }))}
                        placeholder="Areas where the employee can improve..."
                        rows={3}
                        data-testid="input-manager-improvements"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Comments</Label>
                      <Textarea
                        value={managerForm.comments}
                        onChange={(e) => setManagerForm(f => ({ ...f, comments: e.target.value }))}
                        placeholder="Any additional comments..."
                        rows={2}
                        data-testid="input-manager-comments"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Overall Recommendation</Label>
                      <Select value={managerForm.recommendation} onValueChange={(v) => setManagerForm(f => ({ ...f, recommendation: v }))}>
                        <SelectTrigger data-testid="select-recommendation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exceeds_expectations">Exceeds Expectations</SelectItem>
                          <SelectItem value="meets_expectations">Meets Expectations</SelectItem>
                          <SelectItem value="needs_improvement">Needs Improvement</SelectItem>
                          <SelectItem value="below_expectations">Below Expectations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReview(null)}>Cancel</Button>
              <Button onClick={handleSubmit} data-testid="button-submit-manager-review">
                Submit Assessment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Submission</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to submit your assessment for {selectedReview?.employeeName}? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                onClick={() => submitManagerReviewMutation.mutate()}
                disabled={submitManagerReviewMutation.isPending}
                data-testid="button-confirm-manager-submit"
              >
                {submitManagerReviewMutation.isPending ? "Submitting..." : "Confirm Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export default function TeamReviews() {
  return (
    <AdminLayout>
      <TeamReviewsContent />
    </AdminLayout>
  );
}