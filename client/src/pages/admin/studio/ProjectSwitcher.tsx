import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import type { StudioProject } from "@shared/schema";

interface ProjectSwitcherProps {
  projects?: StudioProject[];
  projectsLoading: boolean;
  selectedProjectId: string;
  onChange: (id: string) => void;
}

export function ProjectSwitcher({
  projects,
  projectsLoading,
  selectedProjectId,
  onChange,
}: ProjectSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Project</span>
      <Select
        value={selectedProjectId}
        onValueChange={onChange}
        disabled={projectsLoading || !projects?.length}
      >
        <SelectTrigger className="w-[220px]" data-testid="select-studio-project">
          <SelectValue placeholder={projectsLoading ? "Loading…" : "Select a project"} />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((p) => (
            <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
              <span className="flex items-center gap-2">
                {p.isPrimary && <Star className="h-3 w-3 text-amber-500" />}
                {p.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
