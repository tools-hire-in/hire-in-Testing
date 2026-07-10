import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StudioProject } from "@shared/schema";

const STORAGE_KEY = "studio.selectedProjectId";

// Module-level shared store so every hook instance (StudioShell header
// switcher, PipelineView, classic studio pages) stays in sync when the
// project changes anywhere in the app.
let sharedProjectId = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return sharedProjectId;
}

function setSharedProjectId(id: string) {
  if (sharedProjectId === id) return;
  sharedProjectId = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useStudioProject() {
  const selectedProjectId = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const { data: projects, isLoading: projectsLoading } = useQuery<StudioProject[]>({
    queryKey: ["/api/admin/studio/projects"],
  });

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (sharedProjectId && projects.some((p) => p.id === sharedProjectId)) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const valid = stored && projects.some((p) => p.id === stored) ? stored : null;
    const fallback = projects.find((p) => p.isPrimary)?.id ?? projects[0].id;
    setSharedProjectId(valid ?? fallback);
  }, [projects]);

  return { projects, projectsLoading, selectedProjectId, setSelectedProjectId: setSharedProjectId };
}
