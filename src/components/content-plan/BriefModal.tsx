import { X, BookOpen, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import type { ContentItem } from "./types";
import { TYPE_COLORS } from "./types";

interface BriefModalProps {
  item: ContentItem;
  onClose: () => void;
}

export function BriefModal({ item, onClose }: BriefModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!item.writing_brief) return;
    await navigator.clipboard.writeText(item.writing_brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.writing_brief]);

  // Parse the brief into sections for better rendering
  const renderBrief = (brief: string) => {
    const lines = brief.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-3" />;

      // Bold section headings like **Section 1: ...**
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        const text = trimmed.slice(2, -2);
        return (
          <h3 key={i} className="font-semibold text-sm text-primary mt-4 mb-1">
            {text}
          </h3>
        );
      }

      // Inline bold markers
      if (trimmed.includes("**")) {
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        );
      }

      // Bullet points
      if (trimmed.startsWith("- ")) {
        return (
          <li key={i} className="text-sm text-foreground ml-4 mb-1 list-disc leading-relaxed">
            {trimmed.slice(2)}
          </li>
        );
      }

      // SEO / Tone / Word count lines
      if (
        trimmed.startsWith("SEO") ||
        trimmed.startsWith("Tone") ||
        trimmed.startsWith("Word Count")
      ) {
        return (
          <p key={i} className="text-xs text-muted-foreground italic mt-2 mb-1 bg-muted/40 px-3 py-1 rounded-lg">
            {trimmed}
          </p>
        );
      }

      return (
        <p key={i} className="text-sm text-foreground leading-relaxed mb-1">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Writing brief for Day ${item.day}: ${item.title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {item.day}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    TYPE_COLORS[item.type] || "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.type}
                </span>
                <BookOpen size={13} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Writing Brief</span>
              </div>
              <h2 className="font-semibold text-base leading-snug line-clamp-2">{item.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                🔑 {item.keyword}
                {item.long_tail_keyword && ` · ${item.long_tail_keyword}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy brief to clipboard"
              title="Copy to clipboard"
            >
              {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close brief"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 flex-1">
          {item.writing_brief ? (
            <div className="prose-sm space-y-0.5">
              {renderBrief(item.writing_brief)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No writing brief available. Click "Generate Brief" on the plan item.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex-shrink-0 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            ~1,000 word writing guide · Generated by AI
          </p>
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
