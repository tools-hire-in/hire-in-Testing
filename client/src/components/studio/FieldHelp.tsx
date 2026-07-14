import { CircleHelp } from "lucide-react";
import { Link } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FIELD_HELP_REGISTRY, type FieldHelpEntry } from "@/lib/fieldHelpContent";

/**
 * FieldHelp — persistent contextual cheat sheet for complex Studio fields.
 *
 * Usage: <FieldHelp id="bd-positioning-angle" />
 *
 * Place inline after a <Label> element. The ? icon opens a Popover (stays
 * open for reading, unlike a Tooltip). Content is looked up from the central
 * FIELD_HELP_REGISTRY by id.
 */
export function FieldHelp({ id }: { id: string }) {
  const entry: FieldHelpEntry | undefined = FIELD_HELP_REGISTRY[id];
  if (!entry) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Help: ${entry.title}`}
          data-testid={`field-help-${id}`}
          className="inline-flex items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).click();
            }
          }}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="bottom"
        data-testid={`field-help-popover-${id}`}
      >
        <div className="space-y-3 p-4">
          <p className="text-sm font-semibold leading-snug">{entry.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {entry.explanation}
          </p>
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Example
            </p>
            <p className="text-xs leading-relaxed">{entry.example}</p>
          </div>
          {entry.learnMore && (
            <Link href={entry.learnMore.href}>
              <span className="inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary underline-offset-2 hover:underline">
                {entry.learnMore.label} →
              </span>
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
