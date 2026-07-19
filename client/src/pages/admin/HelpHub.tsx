import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Search, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/use-auth";

interface HelpDoc {
  id: string;
  title: string;
  path: string;
  content: string;
  assignedRoles: string[];
  category: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-blue-500 text-white",
  hr: "bg-green-500 text-white",
  finance: "bg-amber-500 text-white",
  operations: "bg-orange-500 text-white",
  manager: "bg-purple-500 text-white",
  recruiter: "bg-cyan-500 text-white",
  employee: "bg-gray-400 text-white",
  executive: "bg-teal-600 text-white",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  finance: "Finance",
  operations: "Operations",
  manager: "Manager",
  recruiter: "Recruiter",
  employee: "Employee",
  executive: "Executive",
};

export default function HelpHub() {
  const { user } = useAuth();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: docs = [], isLoading } = useQuery<HelpDoc[]>({
    queryKey: ["/api/admin/help/docs"],
  });

  const isSuperAdmin = user?.role === "super_admin";

  const filtered = docs.filter((d) =>
    !search.trim() || d.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? (filtered.length > 0 ? filtered[0] : null);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-help-hub-title">
              Help & Guides
            </h1>
            <p className="text-sm text-muted-foreground">
              Guides and documentation shared with your role.
            </p>
          </div>
          {isSuperAdmin && (
            <a
              href="/admin/knowledge-hub"
              className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
              data-testid="link-knowledge-hub"
            >
              Manage Knowledge Hub →
            </a>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Left: doc list */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-8"
                placeholder="Search guides…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-guides"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-guides">
                {docs.length === 0
                  ? "No guides have been shared with your role yet."
                  : "No guides match your search."}
              </div>
            ) : (
              <div className="space-y-1" data-testid="list-docs">
                {filtered.map((doc) => {
                  const isActive = (selectedDoc?.id ?? filtered[0]?.id) === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      data-testid={`doc-item-${doc.id}`}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{doc.category}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {doc.assignedRoles.slice(0, 4).map((role) => (
                              <span
                                key={role}
                                className={`inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold ${ROLE_COLORS[role] ?? "bg-gray-400 text-white"}`}
                              >
                                {ROLE_LABELS[role] ?? role}
                              </span>
                            ))}
                            {doc.assignedRoles.length > 4 && (
                              <span className="text-[9px] text-muted-foreground">+{doc.assignedRoles.length - 4}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: markdown reader */}
          <div className="min-h-[60vh] rounded-lg border bg-card p-6 overflow-auto">
            {!selectedDoc && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <BookOpen className="h-8 w-8 opacity-40" />
                <p className="text-sm">Select a guide to read it here.</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : selectedDoc ? (
              <article
                className="prose prose-sm max-w-none dark:prose-invert"
                data-testid="article-doc-content"
              >
                <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
