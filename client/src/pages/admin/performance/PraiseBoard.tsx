import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Award, Search, Plus, Send, X, Check, ChevronDown, ChevronUp, Pin, PinOff
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BadgeType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
}

interface PraisePost {
  id: string;
  giverId: string;
  recipientId: string;
  badgeTypeId: string;
  message: string;
  createdAt: string;
  giverName: string;
  recipientName: string;
  badgeType: BadgeType | null;
  clapCount: number;
  commentCount: number;
  hasClapped: boolean;
}

interface PraiseComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
  parentCommentId: string | null;
  replies: PraiseComment[];
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface MyBadge extends PraisePost {
  isPinned: boolean;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700"];
  const colorIdx = name.charCodeAt(0) % colors.length;
  const sizeClass = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sizeClass} ${colors[colorIdx]} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

function ReplyInput({
  postId,
  parentCommentId,
  onDone,
}: {
  postId: string;
  parentCommentId: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");

  const replyMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/praise/${postId}/comments`, { message, parentCommentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/praise", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/praise/board"] });
      setText("");
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Failed to post reply", variant: "destructive" }),
  });

  return (
    <div className="flex gap-2 mt-2 ml-10">
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply..."
        className="text-xs h-7"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && text.trim()) {
            e.preventDefault();
            replyMutation.mutate(text.trim());
          }
          if (e.key === "Escape") onDone();
        }}
        data-testid={`input-reply-${parentCommentId}`}
      />
      <Button
        size="sm"
        className="h-7 px-2"
        disabled={!text.trim() || replyMutation.isPending}
        onClick={() => replyMutation.mutate(text.trim())}
        data-testid={`button-send-reply-${parentCommentId}`}
      >
        <Send className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDone}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function CommentSection({ postId, recipientId }: { postId: string; recipientId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery<PraiseComment[]>({
    queryKey: ["/api/praise", postId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/praise/${postId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/praise/${postId}/comments`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/praise", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/praise/board"] });
      setNewComment("");
    },
    onError: () => toast({ title: "Error", description: "Failed to add comment", variant: "destructive" }),
  });

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : comments.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} data-testid={`comment-${c.id}`}>
              {/* Top-level comment */}
              <div className="flex gap-2">
                <Avatar name={c.authorName} />
                <div className="flex-1 min-w-0">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{c.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm break-words">{c.message}</p>
                  </div>
                  <button
                    className="text-[11px] text-muted-foreground hover:text-foreground ml-2 mt-0.5 transition-colors"
                    onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    data-testid={`button-reply-${c.id}`}
                  >
                    Reply
                  </button>
                </div>
              </div>

              {/* Replies (one level deep) */}
              {c.replies && c.replies.length > 0 && (
                <div className="ml-10 mt-2 space-y-2" data-testid={`replies-${c.id}`}>
                  {c.replies.map((r) => (
                    <div key={r.id} className="flex gap-2" data-testid={`reply-${r.id}`}>
                      <Avatar name={r.authorName} />
                      <div className="bg-muted/60 rounded-lg px-3 py-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold">{r.authorName}</span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-sm break-words">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {replyingTo === c.id && (
                <ReplyInput
                  postId={postId}
                  parentCommentId={c.id}
                  onDone={() => setReplyingTo(null)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">No comments yet — be the first!</p>
      )}
      <div className="flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="text-sm h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
              e.preventDefault();
              addCommentMutation.mutate(newComment.trim());
            }
          }}
          data-testid={`input-comment-${postId}`}
        />
        <Button
          size="sm"
          className="h-8 px-3"
          disabled={!newComment.trim() || addCommentMutation.isPending}
          onClick={() => addCommentMutation.mutate(newComment.trim())}
          data-testid={`button-send-comment-${postId}`}
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function PraiseCard({ post, onClap }: { post: PraisePost; onClap: (id: string) => void }) {
  const [showComments, setShowComments] = useState(false);

  return (
    <Card data-testid={`praise-card-${post.id}`} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Badge emoji pill */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: post.badgeType ? `${post.badgeType.color}20` : "#f3f4f6" }}
            data-testid={`badge-emoji-${post.id}`}
          >
            {post.badgeType?.emoji ?? "🏅"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" data-testid={`text-recipient-${post.id}`}>{post.recipientName}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: post.badgeType ? `${post.badgeType.color}20` : "#f3f4f6",
                      color: post.badgeType?.color ?? "#374151",
                    }}
                    data-testid={`badge-type-chip-${post.id}`}
                  >
                    {post.badgeType?.name ?? "Badge"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  awarded by <span className="font-medium">{post.giverName}</span>
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(post.createdAt)}</span>
            </div>
            <p className="text-sm mt-2 break-words leading-relaxed" data-testid={`text-message-${post.id}`}>{post.message}</p>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t">
          <button
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-md transition-colors ${
              post.hasClapped
                ? "text-orange-600 bg-orange-50 dark:bg-orange-950/30"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => onClap(post.id)}
            data-testid={`button-clap-${post.id}`}
          >
            <span>👏</span>
            <span>{post.clapCount}</span>
          </button>
          <button
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:bg-muted px-2 py-1 rounded-md transition-colors"
            onClick={() => setShowComments((v) => !v)}
            data-testid={`button-comments-${post.id}`}
          >
            <span>💬</span>
            <span>{post.commentCount}</span>
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        {showComments && <CommentSection postId={post.id} recipientId={post.recipientId} />}
      </CardContent>
    </Card>
  );
}

