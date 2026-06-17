import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { INSIGHT_REACTIONS } from "@shared/insights";
import { cn } from "@/lib/utils";

interface ReactionsResponse {
  counts: Record<string, number>;
  userReaction: string | null;
}

export function ReactionBar({ articleId }: { articleId: string }) {
  const { toast } = useToast();
  const queryKey = ["/api/insights", articleId, "reactions"];

  const { data } = useQuery<ReactionsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/insights/${encodeURIComponent(articleId)}/reactions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load reactions");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (reactionType: string) => {
      const res = await apiRequest("POST", `/api/insights/${encodeURIComponent(articleId)}/react`, {
        reactionType,
      });
      return (await res.json()) as ReactionsResponse;
    },
    onMutate: async (reactionType) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ReactionsResponse>(queryKey);
      const counts = { ...(prev?.counts ?? {}) };
      const current = prev?.userReaction ?? null;
      let nextUser: string | null;
      if (current === reactionType) {
        counts[reactionType] = Math.max(0, (counts[reactionType] ?? 0) - 1);
        nextUser = null;
      } else {
        if (current) counts[current] = Math.max(0, (counts[current] ?? 0) - 1);
        counts[reactionType] = (counts[reactionType] ?? 0) + 1;
        nextUser = reactionType;
      }
      queryClient.setQueryData<ReactionsResponse>(queryKey, { counts, userReaction: nextUser });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev);
      toast({
        title: "Couldn't save your reaction",
        description: "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
    },
  });

  const counts = data?.counts ?? {};
  const userReaction = data?.userReaction ?? null;

  return (
    <div className="mt-12 border-t pt-8" data-testid="reaction-bar">
      <h3 className="mb-4 text-lg font-semibold">Did this resonate with you?</h3>
      <div className="flex flex-wrap gap-3">
        {INSIGHT_REACTIONS.map((r) => {
          const active = userReaction === r.value;
          const count = counts[r.value] ?? 0;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => mutation.mutate(r.value)}
              disabled={mutation.isPending}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              data-testid={`button-reaction-${r.value}`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {r.emoji}
              </span>
              <span>{r.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-xs",
                    active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  )}
                  data-testid={`text-reaction-count-${r.value}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
