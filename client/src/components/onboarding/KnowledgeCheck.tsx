import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, Lightbulb } from "lucide-react";

export interface KCItem {
  question: string;
  answer: string;
  options?: string[];
}

interface KnowledgeCheckProps {
  items: KCItem[];
  onComplete: (allSeen: boolean) => void;
}

export function KnowledgeCheck({ items, onComplete }: KnowledgeCheckProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [seenSet, setSeenSet] = useState<Set<number>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const current = items[currentIdx];
  const total = items.length;
  const isLast = currentIdx === total - 1;

  const handleReveal = () => {
    setRevealed(true);
    const next = new Set(seenSet).add(currentIdx);
    setSeenSet(next);
    if (next.size === total) {
      onComplete(true);
    }
  };

  const handleNext = () => {
    if (!revealed) return;
    if (isLast) return;
    setCurrentIdx((i) => i + 1);
    setRevealed(false);
    setSelectedOption(null);
  };

  const allSeen = seenSet.size === total;

  return (
    <div className="space-y-4" data-testid="knowledge-check">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Knowledge Check</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {Math.min(seenSet.size + (revealed ? 0 : 0), seenSet.size)} / {total} seen
        </Badge>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {items.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              seenSet.has(i)
                ? "bg-green-500"
                : i === currentIdx
                ? "bg-primary"
                : "bg-muted"
            }`}
            data-testid={`kc-dot-${i}`}
          />
        ))}
      </div>

      <div className="rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 space-y-3">
        <p className="font-medium text-sm leading-relaxed" data-testid="kc-question">
          {current.question}
        </p>

        {/* Multiple choice options if present */}
        {current.options && !revealed && (
          <div className="space-y-1.5 mt-2">
            {current.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedOption(opt)}
                className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                  selectedOption === opt
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background hover:border-primary/50 hover:bg-accent"
                }`}
                data-testid={`kc-option-${i}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {!revealed ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReveal}
            className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
            data-testid="button-kc-reveal"
          >
            Reveal Answer
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed" data-testid="kc-answer">
                {current.answer}
              </p>
            </div>
            {!isLast && (
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1.5"
                data-testid="button-kc-next"
              >
                Next Question
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLast && allSeen && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All questions reviewed — you can confirm below
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
