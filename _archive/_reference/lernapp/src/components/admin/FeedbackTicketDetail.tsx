import { useState, useCallback, useEffect } from "react";
import { Copy, Wand2, ArrowLeft, Check, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FEEDBACK_CATEGORY_COLORS, FEEDBACK_STATUS_COLORS } from "@/lib/constants";
import { FEEDBACK_CATEGORY_LABELS } from "@/types";
import type { FeedbackItem, FeedbackStatus } from "@/types";
import { updateFeedback } from "@/services/feedbackService";
import { generateClaudeCodePrompt } from "@/services/promptGenerator";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "neu", label: "Neu" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "umgesetzt", label: "Umgesetzt" },
  { value: "abgelehnt", label: "Abgelehnt" },
  { value: "archiviert", label: "Archiviert" },
];

interface Props {
  ticket: FeedbackItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function FeedbackTicketDetail({ ticket, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<FeedbackStatus>("neu");
  const [priority, setPriority] = useState(3);
  const [notes, setNotes] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Sync state when ticket changes
  useEffect(() => {
    if (ticket) {
      setStatus(ticket.admin_status);
      setPriority(ticket.admin_priority ?? 3);
      setNotes(ticket.admin_notes ?? "");
      setPrompt(ticket.generated_prompt ?? "");
      setShowPrompt(false);
    }
  }, [ticket]);

  const handleSave = useCallback(async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      await updateFeedback(ticket.id, {
        admin_status: status,
        admin_priority: priority,
        admin_notes: notes,
        generated_prompt: prompt || undefined,
      });
      toast.success("Ticket aktualisiert");
      onUpdated();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [ticket, status, priority, notes, prompt, onUpdated]);

  const handleGeneratePrompt = useCallback(() => {
    if (!ticket) return;
    const generated = generateClaudeCodePrompt(ticket);
    setPrompt(generated);
    setShowPrompt(true);
    toast.success("Prompt generiert");
  }, [ticket]);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(prompt);
    toast.success("In Zwischenablage kopiert");
  }, [prompt]);

  const handleExportMd = useCallback(() => {
    const blob = new Blob([prompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-prompt-${ticket?.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [prompt, ticket]);

  // Empty state
  if (!ticket) {
    return (
      <div className="rounded-xl border border-border bg-card flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground">← Ticket auswählen</p>
      </div>
    );
  }

  // Prompt view (after generating)
  if (showPrompt && prompt) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück
          </button>
          <span className="text-sm font-semibold ml-2">Generierter Claude Code Prompt</span>
        </div>

        <div className="p-4 space-y-3">
          <pre className="rounded-lg bg-[#1a1a2e] p-4 text-[11.5px] text-slate-200 font-mono leading-[1.7] overflow-x-auto max-h-[50vh] overflow-y-auto whitespace-pre-wrap">
            {prompt}
          </pre>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
              onClick={handleCopyPrompt}
            >
              <Copy className="h-3.5 w-3.5" /> Kopieren
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleExportMd}>
              <Download className="h-3.5 w-3.5" /> Als .md exportieren
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              CLAUDE.md eingebunden
            </span>
          </div>

          {/* Save button */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Detail view
  const contextParts = [
    ticket.context.page,
    ticket.screen_ref || ticket.context.mode,
  ].filter(Boolean).join(" → ");

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[11px] text-muted-foreground">
          Ticket #{ticket.id.slice(0, 4)}
        </span>
        <h2 className="text-[17px] font-semibold leading-snug mt-0.5">
          {ticket.llm_summary || ticket.text || "–"}
        </h2>
      </div>

      <div className="p-4 space-y-5">
        {/* Metadata grid 2×2 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Kategorie</span>
            <div className="mt-0.5">
              <Badge className={`text-[11px] ${FEEDBACK_CATEGORY_COLORS[ticket.category]}`}>
                {FEEDBACK_CATEGORY_LABELS[ticket.category]}
              </Badge>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
            <div className="mt-0.5">
              <Badge variant="outline" className={`text-[11px] ${FEEDBACK_STATUS_COLORS[ticket.admin_status]}`}>
                {STATUS_OPTIONS.find((s) => s.value === ticket.admin_status)?.label}
              </Badge>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Kontext</span>
            <p className="text-[13px] font-medium mt-0.5">{contextParts}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Nutzer</span>
            <p className="text-[13px] font-medium mt-0.5">
              {ticket.user_display_name || ticket.user_id}
            </p>
          </div>
        </div>

        {/* User confirmation */}
        {ticket.user_confirmed && ticket.llm_summary && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Nutzer-Bestätigung</span>
              <p className="text-[13px] mt-0.5">
                Nutzer hat bestätigt: &ldquo;Ja, genau das meine ich&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Original feedback text (if different from summary) */}
        {ticket.llm_summary && ticket.text && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ursprüngliches Feedback</span>
            <p className="text-sm text-muted-foreground mt-1">{ticket.text}</p>
          </div>
        )}

        <hr className="border-border" />

        {/* Admin fields */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
              <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Priorität: {priority}/5</Label>
            <Slider
              value={[priority]}
              onValueChange={([v]) => setPriority(v)}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="text-xs">Admin-Notizen</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 resize-none text-sm"
              placeholder="Interne Notizen..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Button onClick={handleGeneratePrompt} className="gap-1.5">
            <FileText className="h-4 w-4" />
            Claude Code Prompt generieren
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("abgelehnt");
              handleSave();
            }}
          >
            Ablehnen
          </Button>
        </div>

        {/* Save */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Speichern..." : "Speichern"}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  );
}
