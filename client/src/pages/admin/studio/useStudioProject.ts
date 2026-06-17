import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StudioProject } from "@shared/schema";

const STORAGE_KEY = "studio.selectedProjectId";

export function useStudioProject() {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>("");

  const { data: projects, isLoading: projectsLoading } = useQuery<StudioProject[]>({
    queryKey: ["/api/admin/studio/projects"],
  });

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    setSelectedProjectIdState((current) => {
      if (current && projects.some((p) => p.id === current)) return current;
      const stored = localStorage.getItem(STORAGE_KEY);
      const valid = stored && projects.some((p) => p.id === stored) ? stored : null;
      const fallback = projects.find((p) => p.isPrimary)?.id ?? projects[0].id;
      return valid ?? fallback;
    });
  }, [projects]);

  const setSelectedProjectId = (id: string) => {
    setSelectedProjectIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  return { projects, projectsLoading, selectedProjectId, setSelectedProjectId };
}
