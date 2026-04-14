import { useState, useEffect, useCallback } from "react";
import { Lightbulb, Check, Save, Pencil, Sparkles, Loader2 } from "lucide-react";
import { complete } from "@/services/completionService";
import { addConstraint } from "@/services/constraintService";
import { LS_KEYS } from "@/lib/constants";
import { loadStringFromStorage, saveToStorage } from "@/lib/storage";
import { toast } from "sonner";
import type { Msg } from "@/types";

type Phase = "nudge" | "reason" | "suggestion" | "saved";

interface GeneratedConstraint {
  title: string;
  rule: string;
  domain: string;
  example?: { before: string; after: string };
}

interface RejectionNudgeProps {
  turnCount: number;
  recentMessages: Msg[];
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function isCooldownActive(): boolean {
  const ts = loadStringFromStorage(LS_KEYS.REJECTION_NUDGE_COOLDOWN, "");
  if (!ts) return false;
  return Date.now() - Number(ts) < COOLDOWN_MS;
}

const CONSTRAINT_SYSTEM_PROMPT = `Du bist ein Experte für Qualitätssicherung bei KI-generierten Texten.
Der Nutzer hat einen KI-Output iteriert und beschreibt, was nicht gut genug war.
Erstelle daraus eine strukturierte Qualitätsregel im JSON-Format:
{
  "title": "Kurzer, prägnanter Titel (max 50 Zeichen)",
  "rule": "Klare, maschinenlesbare Regel (1-2 Sätze)",
  "domain": "Fachbereich (z.B. Recht, Kommunikation, Personal, IT, Allgemein)",
  "example": {
    "before": "Konkretes Beispiel eines schlechten Outputs (kurz)",
    "after": "Konkretes Beispiel eines guten Outputs (kurz)"
  }
}
Antworte NUR mit dem JSON-Objekt, kein Markdown, kein Preamble.`;

export const RejectionNudge = ({ turnCount, recentMessages }: RejectionNudgeProps) => {
  const [phase, setPhase] = useState<Phase>("nudge");
  const [dismissed, setDismissed] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [constraint, setConstraint] = useState<GeneratedConstraint | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editRule, setEditRule] = useState("");

  // Auto-hide saved banner after 5 seconds
  useEffect(() => {
    if (phase !== "saved") return;
    const t = setTimeout(() => setDismissed(true), 5000);
    return () => clearTimeout(t);
  }, [phase]);

  const handleDerive = useCallback(async () => {
    setLoading(true);
    setPhase("suggestion");

    const userMessage = `Der Nutzer hat folgenden Chat geführt und war mit dem Output unzufrieden.

Chat-Verlauf (letzte Nachrichten):
${recentMessages.map(m => `${m.role === "user" ? "Nutzer" : "KI"}: ${m.content.slice(0, 500)}`).join("\n\n")}

Begründung des Nutzers, warum der Output nicht gut genug war:
"${reason}"

Erstelle jetzt die Qualitätsregel.`;

    try {
      const raw = await complete({
        messages: [
          { role: "system", content: CONSTRAINT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      });

      // Strip markdown fences if present
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed: GeneratedConstraint = JSON.parse(cleaned);
      setConstraint(parsed);
      setEditTitle(parsed.title);
      setEditRule(parsed.rule);
    } catch {
      toast.error("Regel konnte nicht generiert werden. Bitte versuche es manuell.");
      setPhase("nudge");
      setDismissed(true);
    } finally {
      setLoading(false);
    }
  }, [recentMessages, reason]);

  const handleSave = useCallback(() => {
    if (!constraint) return;
    const title = editMode ? editTitle : constraint.title;
    const rule = editMode ? editRule : constraint.rule;

    addConstraint({
      title,
      rule,
      domain: constraint.domain,
      source: "rejection",
      example: constraint.example,
    });

    saveToStorage(LS_KEYS.REJECTION_NUDGE_COOLDOWN, Date.now().toString());
    setSavedThisSession(true);
    setPhase("saved");
    toast.success("Qualitätsregel gespeichert!");
  }, [constraint, editMode, editTitle, editRule]);

  // Don't render conditions
  if (turnCount < 2) return null;
  if (isCooldownActive()) return null;
  if (dismissed) return null;
  if (savedThisSession) return null;

  // Phase: saved
  if (phase === "saved") {
    return (
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Qualitätsregel gespeichert und in deinem KI-Kontext aktiviert.
        </p>
      </div>
    );
  }

  // Phase: suggestion
  if (phase === "suggestion") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Regel wird abgeleitet…</span>
          </div>
        ) : constraint ? (
          <>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Vorgeschlagene Qualitätsregel
              </span>
            </div>

            {editMode ? (
              <div className="space-y-2">
                <input
                  className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-border bg-background"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <textarea
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background min-h-[60px] leading-relaxed"
                  value={editRule}
                  onChange={(e) => setEditRule(e.target.value)}
                />
              </div>
            ) : (
              <>
                <p className="font-semibold text-sm">{constraint.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{constraint.rule}</p>
              </>
            )}

            {constraint.example && !editMode && (
              <div className="space-y-1.5 text-xs">
                <div className="border-l-2 border-red-400 bg-red-50/50 dark:bg-red-950/20 pl-3 py-1.5 rounded-r">
                  <span className="text-muted-foreground">Vorher: </span>
                  <span>{constraint.example.before}</span>
                </div>
                <div className="border-l-2 border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 pl-3 py-1.5 rounded-r">
                  <span className="text-muted-foreground">Nachher: </span>
                  <span>{constraint.example.after}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {constraint.domain}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                aus Ablehnung gelernt
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Save className="w-3 h-3" />
                Regel speichern
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {editMode ? "Vorschau" : "Bearbeiten"}
              </button>
              <button
                onClick={() => { setDismissed(true); }}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Verwerfen
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // Phase: reason
  if (phase === "reason") {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
        <label className="text-sm font-medium text-amber-800 dark:text-amber-400">
          Was genau war nicht gut genug?
        </label>
        <textarea
          className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 dark:border-amber-700 bg-background min-h-[72px] placeholder:text-muted-foreground/60"
          placeholder="z.B. Die Frist war zu vage, es fehlte die Rechtsgrundlage..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleDerive}
            disabled={reason.trim().length < 10}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-700 dark:bg-amber-600 text-white hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Regel ableiten
          </button>
          <button
            onClick={() => { setPhase("nudge"); setDismissed(true); }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // Phase: nudge (default)
  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 space-y-2">
        <p className="font-semibold text-sm text-amber-800 dark:text-amber-400">
          Du hast nachgebessert
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Was war am ersten Output nicht gut genug? Wenn du es kurz beschreibst, kann ich daraus eine Qualitätsregel ableiten.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setPhase("reason")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-700 dark:bg-amber-600 text-white hover:bg-amber-800 transition-colors"
          >
            Ja, Regel ableiten
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            Nicht jetzt
          </button>
        </div>
      </div>
    </div>
  );
};
