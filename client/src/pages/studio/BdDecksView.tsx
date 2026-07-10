import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
  LayoutTemplate, Users, Copy, Eye, Edit3, Download, ChevronLeft, ChevronRight,
  Plus, FileText, Loader2, Archive, StickyNote, X, Check, ArrowUp, ArrowDown,
  CloudOff, Cloud, ShieldCheck, Clock, AlertCircle, History, ChevronDown,
  ChevronUp, Send, RotateCcw, Lock, Pencil,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BdSlide {
  title: string;
  bullets: string[];
  speaker_notes: string;
}

interface BdDeck {
  id: string;
  title: string;
  domain: string;
  deck_type: string;
  parent_id: string | null;
  version: string;
  client_name: string | null;
  status: string;
  description: string | null;
  changes_summary: string | null;
  slides: BdSlide[];
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  deck_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  it: "IT",
  engineering: "Engineering",
  professional_services: "Professional Services",
};

const DOMAIN_COLORS: Record<string, string> = {
  healthcare: "bg-rose-50 text-rose-700 border-rose-200",
  it: "bg-blue-50 text-blue-700 border-blue-200",
  engineering: "bg-amber-50 text-amber-700 border-amber-200",
  professional_services: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft:            { label: "Draft",            cls: "bg-slate-50 text-slate-600 border-slate-200",  icon: <Pencil className="h-3 w-3" /> },
  pending_approval: { label: "Pending Approval", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  approved:         { label: "Approved",         cls: "bg-green-50 text-green-700 border-green-200", icon: <ShieldCheck className="h-3 w-3" /> },
  active:           { label: "Active",           cls: "bg-green-50 text-green-700 border-green-200", icon: <ShieldCheck className="h-3 w-3" /> },
  archived:         { label: "Archived",         cls: "bg-gray-50 text-gray-500 border-gray-200",   icon: <Archive className="h-3 w-3" /> },
};

const ACTION_LABELS: Record<string, string> = {
  created_master:       "Created master deck",
  cloned_from_master:   "Cloned from master",
  edited:               "Edited",
  submitted_for_approval: "Submitted for approval",
  approved:             "Approved",
  approval_revoked:     "Approval revoked",
  archived:             "Archived",
  downloaded_pdf:       "Downloaded PDF",
};

const AUTO_SAVE_DELAY = 2000;
type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

// ── Small helpers ─────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${DOMAIN_COLORS[domain] || "bg-muted text-muted-foreground border-border"}`}>
      {DOMAIN_LABELS[domain] || domain}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, cls: "bg-muted text-muted-foreground", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function VersionChip({ version }: { version: string }) {
  return (
    <span className="inline-flex items-center rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs font-semibold text-primary">
      {version.toUpperCase()}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLog({ deckId }: { deckId: string }) {
  const [open, setOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/bd/decks", deckId, "audit"],
    queryFn: () => fetch(`/api/bd/decks/${deckId}/audit`, { credentials: "include" }).then((r) => r.json()),
    enabled: open,
  });

  return (
    <div className="border-t">
      <button
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
        data-testid="button-audit-toggle"
      >
        <History className="h-3.5 w-3.5" />
        <span className="font-medium">Change History</span>
        <span className="ml-auto">{open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2 max-h-64 overflow-y-auto" data-testid="audit-log-panel">
          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No history yet.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{ACTION_LABELS[e.action] || e.action}</span>
                {e.actor_email && <span className="text-muted-foreground"> · {e.actor_email}</span>}
                {e.note && <p className="text-muted-foreground mt-0.5 leading-relaxed">{e.note}</p>}
                <p className="text-muted-foreground/70 mt-0.5">{formatDateTime(e.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deck Card ─────────────────────────────────────────────────────────────────

function DeckCard({
  deck,
  isSuperAdmin,
  onView,
  onClone,
  onEdit,
  onArchive,
  onSubmitApproval,
  onApprove,
  onRevoke,
}: {
  deck: BdDeck;
  isSuperAdmin: boolean;
  onView: () => void;
  onClone: () => void;
  onEdit?: () => void;
  onArchive: () => void;
  onSubmitApproval?: () => void;
  onApprove?: () => void;
  onRevoke?: () => void;
}) {
  const isMaster = deck.deck_type === "master";
  const isClient = deck.deck_type === "client";
  const isPending = deck.status === "pending_approval";
  const isApproved = deck.status === "approved";
  const isDraft = deck.status === "draft";
  const isLocked = isClient && (isPending || isApproved) && !isSuperAdmin;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card transition-shadow hover:shadow-md ${isPending ? "border-amber-300" : ""}`}
      data-testid={`card-deck-${deck.id}`}
    >
      {/* Pending approval banner */}
      {isPending && (
        <div className="flex items-center gap-1.5 rounded-t-xl border-b border-amber-200 bg-amber-50 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Awaiting super admin approval</span>
        </div>
      )}
      {isLocked && isDraft === false && (
        <div className="absolute right-3 top-3">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isMaster ? "bg-primary/10" : "bg-muted"}`}>
            {isMaster ? <LayoutTemplate className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug" data-testid={`text-deck-title-${deck.id}`}>
              {deck.title}
            </p>
            {deck.client_name && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Client: {deck.client_name}</p>
            )}
          </div>
        </div>

        {/* Description */}
        {deck.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{deck.description}</p>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <DomainBadge domain={deck.domain} />
          <VersionChip version={deck.version} />
          <StatusBadge status={deck.status} />
          <span className="ml-auto text-xs text-muted-foreground">{deck.slides?.length ?? 0} slides</span>
        </div>

        {/* Changes summary (for client decks) */}
        {isClient && deck.changes_summary && (
          <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">What changed</p>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{deck.changes_summary}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Updated {formatDate(deck.updated_at)}</p>
        {isApproved && deck.approved_at && (
          <p className="text-xs text-green-600">Approved {formatDate(deck.approved_at)}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onView} data-testid={`button-view-deck-${deck.id}`}>
            <Eye className="mr-1 h-3 w-3" />View
          </Button>

          {/* Master: clone for client */}
          {isMaster && (
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onClone} data-testid={`button-clone-deck-${deck.id}`}>
              <Copy className="mr-1 h-3 w-3" />Clone
            </Button>
          )}

          {/* Master: edit (super admin only) */}
          {isMaster && isSuperAdmin && onEdit && (
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onEdit} data-testid={`button-edit-master-${deck.id}`}>
              <Edit3 className="mr-1 h-3 w-3" />Edit
            </Button>
          )}

          {/* Client draft: edit */}
          {isClient && isDraft && onEdit && (
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onEdit} data-testid={`button-edit-deck-${deck.id}`}>
              <Edit3 className="mr-1 h-3 w-3" />Edit
            </Button>
          )}

          {/* Super admin: edit locked client deck */}
          {isClient && !isDraft && isSuperAdmin && onEdit && (
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={onEdit} data-testid={`button-edit-deck-admin-${deck.id}`}>
              <Edit3 className="mr-1 h-3 w-3" />Edit
            </Button>
          )}

          {/* Client draft: submit for approval */}
          {isClient && isDraft && onSubmitApproval && (
            <Button size="sm" variant="default" className="h-7 flex-1 text-xs bg-[#1F3A6E] hover:bg-[#1F3A6E]/90" onClick={onSubmitApproval} data-testid={`button-submit-approval-${deck.id}`}>
              <Send className="mr-1 h-3 w-3" />Submit
            </Button>
          )}

          {/* Super admin: approve pending */}
          {isPending && isSuperAdmin && onApprove && (
            <Button size="sm" variant="default" className="h-7 flex-1 text-xs bg-green-600 hover:bg-green-700" onClick={onApprove} data-testid={`button-approve-deck-${deck.id}`}>
              <ShieldCheck className="mr-1 h-3 w-3" />Approve
            </Button>
          )}

          {/* Super admin: revoke */}
          {(isPending || isApproved) && isSuperAdmin && onRevoke && (
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRevoke} title="Revoke — return to draft" data-testid={`button-revoke-deck-${deck.id}`}>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}

          {/* Download PDF — only approved client decks (or any master, or super_admin always) */}
          {(isMaster || isApproved || isSuperAdmin) && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={() => window.open(`/api/bd/decks/${deck.id}/pdf`, "_blank")}
              title="Download PDF"
              data-testid={`button-download-pdf-${deck.id}`}
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}

          {/* Archive */}
          {(isSuperAdmin || (isClient && isDraft)) && deck.status !== "archived" && (
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onArchive} title="Archive" data-testid={`button-archive-deck-${deck.id}`}>
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Audit log (collapsible) */}
      <AuditLog deckId={deck.id} />
    </div>
  );
}

// ── Slide Viewer ──────────────────────────────────────────────────────────────

function SlideViewer({
  deck,
  isSuperAdmin,
  onClose,
  onClone,
  onEdit,
}: {
  deck: BdDeck;
  isSuperAdmin: boolean;
  onClose: () => void;
  onClone: () => void;
  onEdit: () => void;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const slide = slides[slideIdx];
  const isMaster = deck.deck_type === "master";
  const isClient = deck.deck_type === "client";
  const isApproved = deck.status === "approved";
  const isDraft = deck.status === "draft";

  return (
    <div className="flex h-full flex-col" data-testid="slide-viewer">
      {/* Viewer header */}
      <div className="flex items-center gap-2 border-b bg-[#1F3A6E] px-4 py-3">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-white hover:bg-white/10 hover:text-white" onClick={onClose} data-testid="button-viewer-back">
          <ChevronLeft className="h-4 w-4" />Back
        </Button>
        <Separator orientation="vertical" className="h-4 bg-white/30" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{deck.title}</p>
          <p className="text-xs text-white/60">{DOMAIN_LABELS[deck.domain] || deck.domain} · {deck.version.toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={deck.status} />
          {isMaster && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-white hover:bg-white/10 hover:text-white" onClick={onClone} data-testid="button-viewer-clone">
              <Copy className="mr-1 h-3 w-3" />Clone for Client
            </Button>
          )}
          {/* Edit: master=super_admin only; client=any if draft OR super_admin always */}
          {(isMaster && isSuperAdmin) || (isClient && (isDraft || isSuperAdmin)) ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-white hover:bg-white/10 hover:text-white" onClick={onEdit} data-testid="button-viewer-edit">
              <Edit3 className="mr-1 h-3 w-3" />Edit
            </Button>
          ) : null}
          {(isMaster || isApproved || isSuperAdmin) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.open(`/api/bd/decks/${deck.id}/pdf${showNotes ? "?notes=1" : ""}`, "_blank")}
              data-testid="button-viewer-download"
            >
              <Download className="mr-1 h-3 w-3" />PDF
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 px-2 text-xs hover:bg-white/10 ${showNotes ? "text-[#F47C20]" : "text-white/60 hover:text-white"}`}
            onClick={() => setShowNotes((n) => !n)}
            data-testid="button-viewer-notes"
          >
            <StickyNote className="mr-1 h-3 w-3" />{showNotes ? "Hide" : "Show"} Notes
          </Button>
        </div>
      </div>

      {/* Navigation strip */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={slideIdx === 0} onClick={() => setSlideIdx((i) => i - 1)} data-testid="button-viewer-prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Slide <span className="font-semibold text-foreground">{slideIdx + 1}</span> of {slides.length}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={slideIdx === slides.length - 1} onClick={() => setSlideIdx((i) => i + 1)} data-testid="button-viewer-next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-2 flex items-center gap-1 overflow-x-auto">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)}
              className={`h-2 w-2 shrink-0 rounded-full transition-colors ${i === slideIdx ? "bg-[#F47C20]" : "bg-muted-foreground/25 hover:bg-muted-foreground/50"}`}
              data-testid={`button-viewer-dot-${i}`}
            />
          ))}
        </div>
      </div>

      {/* Slide content */}
      {slide ? (
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-3xl flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#F47C20]">SLIDE {slideIdx + 1}</p>
              <h2 className="mt-1 text-2xl font-bold leading-snug text-foreground">{slide.title}</h2>
            </div>
            <ul className="space-y-3">
              {(slide.bullets || []).map((bullet, bi) => (
                <li key={bi} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#F47C20]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {showNotes && slide.speaker_notes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <StickyNote className="h-3.5 w-3.5" />Speaker Notes
                </p>
                <p className="text-sm leading-relaxed text-amber-800">{slide.speaker_notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No slides in this deck.</p>
        </div>
      )}
    </div>
  );
}

// ── Client Deck Editor ────────────────────────────────────────────────────────

function ClientDeckEditor({
  deck,
  isSuperAdmin,
  onClose,
  onSubmitApproval,
}: {
  deck: BdDeck;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSubmitApproval?: () => void;
}) {
  const [slides, setSlides] = useState<BdSlide[]>(
    Array.isArray(deck.slides) ? deck.slides.map((s) => ({ ...s, bullets: [...s.bullets] })) : []
  );
  const [changesSummary, setChangesSummary] = useState(deck.changes_summary || "");
  const [description, setDescription] = useState(deck.description || "");
  const [slideIdx, setSlideIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slidesRef = useRef(slides);
  const changesSummaryRef = useRef(changesSummary);
  const descriptionRef = useRef(description);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { changesSummaryRef.current = changesSummary; }, [changesSummary]);
  useEffect(() => { descriptionRef.current = description; }, [description]);
  useEffect(() => () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); }, []);

  const performSave = useCallback(async (showToast = false) => {
    setSaving(true);
    setAutoSaveState("saving");
    try {
      await apiRequest("PATCH", `/api/bd/decks/${deck.id}`, {
        slides: slidesRef.current,
        changes_summary: changesSummaryRef.current || null,
        description: descriptionRef.current || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      setAutoSaveState("saved");
      if (showToast) toast({ title: "Saved", description: "Changes saved to deck." });
      setTimeout(() => setAutoSaveState("idle"), 3000);
    } catch {
      setAutoSaveState("error");
      if (showToast) toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [deck.id, queryClient, toast]);

  const scheduleAutoSave = useCallback(() => {
    setAutoSaveState("pending");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => performSave(false), AUTO_SAVE_DELAY);
  }, [performSave]);

  const slide = slides[slideIdx];

  const updateSlide = useCallback((updater: (s: BdSlide) => BdSlide) => {
    setSlides((prev) => prev.map((s, i) => i === slideIdx ? updater(s) : s));
    scheduleAutoSave();
  }, [slideIdx, scheduleAutoSave]);

  const moveBullet = useCallback((bi: number, dir: "up" | "down") => {
    updateSlide((s) => {
      const bullets = [...s.bullets];
      const ti = dir === "up" ? bi - 1 : bi + 1;
      if (ti < 0 || ti >= bullets.length) return s;
      [bullets[bi], bullets[ti]] = [bullets[ti], bullets[bi]];
      return { ...s, bullets };
    });
  }, [updateSlide]);

  async function handleSaveAndClose() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await performSave(true);
    onClose();
  }

  function AutoSaveIndicator() {
    if (autoSaveState === "idle") return null;
    if (autoSaveState === "pending") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Unsaved…</span>;
    if (autoSaveState === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
    if (autoSaveState === "saved") return <span className="flex items-center gap-1 text-xs text-green-600"><Cloud className="h-3 w-3" />Saved</span>;
    if (autoSaveState === "error") return <span className="flex items-center gap-1 text-xs text-destructive"><CloudOff className="h-3 w-3" />Failed</span>;
    return null;
  }

  // Check if deck is locked for non-super_admin
  const isLocked = !isSuperAdmin && deck.deck_type === "client" && ["pending_approval", "approved"].includes(deck.status);

  return (
    <div className="flex h-full flex-col" data-testid="deck-editor">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose} data-testid="button-editor-back">
          <ChevronLeft className="h-4 w-4" />Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{deck.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={deck.status} />
            {isLocked && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Locked — super admin only</span>}
          </div>
        </div>
        <AutoSaveIndicator />
        {!isLocked && (
          <Button size="sm" onClick={handleSaveAndClose} disabled={saving} data-testid="button-editor-save">
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Save & Close
          </Button>
        )}
        {deck.deck_type === "client" && deck.status === "draft" && onSubmitApproval && (
          <Button size="sm" className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90" onClick={async () => { await performSave(false); onSubmitApproval(); }} disabled={saving} data-testid="button-submit-from-editor">
            <Send className="mr-1 h-3.5 w-3.5" />Submit for Approval
          </Button>
        )}
      </div>

      {/* Slide navigation */}
      <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={slideIdx === 0} onClick={() => setSlideIdx((i) => i - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Slide <span className="font-semibold text-foreground">{slideIdx + 1}</span> of {slides.length}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={slideIdx === slides.length - 1} onClick={() => setSlideIdx((i) => i + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="ml-2 flex items-center gap-1 overflow-x-auto">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)}
              className={`h-2 w-2 shrink-0 rounded-full ${i === slideIdx ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deck Description</Label>
          <Textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); scheduleAutoSave(); }}
            placeholder="What is this deck for? (e.g. Initial outreach to Apollo Hospitals for ICU nursing positions)"
            className="min-h-[60px] resize-none text-sm"
            disabled={isLocked}
            data-testid="input-deck-description"
          />
        </div>

        <Separator />

        {/* Slide title */}
        {slide && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slide Title</Label>
              <Input
                value={slide.title}
                onChange={(e) => updateSlide((s) => ({ ...s, title: e.target.value }))}
                className="font-semibold"
                disabled={isLocked}
                data-testid="input-slide-title"
              />
            </div>

            {/* Bullets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bullet Points</Label>
                {!isLocked && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => updateSlide((s) => ({ ...s, bullets: [...s.bullets, ""] }))} data-testid="button-add-bullet">
                    <Plus className="mr-1 h-3 w-3" />Add
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {slide.bullets.map((bullet, bi) => (
                  <div key={bi} className="flex items-start gap-1.5">
                    {!isLocked && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={bi === 0} onClick={() => moveBullet(bi, "up")} data-testid={`button-bullet-up-${bi}`}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={bi === slide.bullets.length - 1} onClick={() => moveBullet(bi, "down")} data-testid={`button-bullet-down-${bi}`}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#F47C20]" />
                    <Input
                      value={bullet}
                      onChange={(e) => updateSlide((s) => ({ ...s, bullets: s.bullets.map((b, j) => j === bi ? e.target.value : b) }))}
                      className="flex-1 text-sm"
                      disabled={isLocked}
                      data-testid={`input-bullet-${bi}`}
                    />
                    {!isLocked && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => updateSlide((s) => ({ ...s, bullets: s.bullets.filter((_, j) => j !== bi) }))} data-testid={`button-remove-bullet-${bi}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Speaker notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Speaker Notes</Label>
              <Textarea
                value={slide.speaker_notes}
                onChange={(e) => updateSlide((s) => ({ ...s, speaker_notes: e.target.value }))}
                className="min-h-[80px] resize-none text-sm"
                placeholder="Talking points for the presenter…"
                disabled={isLocked}
                data-testid="input-slide-notes"
              />
            </div>
          </>
        )}

        <Separator />

        {/* Changes summary */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Changes from Template</Label>
          <Textarea
            value={changesSummary}
            onChange={(e) => { setChangesSummary(e.target.value); scheduleAutoSave(); }}
            placeholder="Summarise what was customised from the master template (required before submitting for approval)…"
            className="min-h-[80px] resize-none text-sm"
            disabled={isLocked}
            data-testid="input-changes-summary"
          />
        </div>
      </div>
    </div>
  );
}

// ── Clone Modal ───────────────────────────────────────────────────────────────

function CloneModal({
  deck,
  open,
  onClose,
  onCloned,
}: {
  deck: BdDeck | null;
  open: boolean;
  onClose: () => void;
  onCloned: (newDeck: BdDeck) => void;
}) {
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "short" });
  const year = now.getFullYear();
  const domainLabel = deck ? (DOMAIN_LABELS[deck.domain] || deck.domain) : "";
  const previewTitle = clientName.trim() ? `${clientName.trim()} · ${domainLabel} · ${monthName} ${year}` : "";

  const cloneMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bd/decks/${deck!.id}/clone`, {
      client_name: clientName.trim(),
      description: description.trim() || null,
    }).then((r: any) => r.json()),
    onSuccess: (newDeck: BdDeck) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      toast({ title: "Cloned!", description: `Client deck created: ${newDeck.title}` });
      setClientName(""); setDescription("");
      onCloned(newDeck);
    },
    onError: () => toast({ title: "Clone failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setClientName(""); setDescription(""); onClose(); } }}>
      <DialogContent className="max-w-md" data-testid="modal-clone-deck">
        <DialogHeader>
          <DialogTitle>Clone for Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="clone-client-name">Company name <span className="text-destructive">*</span></Label>
            <Input id="clone-client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Apollo Hospitals" data-testid="input-clone-client-name" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-description">Purpose / context <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea id="clone-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. ICU & OT nursing recruitment — Q3 outreach" className="min-h-[70px] resize-none text-sm" data-testid="input-clone-description" />
          </div>
          {previewTitle && (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Deck title preview</p>
              <p className="mt-0.5 text-sm font-medium">{previewTitle}</p>
            </div>
          )}
          {deck && (
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              Cloning <span className="font-medium">{deck.title}</span> ({deck.slides?.length ?? 0} slides). After cloning, edit your version then submit for super admin approval before sending to the client.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setClientName(""); setDescription(""); onClose(); }}>Cancel</Button>
          <Button disabled={!clientName.trim() || cloneMutation.isPending} onClick={() => cloneMutation.mutate()} data-testid="button-clone-confirm">
            {cloneMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Copy className="mr-1 h-4 w-4" />}
            Create Client Deck
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Submit Approval Modal ─────────────────────────────────────────────────────

function SubmitApprovalModal({
  deck,
  open,
  onClose,
  onSubmitted,
}: {
  deck: BdDeck | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [note, setNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bd/decks/${deck!.id}/submit-approval`, { note: note.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      toast({ title: "Submitted!", description: "Deck sent to super admin for approval." });
      setNote("");
      onSubmitted();
    },
    onError: () => toast({ title: "Submission failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNote(""); onClose(); } }}>
      <DialogContent className="max-w-md" data-testid="modal-submit-approval">
        <DialogHeader>
          <DialogTitle>Submit for Approval</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="inline mr-1 h-3.5 w-3.5" />
            Once submitted, the deck will be locked for editing until a super admin reviews it. Make sure all slides and client details are final.
          </div>
          <div className="space-y-1.5">
            <Label>Note to reviewer <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Ready for Apollo Hospitals pitch on July 15. Please review slides 3 and 7." className="min-h-[70px] resize-none text-sm" data-testid="input-approval-note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setNote(""); onClose(); }}>Cancel</Button>
          <Button className="bg-[#1F3A6E] hover:bg-[#1F3A6E]/90" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()} data-testid="button-confirm-submit-approval">
            {submitMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── New Master Modal ──────────────────────────────────────────────────────────

function NewMasterModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (deck: BdDeck) => void;
}) {
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("healthcare");
  const [version, setVersion] = useState("v1");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/bd/decks", {
        title: title.trim(),
        domain,
        version: version.trim() || "v1",
        description: description.trim() || null,
        slides: [],
      }).then((r: any) => r.json()),
    onSuccess: (deck: BdDeck) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      toast({ title: "Master template created!", description: "Add slides in the editor." });
      setTitle(""); setDomain("healthcare"); setVersion("v1"); setDescription("");
      onCreated(deck);
    },
    onError: () => toast({ title: "Failed to create master", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(""); setDomain("healthcare"); setVersion("v1"); setDescription(""); onClose(); } }}>
      <DialogContent className="max-w-md" data-testid="modal-new-master">
        <DialogHeader>
          <DialogTitle>New Master Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="master-title">Title <span className="text-destructive">*</span></Label>
            <Input id="master-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Healthcare Staffing — Hire'in Solutions" data-testid="input-master-title" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Domain <span className="text-destructive">*</span></Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger data-testid="select-master-domain"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="professional_services">Prof. Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="master-version">Version</Label>
              <Input id="master-version" value={version} onChange={(e) => setVersion(e.target.value)}
                placeholder="v1" data-testid="input-master-version" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="master-description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea id="master-description" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this master deck for? Who is it pitched to?" className="min-h-[70px] resize-none text-sm"
              data-testid="input-master-description" />
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
            The deck will be created with no slides. You'll be taken to the editor to add content.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setTitle(""); setDomain("healthcare"); setVersion("v1"); setDescription(""); onClose(); }}>Cancel</Button>
          <Button disabled={!title.trim() || createMutation.isPending} onClick={() => createMutation.mutate()} data-testid="button-create-master-confirm">
            {createMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Create & Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Domain Tab Content ────────────────────────────────────────────────────────

function DomainTabContent({
  domain,
  allDecks,
  isSuperAdmin,
  onView,
  onClone,
  onEdit,
  onArchive,
  onSubmitApproval,
  onApprove,
  onRevoke,
  onNewMaster,
}: {
  domain: string | null; // null = all
  allDecks: BdDeck[];
  isSuperAdmin: boolean;
  onView: (d: BdDeck) => void;
  onClone: (d: BdDeck) => void;
  onEdit: (d: BdDeck) => void;
  onArchive: (d: BdDeck) => void;
  onSubmitApproval: (d: BdDeck) => void;
  onApprove: (d: BdDeck) => void;
  onRevoke: (d: BdDeck) => void;
  onNewMaster?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const domainFiltered = domain ? allDecks.filter((d) => d.domain === domain) : allDecks;
  const filtered = statusFilter === "all"
    ? domainFiltered
    : domainFiltered.filter((d) => d.status === statusFilter);

  const masters = filtered.filter((d) => d.deck_type === "master");
  const clients = filtered
    .filter((d) => d.deck_type === "client")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Group masters by domain (relevant for "All" tab)
  const mastersByDomain: Record<string, BdDeck[]> = {};
  masters.forEach((d) => {
    if (!mastersByDomain[d.domain]) mastersByDomain[d.domain] = [];
    mastersByDomain[d.domain].push(d);
  });

  const cardProps = (deck: BdDeck) => ({
    deck,
    isSuperAdmin,
    onView: () => onView(deck),
    onClone: () => onClone(deck),
    onEdit: () => onEdit(deck),
    onArchive: () => onArchive(deck),
    onSubmitApproval: () => onSubmitApproval(deck),
    onApprove: () => onApprove(deck),
    onRevoke: () => onRevoke(deck),
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Filter by status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-44 text-xs" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setStatusFilter("all")} data-testid="button-clear-status-filter">
            <X className="mr-1 h-3 w-3" />Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{masters.length + clients.length} deck{masters.length + clients.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Master Templates */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Master Templates</h2>
          <span className="text-xs text-muted-foreground">— read-only reference decks{isSuperAdmin ? "" : " (super admin edits only)"}</span>
          {isSuperAdmin && onNewMaster && (
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={onNewMaster} data-testid="button-new-master">
              <Plus className="mr-1 h-3 w-3" />New Master Template
            </Button>
          )}
        </div>

        {masters.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No master templates{domain ? ` for ${DOMAIN_LABELS[domain]}` : ""} yet.
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(mastersByDomain).map(([dom, deckList]) => (
            <div key={dom}>
              {!domain && (
                <div className="mb-2 flex items-center gap-2">
                  <DomainBadge domain={dom} />
                  <span className="text-xs text-muted-foreground">{deckList.length} version{deckList.length !== 1 ? "s" : ""}</span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {deckList.map((deck) => <DeckCard key={deck.id} {...cardProps(deck)} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Client Decks */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Client Decks</h2>
          <span className="text-xs text-muted-foreground">— cloned and customised versions, newest first</span>
          {isSuperAdmin && clients.filter((d) => d.status === "pending_approval").length > 0 && (
            <span className="ml-2 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Clock className="h-3 w-3" />
              {clients.filter((d) => d.status === "pending_approval").length} pending
            </span>
          )}
        </div>

        {clients.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Copy className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No client decks yet{domain ? ` for ${DOMAIN_LABELS[domain]}` : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">Clone a master template to create a client-specific version.</p>
          </div>
        )}

        {clients.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((deck) => <DeckCard key={deck.id} {...cardProps(deck)} />)}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Main BdDecksView ──────────────────────────────────────────────────────────

export default function BdDecksView() {
  const { role } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = role === "super_admin";

  const [activeTab, setActiveTab] = useState("all");
  const [viewingDeck, setViewingDeck] = useState<BdDeck | null>(null);
  const [editingDeck, setEditingDeck] = useState<BdDeck | null>(null);
  const [cloneTarget, setCloneTarget] = useState<BdDeck | null>(null);
  const [submitTarget, setSubmitTarget] = useState<BdDeck | null>(null);
  const [newMasterOpen, setNewMasterOpen] = useState(false);

  const { data: decks = [], isLoading } = useQuery<BdDeck[]>({
    queryKey: ["/api/bd/decks"],
    queryFn: () => fetch("/api/bd/decks", { credentials: "include" }).then((r) => r.json()),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bd/decks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] }); toast({ title: "Archived" }); },
    onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/bd/decks/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] }); toast({ title: "Approved!", description: "Deck is now approved for client distribution." }); },
    onError: () => toast({ title: "Approval failed", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/bd/decks/${id}/revoke-approval`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] }); toast({ title: "Revoked", description: "Deck returned to draft." }); },
    onError: () => toast({ title: "Revoke failed", variant: "destructive" }),
  });

  // Full-screen views take precedence
  if (viewingDeck) {
    return (
      <SlideViewer
        deck={viewingDeck}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setViewingDeck(null)}
        onClone={() => { setCloneTarget(viewingDeck); setViewingDeck(null); }}
        onEdit={() => { setEditingDeck(viewingDeck); setViewingDeck(null); }}
      />
    );
  }

  if (editingDeck) {
    return (
      <ClientDeckEditor
        deck={editingDeck}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setEditingDeck(null)}
        onSubmitApproval={() => { setSubmitTarget(editingDeck); setEditingDeck(null); }}
      />
    );
  }

  const nonArchivedDecks = decks.filter((d) => d.status !== "archived");
  const pendingCount = nonArchivedDecks.filter((d) => d.deck_type === "client" && d.status === "pending_approval").length;

  const tabProps = {
    allDecks: nonArchivedDecks,
    isSuperAdmin,
    onView: (d: BdDeck) => setViewingDeck(d),
    onClone: (d: BdDeck) => setCloneTarget(d),
    onEdit: (d: BdDeck) => setEditingDeck(d),
    onArchive: (d: BdDeck) => archiveMutation.mutate(d.id),
    onSubmitApproval: (d: BdDeck) => setSubmitTarget(d),
    onApprove: (d: BdDeck) => approveMutation.mutate(d.id),
    onRevoke: (d: BdDeck) => revokeMutation.mutate(d.id),
    onNewMaster: isSuperAdmin ? () => setNewMasterOpen(true) : undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Super admin pending alert banner */}
      {isSuperAdmin && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" data-testid="banner-pending-approval">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{pendingCount} client deck{pendingCount !== 1 ? "s" : ""}</span> awaiting your approval — review below.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-52 animate-pulse rounded-xl border bg-muted" />)}
        </div>
      )}

      {!isLoading && (
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-deck-domain">
          <TabsList className="flex w-full overflow-x-auto mb-2">
            <TabsTrigger value="all" className="flex-1" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="healthcare" className="flex-1" data-testid="tab-healthcare">Healthcare</TabsTrigger>
            <TabsTrigger value="it" className="flex-1" data-testid="tab-it">IT</TabsTrigger>
            <TabsTrigger value="engineering" className="flex-1" data-testid="tab-engineering">Engineering</TabsTrigger>
            <TabsTrigger value="professional_services" className="flex-1" data-testid="tab-ps">Prof. Services</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DomainTabContent domain={null} {...tabProps} />
          </TabsContent>
          <TabsContent value="healthcare">
            <DomainTabContent domain="healthcare" {...tabProps} />
          </TabsContent>
          <TabsContent value="it">
            <DomainTabContent domain="it" {...tabProps} />
          </TabsContent>
          <TabsContent value="engineering">
            <DomainTabContent domain="engineering" {...tabProps} />
          </TabsContent>
          <TabsContent value="professional_services">
            <DomainTabContent domain="professional_services" {...tabProps} />
          </TabsContent>
        </Tabs>
      )}

      {/* Modals */}
      <CloneModal
        deck={cloneTarget}
        open={!!cloneTarget}
        onClose={() => setCloneTarget(null)}
        onCloned={(newDeck) => { setCloneTarget(null); setEditingDeck(newDeck); }}
      />
      <SubmitApprovalModal
        deck={submitTarget}
        open={!!submitTarget}
        onClose={() => setSubmitTarget(null)}
        onSubmitted={() => setSubmitTarget(null)}
      />
      <NewMasterModal
        open={newMasterOpen}
        onClose={() => setNewMasterOpen(false)}
        onCreated={(newDeck) => { setNewMasterOpen(false); setEditingDeck(newDeck); }}
      />
    </div>
  );
}
