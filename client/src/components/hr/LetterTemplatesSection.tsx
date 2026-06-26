import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, ChevronDown, ChevronUp, Download, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY, PERFORMANCE_CLAUSE_CATEGORY_LABELS } from "@shared/performanceClauses";

interface LetterTemplateSentence {
  id: string;
  key: string;
  category: string;
  label: string;
  sentence: string;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  performance_band: "Performance Band Sentences",
  conduct_band: "Conduct Band Sentences",
  completion_band: "Completion Band Phrases",
  closing_line: "Closing Line Sentences",
  ...PERFORMANCE_CLAUSE_CATEGORY_LABELS,
};

const CLAUSE_DOWNLOAD_CATEGORIES = [OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY];

export function LetterTemplatesSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "admin"].includes(user?.role || "");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: sentences = [], isLoading } = useQuery<LetterTemplateSentence[]>({
    queryKey: ["/api/hr/letter-templates/sentences"],
    queryFn: async () => {
      const res = await fetch("/api/hr/letter-templates/sentences", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, sentence }: { id: string; sentence: string }) => {
      const res = await apiRequest("PATCH", `/api/hr/letter-templates/sentences/${id}`, { sentence });
      return res.json();
    },
    onMutate: async ({ id, sentence }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/hr/letter-templates/sentences"] });
      const previous = queryClient.getQueryData<LetterTemplateSentence[]>(["/api/hr/letter-templates/sentences"]);
      if (previous) {
        queryClient.setQueryData<LetterTemplateSentence[]>(
          ["/api/hr/letter-templates/sentences"],
          previous.map(s => s.id === id ? { ...s, sentence } : s),
        );
      }
      return { previous };
    },
    onSuccess: (updated, _vars, context) => {
      queryClient.setQueryData<LetterTemplateSentence[]>(
        ["/api/hr/letter-templates/sentences"],
        (old) => old ? old.map(s => s.id === updated.id ? updated : s) : old,
      );
      setEditing(prev => {
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      toast({ title: "Sentence updated", description: "The template sentence has been updated." });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/hr/letter-templates/sentences"], context.previous);
      }
      toast({ title: "Failed to update sentence", variant: "destructive" });
    },
  });

  if (!isAdmin) return null;

  const grouped = sentences.reduce<Record<string, LetterTemplateSentence[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const categories = ["performance_band", "conduct_band", "completion_band", "closing_line", OFFER_CLAUSE_CATEGORY, ADDENDUM_CLAUSE_CATEGORY];

  const handleDownloadClause = async (id: string, label: string) => {
    try {
      const res = await fetch(`/api/hr/letter-templates/sentences/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.replace(/[^a-z0-9]+/gi, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Failed to download clause", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Letter Template Sentences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Customize the sentences used in generated HR letters. Changes take effect immediately for new letters — no redeployment needed.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const items = grouped[cat] || [];
              const isExpanded = expandedCategory === cat;
              return (
                <div key={cat} className="border rounded-md overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    data-testid={`btn-expand-category-${cat}`}
                  >
                    <span className="font-medium text-sm">{CATEGORY_LABELS[cat] || cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{items.length} sentences</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="p-3 space-y-4 border-t">
                      {items.map((sentence) => {
                        const isEditing = editing[sentence.id] !== undefined;
                        const currentValue = isEditing ? editing[sentence.id] : sentence.sentence;
                        return (
                          <div key={sentence.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">{sentence.label}</Label>
                              {!isEditing ? (
                                <div className="flex gap-2">
                                  {CLAUSE_DOWNLOAD_CATEGORIES.includes(sentence.category) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDownloadClause(sentence.id, sentence.label)}
                                      data-testid={`btn-download-clause-${sentence.id}`}
                                    >
                                      <Download className="h-3 w-3 mr-1" />DOCX
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditing(prev => ({ ...prev, [sentence.id]: sentence.sentence }))}
                                    data-testid={`btn-edit-sentence-${sentence.id}`}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />Edit
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateMutation.mutate({ id: sentence.id, sentence: currentValue })}
                                    disabled={updateMutation.isPending || !currentValue.trim()}
                                    data-testid={`btn-save-sentence-${sentence.id}`}
                                  >
                                    {updateMutation.isPending ? "Saving..." : "Save"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditing(prev => { const n = { ...prev }; delete n[sentence.id]; return n; })}
                                    data-testid={`btn-cancel-sentence-${sentence.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <Textarea
                                value={currentValue}
                                onChange={(e) => setEditing(prev => ({ ...prev, [sentence.id]: e.target.value }))}
                                rows={3}
                                className="text-sm"
                                data-testid={`textarea-sentence-${sentence.id}`}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed" data-testid={`text-sentence-${sentence.id}`}>
                                {sentence.sentence}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
