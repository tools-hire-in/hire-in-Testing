import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BookOpen, Plus, ChevronRight, Trash2, Pencil, Users, Send,
  CheckCircle, Eye, EyeOff, GraduationCap, Clock, Loader2, X, Save, UserPlus, Sprout,
  AlertCircle,
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
  const [showPreview, setShowPreview] = useState(false);

  // Track form state
  const [trackForm, setTrackForm] = useState({ title: "", description: "", targetRole: "all_roles", version: "1.0" });

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

  const { data: tracks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/onboarding/tracks"] });
  const { data: sections = [], isLoading: loadingSections } = useQuery<any[]>({
    queryKey: ["/api/onboarding/tracks", selectedTrackId, "sections"],
    enabled: !!selectedTrackId,
  });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });
  const { data: trackAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/onboarding/tracks", assignTrackId, "assignments"],
    enabled: !!assignTrackId,
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
      setTrackForm({ title: "", description: "", targetRole: "all_roles", version: "1.0" });
      toast({ title: "Track created" });
    },
    onError: () => toast({ title: "Failed to create track", variant: "destructive" }),
  });

  const updateTrack = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/onboarding/tracks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      toast({ title: "Track updated" });
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

  const assignTrack = useMutation({
    mutationFn: () => apiRequest("POST", `/api/onboarding/tracks/${assignTrackId}/assign`, {
      userIds: assignSelectedUsers,
      dueDate: assignDueDate || null,
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      const assigned = data.results.filter((r: any) => r.status === "assigned").length;
      const skipped = data.results.filter((r: any) => r.status === "already_assigned").length;
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks", assignTrackId, "assignments"] });
      toast({ title: `Assigned to ${assigned} employee(s)${skipped > 0 ? `, ${skipped} already assigned` : ""}` });
      setAssignSelectedUsers([]);
      setAssignDueDate("");
    },
    onError: () => toast({ title: "Failed to assign track", variant: "destructive" }),
  });

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest("POST", "/api/onboarding/seed");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/tracks"] });
      toast({ title: `Seeded: ${data.created.join(", ") || "none new"}${data.skipped.length > 0 ? ` (skipped: ${data.skipped.length})` : ""}` });
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
            </h1>
            <p className="text-muted-foreground mt-1">Author tracks, manage content, and assign training to employees</p>
          </div>
          <div className="flex gap-2">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Track List */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Learning Tracks</h2>
            {isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
            {!isLoading && tracks.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
                  No tracks yet. Create one or load the SOP content.
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
                      <p className="font-medium text-sm leading-tight truncate">{track.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[track.status] || "bg-gray-100 text-gray-600"}`}>
                          {track.status}
                        </span>
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
                  <p>Select a track to view and edit its content</p>
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
              </>
            )}
          </div>
        </div>
      </div>

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
