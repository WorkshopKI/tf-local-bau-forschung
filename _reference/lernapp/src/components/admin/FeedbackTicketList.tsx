import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FEEDBACK_CATEGORY_COLORS } from "@/lib/constants";
import { FEEDBACK_CATEGORY_LABELS } from "@/types";
import type { FeedbackItem, FeedbackCategory, FeedbackStatus } from "@/types";

const CATEGORY_ICONS: Record<FeedbackCategory, string> = {
  praise: "♦",
  problem: "♦",
  idea: "◈",
  question: "◇",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  neu: "Neu",
  in_bearbeitung: "In Bearbeitung",
  umgesetzt: "Umgesetzt",
  abgelehnt: "Abgelehnt",
  archiviert: "Archiviert",
};

interface Props {
  tickets: FeedbackItem[];
  loading: boolean;
  selectedId?: string;
  filterCategory: FeedbackCategory | "";
  filterStatus: FeedbackStatus | "";
  onFilterCategory: (v: FeedbackCategory | "") => void;
  onFilterStatus: (v: FeedbackStatus | "") => void;
  onSelect: (ticket: FeedbackItem) => void;
}

export function FeedbackTicketList({
  tickets,
  loading,
  selectedId,
  filterCategory,
  filterStatus,
  onFilterCategory,
  onFilterStatus,
  onSelect,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Container header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Feedback-Tickets</span>
        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium min-w-[22px]">
          {tickets.length}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap px-4 py-3 border-b border-border">
        <Select
          value={filterCategory || "all"}
          onValueChange={(v) => onFilterCategory(v === "all" ? "" : v as FeedbackCategory)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {(Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[]).map((cat) => (
              <SelectItem key={cat} value={cat}>{FEEDBACK_CATEGORY_LABELS[cat]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus || "all"}
          onValueChange={(v) => onFilterStatus(v === "all" ? "" : v as FeedbackStatus)}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ticket items */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Noch kein Feedback vorhanden.
          </p>
        ) : (
          tickets.map((ticket, idx) => {
            const isSelected = selectedId === ticket.id;
            const summary = ticket.llm_summary || ticket.text || "–";
            const contextLine = [
              ticket.context.page,
              ticket.screen_ref ? `→ ${ticket.screen_ref}` : null,
              ticket.user_display_name || ticket.user_id,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={ticket.id}
                onClick={() => onSelect(ticket)}
                className={`
                  cursor-pointer px-4 py-3 transition-colors
                  ${isSelected ? "border-l-[3px] border-l-primary bg-primary/5 pl-[13px]" : "border-l-[3px] border-l-transparent"}
                  ${idx < tickets.length - 1 ? "border-b border-border" : ""}
                  hover:bg-muted/50
                `}
              >
                {/* Top row: category badge + id + date */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className={`text-[10px] px-1.5 py-0 h-5 ${FEEDBACK_CATEGORY_COLORS[ticket.category]}`}>
                    {CATEGORY_ICONS[ticket.category]} {FEEDBACK_CATEGORY_LABELS[ticket.category]}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">#{ticket.id.slice(0, 4)}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {new Date(ticket.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>

                {/* Summary */}
                <p className="text-[13px] font-medium leading-snug line-clamp-2">{summary}</p>

                {/* Context line */}
                <p className="text-[11px] text-muted-foreground mt-1 truncate">{contextLine}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
