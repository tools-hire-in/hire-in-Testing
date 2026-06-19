import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Key, FileText, Settings, ClipboardList,
  CheckCircle2, ExternalLink, X, Send, AlertCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const REQUEST_TILES = [
  {
    id: "access",
    label: "Access",
    description: "System access, permissions, tool accounts",
    icon: Key,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    subTypes: [
      "New system access",
      "Permission change",
      "Account unlock / reset",
      "VPN / remote access",
      "Other access request",
    ],
  },
  {
    id: "hr",
    label: "HR",
    description: "Leave disputes, payroll, documents",
    icon: FileText,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    subTypes: [
      "Leave balance dispute",
      "Payroll / salary query",
      "Document request",
      "Policy clarification",
      "Other HR request",
    ],
  },
  {
    id: "ops",
    label: "Operations",
    description: "Equipment, facilities, onboarding support",
    icon: Settings,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    subTypes: [
      "Equipment / hardware",
      "Facilities request",
      "Onboarding support",
      "Software / tool issue",
      "Other ops request",
    ],
  },
  {
    id: "general",
    label: "General",
    description: "Other requests and enquiries",
    icon: ClipboardList,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    subTypes: [
      "General enquiry",
      "Feedback / suggestion",
      "Compliance question",
      "Other",
    ],
  },
];

type Tile = typeof REQUEST_TILES[number];

interface DraftRequest {
  tileId: string;
  subType: string;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
}

function NewRequestModal({
  tile,
  onClose,
}: {
  tile: Tile;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<DraftRequest>({
    tileId: tile.id,
    subType: "",
    subject: "",
    description: "",
    priority: "medium",
  });

  const isValid = draft.subType && draft.subject.trim().length >= 5 && draft.description.trim().length >= 20;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitted(true);
    toast({
      title: "Request submitted",
      description: "Your request has been logged. A reference number will be assigned once HIRD is enabled.",
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-new-request">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">Request Submitted</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Your request has been logged. You will receive a reference number and status updates
                once the HIRD ticketing system is enabled.
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed text-xs text-muted-foreground text-left w-full">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                For urgent issues, contact HR directly while the ticketing system is being set up.
              </span>
            </div>
            <Button onClick={onClose} className="w-full" data-testid="button-close-success">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-md ${tile.bg}`}>
                  <tile.icon className={`h-4 w-4 ${tile.color}`} />
                </div>
                New {tile.label} Request
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-1">
              <div className="space-y-1.5">
                <Label htmlFor="sub-type">Request type <span className="text-destructive">*</span></Label>
                <Select
                  value={draft.subType}
                  onValueChange={(v) => setDraft(d => ({ ...d, subType: v }))}
                >
                  <SelectTrigger id="sub-type" data-testid="select-sub-type">
                    <SelectValue placeholder="Select a request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {tile.subTypes.map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your request"
                  value={draft.subject}
                  onChange={(e) => setDraft(d => ({ ...d, subject: e.target.value }))}
                  maxLength={120}
                  data-testid="input-request-subject"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                  <span className="text-xs font-normal text-muted-foreground ml-1">(min. 20 chars)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your request in detail — include any relevant dates, systems, or context."
                  rows={4}
                  value={draft.description}
                  onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                  data-testid="textarea-request-description"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {draft.description.trim().length} / 20 min
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft(d => ({ ...d, priority: v as DraftRequest["priority"] }))}
                >
                  <SelectTrigger id="priority" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — no deadline, general request</SelectItem>
                    <SelectItem value="medium">Medium — needed within a few days</SelectItem>
                    <SelectItem value="high">High — urgent, blocking my work</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  data-testid="button-cancel-request"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid}
                  className="flex-1 gap-2"
                  data-testid="button-submit-request"
                >
                  <Send className="h-4 w-4" />
                  Submit Request
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ServiceDesk() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTile, setActiveTile] = useState<Tile | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    document.title = "Service Desk | Hire'in Portal";
    return () => { document.title = "Hire'in Portal"; };
  }, []);

  if (authLoading || !isAuthenticated) return null;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-service-desk-title">Service Desk</h1>
          <p className="text-sm text-muted-foreground">Raise internal support requests — we'll take it from there.</p>
        </div>

        {/* Request type tiles */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">What do you need help with?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REQUEST_TILES.map(tile => (
              <button
                key={tile.id}
                onClick={() => setActiveTile(tile)}
                className={`group flex flex-col items-start gap-3 p-4 rounded-xl border-2 ${tile.border} ${tile.bg} hover:shadow-md transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                data-testid={`tile-${tile.id}`}
              >
                <div className="p-2 rounded-lg bg-white dark:bg-background shadow-sm">
                  <tile.icon className={`h-5 w-5 ${tile.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tile.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tile.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* My open requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">
              My Open Requests
              <span className="ml-2 text-xs font-normal text-muted-foreground">(0)</span>
            </p>
          </div>

          <Card>
            <CardContent className="py-12 text-center" data-testid="service-desk-empty-state">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
              <p className="text-sm font-medium text-foreground">No open requests — you're all set ✓</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the tiles above to raise a new request. Tickets will appear here once HIRD is enabled.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info strip */}
        <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed text-xs text-muted-foreground" data-testid="service-desk-info">
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Full ticket tracking with HIRD reference numbers, status updates, and email notifications is coming soon.
            For urgent issues, contact HR directly.
          </span>
        </div>
      </div>

      {/* New Request Modal */}
      {activeTile && (
        <NewRequestModal
          tile={activeTile}
          onClose={() => setActiveTile(null)}
        />
      )}
    </AdminLayout>
  );
}
