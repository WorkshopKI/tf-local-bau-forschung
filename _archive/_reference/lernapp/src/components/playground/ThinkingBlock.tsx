import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  content: string;
  isStreaming?: boolean;
}

export const ThinkingBlock = ({ content, isStreaming }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return null;

  const preview = content.slice(0, 100).replace(/\n/g, " ");
  const hasMore = content.length > 100;

  return (
    <div className="mx-4 mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left group"
      >
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <Brain className={`w-3.5 h-3.5 text-primary/60 ${isStreaming ? "animate-pulse" : ""}`} />
          {isOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </div>
        <span className="flex-1">
          {isOpen ? (
            <span className="font-medium text-primary/70">Denkprozess</span>
          ) : (
            <>
              <span className="font-medium text-primary/70">Denkprozess: </span>
              <span className="text-muted-foreground/60 italic">
                {preview}{hasMore && "\u2026"}
                {isStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-primary/40 animate-pulse rounded-sm" />}
              </span>
            </>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="ml-7 mt-1.5 pl-3 border-l-2 border-primary/15 text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-primary/40 animate-pulse rounded-sm" />}
        </div>
      )}
    </div>
  );
};
