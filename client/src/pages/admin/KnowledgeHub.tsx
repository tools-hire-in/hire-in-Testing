import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Search,
  Printer,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Check,
  FileText,
  ChevronsUpDown,
  Users,
} from "lucide-react";

const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", color: "bg-blue-500 text-white" },
  hr: { label: "HR", color: "bg-green-500 text-white" },
  finance: { label: "Finance", color: "bg-amber-500 text-white" },
  operations: { label: "Operations", color: "bg-orange-500 text-white" },
  manager: { label: "Manager", color: "bg-purple-500 text-white" },
  recruiter: { label: "Recruiter", color: "bg-cyan-500 text-white" },
  employee: { label: "Employee", color: "bg-gray-500 text-white" },
  executive: { label: "Executive", color: "bg-teal-600 text-white" },
};

const ALL_ROLES = Object.keys(roleLabels);

const FIXED_CATEGORIES: { key: string; label: string }[] = [
  { key: "strategy", label: "Strategy" },
  { key: "guides", label: "Guides" },
  { key: "platform", label: "Platform" },
  { key: "architecture", label: "Architecture" },
  { key: "engineering", label: "Engineering" },
  { key: "training", label: "Training" },
  { key: "governance", label: "Governance" },
  { key: "qa", label: "QA" },
  { key: "website", label: "Website" },
];

interface KnowledgeDoc {
  id: string;
  category: string;
  title: string;
  path: string;
  content: string;
  assignedRoles: string[];
}

interface ReadsResponse {
  readPaths: string[];
  readCounts?: Record<string, number>;
}

