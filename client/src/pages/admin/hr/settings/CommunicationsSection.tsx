import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

interface AnnouncementAdminData {
  version: string;
  content: AnnouncementContent | null;
  lastSent: { sentAt: string; recipientCount: number; failedCount: number } | null;
}

const ICON_OPTIONS = ["star", "message", "clock", "bell", "heart", "award"];

export function CommunicationsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHr = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const defaultContent: AnnouncementContent = {
    title: "What's new at Hire'in",
    subtitle: "Three updates made just for you",
    blocks: [
      { icon: "star", title: "", body: "", cta_label: "", cta_path: "" },
    ],
  };

  const [form, setForm] = useState<AnnouncementContent>(defaultContent);
  const [version, setVersion] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const { data: announcementData, isLoading } = useQuery<AnnouncementAdminData>({
    queryKey: ["/api/admin/announcements"],
    enabled: isHr,
  });

  const { data: recipientData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/announcements/recipient-count"],
    enabled: isHr,
  });

  useEffect(() => {
    if (announcementData) {
      setVersion(announcementData.version || "2024-06");
      if (announcementData.content) {
        setForm(announcementData.content);
      }
    }
  }, [announcementData]);

  useEffect(() => {
    if (recipientData) setRecipientCount(recipientData.count);
  }, [recipientData]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/admin/announcements", { content: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      toast({ title: "Content saved", description: "Announcement content updated." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/admin/announcements", { version, content: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setConfirmPublish(false);
      toast({ title: "Published", description: "Version updated — all employees will see the modal on next login." });
    },
    onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/announcements/send-email");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      setConfirmSend(false);
      toast({ title: "Email blast sent", description: `Sent to ${data.sent} recipients${data.failed > 0 ? `, ${data.failed} failed` : ""}.` });
    },
    onError: (err: any) => {
      setConfirmSend(false);
      toast({ title: "Failed to send", description: err.message || "Check that notifications are enabled.", variant: "destructive" });
    },
  });

  const updateBlock = (idx: number, field: keyof AnnouncementBlock, value: string) => {
    setForm(prev => ({
      ...prev,
      blocks: prev.blocks.map((b, i) => i === idx ? { ...b, [field]: value } : b),
    }));
  };

  const addBlock = () => {
    if (form.blocks.length >= 5) return;
    setForm(prev => ({
      ...prev,
      blocks: [...prev.blocks, { icon: "star", title: "", body: "", cta_label: "", cta_path: "" }],
    }));
  };

  const removeBlock = (idx: number) => {
    setForm(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== idx),
    }));
  };

  if (!isHr) return null;
  if (isLoading) return null;

  const lastSent = announcementData?.lastSent;

  return (
    <Card data-testid="card-communications-section">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          What's New — Announcement System
        </CardTitle>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          <span>Current version: <strong className="text-foreground">{announcementData?.version || "—"}</strong></span>
          {lastSent && (
            <span>
              Last emailed: <strong className="text-foreground">
                {new Date(lastSent.sentAt).toLocaleDateString()} — {lastSent.recipientCount} recipients
              </strong>
            </span>
          )}
          {recipientCount !== null && (
            <span>Eligible recipients: <strong className="text-foreground">{recipientCount}</strong></span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Version string</Label>
              <Input
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="e.g. 2024-06"
                data-testid="input-announcement-version"
              />
              <p className="text-xs text-muted-foreground">Changing version re-triggers modal for all users</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modal title</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What's new at Hire'in"
              data-testid="input-announcement-title"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subtitle</Label>
            <Input
              value={form.subtitle}
              onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
              placeholder="Three updates made just for you"
              data-testid="input-announcement-subtitle"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Feature blocks ({form.blocks.length}/5)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addBlock}
              disabled={form.blocks.length >= 5}
              data-testid="button-add-block"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add block
            </Button>
          </div>

          {form.blocks.map((block, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/30" data-testid={`block-editor-${idx}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Block {idx + 1}</span>
                {form.blocks.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(idx)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    data-testid={`button-remove-block-${idx}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Icon</Label>
                  <Select value={block.icon} onValueChange={v => updateBlock(idx, "icon", v)}>
                    <SelectTrigger data-testid={`select-block-icon-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(ic => (
                        <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={block.title}
                    onChange={e => updateBlock(idx, "title", e.target.value)}
                    placeholder="Feature name"
                    data-testid={`input-block-title-${idx}`}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body text</Label>
                <Textarea
                  value={block.body}
                  onChange={e => updateBlock(idx, "body", e.target.value)}
                  placeholder="Describe the feature in 1–2 sentences"
                  rows={2}
                  data-testid={`textarea-block-body-${idx}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CTA label</Label>
                  <Input
                    value={block.cta_label}
                    onChange={e => updateBlock(idx, "cta_label", e.target.value)}
                    placeholder="Try it now"
                    data-testid={`input-block-cta-label-${idx}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTA path</Label>
                  <Input
                    value={block.cta_path}
                    onChange={e => updateBlock(idx, "cta_path", e.target.value)}
                    placeholder="/admin/praise"
                    data-testid={`input-block-cta-path-${idx}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-announcement-content"
          >
            {saveMutation.isPending ? "Saving..." : "Save content"}
          </Button>
          <Button
            onClick={() => setConfirmPublish(true)}
            disabled={publishMutation.isPending}
            data-testid="button-publish-announcement"
          >
            Publish to all employees
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirmSend(true)}
            disabled={sendEmailMutation.isPending}
            data-testid="button-send-announcement-email"
          >
            Send email blast
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogContent data-testid="dialog-confirm-publish">
          <DialogHeader>
            <DialogTitle>Publish announcement?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will save the content and set version to <strong>{version}</strong>.
            All employees and managers will see the "What's New" modal on their next login.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPublish(false)}>Cancel</Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishMutation.isPending ? "Publishing..." : "Yes, publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent data-testid="dialog-confirm-send-email">
          <DialogHeader>
            <DialogTitle>Send email blast?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send the current announcement email to{" "}
            <strong>{recipientCount ?? "all"} eligible employees</strong>.
            Make sure you have saved your content first and that the Notifications feature flag is enabled.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSend(false)}>Cancel</Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? "Sending..." : "Yes, send emails"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
