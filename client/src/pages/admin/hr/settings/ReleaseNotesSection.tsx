import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wand2, RefreshCw, Send, GitCommit, Mail, Bell, Check, ChevronDown, ChevronUp,
  Save, Pencil, Trash2, CheckCircle2, XCircle, Clock, Combine, Sparkles, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ReleaseStatus = "draft" | "pending_approval" | "approved" | "rejected" | "sent";

interface ReleaseNote {
  id: string;
  version: string | null;
  title: string | null;
  body: string | null;
  changelogInput: string | null;
  status: ReleaseStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  sentChannels: string[] | null;
  sentAt: string | null;
  createdAt: string;
}

interface DraftFields {
  version: string;
  title: string;
  body: string;
}

const STATUS_META: Record<ReleaseStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-slate-600 border-slate-300" },
  pending_approval: { label: "Pending approval", className: "text-amber-600 border-amber-300" },
  approved: { label: "Approved", className: "text-blue-600 border-blue-300" },
  rejected: { label: "Rejected", className: "text-red-600 border-red-300" },
  sent: { label: "Sent", className: "text-green-700 border-green-300" },
};

const RNLIST_KEY = ["/api/admin/release-notes"];

export function ReleaseNotesSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [changelogInput, setChangelogInput] = useState("");
  const [digestMode, setDigestMode] = useState(false);
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: releaseNotesList, isLoading } = useQuery<ReleaseNote[]>({
    queryKey: RNLIST_KEY,
  });

  const notes = releaseNotesList || [];
  const pipeline = notes.filter(n => n.status !== "sent");
  const sent = notes.filter(n => n.status === "sent");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: RNLIST_KEY });

  // --- Scratchpad helpers ---
  const fetchGitLogMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/release-notes/git-log", {});
      return res.json();
    },
    onSuccess: (data) => {
      const log = (data.log || "").trim();
      if (!log) {
        toast({ title: "No commits available", description: "Paste a change summary into the scratchpad instead." });
        return;
      }
      setChangelogInput(prev => (prev.trim() ? `${prev.trim()}\n\n--- synced from git ---\n${log}` : log));
      toast({ title: "Commits appended", description: `${log.split("\n").filter(Boolean).length} commit(s) added.` });
    },
    onError: () => {
      toast({ title: "No commits available", description: "Paste a change summary into the scratchpad instead." });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/release-notes/generate", {
        changelogInput,
        mode: digestMode ? "digest" : "release",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setDraft({ version: data.version || "", title: data.title || "", body: data.body || "" });
      toast({ title: "Draft generated", description: "Review and edit before saving." });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err?.message || "AI could not generate.", variant: "destructive" });
    },
  });

  // --- Draft persistence ---
  const saveDraftMutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (!draft) throw new Error("No draft");
      let saved: ReleaseNote;
      if (editingId) {
        const res = await apiRequest("PATCH", `/api/admin/release-notes/${editingId}`, {
          version: draft.version, title: draft.title, body: draft.body, changelogInput,
        });
        saved = await res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/release-notes", {
          version: draft.version, title: draft.title, body: draft.body, changelogInput,
        });
        saved = await res.json();
      }
      if (!saved?.id) throw new Error("Save failed");
      if (submit) {
        const subRes = await apiRequest("POST", `/api/admin/release-notes/${saved.id}/submit`, {});
        return subRes.json();
      }
      return saved;
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.submit ? "Submitted for approval" : "Draft saved",
        description: vars.submit ? "A Super Admin can now review it." : "Saved to the drafts pipeline.",
      });
      setDraft(null);
      setEditingId(null);
      setChangelogInput("");
      invalidate();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save draft.", variant: "destructive" });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/release-notes/${id}`),
    onSuccess: () => { toast({ title: "Discarded" }); invalidate(); },
    onError: () => toast({ title: "Error", description: "Could not discard.", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/release-notes/${id}/submit`, {}),
    onSuccess: () => { toast({ title: "Submitted for approval" }); invalidate(); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not submit.", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/release-notes/${id}/approve`, {}),
    onSuccess: () => { toast({ title: "Approved", description: "Ready to send." }); invalidate(); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not approve.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/admin/release-notes/${id}/reject`, { reason }),
    onSuccess: () => { toast({ title: "Returned to author" }); invalidate(); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not reject.", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, channels }: { id: string; channels: string[] }) =>
      apiRequest("POST", `/api/admin/release-notes/${id}/send`, { channels }),
    onSuccess: () => { toast({ title: "Sent!", description: "Delivered to selected channels." }); invalidate(); },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not send.", variant: "destructive" }),
  });

  const combineMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/admin/release-notes/combine", { ids });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Drafts combined", description: "A new combined draft was created." });
      setSelectedIds(new Set());
      invalidate();
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not combine.", variant: "destructive" }),
  });

  function startEdit(rn: ReleaseNote) {
    setEditingId(rn.id);
    setDraft({ version: rn.version || "", title: rn.title || "", body: rn.body || "" });
    setChangelogInput(rn.changelogInput || "");
    document.getElementById("release-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Two-column editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Changelog scratchpad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              Changelog Scratchpad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Paste a diff or change summary. Used only as AI input — kept private.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchGitLogMutation.mutate()}
                disabled={fetchGitLogMutation.isPending}
                data-testid="button-fetch-git-log"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${fetchGitLogMutation.isPending ? "animate-spin" : ""}`} />
                {fetchGitLogMutation.isPending ? "Loading..." : "Auto-populate (optional)"}
              </Button>
            </div>
            <Textarea
              value={changelogInput}
              onChange={(e) => setChangelogInput(e.target.value)}
              placeholder="Paste changes or commits…&#10;e.g. Fixed leave balance calculation&#10;     Added break tracking widget"
              rows={12}
              className="font-mono text-xs resize-none"
              data-testid="textarea-changelog-input"
            />
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={digestMode}
                onCheckedChange={(v) => setDigestMode(!!v)}
                data-testid="checkbox-digest-mode"
              />
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Monthly "what's new" digest (themed highlights)</span>
            </label>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!changelogInput.trim() || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-release-notes"
            >
              <Wand2 className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-pulse" : ""}`} />
              {generateMutation.isPending
                ? "Generating with AI…"
                : digestMode ? "Generate monthly digest →" : "Generate with AI →"}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Editable release note */}
        <Card id="release-editor">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {editingId ? "Edit Draft" : "Release Note Editor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Wand2 className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">Generate a draft with AI, or write one manually.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setEditingId(null); setDraft({ version: "", title: "", body: "" }); }}
                  data-testid="button-new-draft-manual"
                >
                  Write manually
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Version</Label>
                    <Input
                      value={draft.version}
                      onChange={(e) => setDraft(prev => prev ? { ...prev, version: e.target.value } : null)}
                      placeholder="v1.2.3"
                      className="text-sm font-mono"
                      data-testid="input-release-version"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft(prev => prev ? { ...prev, title: e.target.value } : null)}
                      placeholder="Release title…"
                      className="text-sm"
                      data-testid="input-release-title"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={draft.body}
                    onChange={(e) => setDraft(prev => prev ? { ...prev, body: e.target.value } : null)}
                    rows={9}
                    className="text-sm resize-none"
                    placeholder="Release notes body…"
                    data-testid="textarea-release-body"
                  />
                </div>

                <div className="border-t pt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDraft(null); setEditingId(null); }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveDraftMutation.mutate({ submit: false })}
                    disabled={saveDraftMutation.isPending || !draft.title.trim() || !draft.body.trim()}
                    data-testid="button-save-draft"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {editingId ? "Save changes" : "Save as draft"}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => saveDraftMutation.mutate({ submit: true })}
                    disabled={saveDraftMutation.isPending || !draft.title.trim() || !draft.body.trim()}
                    data-testid="button-save-submit"
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    {saveDraftMutation.isPending ? "Saving…" : "Submit for approval"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only a Super Admin can approve and send. Saving never overwrites other drafts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drafts pipeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Drafts &amp; Approvals</CardTitle>
            {selectedIds.size >= 2 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => combineMutation.mutate(Array.from(selectedIds))}
                disabled={combineMutation.isPending}
                data-testid="button-combine-drafts"
              >
                <Combine className="h-3.5 w-3.5 mr-1.5" />
                Combine {selectedIds.size} into one
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : pipeline.length === 0 ? (
            <div className="text-center py-8">
              <GitCommit className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No drafts in the pipeline.</p>
              <p className="text-xs text-muted-foreground mt-1">Generate or write one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Tick two or more to combine them into a single update.
              </p>
              {pipeline.map((rn) => (
                <PipelineRow
                  key={rn.id}
                  rn={rn}
                  isSuperAdmin={isSuperAdmin}
                  selected={selectedIds.has(rn.id)}
                  onSelect={() => toggleSelect(rn.id)}
                  onEdit={() => startEdit(rn)}
                  onDiscard={() => discardMutation.mutate(rn.id)}
                  onSubmit={() => submitMutation.mutate(rn.id)}
                  onApprove={() => approveMutation.mutate(rn.id)}
                  onReject={(reason) => rejectMutation.mutate({ id: rn.id, reason })}
                  onSend={(channels) => sendMutation.mutate({ id: rn.id, channels })}
                  busy={
                    discardMutation.isPending || submitMutation.isPending ||
                    approveMutation.isPending || rejectMutation.isPending || sendMutation.isPending
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sent history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release History</CardTitle>
        </CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No release notes sent yet.</p>
          ) : (
            <div className="space-y-2">
              {sent.map((rn) => <SentRow key={rn.id} rn={rn} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineRow({
  rn, isSuperAdmin, selected, onSelect, onEdit, onDiscard, onSubmit, onApprove, onReject, onSend, busy,
}: {
  rn: ReleaseNote;
  isSuperAdmin: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSend: (channels: string[]) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const meta = STATUS_META[rn.status];

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`release-note-row-${rn.id}`}>
      <div className="flex items-center gap-3 p-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          data-testid={`checkbox-select-${rn.id}`}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {rn.version && <Badge variant="outline" className="font-mono text-xs shrink-0">{rn.version}</Badge>}
          <span className="font-medium text-sm truncate">{rn.title || "Untitled"}</span>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.className}`} data-testid={`status-${rn.id}`}>
          {meta.label}
        </Badge>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setExpanded(!expanded)} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setExpanded(!expanded)} />
        )}
      </div>

      {rn.status === "rejected" && rn.rejectionReason && (
        <div className="px-4 pb-2 -mt-1">
          <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5" data-testid={`rejection-reason-${rn.id}`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Returned:</strong> {rn.rejectionReason}</span>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed font-sans">
            {rn.body || "(no body)"}
          </pre>

          <div className="pt-2 border-t flex flex-wrap items-center gap-2">
            {/* Author actions — available on draft / rejected */}
            {(rn.status === "draft" || rn.status === "rejected") && (
              <>
                <Button size="sm" variant="outline" onClick={onEdit} data-testid={`button-edit-${rn.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                <Button size="sm" onClick={onSubmit} disabled={busy} data-testid={`button-submit-${rn.id}`}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Submit for approval
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={onDiscard} disabled={busy} data-testid={`button-discard-${rn.id}`}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Discard
                </Button>
              </>
            )}

            {/* Pending approval */}
            {rn.status === "pending_approval" && (
              isSuperAdmin ? (
                rejecting ? (
                  <div className="w-full space-y-2">
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for returning this to the author…"
                      rows={2}
                      className="text-sm"
                      data-testid={`textarea-reject-reason-${rn.id}`}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setRejecting(false); setReason(""); }}>Cancel</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { if (reason.trim()) onReject(reason.trim()); }}
                        disabled={!reason.trim() || busy}
                        data-testid={`button-confirm-reject-${rn.id}`}
                      >
                        Return to author
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button size="sm" onClick={onApprove} disabled={busy} data-testid={`button-approve-${rn.id}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejecting(true)} disabled={busy} data-testid={`button-reject-${rn.id}`}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                    </Button>
                  </>
                )
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <Clock className="h-3.5 w-3.5" /> Waiting for a Super Admin to review.
                </div>
              )
            )}

            {/* Approved — send (super admin only) */}
            {rn.status === "approved" && (
              isSuperAdmin ? (
                <div className="w-full space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Send via</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <Checkbox checked={sendInApp} onCheckedChange={(v) => setSendInApp(!!v)} data-testid={`checkbox-send-inapp-${rn.id}`} />
                      <Bell className="h-3 w-3" /> In-app
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} data-testid={`checkbox-send-email-${rn.id}`} />
                      <Mail className="h-3 w-3" /> Email
                    </label>
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        const channels: string[] = [];
                        if (sendInApp) channels.push("in_app");
                        if (sendEmail) channels.push("email");
                        if (channels.length === 0) return;
                        onSend(channels);
                      }}
                      disabled={busy || (!sendInApp && !sendEmail)}
                      data-testid={`button-send-${rn.id}`}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {sendInApp && sendEmail ? "Send (both)" : "Send"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approved — a Super Admin will send it.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SentRow({ rn }: { rn: ReleaseNote }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`sent-note-row-${rn.id}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {rn.version && <Badge variant="outline" className="font-mono text-xs shrink-0">{rn.version}</Badge>}
        <span className="font-medium text-sm flex-1 min-w-0 truncate">{rn.title || "Untitled"}</span>
        <div className="flex items-center gap-2 shrink-0">
          {rn.sentAt && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {new Date(rn.sentAt).toLocaleDateString()}
            </span>
          )}
          {rn.sentChannels?.includes("in_app") && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Bell className="h-2.5 w-2.5 mr-0.5" />In-app</Badge>
          )}
          {rn.sentChannels?.includes("email") && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Mail className="h-2.5 w-2.5 mr-0.5" />Email</Badge>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed font-sans">
            {rn.body || "(no body)"}
          </pre>
          {rn.sentAt && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 pt-2 border-t">
              <Check className="h-3.5 w-3.5" />
              Sent {new Date(rn.sentAt).toLocaleString()}
              {rn.sentChannels && rn.sentChannels.length > 0 && (
                <span className="text-muted-foreground ml-1">via {rn.sentChannels.join(", ")}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
