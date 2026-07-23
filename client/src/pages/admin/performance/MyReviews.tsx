import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardList, Star, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MyReview {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleType: string;
  status: "pending_self_review" | "self_review_submitted" | "manager_reviewed" | "closed";
  selfReview?: SelfReviewData;
  managerReview?: ManagerReviewData;
  submittedAt?: string;
}

interface SelfReviewData {
  goalsReflection: string;
  strengths: string;
  improvements: string;
  developmentNeeds: string;
  selfRating: number;
}

interface ManagerReviewData {
  rating: number;
  strengths: string;
  improvements: string;
  comments: string;
  recommendation: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_self_review: { label: "Pending Self-Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  self_review_submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  manager_reviewed: { label: "Manager Reviewed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

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

export function MyReviewsContent() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { enabled: newLook } = useNewLook();
  const { toast } = useToast();
  const [showSelfReview, setShowSelfReview] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selfForm, setSelfForm] = useState<SelfReviewData>({
    goalsReflection: "",
    strengths: "",
    improvements: "",
    developmentNeeds: "",
    selfRating: 0,
  });

  const { data: rayoUrl } = useQuery<{ value: string }>({
    queryKey: ["/api/system-settings/rayo_academy_url"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/system-settings/rayo_academy_url", { credentials: "include" });
        if (!res.ok) return { value: "" };
        return res.json();
      } catch {
        return { value: "" };
      }
    },
    enabled: isAuthenticated,
  });

  const { data: reviews, isLoading } = useQuery<MyReview[]>({
    queryKey: ["/api/performance/my-reviews"],
    enabled: isAuthenticated,
  });

  const submitSelfReviewMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/performance/reviews/${selectedReviewId}/self-review`, selfForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/my-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/pending-reviews-count"] });
      setShowSelfReview(false);
      setShowConfirm(false);
      setSelectedReviewId(null);
      setSelfForm({ goalsReflection: "", strengths: "", improvements: "", developmentNeeds: "", selfRating: 0 });
      toast({ title: "Self-review submitted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" }),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const activeReviews = reviews?.filter(r => r.status === "pending_self_review" || r.status === "self_review_submitted") || [];
  const pastReviews = reviews?.filter(r => r.status === "manager_reviewed" || r.status === "closed") || [];

  const openSelfReview = (reviewId: string) => {
    setSelectedReviewId(reviewId);
    setSelfForm({ goalsReflection: "", strengths: "", improvements: "", developmentNeeds: "", selfRating: 0 });
    setShowSelfReview(true);
  };

  const handleSubmit = () => {
    if (!selfForm.goalsReflection || !selfForm.strengths || !selfForm.improvements || selfForm.selfRating === 0) {
      toast({ title: "Please fill all required fields and select a rating", variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const rayoAcademyUrl = rayoUrl?.value;

  return (
      <div className="v2-surface space-y-6">
        {newLook ? (
          <V2PageHeader
            icon={ClipboardList}
            eyebrow="Performance"
            title="My Reviews"
            subtitle="View and complete your performance reviews"
            testId="text-my-reviews-title"
          />
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-my-reviews-title">My Reviews</h1>
              <p className="text-muted-foreground">View and complete your performance reviews</p>
            </div>
            {rayoAcademyUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(`${rayoAcademyUrl}?email=${encodeURIComponent(user?.email || "")}`, "_blank")}
                data-testid="button-rayo-academy"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Rayo Academy
              </Button>
            )}
          </div>
        )}

        {rayoAcademyUrl && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-sm">Rayo Academy</p>
                  <p className="text-xs text-muted-foreground">Enhance your skills with courses and certifications</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => window.open(`${rayoAcademyUrl}?email=${encodeURIComponent(user?.email || "")}`, "_blank")}
                  data-testid="button-rayo-academy-card"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Rayo Academy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Reviews ({activeReviews.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : activeReviews.length > 0 ? (
              <div className="space-y-3">
                {activeReviews.map((review) => {
                  const statusInfo = statusLabels[review.status];
                  return (
                    <div key={review.id} className="border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap" data-testid={`active-review-${review.id}`}>
                      <div>
                        <h3 className="font-semibold text-sm">{review.cycleName}</h3>
                        <p className="text-xs text-muted-foreground">{review.cycleType}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className={statusInfo.color} data-testid={`badge-review-status-${review.id}`}>
                          {statusInfo.label}
                        </Badge>
                        {review.status === "pending_self_review" && (
                          <Button
                            size="sm"
                            onClick={() => openSelfReview(review.id)}
                            data-testid={`button-self-review-${review.id}`}
                          >
                            Write Self-Review
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active reviews at this time</p>
              </div>
            )}
          </CardContent>
        </Card>

        {pastReviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past Reviews ({pastReviews.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pastReviews.map((review) => {
                  const isExpanded = expandedPastId === review.id;
                  const statusInfo = statusLabels[review.status];
                  return (
                    <div key={review.id} className="border rounded-lg" data-testid={`past-review-${review.id}`}>
                      <div
                        className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                        onClick={() => setExpandedPastId(isExpanded ? null : review.id)}
                      >
                        <div>
                          <h3 className="font-semibold text-sm">{review.cycleName}</h3>
                          <p className="text-xs text-muted-foreground">{review.cycleType}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className={statusInfo.color}>{statusInfo.label}</Badge>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t px-4 py-3 bg-muted/30 space-y-4">
                          {review.selfReview && (
                            <div>
                              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Your Self-Review</h4>
                              <div className="space-y-2 text-sm">
                                <div><span className="font-medium">Goals Reflection:</span> {review.selfReview.goalsReflection}</div>
                                <div><span className="font-medium">Strengths:</span> {review.selfReview.strengths}</div>
                                <div><span className="font-medium">Areas for Improvement:</span> {review.selfReview.improvements}</div>
                                <div><span className="font-medium">Development Needs:</span> {review.selfReview.developmentNeeds}</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Self-Rating:</span>
                                  <StarRating value={review.selfReview.selfRating} readOnly />
                                </div>
                              </div>
                            </div>
                          )}
                          {review.managerReview && (
                            <>
                              <Separator />
                              <div>
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Manager's Review</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">Manager Rating:</span>
                                    <StarRating value={review.managerReview.rating} readOnly />
                                  </div>
                                  <div><span className="font-medium">Strengths:</span> {review.managerReview.strengths}</div>
                                  <div><span className="font-medium">Areas for Improvement:</span> {review.managerReview.improvements}</div>
                                  <div><span className="font-medium">Comments:</span> {review.managerReview.comments}</div>
                                  <div><span className="font-medium">Recommendation:</span> {review.managerReview.recommendation}</div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showSelfReview} onOpenChange={setShowSelfReview}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Self-Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Goals Reflection *</Label>
                <Textarea
                  value={selfForm.goalsReflection}
                  onChange={(e) => setSelfForm(f => ({ ...f, goalsReflection: e.target.value }))}
                  placeholder="Reflect on your goals and how you've progressed..."
                  rows={3}
                  data-testid="input-goals-reflection"
                />
              </div>
              <div className="space-y-2">
                <Label>Strengths *</Label>
                <Textarea
                  value={selfForm.strengths}
                  onChange={(e) => setSelfForm(f => ({ ...f, strengths: e.target.value }))}
                  placeholder="What are your key strengths this period?"
                  rows={3}
                  data-testid="input-strengths"
                />
              </div>
              <div className="space-y-2">
                <Label>Areas for Improvement *</Label>
                <Textarea
                  value={selfForm.improvements}
                  onChange={(e) => setSelfForm(f => ({ ...f, improvements: e.target.value }))}
                  placeholder="What areas would you like to improve?"
                  rows={3}
                  data-testid="input-improvements"
                />
              </div>
              <div className="space-y-2">
                <Label>Development Needs</Label>
                <Textarea
                  value={selfForm.developmentNeeds}
                  onChange={(e) => setSelfForm(f => ({ ...f, developmentNeeds: e.target.value }))}
                  placeholder="What training or development do you need?"
                  rows={3}
                  data-testid="input-development-needs"
                />
              </div>
              <div className="space-y-2">
                <Label>Self-Rating *</Label>
                <StarRating value={selfForm.selfRating} onChange={(v) => setSelfForm(f => ({ ...f, selfRating: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSelfReview(false)}>Cancel</Button>
              <Button onClick={handleSubmit} data-testid="button-submit-self-review">
                Submit Self-Review
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
              Are you sure you want to submit your self-review? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                onClick={() => submitSelfReviewMutation.mutate()}
                disabled={submitSelfReviewMutation.isPending}
                data-testid="button-confirm-submit"
              >
                {submitSelfReviewMutation.isPending ? "Submitting..." : "Confirm Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export default function MyReviews() {
  return (
    <AdminLayout>
      <MyReviewsContent />
    </AdminLayout>
  );
}