import { memo, useState, useCallback } from "react";
import { Pencil, Check, X, BookOpen, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContentItem } from "./types";
import { TYPE_COLORS } from "./types";
import { BriefModal } from "./BriefModal";

interface PlanItemProps {
  item: ContentItem;
  index: number;
  onUpdate: (idx: number, updates: Partial<ContentItem>) => void;
  onRemove: (idx: number) => void;
  onGenerateBrief: (idx: number) => Promise<void>;
}

export const PlanItem = memo(function PlanItem({
  item,
  index,
  onUpdate,
  onRemove,
  onGenerateBrief,
}: PlanItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.title);
  const [showBrief, setShowBrief] = useState(false);

  const startEdit = useCallback(() => {
    setEditValue(item.title);
    setEditing(true);
  }, [item.title]);

  const saveEdit = useCallback(() => {
    if (editValue.trim()) {
      onUpdate(index, { title: editValue.trim() });
    }
    setEditing(false);
  }, [editValue, index, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(item.title);
  }, [item.title]);

  const handleGenerateBrief = useCallback(async () => {
    await onGenerateBrief(index);
  }, [index, onGenerateBrief]);

  const hasBrief = !!item.writing_brief;
  const isGenerating = !!item.brief_generating;

  return (
    <>
      <article
        className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:shadow-md transition-shadow group"
        aria-label={`Day ${item.day}: ${item.title}`}
      >
        {/* Day badge */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm"
          aria-label={`Day ${item.day}`}
        >
          {item.day}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                aria-label="Edit title"
              />
              <button onClick={saveEdit} className="text-primary hover:opacity-80" aria-label="Save edit">
                <Check size={16} />
              </button>
              <button
                onClick={cancelEdit}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cancel edit"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <h3 className="font-semibold text-sm leading-tight">{item.title}</h3>
          )}

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>

          {/* Tags row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                TYPE_COLORS[item.type] || "bg-muted text-muted-foreground"
              }`}
            >
              {item.type}
            </span>
            <Badge variant="outline" className="text-xs">
              {item.keyword}
            </Badge>
            {item.long_tail_keyword && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {item.long_tail_keyword}
              </Badge>
            )}
          </div>

          {/* Brief action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {hasBrief && (
              <button
                onClick={() => setShowBrief(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 px-3 py-1 rounded-lg transition-colors"
                aria-label={`View writing brief for Day ${item.day}`}
              >
                <BookOpen size={12} />
                View Brief
              </button>
            )}
            <button
              onClick={handleGenerateBrief}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasBrief
                  ? "text-muted-foreground hover:text-foreground border border-border hover:border-primary/30"
                  : "text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60"
              }`}
              aria-label={`${hasBrief ? "Regenerate" : "Generate"} writing brief for Day ${item.day}`}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  {hasBrief ? "Regenerate Brief" : "Generate Brief"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Edit / Remove actions */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={startEdit}
            className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground"
            aria-label={`Edit "${item.title}"`}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            aria-label={`Remove "${item.title}"`}
          >
            <X size={14} />
          </button>
        </div>
      </article>

      {/* Brief Modal — rendered outside the article to avoid stacking issues */}
      {showBrief && hasBrief && (
        <BriefModal item={item} onClose={() => setShowBrief(false)} />
      )}
    </>
  );
});
