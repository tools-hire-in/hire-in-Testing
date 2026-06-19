import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wand2, RefreshCw, Send, GitCommit, Mail, Bell, Check, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ReleaseNote {
  id: string;
  version: string | null;
  title: string | null;
  body: string | null;
  changelogInput: string | null;
  sentChannels: string[] | null;
  sentAt: string | null;
  createdAt: string;
}

interface DraftFields {
  version: string;
  title: string;
  body: string;
}

export function ReleaseNotesSection() {
  const { toast } = useToast();

  const [changelogInput, setChangelogInput] = useState("");
  const [draft, setDraft] = useState<DraftFields | null>(null);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendInApp, setSendInApp] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: settingsDraft } = useQuery<{ draft: string; lastSha: string }>({
    queryKey: ["/api/admin/settings/release-notes-draft"],
  });

  const { data: releaseNotesList, isLoading } = useQuery<ReleaseNote[]>({
    queryKey: ["/api/admin/release-notes"],
  });

  useEffect(() => {
    if (settingsDraft?.draft && !changelogInput) {
      setChangelogInput(settingsDraft.draft);
    }
  }, [settingsDraft]);

  const saveDraftMutation = useMutation({
    mutationFn: async (text: string) => {
      await apiRequest("PATCH", "/api/admin/settings/release-notes-draft", { draft: text });
    },
  });

  function handleChangelogBlur() {
    if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current);
    saveDraftMutation.mutate(changelogInput);
  }

  function handleChangelogChange(value: string) {
    setChangelogInput(value);
    if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current);
    saveDraftTimer.current = setTimeout(() => {
      saveDraftMutation.mutate(value);
    }, 2000);
  }

  const fetchGitLogMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/release-notes/git-log", {});
      return res.json();
    },
    onSuccess: (data) => {
      const log = (data.log || "").trim();
      if (!log) {
        toast({ title: "No new commits", description: "No commits found since the last release." });
        return;
      }
      // Append fetched commits to any existing scratchpad content
      setChangelogInput(prev => {
        const combined = prev.trim() ? `${prev.trim()}\n\n--- synced from git ---\n${log}` : log;
        // Debounce-save the merged value
        if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current);
        saveDraftTimer.current = setTimeout(() => saveDraftMutation.mutate(combined), 2000);
        return combined;
      });
      toast({ title: "Commits appended", description: `${log.split("\n").filter(Boolean).length} commit(s) added to scratchpad.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not fetch git log.", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/release-notes/generate", { changelogInput });
      return res.json();
    },
    onSuccess: (data) => {
      setDraft({ version: data.version || "", title: data.title || "", body: data.body || "" });
      toast({ title: "Draft generated", description: "Review and edit the fields below before publishing." });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err?.message || "AI could not generate release notes.", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("No draft");
      const channels: string[] = [];
      if (sendInApp) channels.push("in_app");
      if (sendEmail) channels.push("email");

      // Step 1: save as draft
      const saveRes = await apiRequest("POST", "/api/admin/release-notes", {
        version: draft.version,
        title: draft.title,
        body: draft.body,
        changelogInput,
      });
      const saved = await saveRes.json();
      if (!saved?.id) throw new Error("Draft save failed");

      // Step 2: dispatch via selected channels (updates SHA cursor only after send)
      if (channels.length > 0) {
        const sendRes = await apiRequest("POST", `/api/admin/release-notes/${saved.id}/send`, { channels });
        return sendRes.json();
      }
      return saved;
    },
    onSuccess: () => {
      toast({ title: "Published!", description: "Release notes saved and sent." });
      setDraft(null);
      handleChangelogChange("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/release-notes"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish release notes.", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, channels }: { id: string; channels: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/release-notes/${id}/send`, { channels });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sent!", description: "Release notes dispatched to selected channels." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/release-notes"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send release notes.", variant: "destructive" });
    },
  });

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
                Raw commit log — stays private, used only for AI generation.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchGitLogMutation.mutate()}
                disabled={fetchGitLogMutation.isPending}
                data-testid="button-fetch-git-log"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${fetchGitLogMutation.isPending ? "animate-spin" : ""}`} />
                {fetchGitLogMutation.isPending ? "Loading..." : "Auto-populate"}
              </Button>
            </div>
            <Textarea
              value={changelogInput}
              onChange={(e) => handleChangelogChange(e.target.value)}
              onBlur={handleChangelogBlur}
              placeholder="Paste git commits or describe changes…&#10;e.g. abc1234 Fix leave balance calculation&#10;     def5678 Add break tracking widget"
              rows={12}
              className="font-mono text-xs resize-none"
              data-testid="textarea-changelog-input"
            />
            {saveDraftMutation.isPending && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Save className="h-3 w-3 animate-pulse" /> Auto-saving…
              </p>
            )}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!changelogInput.trim() || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-release-notes"
            >
              <Wand2 className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-pulse" : ""}`} />
              {generateMutation.isPending ? "Generating with AI…" : "Generate with AI →"}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Editable release note + send controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Release Note Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Wand2 className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">Fill in the changelog and click "Generate with AI →" to create a draft.</p>
                <p className="text-xs mt-1 opacity-60">Or you can type directly in the fields below after clicking anywhere.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setDraft({ version: "", title: "", body: "" })}
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

                <div className="border-t pt-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Send via</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={sendInApp}
                        onCheckedChange={(v) => setSendInApp(!!v)}
                        data-testid="checkbox-send-in-app"
                      />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">In-app notification (all active users)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={sendEmail}
                        onCheckedChange={(v) => setSendEmail(!!v)}
                        data-testid="checkbox-send-email"
                      />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Email blast (all active employees)</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDraft(null)}
                    >
                      Discard
                    </Button>
                    <Button
                      onClick={() => publishMutation.mutate()}
                      disabled={publishMutation.isPending || !draft.title.trim() || !draft.body.trim() || (!sendInApp && !sendEmail)}
                      className="flex-1"
                      data-testid="button-publish-release-notes"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {publishMutation.isPending ? "Publishing…" : "Publish & Send"}
                    </Button>
                  </div>
                  {!sendInApp && !sendEmail && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one channel to publish.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !releaseNotesList || releaseNotesList.length === 0 ? (
            <div className="text-center py-8">
              <GitCommit className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No release notes published yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Generate your first entry above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {releaseNotesList.map((rn) => (
                <HistoryRow
                  key={rn.id}
                  rn={rn}
                  expanded={expandedId === rn.id}
                  onToggle={() => setExpandedId(expandedId === rn.id ? null : rn.id)}
                  onSend={(channels) => sendMutation.mutate({ id: rn.id, channels })}
                  isSending={sendMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryRow({
  rn,
  expanded,
  onToggle,
  onSend,
  isSending,
}: {
  rn: ReleaseNote;
  expanded: boolean;
  onToggle: () => void;
  onSend: (channels: string[]) => void;
  isSending: boolean;
}) {
  const [sendEmail, setSendEmail] = useState(false);
  const [sendInApp, setSendInApp] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`release-note-row-${rn.id}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {rn.version && <Badge variant="outline" className="font-mono text-xs shrink-0">{rn.version}</Badge>}
        <span className="font-medium text-sm flex-1 min-w-0 truncate">{rn.title || "Untitled"}</span>
        <div className="flex items-center gap-2 shrink-0">
          {rn.sentAt && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {new Date(rn.sentAt).toLocaleDateString()}
            </span>
          )}
          {rn.sentChannels && rn.sentChannels.length > 0 && (
            <div className="flex gap-1">
              {rn.sentChannels.includes("in_app") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Bell className="h-2.5 w-2.5 mr-0.5" />In-app
                </Badge>
              )}
              {rn.sentChannels.includes("email") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Mail className="h-2.5 w-2.5 mr-0.5" />Email
                </Badge>
              )}
            </div>
          )}
          {!rn.sentAt && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Draft</Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/20 space-y-3">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed font-sans">
            {rn.body || "(no body)"}
          </pre>

          <div className="pt-2 border-t flex items-center gap-4 flex-wrap">
            {rn.sentAt ? (
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Sent {new Date(rn.sentAt).toLocaleString()}
                {rn.sentChannels && rn.sentChannels.length > 0 && (
                  <span className="text-muted-foreground ml-1">via {rn.sentChannels.join(", ")}</span>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-4 ml-auto">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <Checkbox
                  checked={sendInApp}
                  onCheckedChange={(v) => setSendInApp(!!v)}
                  data-testid={`checkbox-history-inapp-${rn.id}`}
                />
                <Bell className="h-3 w-3" /> In-app
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(v) => setSendEmail(!!v)}
                  data-testid={`checkbox-history-email-${rn.id}`}
                />
                <Mail className="h-3 w-3" /> Email
              </label>
              <Button
                size="sm"
                variant={rn.sentAt ? "outline" : "default"}
                onClick={() => {
                  const channels: string[] = [];
                  if (sendInApp) channels.push("in_app");
                  if (sendEmail) channels.push("email");
                  if (channels.length === 0) return;
                  onSend(channels);
                }}
                disabled={isSending || (!sendInApp && !sendEmail)}
                data-testid={`button-send-release-note-${rn.id}`}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {isSending ? "Sending…" : rn.sentAt ? "Re-send" : "Send Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
