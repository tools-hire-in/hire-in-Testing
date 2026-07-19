import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookOpen, HelpCircle, ArrowUpRight, FileText, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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

interface HelpDoc {
  id: string;
  category: string;
  title: string;
  path: string;
  content: string;
  assignedRoles: string[];
}

function extractOneLiner(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("+")) {
      return trimmed.replace(/^[-*+]\s*/, "");
    }
    return trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed;
  }
  return "No description available.";
}

function DocReader({ content }: { content: string | null }) {
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-16">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Select a guide to read it here.</p>
      </div>
    );
  }
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-pre:bg-muted">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default function HelpHub() {
  const { user } = useAuth();
  const [selectedDoc, setSelectedDoc] = useState<HelpDoc | null>(null);

  const { data: docs = [], isLoading, isError } = useQuery<HelpDoc[]>({
    queryKey: ["/api/admin/help/docs"],
  });

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        {/* Page header */}
        <div className="mb-5 flex items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-help-hub-title">
              Help &amp; Guides
            </h1>
            <p className="text-sm text-muted-foreground">
              Documentation and guides shared with your role.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 grid grid-cols-[320px_1fr] gap-0 min-h-0 border rounded-lg overflow-hidden">
          {/* Left: doc list */}
          <div className="border-r overflow-y-auto bg-muted/20">
            {/* Super admin shortcut card */}
            {isSuperAdmin && (
              <div className="p-3 border-b bg-primary/5">
                <Link href="/admin/knowledge-hub">
                  <div
                    className="flex items-center gap-2 rounded-md border border-primary/20 bg-background p-2.5 cursor-pointer hover:bg-primary/5 transition-colors group"
                    data-testid="link-knowledge-hub-shortcut"
                  >
                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary">Knowledge Hub</p>
                      <p className="text-[11px] text-muted-foreground">Manage doc visibility for all roles</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </Link>
              </div>
            )}

            <div className="p-2 space-y-1">
              {isLoading && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3 rounded-md">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </>
              )}

              {!isLoading && !isError && docs.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2" data-testid="text-help-empty-state">
                  <Info className="h-8 w-8 opacity-30" />
                  <p>No guides have been shared with your role yet. Contact your administrator.</p>
                </div>
              )}

              {!isLoading && docs.map((doc) => {
                const isActive = selectedDoc?.id === doc.id;
                const oneLiner = extractOneLiner(doc.content);
                return (
                  <button
                    key={doc.id}
                    data-testid={`doc-card-${doc.id}`}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3 rounded-md transition-colors border ${
                      isActive
                        ? "bg-primary/10 border-primary/20"
                        : "border-transparent hover:bg-muted/60 hover:border-border"
                    }`}
                  >
                    <p className={`text-sm font-medium leading-tight mb-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                      {doc.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                      {oneLiner}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {doc.assignedRoles.slice(0, 4).map((role) => {
                        const rl = roleLabels[role];
                        if (!rl) return null;
                        return (
                          <span
                            key={role}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${rl.color}`}
                            data-testid={`badge-role-${role}-${doc.id}`}
                          >
                            {rl.label}
                          </span>
                        );
                      })}
                      {doc.assignedRoles.length > 4 && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                          +{doc.assignedRoles.length - 4}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: markdown reader */}
          <div className="overflow-y-auto">
            {selectedDoc ? (
              <div className="p-6">
                <div className="mb-4 pb-4 border-b">
                  <h2 className="text-lg font-semibold" data-testid="text-doc-reader-title">
                    {selectedDoc.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedDoc.path}</p>
                </div>
                <DocReader content={selectedDoc.content} />
              </div>
            ) : (
              <DocReader content={null} />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

