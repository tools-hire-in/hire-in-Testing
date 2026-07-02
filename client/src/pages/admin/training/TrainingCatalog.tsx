import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Loader2, Search, Filter, ExternalLink } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  not_assigned: "bg-gray-100 text-gray-600",
  not_started: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

function statusLabel(s: string) {
  if (s === "not_assigned") return "Not assigned";
  return s.replace("_", " ");
}

function WaveBadge({ wave }: { wave?: string | null }) {
  if (!wave) return null;
  const isW0 = wave.toLowerCase().startsWith("wave 0");
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${
      isW0 ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
    }`}>
      {wave}
    </span>
  );
}

export default function TrainingCatalog() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [waveFilter, setWaveFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");

  const { data: tracks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/training/catalog", waveFilter, categoryFilter, audienceFilter, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (waveFilter !== "all") params.set("wave", waveFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (audienceFilter !== "all") params.set("audience", audienceFilter);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/training/catalog?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
  });

  const waves = [...new Set(tracks.map((t: any) => t.launchWave).filter(Boolean))].sort();
  const categories = [...new Set(tracks.map((t: any) => t.sopCategory).filter(Boolean))].sort();
  const audiences = [...new Set(tracks.map((t: any) => t.audience).filter(Boolean))].sort();

  const waveTotals = waves.map((w) => ({
    wave: w,
    count: tracks.filter((t: any) => t.launchWave === w).length,
    completed: tracks.filter((t: any) => t.launchWave === w && t.myStatus === "completed").length,
  }));

  return (
    <AdminLayout>
      <div className="v2-surface p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              SOP Training Catalog
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tracks.length} module{tracks.length !== 1 ? "s" : ""} — SOP compliance training library
            </p>
          </div>
        </div>

        {waveTotals.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {waveTotals.map((w) => (
              <Card
                key={w.wave}
                className="cursor-pointer hover:shadow-md transition-all"
                onClick={() => setWaveFilter(waveFilter === w.wave ? "all" : w.wave)}
                data-testid={`card-wave-${w.wave}`}
              >
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{w.wave}</p>
                  <p className="text-2xl font-mono font-bold mt-0.5">{w.count}</p>
                  <p className="text-xs text-muted-foreground">{w.completed} completed</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
              data-testid="input-search-catalog"
            />
          </div>
          <Select value={waveFilter} onValueChange={setWaveFilter}>
            <SelectTrigger className="w-44 h-9" data-testid="select-wave-filter">
              <SelectValue placeholder="All waves" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All waves</SelectItem>
              {waves.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-52 h-9" data-testid="select-category-filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={audienceFilter} onValueChange={setAudienceFilter}>
            <SelectTrigger className="w-52 h-9" data-testid="select-audience-filter">
              <SelectValue placeholder="All audiences" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All audiences</SelectItem>
              {audiences.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog...
          </div>
        )}

        {!isLoading && tracks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No training modules found</p>
              <p className="text-sm mt-1">
                {q || waveFilter !== "all" || categoryFilter !== "all" || audienceFilter !== "all"
                  ? "Try adjusting the filters."
                  : "Import the SOP training catalog from Training Management."}
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && tracks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((track: any) => (
              <Card
                key={track.id}
                className="hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                  if (track.myAssignmentId) {
                    navigate(`/admin/growth?tab=training&track=${track.myAssignmentId}`);
                  } else {
                    navigate("/admin/growth?tab=training");
                  }
                }}
                data-testid={`card-catalog-${track.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-tight line-clamp-2">{track.title}</CardTitle>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[track.myStatus] || STATUS_COLORS.not_assigned}`}>
                      {statusLabel(track.myStatus)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1 items-center">
                    {track.sopCategory && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">{track.sopCategory}</Badge>
                    )}
                    <WaveBadge wave={track.launchWave} />
                  </div>
                  {track.audience && (
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">Audience:</span> {track.audience}
                    </p>
                  )}
                  {track.trainingId && (
                    <p className="text-xs text-muted-foreground font-mono">{track.trainingId}</p>
                  )}
                  <Button
                    size="sm"
                    variant={track.myAssignmentId ? "default" : "outline"}
                    className="w-full mt-1 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track.myAssignmentId) {
                        navigate(`/admin/growth?tab=training&track=${track.myAssignmentId}`);
                      } else {
                        navigate("/admin/growth?tab=training");
                      }
                    }}
                    data-testid={`button-start-track-${track.id}`}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    {track.myStatus === "completed" ? "View" : track.myStatus === "in_progress" ? "Resume" : track.myStatus === "not_started" ? "Start" : "View in My Training"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
