import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BookOpen, Plus, ChevronRight, Trash2, Pencil, Users, Send,
  CheckCircle, Eye, EyeOff, GraduationCap, Clock, Loader2, X, Save, UserPlus, Sprout,
  AlertCircle, CalendarPlus, ShieldAlert, Check, XCircle, ExternalLink, WifiOff, Shield, ShieldOff,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

export default function TrainingManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTrackId, setAssignTrackId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [sopCatalogImporting, setSopCatalogImporting] = useState(false);
  const [showBulkRoleModal, setShowBulkRoleModal] = useState(false);
  const [bulkRoleTrackId, setBulkRoleTrackId] = useState<string>("");
  const [bulkRoleSlug, setBulkRoleSlug] = useState<string>("");
  const [bulkRoleDepartment, setBulkRoleDepartment] = useState<string>("");
  const [bulkRoleDueDate, setBulkRoleDueDate] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const [showEndorsements, setShowEndorsements] = useState(false);
  const [extensionComment, setExtensionComment] = useState<Record<string, string>>({});
  const [endorseComment, setEndorseComment] = useState<Record<string, string>>({});

  // Track form state
  const [trackForm, setTrackForm] = useState({ title: "", description: "", targetRole: "all_roles", version: "1.0", isPolicyTrack: false, isUniversal: false });

  // Section form state
  const [sectionForm, setSectionForm] = useState({
    title: "", body: "", estimatedMinutes: 5, minDwellSeconds: 60,
    questionText: "", explanation: "",
    options: [
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ],
  });

  const { data: rayoStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/rayo-academy/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/status", { credentials: "include" });
        if (!res.ok) return { enabled: false };
        return res.json();
      } catch { return { enabled: false }; }
    },
    staleTime: 60000,
  });
  const isRayoEnabled = rayoStatus?.enabled === true;

  const { data: rayoTracks } = useQuery<{ tracks: any[]; fromApi: boolean }>({
    queryKey: ["/api/rayo-academy/tracks"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/tracks", { credentials: "include" });
        if (!res.ok) return { tracks: [], fromApi: false };
        return res.json();
      } catch { return { tracks: [], fromApi: false }; }
    },
    enabled: isRayoEnabled,
  });

  const { data: tracks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/onboarding/tracks"] });
  const { data: sections = [], isLoading: loadingSections } = useQuery<any[]>({
    queryKey: ["/api/onboarding/tracks", selectedTrackId, "sections"],
    enabled: !!selectedTrackId,
  });
  const { data: usersResponse } = useQuery<{ users: { id: string; firstName: string; lastName: string; email: string; isActive: boolean }[]; counts: { active: number; disabled: number; deleted: number } }>({ queryKey: ["/api/admin/users"] });
  const users = usersResponse?.users ?? [];
  const { data: trackAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/onboarding/tracks", assignTrackId, "assignments"],
    enabled: !!assignTrackId,
  });

  const { data: selectedTrackAssignments = [], isLoading: loadingSelectedAssignments } = useQuery<any[]>({
    queryKey: ["/api/onboarding/tracks", selectedTrackId, "assignments"],
    enabled: !!selectedTrackId,
  });

  const { data: pendingExtensions = [], isLoading: loadingExtensions } = useQuery<any[]>({
    queryKey: ["/api/onboarding/extension-requests/pending"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/extension-requests/pending", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: user?.role === "super_admin",
  });

  const endorserRoles = ["manager", "hr", "admin"];
  const isEndorser = endorserRoles.includes(user?.role || "");

  const { data: toEndorse = [], isLoading: loadingEndorse } = useQuery<any[]>({
    queryKey: ["/api/onboarding/extension-requests/to-endorse"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/extension-requests/to-endorse", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: isEndorser,
  });

  const { data: catalogTracks = [] } = useQuery<any[]>({
    queryKey: ["/api/training/catalog"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/training/catalog", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch { return []; }
    },
    enabled: showBulkRoleModal,
    staleTime: 60000,
  });

  const bulkAssignByRole = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/training/bulk-assign-by-role", {
        trackId: bulkRoleTrackId,
        roleSlug: bulkRoleSlug,
        department: bulkRoleDepartment || undefined,
        dueDate: bulkRoleDueDate || undefined,
      }),
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      setShowBulkRoleModal(false);
      setBulkRoleTrackId("");
      setBulkRoleSlug("");
      setBulkRoleDepartment("");
      setBulkRoleDueDate("");
      toast({ title: `Assigned to ${data.assigned ?? 0} employee(s) · ${data.skipped ?? 0} already had it` });
    },
    onError: () => toast({ title: "Bulk assign failed", variant: "destructive" }),
  });

  const endorseExtension = useMutation({
    mutationFn: ({ id, comment, action }: { id: string; comment?: string; action?: string }) =>
      apiRequest("PATCH", `/api/onboarding/extension-requests/${id}/endorse`, { comment, action }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/to-endorse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/pending"] });
      const msg = variables.action === "approve" ? "Extension request approved"
        : variables.action === "reject" ? "Extension request rejected"
        : "Extension request endorsed and forwarded for approval";
      toast({ title: msg });
    },
    onError: () => toast({ title: "Failed to process request", variant: "destructive" }),
  });

  const resolveExtension = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: string; comment?: string }) =>
      apiRequest("PATCH", `/api/onboarding/extension-requests/${id}`, { status, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/extension-requests/pending"] });
      toast({ title: "Extension request updated" });
    },
    onError: () => toast({ title: "Failed to update request", variant: "destructive" }),
  });

  const activeUsers = useMemo(() => users.filter((u: any) => u.isActive), [users]);
  const selectedTrack = tracks.find((t: any) => t.id === selectedTrackId);

  const createTrack = useMutation({
    mutationFn: () => {
      const payload = {
        ...trackForm,
        targetRole: trackForm.targetRole === "all_roles" ? "" : trackForm.targetRole,
      };
      return apiRequest("POST", "/api/onboarding/tracks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      setShowTrackForm(false);
      setTrackForm({ title: "", description: "", targetRole: "all_roles", version: "1.0", isPolicyTrack: false, isUniversal: false });
      toast({ title: "Track created" });
    },
    onError: () => toast({ title: "Failed to create track", variant: "destructive" }),
  });

  const updateTrack = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/onboarding/tracks/${id}`, data),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      const data = await res.json().catch(() => ({}));
      if (data?.requiresReSign && data?.affectedUsersCount > 0) {
        toast({
          title: "Policy version updated",
          description: `${data.affectedUsersCount} employee(s) will be required to re-sign this policy (version bumped to v${data.versionNumber}).`,
        });
      } else {
        toast({ title: "Track updated" });
      }
    },
    onError: () => toast({ title: "Failed to update track", variant: "destructive" }),
  });

  const deleteTrack = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/onboarding/tracks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      setSelectedTrackId(null);
      toast({ title: "Track archived" });
    },
  });

  const saveSection = useMutation({
    mutationFn: async () => {
      const hasQuestion = sectionForm.questionText.trim().length > 0;
      const filledOptions = sectionForm.options.filter(o => o.optionText.trim().length > 0);
      const hasCorrectOption = sectionForm.options.some(o => o.isCorrect);

      // Validate quiz: if a question is provided, need at least 2 options AND a correct one marked
      if (hasQuestion) {
        if (filledOptions.length < 2) {
          throw new Error("Please fill in at least 2 answer options for the quiz.");
        }
        if (!hasCorrectOption) {
          throw new Error("Please select the correct answer by clicking the radio button next to the right option.");
        }
      }

      let section;
      if (editingSection?.id) {
        const res = await apiRequest("PATCH", `/api/onboarding/sections/${editingSection.id}`, {
          title: sectionForm.title,
          body: sectionForm.body,
          estimatedMinutes: sectionForm.estimatedMinutes,
          minDwellSeconds: sectionForm.minDwellSeconds,
        });
        section = await res.json();
      } else {
        const existingSections = sections || [];
        const res = await apiRequest("POST", `/api/onboarding/tracks/${selectedTrackId}/sections`, {
          title: sectionForm.title,
          body: sectionForm.body,
          estimatedMinutes: sectionForm.estimatedMinutes,
          minDwellSeconds: sectionForm.minDwellSeconds,
          orderIndex: existingSections.length,
        });
        section = await res.json();
      }

      if (hasQuestion && hasCorrectOption) {
        const quizRes = await apiRequest("PUT", `/api/onboarding/sections/${section.id}/quiz`, {
          questionText: sectionForm.questionText,
          explanation: sectionForm.explanation,
          options: filledOptions,
        });
        if (!quizRes.ok) {
          throw new Error("Section saved but quiz failed to save. Please edit the section to add the quiz again.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", selectedTrackId, "sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      setShowSectionForm(false);
      setEditingSection(null);
      resetSectionForm();
      toast({ title: "Section saved successfully" });
    },
    onError: (err: any) => toast({
      title: err?.message || "Failed to save section",
      variant: "destructive",
    }),
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/onboarding/sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", selectedTrackId, "sections"] });
      toast({ title: "Section deleted" });
    },
  });

  const [assignSelectedUsers, setAssignSelectedUsers] = useState<string[]>([]);
  const [assignDueDate, setAssignDueDate] = useState("");

  // Unassign / admin-exempt state for management view
  const [mgmtUnassignAssignment, setMgmtUnassignAssignment] = useState<{ id: string; trackTitle: string; userName: string } | null>(null);
  const [mgmtExemptAssignment, setMgmtExemptAssignment] = useState<{ id: string; trackTitle: string; userName: string } | null>(null);
  const [mgmtExemptReason, setMgmtExemptReason] = useState("");

  const mgmtUnassignMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiRequest("DELETE", `/api/onboarding/assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", selectedTrackId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/team-progress"] });
      toast({ title: "Training unassigned — progress records cleared" });
      setMgmtUnassignAssignment(null);
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to unassign", variant: "destructive" }),
  });

  const mgmtExemptMutation = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      apiRequest("PATCH", `/api/onboarding/assignments/${assignmentId}/exempt`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", selectedTrackId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/team-progress"] });
      toast({ title: "Training marked as exempt" });
      setMgmtExemptAssignment(null);
      setMgmtExemptReason("");
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to mark exempt", variant: "destructive" }),
  });

  const assignTrack = useMutation({
    mutationFn: async () => {
      if (isRayoEnabled) {
        return apiRequest("POST", "/api/rayo-academy/assign", {
          userIds: assignSelectedUsers,
          trackId: assignTrackId,
          dueDate: assignDueDate || null,
        });
      }
      return apiRequest("POST", `/api/onboarding/tracks/${assignTrackId}/assign`, {
        userIds: assignSelectedUsers,
        dueDate: assignDueDate || null,
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      const assigned = data.results.filter((r: any) => r.status === "assigned" || r.success).length;
      const skipped = data.results.filter((r: any) => r.status === "already_assigned").length;
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", assignTrackId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rayo-academy/my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rayo-academy/team-progress"] });
      toast({ title: `Assigned to ${assigned} employee(s)${skipped > 0 ? `, ${skipped} already assigned` : ""}` });
      setAssignSelectedUsers([]);
      setAssignDueDate("");
    },
    onError: () => toast({ title: "Failed to assign track", variant: "destructive" }),
  });

  const handleSopCatalogImport = async () => {
    setSopCatalogImporting(true);
    try {
      const res = await apiRequest("POST", "/api/training/seed-import");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      const parts: string[] = [];
      if (data.tracksUpserted) parts.push(`${data.tracksUpserted} module(s) upserted`);
      if (data.linksCreated) parts.push(`${data.linksCreated} SOP link(s) created`);
      if (data.rulesCreated) parts.push(`${data.rulesCreated} role rule(s) created`);
      toast({ title: parts.join(" · ") || "Catalog already up to date" });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setSopCatalogImporting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/seed");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      const parts: string[] = [];
      if (data.created?.length) parts.push(`${data.created.length} new track(s) created`);
      if (data.skipped?.length) parts.push(`${data.skipped.length} track(s) already existed`);
      if (data.sectionsAdded?.length) parts.push(`${data.sectionsAdded.length} new section(s) added`);
      if (data.sectionsSkipped?.length) parts.push(`${data.sectionsSkipped.length} section(s) already present`);
      if (data.universalCreated?.length) parts.push(`${data.universalCreated.length} universal policy track(s) created`);
      if (typeof data.universalAssigned === "number" && data.universalAssigned > 0) parts.push(`${data.universalAssigned} assignment(s) created`);
      toast({ title: parts.join(" · ") || "Content already up to date" });
    } catch {
      toast({ title: "Seed failed", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const resetSectionForm = () => setSectionForm({
    title: "", body: "", estimatedMinutes: 5, minDwellSeconds: 60,
    questionText: "", explanation: "",
    options: [
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
      { optionText: "", isCorrect: false },
    ],
  });

  const openEditSection = (section: any) => {
    setEditingSection(section);
    setSectionForm({
      title: section.title,
      body: section.body,
      estimatedMinutes: section.estimatedMinutes,
      minDwellSeconds: section.minDwellSeconds,
      questionText: section.quiz?.questionText || "",
      explanation: section.quiz?.explanation || "",
      options: section.quiz?.options?.length > 0
        ? (() => {
            const loaded = section.quiz.options.map((o: any) => ({ optionText: o.optionText, isCorrect: o.isCorrect }));
            // Pad to 4 options
            while (loaded.length < 4) loaded.push({ optionText: "", isCorrect: false });
            return loaded;
          })()
        : [
            { optionText: "", isCorrect: false },
            { optionText: "", isCorrect: false },
            { optionText: "", isCorrect: false },
            { optionText: "", isCorrect: false },
          ],
    });
    setShowSectionForm(true);
  };

  const canAdmin = ["super_admin", "admin", "hr", "manager"].includes(user?.role || "");
  const canHRAdmin = ["super_admin", "admin", "hr"].includes(user?.role || "");

  // Quiz validation state for inline feedback
  const hasQuestion = sectionForm.questionText.trim().length > 0;
  const filledOptionsCount = sectionForm.options.filter(o => o.optionText.trim().length > 0).length;
  const hasCorrectMarked = sectionForm.options.some(o => o.isCorrect);
  const quizValidationMsg = hasQuestion && filledOptionsCount < 2
    ? "Fill in at least 2 answer options"
    : hasQuestion && !hasCorrectMarked
    ? "Click a radio button to mark the correct answer"
    : null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-600" />
              Training Management
              {isRayoEnabled && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">Rayo Academy</span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Author tracks, manage content, and assign training to employees</p>
          </div>
          <div className="flex gap-2">
            {isEndorser && (
              <Button
                variant={showEndorsements ? "default" : "outline"}
                onClick={() => setShowEndorsements(!showEndorsements)}
                data-testid="button-toggle-endorsements"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {user?.role === "manager" ? "Review Requests" : "Endorse"}
                {toEndorse.length > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center" data-testid="badge-to-endorse">
                    {toEndorse.length}
                  </span>
                )}
              </Button>
            )}
            {user?.role === "super_admin" && (
              <Button
                variant={showExtensions ? "default" : "outline"}
                onClick={() => setShowExtensions(!showExtensions)}
                data-testid="button-toggle-extensions"
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Extensions
                {pendingExtensions.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center" data-testid="badge-pending-extensions">
                    {pendingExtensions.length}
                  </span>
                )}
              </Button>
            )}
            {["super_admin", "admin"].includes(user?.role || "") && (
              <Button variant="outline" onClick={handleSopCatalogImport} disabled={sopCatalogImporting} data-testid="button-import-sop-catalog">
                {sopCatalogImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BookOpen className="h-4 w-4 mr-2" />}
                Import SOP Catalog
              </Button>
            )}
            {["super_admin", "admin", "hr"].includes(user?.role || "") && (
              <Button variant="outline" onClick={() => setShowBulkRoleModal(true)} data-testid="button-bulk-assign-by-role">
                <Users className="h-4 w-4 mr-2" />
                Bulk Assign by Role
              </Button>
            )}
            {user?.role === "super_admin" && (
              <Button variant="outline" onClick={handleSeed} disabled={seeding} data-testid="button-seed-tracks">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sprout className="h-4 w-4 mr-2" />}
                Load SOP Content
              </Button>
            )}
            {canAdmin && (
              <Button onClick={() => setShowTrackForm(true)} data-testid="button-new-track">
                <Plus className="h-4 w-4 mr-2" />
                New Track
              </Button>
            )}
          </div>
        </div>

        {showEndorsements && isEndorser && (
          <Card data-testid="panel-endorsements">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-amber-600" />
                {user?.role === "manager" ? "Extension Requests from Your Reports" : "Requests Awaiting Your Endorsement"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEndorse && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              )}
              {!loadingEndorse && toEndorse.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No extension requests need your endorsement.</p>
              )}
              {!loadingEndorse && toEndorse.length > 0 && (
                <div className="space-y-3">
                  {toEndorse.map((ext: any) => (
                    <div key={ext.id} className="border rounded-lg p-4 space-y-3" data-testid={`endorse-request-${ext.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-semibold text-sm">{ext.requesterName} <span className="text-muted-foreground font-normal">({ext.requesterRole})</span></p>
                          <p className="text-sm text-muted-foreground">{ext.requesterEmail}</p>
                          <p className="text-sm">
                            <span className="font-medium">Track:</span> {ext.trackTitle}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Current due:</span> {ext.currentDueDate ? new Date(ext.currentDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "None"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Requested new date:</span> {new Date(ext.newDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-300">
                          {ext.isDirectReport && user?.role === "manager" ? "Pending Your Approval" : "Pending Endorsement"}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm whitespace-pre-wrap">{ext.reason}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Endorsement comment (optional)</Label>
                        <Input
                          value={endorseComment[ext.id] || ""}
                          onChange={e => setEndorseComment(prev => ({ ...prev, [ext.id]: e.target.value }))}
                          placeholder="Add a comment..."
                          className="h-8 text-sm"
                          data-testid={`input-endorse-comment-${ext.id}`}
                        />
                      </div>
                      {ext.isDirectReport && user?.role === "manager" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-700 hover:bg-green-800"
                            onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "", action: "approve" })}
                            disabled={endorseExtension.isPending}
                            data-testid={`button-approve-${ext.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "", action: "reject" })}
                            disabled={endorseExtension.isPending}
                            data-testid={`button-reject-${ext.id}`}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-blue-700 hover:bg-blue-800"
                          onClick={() => endorseExtension.mutate({ id: ext.id, comment: endorseComment[ext.id] || "" })}
                          disabled={endorseExtension.isPending}
                          data-testid={`button-endorse-${ext.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Endorse & Forward to Super Admin
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showExtensions && user?.role === "super_admin" && (
          <Card data-testid="panel-extensions">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Endorsed Extension Requests (Awaiting Approval)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingExtensions && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              )}
              {!loadingExtensions && pendingExtensions.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No endorsed extension requests awaiting your approval.</p>
              )}
              {!loadingExtensions && pendingExtensions.length > 0 && (
                <div className="space-y-3">
                  {pendingExtensions.map((ext: any) => (
                    <div key={ext.id} className="border rounded-lg p-4 space-y-3" data-testid={`extension-request-${ext.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-semibold text-sm">{ext.requesterName} <span className="text-muted-foreground font-normal">({ext.requesterRole})</span></p>
                          <p className="text-sm text-muted-foreground">{ext.requesterEmail}</p>
                          <p className="text-sm">
                            <span className="font-medium">Track:</span> {ext.trackTitle}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Current due:</span> {ext.currentDueDate ? new Date(ext.currentDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "None"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Requested new date:</span> {new Date(ext.newDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-blue-700 border-blue-300">Endorsed</Badge>
                      </div>
                      {ext.endorserName && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3">
                          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Endorsed by</p>
                          <p className="text-sm font-medium">{ext.endorserName}</p>
                          {ext.endorserComment && <p className="text-sm text-muted-foreground mt-1">"{ext.endorserComment}"</p>}
                          {ext.endorsedAt && <p className="text-xs text-muted-foreground mt-1">{new Date(ext.endorsedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                        </div>
                      )}
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm whitespace-pre-wrap">{ext.reason}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Comment (optional)</Label>
                        <Input
                          value={extensionComment[ext.id] || ""}
                          onChange={e => setExtensionComment(prev => ({ ...prev, [ext.id]: e.target.value }))}
                          placeholder="Add a comment..."
                          className="h-8 text-sm"
                          data-testid={`input-extension-comment-${ext.id}`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-700 hover:bg-green-800"
                          onClick={() => resolveExtension.mutate({ id: ext.id, status: "approved", comment: extensionComment[ext.id] || "" })}
                          disabled={resolveExtension.isPending}
                          data-testid={`button-approve-extension-${ext.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => resolveExtension.mutate({ id: ext.id, status: "rejected", comment: extensionComment[ext.id] || "" })}
                          disabled={resolveExtension.isPending}
                          data-testid={`button-reject-extension-${ext.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isRayoEnabled && rayoTracks && (
          <div className="space-y-4">
            {!rayoTracks.fromApi && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30" data-testid="banner-rayo-fallback">
                <WifiOff className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Training data may be delayed</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Unable to reach Rayo Academy. Showing locally cached track data.
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Rayo Academy Tracks ({rayoTracks.tracks.length})
              </h2>
              <Button size="sm" variant="outline" onClick={() => window.open("https://rayo.academy", "_blank")} data-testid="button-open-rayo-academy">
                <ExternalLink className="h-4 w-4 mr-1" />
                Manage in Rayo Academy
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rayoTracks.tracks.map((track: any) => (
                <Card key={track.id} className="hover:shadow-md transition-all" data-testid={`card-rayo-track-${track.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">{track.title}</p>
                        {track.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{track.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                            Rayo Academy
                          </span>
                          {track.category && (
                            <span className="text-xs text-muted-foreground">{track.category}</span>
                          )}
                          {track.estimatedHours > 0 && (
                            <span className="text-xs text-muted-foreground">{track.estimatedHours}h</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      variant="outline"
                      onClick={() => {
                        setAssignTrackId(track.id);
                        setShowAssignModal(true);
                      }}
                      data-testid={`button-assign-rayo-track-${track.id}`}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign to Employees
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {isRayoEnabled && <Separator />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Track List */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {isRayoEnabled ? "Local Learning Tracks (Legacy)" : "Learning Tracks"}
            </h2>
            {isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
            {!isLoading && tracks.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
                  {isRayoEnabled
                    ? "No local tracks. Use Rayo Academy tracks above for new assignments."
                    : "No tracks yet. Create one or load the SOP content."}
                </CardContent>
              </Card>
            )}
            {tracks.map((track: any) => (
              <Card
                key={track.id}
                className={`cursor-pointer transition-all ${selectedTrackId === track.id ? "ring-2 ring-blue-500" : "hover:shadow-md"}`}
                onClick={() => setSelectedTrackId(track.id)}
                data-testid={`card-track-${track.id}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm leading-tight truncate">{track.title}</p>
                        {track.isPolicyTrack && <Shield className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[track.status] || "bg-gray-100 text-gray-600"}`}>
                          {track.status}
                        </span>
                        {track.isPolicyTrack && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Policy</span>
                        )}
                        {track.isUniversal && (
                          <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Universal</span>
                        )}
                        <span className="text-xs text-muted-foreground">{track.sectionCount} sections</span>
                        <span className="text-xs text-muted-foreground">{track.assignmentCount} assigned</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Track Detail + Section Editor */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedTrackId && (
              <Card className="border-dashed">
                <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{isRayoEnabled ? "Select a local track to view, or use Rayo Academy tracks above" : "Select a track to view and edit its content"}</p>
                </CardContent>
              </Card>
            )}

            {selectedTrack && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedTrack.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{selectedTrack.description}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedTrack.status]}`}>
                            {selectedTrack.status}
                          </span>
                          {selectedTrack.targetRole && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{selectedTrack.targetRole}</span>
                          )}
                          {selectedTrack.isPolicyTrack && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Shield className="h-3 w-3" />Policy v{selectedTrack.versionNumber ?? 1}
                            </span>
                          )}
                          {selectedTrack.isUniversal && (
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Users className="h-3 w-3" />Universal
                            </span>
                          )}
                        </div>
                      </div>
                      {canAdmin && (
                        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowPreview(true)}
                            data-testid="button-preview-track"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignTrackId(selectedTrackId);
                              setShowAssignModal(true);
                            }}
                            data-testid="button-assign-track"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTrack.isPolicyTrack ? "secondary" : "outline"}
                            onClick={() => updateTrack.mutate({
                              id: selectedTrack.id,
                              data: { isPolicyTrack: !selectedTrack.isPolicyTrack, isUniversal: !selectedTrack.isPolicyTrack ? selectedTrack.isUniversal : false },
                            })}
                            data-testid="button-toggle-policy-track"
                            title={selectedTrack.isPolicyTrack ? "Remove mandatory policy flag" : "Mark as mandatory policy track"}
                          >
                            <Shield className={`h-4 w-4 mr-1 ${selectedTrack.isPolicyTrack ? "text-primary" : ""}`} />
                            {selectedTrack.isPolicyTrack ? "Policy" : "Set Policy"}
                          </Button>
                          {selectedTrack.isPolicyTrack && (
                            <Button
                              size="sm"
                              variant={selectedTrack.isUniversal ? "secondary" : "outline"}
                              onClick={() => updateTrack.mutate({
                                id: selectedTrack.id,
                                data: { isUniversal: !selectedTrack.isUniversal },
                              })}
                              data-testid="button-toggle-universal"
                              title={selectedTrack.isUniversal ? "Remove universal flag (admins exempt)" : "Mark as universal — all roles must sign"}
                              className={selectedTrack.isUniversal ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400" : ""}
                            >
                              <Users className={`h-4 w-4 mr-1 ${selectedTrack.isUniversal ? "text-amber-600" : ""}`} />
                              {selectedTrack.isUniversal ? "Universal" : "Set Universal"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={selectedTrack.status === "published" ? "outline" : "default"}
                            onClick={() => updateTrack.mutate({
                              id: selectedTrack.id,
                              data: { ...selectedTrack, status: selectedTrack.status === "published" ? "draft" : "published" },
                            })}
                            data-testid="button-toggle-publish"
                          >
                            {selectedTrack.status === "published"
                              ? <><EyeOff className="h-4 w-4 mr-1" />Unpublish</>
                              : <><Eye className="h-4 w-4 mr-1" />Publish</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => { if (confirm("Archive this track?")) deleteTrack.mutate(selectedTrack.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>

                {/* Sections */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Sections ({sections.length})
                    </h3>
                    {canAdmin && (
                      <Button size="sm" onClick={() => { resetSectionForm(); setEditingSection(null); setShowSectionForm(true); }} data-testid="button-add-section">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Section
                      </Button>
                    )}
                  </div>

                  {loadingSections && <div className="text-muted-foreground text-sm">Loading sections...</div>}

                  {sections.map((section: any, idx: number) => (
                    <Card key={section.id} data-testid={`card-section-${section.id}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{idx + 1}</span>
                              <p className="font-medium">{section.title}</p>
                            </div>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {section.estimatedMinutes} min read
                              </span>
                              <span>Min dwell: {section.minDwellSeconds}s</span>
                              {section.quiz
                                ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Quiz set</span>
                                : <span className="text-amber-600">No quiz</span>
                              }
                            </div>
                          </div>
                          {canAdmin && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => openEditSection(section)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => { if (confirm("Delete this section?")) deleteSection.mutate(section.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Assignments Panel — HR/Admin can Unassign or Mark Exempt */}
                {canHRAdmin && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                        Current Assignments ({selectedTrackAssignments.length})
                      </h3>
                    </div>
                    {loadingSelectedAssignments && (
                      <div className="text-muted-foreground text-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments...
                      </div>
                    )}
                    {!loadingSelectedAssignments && selectedTrackAssignments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No employees assigned to this track yet.</p>
                    )}
                    {!loadingSelectedAssignments && selectedTrackAssignments.length > 0 && (
                      <div className="space-y-2">
                        {selectedTrackAssignments.map((a: any) => {
                          const isExcepted = a.assignment.status === "excepted";
                          const isCompleted = a.assignment.status === "completed";
                          return (
                            <div key={a.assignment.id} className="border rounded-lg" data-testid={`mgmt-assignment-${a.assignment.id}`}>
                              <div className="flex items-center gap-3 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{a.user.firstName} {a.user.lastName}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                      isCompleted ? "bg-green-100 text-green-700"
                                      : isExcepted ? "bg-purple-100 text-purple-700"
                                      : a.assignment.status === "overdue" || (a.assignment.dueDate && new Date(a.assignment.dueDate) < new Date() && !isCompleted) ? "bg-red-100 text-red-700"
                                      : a.assignment.status === "in_progress" ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {isExcepted ? "Exempt" : isCompleted ? "Completed" : a.assignment.status === "in_progress" ? "In Progress" : "Not Started"}
                                    </span>
                                    {a.assignment.dueDate && (
                                      <span className="text-xs text-muted-foreground">Due: {new Date(a.assignment.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    )}
                                    {isExcepted && a.assignment.exceptionReason && (
                                      <span className="text-xs text-purple-600 truncate max-w-xs">Reason: {a.assignment.exceptionReason}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  {!isExcepted && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                                      onClick={() => {
                                        setMgmtExemptAssignment({
                                          id: a.assignment.id,
                                          trackTitle: selectedTrack?.title || "",
                                          userName: `${a.user.firstName} ${a.user.lastName}`,
                                        });
                                        setMgmtExemptReason("");
                                      }}
                                      data-testid={`button-mgmt-exempt-${a.assignment.id}`}
                                    >
                                      <ShieldOff className="h-3 w-3 mr-1" />
                                      Mark Exempt
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                    onClick={() => setMgmtUnassignAssignment({
                                      id: a.assignment.id,
                                      trackTitle: selectedTrack?.title || "",
                                      userName: `${a.user.firstName} ${a.user.lastName}`,
                                    })}
                                    data-testid={`button-mgmt-unassign-${a.assignment.id}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Unassign
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>

      {/* Mark Exempt Dialog (Management View) */}
      <Dialog open={!!mgmtExemptAssignment} onOpenChange={v => { if (!v) { setMgmtExemptAssignment(null); setMgmtExemptReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <ShieldOff className="h-5 w-5" />
              Mark Training Exempt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm">
              Marking <span className="font-semibold">{mgmtExemptAssignment?.userName}'s</span> assignment for{" "}
              <span className="font-semibold">"{mgmtExemptAssignment?.trackTitle}"</span> as exempt will immediately set the status to "Excepted" — no employee request needed.
            </p>
            <div className="space-y-2">
              <Label className="text-sm">Reason <span className="text-red-500">*</span></Label>
              <Textarea
                value={mgmtExemptReason}
                onChange={e => setMgmtExemptReason(e.target.value)}
                placeholder="e.g. Tenured employee hired mid-cycle, role change, external certification equivalent..."
                rows={3}
                className="text-sm"
                data-testid="input-mgmt-exempt-reason-dialog"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMgmtExemptAssignment(null); setMgmtExemptReason(""); }} data-testid="button-mgmt-cancel-exempt">
              Cancel
            </Button>
            <Button
              className="bg-orange-700 hover:bg-orange-800"
              onClick={() => mgmtExemptAssignment && mgmtExemptMutation.mutate({ assignmentId: mgmtExemptAssignment.id, reason: mgmtExemptReason })}
              disabled={!mgmtExemptReason.trim() || mgmtExemptMutation.isPending}
              data-testid="button-mgmt-confirm-exempt"
            >
              {mgmtExemptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Confirm Exemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Confirmation Dialog (Management View) */}
      <Dialog open={!!mgmtUnassignAssignment} onOpenChange={v => { if (!v) setMgmtUnassignAssignment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Unassign Training
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              You are about to remove <span className="font-semibold">{mgmtUnassignAssignment?.userName}</span>'s assignment for{" "}
              <span className="font-semibold">"{mgmtUnassignAssignment?.trackTitle}"</span>.
            </p>
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700">
              <strong>Warning:</strong> All progress records for this assignment will be permanently deleted. This cannot be undone.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMgmtUnassignAssignment(null)} data-testid="button-mgmt-cancel-unassign">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => mgmtUnassignAssignment && mgmtUnassignMutation.mutate(mgmtUnassignAssignment.id)}
              disabled={mgmtUnassignMutation.isPending}
              data-testid="button-mgmt-confirm-unassign"
            >
              {mgmtUnassignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Yes, Unassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Track Modal */}
      <Dialog open={showTrackForm} onOpenChange={setShowTrackForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Learning Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Track Title</Label>
              <Input
                value={trackForm.title}
                onChange={e => setTrackForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Common Onboarding"
                data-testid="input-track-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={trackForm.description}
                onChange={e => setTrackForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this track..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Role (optional)</Label>
                <Select value={trackForm.targetRole} onValueChange={v => setTrackForm(p => ({ ...p, targetRole: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_roles">All roles</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  value={trackForm.version}
                  onChange={e => setTrackForm(p => ({ ...p, version: e.target.value }))}
                />
              </div>
            </div>
            <div
              className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${trackForm.isPolicyTrack ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"}`}
              onClick={() => setTrackForm(p => ({ ...p, isPolicyTrack: !p.isPolicyTrack, isUniversal: !p.isPolicyTrack ? p.isUniversal : false }))}
              data-testid="toggle-is-policy-track"
            >
              <div className="flex items-center gap-3">
                <Shield className={`h-4 w-4 ${trackForm.isPolicyTrack ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Mandatory Policy Track</p>
                  <p className="text-xs text-muted-foreground">Employees must sign this before accessing the portal</p>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${trackForm.isPolicyTrack ? "bg-primary" : "bg-muted-foreground/30"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${trackForm.isPolicyTrack ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
              </div>
            </div>
            {trackForm.isPolicyTrack && (
              <div
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${trackForm.isUniversal ? "bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-700" : "hover:bg-muted/50"}`}
                onClick={() => setTrackForm(p => ({ ...p, isUniversal: !p.isUniversal }))}
                data-testid="toggle-is-universal"
              >
                <div className="flex items-center gap-3">
                  <Users className={`h-4 w-4 ${trackForm.isUniversal ? "text-amber-600" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">Apply to All Roles (Universal)</p>
                    <p className="text-xs text-muted-foreground">HR, managers, and admins must also sign this policy</p>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${trackForm.isUniversal ? "bg-amber-500" : "bg-muted-foreground/30"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${trackForm.isUniversal ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackForm(false)}>Cancel</Button>
            <Button onClick={() => createTrack.mutate()} disabled={createTrack.isPending || !trackForm.title}>
              {createTrack.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Create Track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Form Modal */}
      <Dialog open={showSectionForm} onOpenChange={setShowSectionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Section Title</Label>
                <Input
                  value={sectionForm.title}
                  onChange={e => setSectionForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Welcome & Mission"
                  data-testid="input-section-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Read Time (minutes)</Label>
                <Input
                  type="number"
                  value={sectionForm.estimatedMinutes}
                  onChange={e => setSectionForm(p => ({ ...p, estimatedMinutes: parseInt(e.target.value) || 5 }))}
                  min={1} max={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Read Time (seconds)</Label>
                <Input
                  type="number"
                  value={sectionForm.minDwellSeconds}
                  onChange={e => setSectionForm(p => ({ ...p, minDwellSeconds: parseInt(e.target.value) || 30 }))}
                  min={10} max={300}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={sectionForm.body}
                onChange={e => setSectionForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Section content... Use plain text or markdown-style formatting."
                rows={10}
                className="font-mono text-sm"
                data-testid="textarea-section-body"
              />
            </div>

            <Separator />
            <div>
              <p className="font-semibold text-sm mb-1">Comprehension Quiz (optional but recommended)</p>
              <p className="text-xs text-muted-foreground mb-3">Leave the question blank to skip the quiz for this section.</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Textarea
                    value={sectionForm.questionText}
                    onChange={e => setSectionForm(p => ({ ...p, questionText: e.target.value }))}
                    placeholder="What is the correct approach when..."
                    rows={2}
                    data-testid="input-quiz-question"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Answer Options</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Fill in the options, then click the circle next to the correct answer.</p>
                  {sectionForm.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-2 p-2 rounded-md border ${opt.isCorrect ? "border-green-400 bg-green-50" : "border-transparent"}`}>
                      <input
                        type="radio"
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={() => setSectionForm(p => ({
                          ...p,
                          options: p.options.map((o, i) => ({ ...o, isCorrect: i === idx })),
                        }))}
                        className="shrink-0 w-4 h-4 accent-green-600"
                      />
                      <Input
                        value={opt.optionText}
                        onChange={e => setSectionForm(p => ({
                          ...p,
                          options: p.options.map((o, i) => i === idx ? { ...o, optionText: e.target.value } : o),
                        }))}
                        placeholder={`Option ${idx + 1}`}
                        className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                        data-testid={`input-quiz-option-${idx}`}
                      />
                      {opt.isCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                    </div>
                  ))}
                </div>

                {/* Inline quiz validation hint */}
                {quizValidationMsg && (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {quizValidationMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Explanation (shown to employee after answering)</Label>
                  <Textarea
                    value={sectionForm.explanation}
                    onChange={e => setSectionForm(p => ({ ...p, explanation: e.target.value }))}
                    placeholder="Why is this the correct answer?"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSectionForm(false); setEditingSection(null); resetSectionForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => saveSection.mutate()}
              disabled={saveSection.isPending || !sectionForm.title || !sectionForm.body || !!quizValidationMsg}
              data-testid="button-save-section"
            >
              {saveSection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Preview — {selectedTrack?.title}
            </DialogTitle>
          </DialogHeader>

          {loadingSections ? (
            <div className="py-8 text-center text-muted-foreground">Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No sections added yet.</div>
          ) : (
            <div className="space-y-6 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <BookOpen className="h-4 w-4" />
                <span>{sections.length} section{sections.length !== 1 ? "s" : ""} · {sections.reduce((acc: number, s: any) => acc + (s.estimatedMinutes || 5), 0)} min total</span>
              </div>

              {(sections as any[]).map((section: any, idx: number) => (
                <div key={section.id} className="border rounded-xl overflow-hidden">
                  {/* Section header */}
                  <div className="bg-muted/50 px-5 py-3 flex items-center gap-3 border-b">
                    <span className="text-xs font-mono bg-background border rounded px-2 py-0.5 font-semibold">
                      {idx + 1}
                    </span>
                    <h3 className="font-semibold text-base">{section.title}</h3>
                    <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{section.estimatedMinutes} min</span>
                      {section.quiz
                        ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Quiz</span>
                        : <span className="text-amber-500">No quiz</span>
                      }
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 py-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{section.body}</pre>
                  </div>

                  {/* Quiz preview */}
                  {section.quiz && (
                    <div className="border-t bg-blue-50/40 px-5 py-4 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Comprehension Quiz</p>
                      <p className="text-sm font-medium">{section.quiz.questionText}</p>
                      <div className="space-y-1.5">
                        {(section.quiz.options || []).map((opt: any, oi: number) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${opt.isCorrect ? "bg-green-50 border-green-300 text-green-800 font-medium" : "bg-white border-gray-200"}`}
                          >
                            <span className="text-xs font-mono shrink-0 w-5 h-5 flex items-center justify-center border rounded-full">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt.optionText}
                            {opt.isCorrect && <CheckCircle className="h-3.5 w-3.5 ml-auto text-green-600" />}
                          </div>
                        ))}
                      </div>
                      {section.quiz.explanation && (
                        <p className="text-xs text-muted-foreground italic">{section.quiz.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            {selectedTrack?.status !== "published" && canAdmin && (
              <Button
                onClick={() => {
                  updateTrack.mutate({
                    id: selectedTrack.id,
                    data: { ...selectedTrack, status: "published" },
                  });
                  setShowPreview(false);
                }}
                data-testid="button-publish-from-preview"
              >
                <Eye className="h-4 w-4 mr-2" />
                Publish Track
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign by Role Dialog */}
      <Dialog open={showBulkRoleModal} onOpenChange={setShowBulkRoleModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Assign by Role
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>SOP Training Module</Label>
              <Select value={bulkRoleTrackId} onValueChange={setBulkRoleTrackId}>
                <SelectTrigger data-testid="select-bulk-role-track">
                  <SelectValue placeholder={catalogTracks.length === 0 ? "Import catalog first…" : "Select a module"} />
                </SelectTrigger>
                <SelectContent>
                  {catalogTracks.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                      {t.launchWave && <span className="ml-1 text-muted-foreground text-xs">({t.launchWave})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Role</Label>
              <Select value={bulkRoleSlug} onValueChange={setBulkRoleSlug}>
                <SelectTrigger data-testid="select-bulk-role-slug">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {["super_admin", "admin", "hr", "finance", "operations", "manager", "recruiter", "employee"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department filter (optional)</Label>
              <Input
                value={bulkRoleDepartment}
                onChange={e => setBulkRoleDepartment(e.target.value)}
                placeholder="e.g. Engineering, Healthcare…"
                className="h-9"
                data-testid="input-bulk-role-department"
              />
              <p className="text-xs text-muted-foreground">Leave blank to assign all employees with the selected role.</p>
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <input
                type="date"
                value={bulkRoleDueDate}
                onChange={e => setBulkRoleDueDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="input-bulk-role-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkRoleModal(false); setBulkRoleTrackId(""); setBulkRoleSlug(""); setBulkRoleDepartment(""); setBulkRoleDueDate(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkAssignByRole.mutate()}
              disabled={bulkAssignByRole.isPending || !bulkRoleTrackId || !bulkRoleSlug}
              data-testid="button-confirm-bulk-assign"
            >
              {bulkAssignByRole.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Assign to All {bulkRoleSlug || "…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Track Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Assign Track to Employees
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {trackAssignments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Already assigned ({trackAssignments.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {trackAssignments.map((a: any) => (
                    <Badge key={a.assignment.id} variant="secondary" className="text-xs">
                      {a.user.firstName} {a.user.lastName} — <span className={a.assignment.status === "completed" ? "text-green-600" : ""}>{a.assignment.status}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Select Employees</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {activeUsers.map((u: any) => {
                  const alreadyAssigned = trackAssignments.some((a: any) => a.assignment.userId === u.id);
                  return (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer ${alreadyAssigned ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={assignSelectedUsers.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setAssignSelectedUsers(prev => [...prev, u.id]);
                          else setAssignSelectedUsers(prev => prev.filter(id => id !== u.id));
                        }}
                        disabled={alreadyAssigned}
                      />
                      <span className="text-sm">
                        {u.firstName} {u.lastName}
                        <span className="text-xs text-muted-foreground ml-1">({u.role})</span>
                        {alreadyAssigned && <span className="text-xs text-muted-foreground ml-1">— already assigned</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={assignDueDate}
                onChange={e => setAssignDueDate(e.target.value)}
                data-testid="input-assign-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setAssignSelectedUsers([]); setAssignDueDate(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => assignTrack.mutate()}
              disabled={assignTrack.isPending || assignSelectedUsers.length === 0}
              data-testid="button-confirm-assign"
            >
              {assignTrack.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Assign to {assignSelectedUsers.length} Employee{assignSelectedUsers.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
