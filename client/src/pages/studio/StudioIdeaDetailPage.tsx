import { useRoute, useLocation } from "wouter";
import { IdeaPeek } from "./PipelineView";

export default function StudioIdeaDetailPage() {
  const [, params] = useRoute("/studio/ideas/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? null;

  if (!id) {
    navigate("/studio/ideas");
    return null;
  }

  return (
    <IdeaPeek
      ideaId={id}
      onClose={() => navigate("/studio/ideas")}
      standalone
    />
  );
}
