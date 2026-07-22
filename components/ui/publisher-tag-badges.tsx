import { getStatusBadgePresentation } from "@/lib/status-badge";
import { cn } from "@/lib/utils";

type PublisherTagBadgesProps = {
  tag?: string | null;
  className?: string;
};

/** Renders publisher tags as "#"-prefixed pills (one per comma-separated value). */
export function PublisherTagBadges({ tag, className }: PublisherTagBadgesProps) {
  const tags = (tag ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (tags.length === 0) {
    return <span className="text-slate-500 dark:text-slate-300">—</span>;
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      {tags.map((value) => {
        const presentation = getStatusBadgePresentation(value, "outline");
        return (
          <span
            key={value}
            className={cn(presentation.className, "px-2 py-0.5 text-xs")}
            style={presentation.style}
          >
            # {value}
          </span>
        );
      })}
    </div>
  );
}