function DocReader({ content }: { content: string | null }) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-20">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Select a document to read it here.</p>
      </div>
    );
  }
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-pre:bg-muted">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function RolePopover({
  docPath,
  assignedRoles,
  onRolesChange,
  onRolesRollback,
}: {
  docPath: string;
  assignedRoles: string[];
  onRolesChange: (path: string, roles: string[]) => void;
  onRolesRollback: (path: string, roles: string[]) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ roles }: { roles: string[] }) => {
      await apiRequest("POST", "/api/admin/knowledge/visibility", {
        docPath,
        roles,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/docs"] });
    },
    onError: (_err: unknown, _vars: unknown, context: unknown) => {
      const ctx = context as { previousRoles: string[] } | undefined;
      if (ctx) {
        onRolesRollback(docPath, ctx.previousRoles);
      }
      toast({
        title: "Failed to update visibility",
        description: "Could not save role assignments. The change has been reverted.",
        variant: "destructive",
      });
    },
  });

  const toggleRole = (role: string) => {
    const current = new Set(assignedRoles);
    if (current.has(role)) {
      if (current.size === 1) {
        toast({
          title: "At least one role required",
          description: "A document must be visible to at least one role.",
          variant: "destructive",
        });
        return;
      }
      current.delete(role);
    } else {
      current.add(role);
    }
    const newRoles = Array.from(current);
    const previousRoles = [...assignedRoles];
    onRolesChange(docPath, newRoles);
    mutation.mutate({ roles: newRoles }, { context: { previousRoles } } as any);
  };

  const isSuperAdminOnly =
    assignedRoles.length === 1 && assignedRoles[0] === "super_admin";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`role-picker-trigger-${docPath.replace(/[^a-z0-9]/gi, "-")}`}
          className="flex items-center gap-1 flex-wrap max-w-[260px]"
        >
          {isSuperAdminOnly ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              Super Admin Only
            </span>
          ) : (
            <>
              {assignedRoles.slice(0, 3).map((role) => {
                const rl = roleLabels[role];
                if (!rl) return null;
                return (
                  <span
                    key={role}
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${rl.color}`}
                  >
                    {rl.label}
                  </span>
                );
              })}
              {assignedRoles.length > 3 && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                  +{assignedRoles.length - 3}
                </span>
              )}
            </>
          )}
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        data-testid={`role-picker-content-${docPath.replace(/[^a-z0-9]/gi, "-")}`}
      >
        <Command>
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup heading="Assign roles">
              {ALL_ROLES.map((role) => {
                const rl = roleLabels[role];
                if (!rl) return null;
                const isChecked = assignedRoles.includes(role);
                return (
                  <CommandItem
                    key={role}
                    onSelect={() => toggleRole(role)}
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid={`role-option-${role}`}
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isChecked ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${rl.color}`}
                    >
                      {rl.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Simplified reader view for non-super_admin roles ───────────────────────

function SimplifiedTrainingView({
  docs,
  isLoading,
  isError,
  refetch,
  readPaths,
  readCounts,
}: {
  docs: KnowledgeDoc[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  readPaths: Set<string>;
  readCounts: Record<string, number> | null;
}) {
  const queryClient = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [search, setSearch] = useState("");
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReadMutation = useMutation({
    mutationFn: async (docPath: string) => {
      const res = await fetch("/api/admin/knowledge/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ doc_path: docPath }),
      });
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/reads"] });
    },
  });

  const handleSelectDoc = (doc: KnowledgeDoc) => {
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    setSelectedDoc(doc);
    if (!readPaths.has(doc.path)) {
      readTimerRef.current = setTimeout(() => {
        markReadMutation.mutate(doc.path);
      }, 30000);
    }
  };

  useEffect(() => {
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter((d) => d.title.toLowerCase().includes(q));
  }, [docs, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5 flex items-center gap-3 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-knowledge-hub-title">
            Training Docs
          </h1>
          <p className="text-sm text-muted-foreground">
            Your role-curated training documents.
          </p>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Failed to load training docs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Check server connectivity and try again.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-knowledge">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-[280px_1fr] gap-0 min-h-0 border rounded-lg overflow-hidden">
        {/* Left: doc list */}
        <div className="border-r overflow-y-auto flex flex-col">
          <div className="p-2 border-b bg-background sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs…"
                className="pl-8 h-8 text-sm"
                data-testid="input-knowledge-search"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-knowledge-no-results">
                No documents found.
              </div>
            )}

            {!isLoading &&
              filtered.map((doc) => {
                const isActive = selectedDoc?.id === doc.id;
                const isRead = readPaths.has(doc.path);
                const readCount = readCounts?.[doc.path];
                return (
                  <div
                    key={doc.id}
                    data-testid={`knowledge-doc-row-${doc.id}`}
                    onClick={() => handleSelectDoc(doc)}
                    className={`p-3 border-b cursor-pointer transition-colors flex items-start gap-2 ${
                      isActive
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : isRead
                        ? "hover:bg-muted/30"
                        : "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/20"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isActive
                            ? "text-primary"
                            : isRead
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {doc.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {doc.category}
                        {readCounts != null && (
                          <span className="ml-1.5 text-muted-foreground/70">
                            · {readCount ?? 0} read
                          </span>
                        )}
                      </p>
                    </div>
                    {isRead ? (
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: reader */}
        <div className="overflow-y-auto knowledge-hub-reader">
          {selectedDoc ? (
            <div className="p-5">
              <div className="mb-4 pb-4 border-b flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight" data-testid="text-knowledge-doc-title">
                    {selectedDoc.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedDoc.path}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  data-testid="button-print-doc"
                  className="shrink-0"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print
                </Button>
              </div>
              <DocReader content={selectedDoc.content} />
            </div>
          ) : (
            <DocReader content={null} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Full admin view for super_admin ────────────────────────────────────────

function SuperAdminView({
  docs,
  isLoading,
  isError,
  refetch,
  readCounts,
  readPaths,
}: {
  docs: KnowledgeDoc[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  readCounts: Record<string, number> | null;
  readPaths: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [search, setSearch] = useState("");
  const [localRoles, setLocalRoles] = useState<Record<string, string[]>>({});
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReadMutation = useMutation({
    mutationFn: async (docPath: string) => {
      const res = await fetch("/api/admin/knowledge/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ doc_path: docPath }),
      });
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/reads"] });
    },
  });

  const handleSelectDoc = (doc: KnowledgeDoc) => {
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    setSelectedDoc(doc);
    if (!readPaths.has(doc.path)) {
      readTimerRef.current = setTimeout(() => {
        markReadMutation.mutate(doc.path);
      }, 30000);
    }
  };

  useEffect(() => {
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, []);

  const getAssignedRoles = (doc: KnowledgeDoc) =>
    localRoles[doc.path] ?? doc.assignedRoles;

  const handleRolesChange = (path: string, roles: string[]) => {
    setLocalRoles((prev) => ({ ...prev, [path]: roles }));
  };

  const handleRolesRollback = (path: string, previousRoles: string[]) => {
    setLocalRoles((prev) => ({ ...prev, [path]: previousRoles }));
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of docs) {
      const cat = doc.category.toLowerCase();
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (selectedCategory) {
      list = list.filter(
        (d) => d.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q));
    }
    return list;
  }, [docs, selectedCategory, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5 flex items-center gap-3 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-knowledge-hub-title">
            Knowledge Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage which roles can see each internal document.
          </p>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Failed to load knowledge docs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Check server connectivity and try again.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-knowledge">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-[200px_1fr_1fr] gap-0 min-h-0 border rounded-lg overflow-hidden">
        {/* Left: category sidebar */}
        <div className="knowledge-hub-sidebars border-r overflow-y-auto bg-muted/20">
          <div className="p-2">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            <div className="space-y-0.5">
              <button
                data-testid="category-all"
                onClick={() => setSelectedCategory(null)}
                className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
                  selectedCategory === null
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <span>All</span>
                <span className="text-xs font-medium tabular-nums">{docs.length}</span>
              </button>

              {isLoading &&
                FIXED_CATEGORIES.map((c) => (
                  <Skeleton key={c.key} className="h-7 w-full rounded-md" />
                ))}

              {!isLoading &&
                FIXED_CATEGORIES.map(({ key, label }) => {
                  const count = categoryCounts[key] ?? 0;
                  return (
                    <button
                      key={key}
                      data-testid={`category-${key}`}
                      onClick={() => setSelectedCategory(key)}
                      className={`flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
                        selectedCategory === key
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span className="truncate">{label}</span>
                      <span className="text-xs font-medium tabular-nums ml-1 shrink-0">
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Centre: doc list with role pickers + read count */}
        <div className="knowledge-hub-sidebars border-r overflow-y-auto flex flex-col">
          <div className="p-2 border-b bg-background sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs…"
                className="pl-8 h-8 text-sm"
                data-testid="input-knowledge-search"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && filteredDocs.length === 0 && (
              <div
                className="p-6 text-center text-sm text-muted-foreground"
                data-testid="text-knowledge-no-results"
              >
                No documents found.
              </div>
            )}

            {!isLoading &&
              filteredDocs.map((doc) => {
                const isActive = selectedDoc?.id === doc.id;
                const assignedRoles = getAssignedRoles(doc);
                const readCount = readCounts?.[doc.path];
                return (
                  <div
                    key={doc.id}
                    data-testid={`knowledge-doc-row-${doc.id}`}
                    className={`p-3 border-b cursor-pointer transition-colors ${
                      isActive
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => handleSelectDoc(doc)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive ? "text-primary" : ""
                          }`}
                        >
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {doc.path}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <RolePopover
                          docPath={doc.path}
                          assignedRoles={assignedRoles}
                          onRolesChange={handleRolesChange}
                          onRolesRollback={handleRolesRollback}
                        />
                      </div>
                      <span
                        className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0"
                        data-testid={`read-count-${doc.id}`}
                        title="Users who have read this doc"
                      >
                        <Users className="h-3 w-3" />
                        {readCount != null ? readCount : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: doc reader */}
        <div className="overflow-y-auto knowledge-hub-reader">
          {selectedDoc ? (
            <div className="p-5">
              <div className="mb-4 pb-4 border-b flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    className="text-base font-semibold leading-tight"
                    data-testid="text-knowledge-doc-title"
                  >
                    {selectedDoc.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {selectedDoc.path}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  data-testid="button-print-doc"
                  className="shrink-0"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print
                </Button>
              </div>
              <DocReader content={selectedDoc.content} />
            </div>
          ) : (
            <DocReader content={null} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function KnowledgeHub() {
  const { user, isLoading: authLoading } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";
  const isHr = user?.role === "hr";
  const canSeeReadCounts = isSuperAdmin || isHr;

  const { data: docs = [], isLoading, isError, refetch } = useQuery<KnowledgeDoc[]>({
    queryKey: ["/api/admin/knowledge/docs"],
    enabled: !authLoading && !!user,
  });

  // Unified reads endpoint returns { readPaths, readCounts? }
  const { data: readsData } = useQuery<ReadsResponse>({
    queryKey: ["/api/admin/knowledge/reads"],
    enabled: !authLoading && !!user,
    retry: false,
    throwOnError: false,
  } as any);

  const readPaths = useMemo(
    () => new Set(readsData?.readPaths ?? []),
    [readsData]
  );

  const readCounts = readsData?.readCounts ?? null;

  if (authLoading || !user) return null;

  return (
    <AdminLayout>
      <style>{`
        @media print {
          .knowledge-hub-sidebars { display: none !important; }
          .knowledge-hub-reader { padding: 0 !important; }
        }
      `}</style>

      {isSuperAdmin ? (
        <SuperAdminView
          docs={docs}
          isLoading={isLoading}
          isError={isError}
          refetch={refetch}
          readCounts={readCounts}
          readPaths={readPaths}
        />
      ) : (
        <SimplifiedTrainingView
          docs={docs}
          isLoading={isLoading}
          isError={isError}
          refetch={refetch}
          readPaths={readPaths}
          readCounts={canSeeReadCounts ? readCounts : null}
        />
      )}
    </AdminLayout>
  );
}
