import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FEEDBACK_CATEGORY_COLORS } from "@/lib/constants";

interface LLMClassification {
  category: string;
  summary: string;
  details: string;
  affectedArea: string;
  priority_suggestion: number;
  relevant_files?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature-Wunsch",
  ux: "UX-Feedback",
  praise: "Lob",
  question: "Frage",
};

const CATEGORY_MAP: Record<string, string> = {
  bug: "problem",
  feature: "idea",
  ux: "problem",
  praise: "praise",
  question: "question",
};

interface Props {
  classification: LLMClassification;
  onConfirm: () => void;
  onReject: () => void;
}

export function FeedbackConfirmCard({ classification, onConfirm, onReject }: Props) {
  const badgeColor = FEEDBACK_CATEGORY_COLORS[CATEGORY_MAP[classification.category] ?? "question"];

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
      {/* Titelzeile: Label + Badge + Bereich — alles in einer Zeile */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Zusammenfassung
        </span>
        <Badge className={badgeColor}>
          {CATEGORY_LABELS[classification.category] ?? classification.category}
        </Badge>
        {classification.affectedArea && (
          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {classification.affectedArea}
          </code>
        )}
      </div>
      {/* Summary */}
      <p className="text-[13px] leading-[1.55]">{classification.summary}</p>
      {/* Details — nur wenn vorhanden und unterscheidet sich von summary */}
      {classification.details && classification.details !== classification.summary && (
        <p className="text-[12px] text-muted-foreground">{classification.details}</p>
      )}
      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={onConfirm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Ja, genau das meine ich
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} className="text-[12px]">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Nein, korrigieren
        </Button>
      </div>
    </div>
  );
}
