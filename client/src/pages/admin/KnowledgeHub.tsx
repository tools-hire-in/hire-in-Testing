import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookOpen, Search, FileText, Printer, ChevronRight, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface KnowledgeDoc {
  id: string;
  title: string;
  path: string;
  content: string;
  assignedRoles: string[];
  category: string;
}

const CATEGORIES = ["Strategy", "Guides", "Platform", "Architecture", "Engineering", "Training", "Governance", "QA", "Website"] as const;

const ALL_ROLES = [
  { key: "super_admin", label: "Super Admin", color: "bg-primary text-primary-foreground" },
  { key: "admin", label: "Admin", color: "bg-blue-500 text-white" },
  { key: "hr", label: "HR", color: "bg-green-500 text-white" },
  { key: "finance", label: "Finance", color: "bg-amber-500 text-white" },
  { key: "operations", label: "Operations", color: "bg-orange-500 text-white" },
  { key: "manager", label: "Manager", color: "bg-purple-500 text-white" },
  { key: "recruiter", label: "Recruiter", color: "bg-cyan-500 text-white" },
  { key: "employee", label: "Employee", color: "bg-gray-400 text-white" },
  { key: "executive", label: "Executive", color: "bg-teal-600 text-white" },
] as const;

function RolePicker({
  docPath,
  assignedRoles,
}: {
  docPath: string;
  assignedRoles: string[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(assignedRoles);

  const mutation = useMutation({
    mutationFn: async (roles: string[]) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/visibility", {
        docPath,
        roles,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/docs"] });
      toast({ title: "Role visibility saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const toggle = (role: string) => {
    const next = selected.includes(role)
      ? selected.filter((r) => r !== role)
      : [...selected, role];
    setSelected(next);
    mutation.mutate(next);
  };

  const isSuperAdminOnly =
    selected.length === 0 ||
    (selected.length === 1 && selected[0] === "super_admin");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex flex-wrap items-center gap-1 text-left"
          data-testid={`role-picker-${docPath}`}
        >
          {isSuperAdminOnly ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              Super Admin Only
            </span>
          ) : (
            selected.map((role) => {
              const def = ALL_ROLES.find((r) => r.key === role);
              return (
                <span
                  key={role}
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${def?.color ?? "bg-gray-400 text-white"}`}
                >
                  {def?.label ?? role}
                </span>
              );
            })
          )}
          <Users className="h-3 w-3 text-muted-foreground ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Who can see this doc?</p>
        <div className="space-y-1">
          {ALL_ROLES.map(({ key, label, color }) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(key)}
                onCheckedChange={() => toggle(key)}
                data-testid={`role-checkbox-${key}`}
              />
              <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
              {label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function KnowledgeHub() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Strategy");
  const [selectedDocPath, setSelectedDocPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: docs = [], isLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ["/api/admin/knowledge/docs"],
  });

  const docsByCategory = (cat: string) =>
    docs.filter(
      (d) =>
        d.category === cat &&
        (!search.trim() || d.title.toLowerCase().includes(search.toLowerCase()))
    );

  const allFiltered = search.trim()
    ? docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const displayDocs = allFiltered ?? docsByCategory(selectedCategory);
  const selectedDoc = docs.find((d) => d.path === selectedDocPath) ?? displayDocs[0] ?? null;

  const catCount = (cat: string) => docsByCategory(cat).length;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Print styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .prose { max-width: none !important; }
          }
        `}</style>

        <div className="flex items-center gap-3 no-print">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-knowledge-hub-title">
              Knowledge Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage which roles can see each doc. Changes take effect immediately.
            </p>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[180px_340px_1fr]">
          {/* Left: Category sidebar */}
          <nav className="no-print hidden lg:block border-r pr-2 space-y-0.5" data-testid="nav-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSearch(""); }}
                data-testid={`cat-${cat}`}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  !search && selectedCategory === cat
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{cat}</span>
                <span className="text-xs tabular-nums opacity-60">{catCount(cat)}</span>
              </button>
            ))}
          </nav>

          {/* Centre: Doc list */}
          <div className="no-print border-r">
            <div className="sticky top-0 bg-background z-10 px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-7 text-xs"
                  placeholder="Search all docs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-docs"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : displayDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No docs in this category.</p>
              ) : (
                <div className="divide-y">
                  {displayDocs.map((doc) => {
                    const isActive = (selectedDoc?.path ?? "") === doc.path;
                    return (
                      <div
                        key={doc.path}
                        data-testid={`doc-row-${doc.id}`}
                        className={`px-3 py-2.5 cursor-pointer transition-colors ${
                          isActive ? "bg-accent" : "hover:bg-muted/40"
                        }`}
                        onClick={() => setSelectedDocPath(doc.path)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{doc.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{doc.path}</p>
                          </div>
                          {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />}
                        </div>
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                          <RolePicker docPath={doc.path} assignedRoles={doc.assignedRoles} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Markdown reader */}
          <div className="min-h-[60vh] overflow-auto">
            {selectedDoc ? (
              <div>
                <div className="no-print sticky top-0 bg-background border-b px-5 py-2.5 flex items-center justify-between z-10">
                  <div>
                    <p className="text-sm font-semibold truncate">{selectedDoc.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedDoc.category} · {selectedDoc.path}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5"
                    onClick={() => window.print()}
                    data-testid="button-print-doc"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                </div>
                <article
                  className="prose prose-sm max-w-none dark:prose-invert px-5 py-4"
                  data-testid="article-knowledge-content"
                >
                  <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                </article>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <FileText className="h-8 w-8 opacity-40" />
                <p className="text-sm">Select a doc to read it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