function GiveBadgeModal({
  open,
  onClose,
  badgeTypes,
}: {
  open: boolean;
  onClose: () => void;
  badgeTypes: BadgeType[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Employee | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [message, setMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [requestCertificate, setRequestCertificate] = useState(false);
  const [recognitionDescription, setRecognitionDescription] = useState("");
  const [contributionSummary, setContributionSummary] = useState("");
  const [publicCitationDraft, setPublicCitationDraft] = useState("");
  const [recognitionContext, setRecognitionContext] = useState("");

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/praise/users"],
    enabled: open,
  });

  const filteredEmployees = employees.filter(
    (e) =>
      e.id !== user?.id &&
      (`${e.firstName} ${e.lastName}`.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        recipientId: selectedRecipient!.id,
        badgeTypeId: selectedBadgeId,
        message: message.trim(),
        certificateRequested: requestCertificate,
      };
      if (requestCertificate) {
        body.recognitionDescription = recognitionDescription.trim();
        body.contributionSummary = contributionSummary.trim();
        body.publicCitationDraft = publicCitationDraft.trim();
        if (recognitionContext.trim()) body.recognitionContext = recognitionContext.trim();
      }
      const res = await apiRequest("POST", "/api/praise", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/praise/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/praise/my-badges"] });
      const desc = requestCertificate
        ? `Recognition certificate request submitted for ${selectedRecipient?.firstName}`
        : `Praised ${selectedRecipient?.firstName}`;
      toast({ title: "Badge awarded! 🎉", description: desc });
      onClose();
      setSelectedRecipient(null);
      setSelectedBadgeId("");
      setMessage("");
      setRecipientSearch("");
      setRequestCertificate(false);
      setRecognitionDescription("");
      setContributionSummary("");
      setPublicCitationDraft("");
      setRecognitionContext("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to award badge", variant: "destructive" }),
  });

  const canSubmit = selectedRecipient && selectedBadgeId && message.trim().length > 0 &&
    (!requestCertificate || (recognitionDescription.trim().length >= 40 && contributionSummary.trim().length >= 40 && publicCitationDraft.trim().length > 0));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Give a Badge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label>Recipient *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={selectedRecipient ? `${selectedRecipient.firstName} ${selectedRecipient.lastName}` : recipientSearch}
                onChange={(e) => {
                  if (selectedRecipient) {
                    setSelectedRecipient(null);
                    setRecipientSearch(e.target.value);
                  } else {
                    setRecipientSearch(e.target.value);
                  }
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search for a colleague..."
                className="pl-9"
                data-testid="input-recipient-search"
              />
              {selectedRecipient && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => { setSelectedRecipient(null); setRecipientSearch(""); }}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {showDropdown && !selectedRecipient && recipientSearch && filteredEmployees.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto shadow-sm">
                {filteredEmployees.slice(0, 8).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                    onClick={() => {
                      setSelectedRecipient(emp);
                      setRecipientSearch("");
                      setShowDropdown(false);
                    }}
                    data-testid={`select-employee-${emp.id}`}
                  >
                    <span>{emp.firstName} {emp.lastName}</span>
                    <span className="text-xs text-muted-foreground">{emp.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Badge type grid */}
          <div className="space-y-2">
            <Label>Badge Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {badgeTypes.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedBadgeId(badge.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                    selectedBadgeId === badge.id
                      ? "border-2 shadow-sm"
                      : "border hover:bg-muted"
                  }`}
                  style={selectedBadgeId === badge.id ? { borderColor: badge.color, backgroundColor: `${badge.color}10` } : {}}
                  data-testid={`badge-type-option-${badge.id}`}
                >
                  <span className="text-xl">{badge.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{badge.name}</div>
                    {badge.description && <div className="text-[10px] text-muted-foreground truncate">{badge.description}</div>}
                  </div>
                  {selectedBadgeId === badge.id && (
                    <Check className="h-4 w-4 ml-auto shrink-0" style={{ color: badge.color }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them why they deserve this badge..."
              rows={3}
              maxLength={500}
              data-testid="input-praise-message"
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
          </div>

          {/* Certificate request toggle */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Request Recognition Certificate</Label>
                <p className="text-xs text-muted-foreground">Submit for manager approval to issue a verified certificate</p>
              </div>
              <button
                type="button"
                onClick={() => setRequestCertificate((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${requestCertificate ? "bg-[#F47C20]" : "bg-gray-200"}`}
                data-testid="toggle-request-certificate"
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${requestCertificate ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>

            {requestCertificate && (
              <div className="space-y-3 pt-1 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Recognition *</Label>
                  <Textarea
                    value={recognitionDescription}
                    onChange={(e) => setRecognitionDescription(e.target.value)}
                    placeholder="Describe what this person did that deserves recognition..."
                    rows={2}
                    maxLength={800}
                    data-testid="input-recognition-description"
                  />
                  <p className={`text-xs ${recognitionDescription.trim().length < 40 ? "text-orange-500" : "text-muted-foreground"}`}>
                    {recognitionDescription.trim().length}/800 — minimum 40 characters required
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contribution *</Label>
                  <Textarea
                    value={contributionSummary}
                    onChange={(e) => setContributionSummary(e.target.value)}
                    placeholder="Summarize the impact of their contribution..."
                    rows={2}
                    maxLength={800}
                    data-testid="input-contribution-summary"
                  />
                  <p className={`text-xs ${contributionSummary.trim().length < 40 ? "text-orange-500" : "text-muted-foreground"}`}>
                    {contributionSummary.trim().length}/800 — minimum 40 characters required
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Public Citation Draft *</Label>
                  <Textarea
                    value={publicCitationDraft}
                    onChange={(e) => setPublicCitationDraft(e.target.value)}
                    placeholder="Draft a public citation to appear on the certificate..."
                    rows={2}
                    maxLength={500}
                    data-testid="input-public-citation-draft"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Recognition Context (optional)</Label>
                  <Input
                    value={recognitionContext}
                    onChange={(e) => setRecognitionContext(e.target.value)}
                    placeholder="e.g. Q2 2026 Project Delivery"
                    maxLength={100}
                    data-testid="input-recognition-context"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-submit-praise"
          >
            {createMutation.isPending ? "Sending..." : "Award Badge 🎉"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagePinnedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ posts: MyBadge[]; pinnedPostIds: string[] }>({
    queryKey: ["/api/praise/my-badges"],
    enabled: open,
  });

  const [localPinned, setLocalPinned] = useState<string[]>([]);

  useEffect(() => {
    if (data?.pinnedPostIds) setLocalPinned(data.pinnedPostIds);
  }, [data?.pinnedPostIds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/praise/pinned", { postIds: localPinned });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/praise/my-badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/praise/pinned"] });
      toast({ title: "Pinned badges updated!" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to save pinned badges", variant: "destructive" }),
  });

  const togglePin = (postId: string) => {
    setLocalPinned((prev) => {
      if (prev.includes(postId)) return prev.filter((id) => id !== postId);
      if (prev.length >= 3) {
        toast({ title: "Max 3 badges", description: "Unpin one first", variant: "destructive" });
        return prev;
      }
      return [...prev, postId];
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Pinned Badges</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Pin up to 3 badges to display on your profile.</p>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : !data?.posts.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No badges received yet
          </div>
        ) : (
          <div className="space-y-2">
            {data.posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
                data-testid={`my-badge-row-${post.id}`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: post.badgeType ? `${post.badgeType.color}20` : "#f3f4f6" }}
                >
                  {post.badgeType?.emoji ?? "🏅"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{post.badgeType?.name ?? "Badge"}</div>
                  <div className="text-xs text-muted-foreground truncate">from {post.giverName}</div>
                </div>
                <button
                  onClick={() => togglePin(post.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    localPinned.includes(post.id)
                      ? "text-orange-500 bg-orange-50 dark:bg-orange-950/30"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid={`button-pin-${post.id}`}
                >
                  {localPinned.includes(post.id) ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Pins"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PraiseBoard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showGive, setShowGive] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const { data: badgeTypes = [] } = useQuery<BadgeType[]>({
    queryKey: ["/api/praise/badge-types"],
  });

  const { data: boardData, isLoading } = useQuery<{ posts: PraisePost[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/praise/board", page, selectedBadgeFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (selectedBadgeFilter) params.set("badgeTypeId", selectedBadgeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/praise/board?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load board");
      return res.json();
    },
  });

  const clapMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest("POST", `/api/praise/${postId}/react`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/praise/board"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to react", variant: "destructive" }),
  });

  const posts = boardData?.posts ?? [];
  const total = boardData?.total ?? 0;
  const pageSize = boardData?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  const handleBadgeFilter = (id: string) => {
    setSelectedBadgeFilter((prev) => (prev === id ? null : id));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-lg">Praise Board</span>
          <Badge variant="secondary" className="text-xs">{total} posts</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPinned(true)}
            data-testid="button-manage-pins"
          >
            <Pin className="h-4 w-4 mr-1.5" />
            My Pins
          </Button>
          <Button size="sm" onClick={() => setShowGive(true)} data-testid="button-give-badge">
            <Plus className="h-4 w-4 mr-1.5" />
            Give a Badge
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="pl-9"
            data-testid="input-board-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {badgeTypes.map((badge) => (
            <button
              key={badge.id}
              onClick={() => handleBadgeFilter(badge.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedBadgeFilter === badge.id
                  ? "border-transparent text-white shadow-sm"
                  : "border hover:bg-muted"
              }`}
              style={
                selectedBadgeFilter === badge.id
                  ? { backgroundColor: badge.color }
                  : {}
              }
              data-testid={`filter-badge-${badge.id}`}
            >
              <span>{badge.emoji}</span>
              <span>{badge.name}</span>
            </button>
          ))}
          {selectedBadgeFilter && (
            <button
              onClick={() => setSelectedBadgeFilter(null)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border hover:bg-muted"
              data-testid="button-clear-filter"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Award className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
          <p className="text-muted-foreground font-medium">No praise posts yet</p>
          <p className="text-sm text-muted-foreground">Be the first to award a badge to a colleague!</p>
          <Button className="mt-4" size="sm" onClick={() => setShowGive(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Give First Badge
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {posts.map((post) => (
              <PraiseCard key={post.id} post={post} onClap={(id) => clapMutation.mutate(id)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <GiveBadgeModal open={showGive} onClose={() => setShowGive(false)} badgeTypes={badgeTypes} />
      <ManagePinnedModal open={showPinned} onClose={() => setShowPinned(false)} />
    </div>
  );
}
