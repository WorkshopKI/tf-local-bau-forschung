import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2 } from "lucide-react";
import { ChatMessage } from "./ChatMessage";

export interface ComparisonResult {
  model: string;
  content: string;
  isStreaming: boolean;
}

interface ComparisonColumnProps {
  label: string;
  result: ComparisonResult | null;
}

export function ComparisonColumn({ label, result }: ComparisonColumnProps) {
  return (
    <Card className="p-3 space-y-2 min-h-[200px]">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Bot className="w-3 h-3 text-muted-foreground" />
        <Badge variant="outline" className="text-[10px]">
          {label}
        </Badge>
        {result?.isStreaming && (
          <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />
        )}
      </div>

      {result ? (
        result.content ? (
          <ChatMessage
            role="assistant"
            content={result.content}
            isStreaming={result.isStreaming}
          />
        ) : result.isStreaming ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="w-3 h-3 animate-spin" />
            Warte auf Antwort...
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4">Keine Antwort.</p>
        )
      ) : null}
    </Card>
  );
}
