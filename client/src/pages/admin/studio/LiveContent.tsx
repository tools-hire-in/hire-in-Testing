import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Radio, Globe, EyeOff } from "lucide-react";
import { STUDIO_CONTENT_TYPES, getStudioContentType } from "@shared/studioContent";
import { insightCategoryLabel } from "@shared/insights";
import type { StudioArticle } from "@shared/schema";

interface ArticleListResponse {
  items: (StudioArticle & { authorName: string | null })[];
  total: number;
}

const PAGE_SIZE = 50;

export default function LiveContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = usePermissions();
  const canTakeDown = role === "super_admin";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [takeDownTarget, setTakeDownTarget] =
    useState<(StudioArticle & { authorName: string | null }) | null>(null);

  const queryKey = [
    "/api/admin/studio/articles",
    {
      status: "published",
      contentType: typeFilter === "all" ? "" : typeFilter,
      search,
      page,
      pageSize: PAGE_SIZE,
    },
  ];

  const { data, isLoading } = useQuery<ArticleListResponse>({ queryKey });

  const takeDownMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/unpublish`,
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to take down");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Content taken down",
        description: "It is no longer visible on the public site.",
      });
      setTakeDownTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
    },
    onError: (err: Error) =>
      toast({ title: "Take down failed", description: err.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Radio className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-live-content-title">
                Live Content
              </h1>
              <button
                onClick={() => setLocation("/admin/studio")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to Content Studio
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Everything currently live on the public site. Take an item down to remove it
          from the public Insights pages immediately.
        </p>

        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search titles…"
                value={search}
                onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
                className="pl-8"
                data-testid="input-search-live-content"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => resetPageAnd(() => setTypeFilter(v))}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All content types</SelectItem>
                {STUDIO_CONTENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <Globe className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Nothing is live right now</p>
                  <p className="text-sm text-muted-foreground">
                    Published articles will appear here once they go live on the public site.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Content type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Published</TableHead>
                      {canTakeDown && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((a) => (
                      <TableRow key={a.id} data-testid={`row-live-${a.id}`}>
                        <TableCell className="font-medium" data-testid={`text-live-title-${a.id}`}>
                          {a.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getStudioContentType(a.contentType)?.label ?? a.contentType}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`badge-category-${a.id}`}>
                            {insightCategoryLabel(a.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.authorName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`text-live-published-${a.id}`}>
                          {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        {canTakeDown && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTakeDownTarget(a)}
                              data-testid={`button-take-down-${a.id}`}
                            >
                              <EyeOff className="mr-2 h-4 w-4" />
                              Take down
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground" data-testid="text-pagination-info">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Take down confirmation */}
      <AlertDialog
        open={!!takeDownTarget}
        onOpenChange={(open) => {
          if (!open) setTakeDownTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this content down?</AlertDialogTitle>
            <AlertDialogDescription>
              "{takeDownTarget?.title}" will be removed from the public site immediately.
              It reverts to an unpublished (approved) state, so its history is preserved and
              it can be republished later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-take-down">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (takeDownTarget) takeDownMutation.mutate(takeDownTarget.id);
              }}
              disabled={takeDownMutation.isPending}
              data-testid="button-confirm-take-down"
            >
              {takeDownMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Take down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
