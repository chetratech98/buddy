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

          