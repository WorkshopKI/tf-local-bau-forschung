import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, ChevronDown, ChevronRight, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  loadConstraints,
  addConstraint,
  deleteConstraint,
  toggleConstraintActive,
} from "@/services/constraintService";
import { ComplianceReport } from "@/components/ComplianceReport";
import type { Constraint } from "@/types";

const DOMAIN_OPTIONS = ["Allgemein", "Recht", "Kommunikation", "Personal", "IT"];
const ALL_DOMAINS = ["Alle", ...DOMAIN_OPTIONS];

export function ConstraintLibrary() {
  const [constraints, setConstraints] = useState<Constraint[]>(loadConstraints);
  const [filter, setFilter] = useState("Alle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newRule, setNewRule] = useState("");
  const [newDomain, setNewDomain] = useState("Allgemein");
  const [newBefore, setNewBefore] = useState("");
  const [newAfter, setNewAfter] = useState("");

  const filtered = useMemo(() => {
    if (filter === "Alle") return constraints;
    return constraints.filter((c) => c.domain === filter);
  }, [constraints, filter]);

  const activeCount = constraints.filter((c) => c.active).length;
  const rejectionCount = constraints.filter((c) => c.source === "rejection").length;

  const reload = () => setConstraints(loadConstraints());

  const handleAdd = () => {
    if (!newTitle.trim() || !newRule.trim()) return;
    const example = newBefore.trim() && newAfter.trim()
      ? { before: newBefore.trim(), after: newAfter.trim() }
      : undefined;
    addConstraint({
      title: newTitle.trim(),
      rule: newRule.trim(),
      domain: newDomain,
      example,
    });
    reload();
    resetForm();
    toast.success("Regel erstellt");
  };

  const resetForm = () => {
    setAdding(false);
    setNewTitle("");
    setNewRule("");
    setNewDomain("Allgemein");
    setNewBefore("");
    setNewAfter("");
    setShowExample(false);
  };

  const handleToggle = (id: string) => {
    toggleConstraintActive(id);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteConstraint(id);
    reload();
    toast.success("Regel gelöscht");
  };

  // Empty state
  if (constraints.length === 0 && !adding) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Noch keine Qualitätsregeln. Regeln entstehen, wenn du im Prompt-Labor erkennst was die KI besser machen soll.
        </p>
        <Button onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Erste Regel erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Dein akkumuliertes Wissen über gute vs. schlechte KI-Outputs. Jede Regel kodiert eine Erfahrung.
        </p>
        <div className="flex items-center gap-5 mt-3">
          <StatBadge value={constraints.length} label="Regeln" />
          <StatBadge value={activeCount} label="aktiv" />
          {rejectionCount > 0 && <StatBadge value={rejectionCount} label="aus Ablehnungen" />}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setReportOpen(true)}
          >
            <FileText className="w-3.5 h-3.5" /> Kompetenznachweis
          </Button>
          <Button size="sm" className="gap-1 text-xs h-7" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3" />
            Regel hinzufügen
          </Button>
        </div>
      </div>

      {/* Domain Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_DOMAINS.map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              filter === d
                ? "bg-foreground text-background border-foreground"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {adding && (
        <div className="card-section space-y-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titel der Regel…"
            className="text-sm"
          />
          <Textarea
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="Regel beschreiben…"
            className="text-sm min-h-[72px]"
          />
          <Select value={newDomain} onValueChange={setNewDomain}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOMAIN_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!showExample ? (
            <button
              onClick={() => setShowExample(true)}
              className="text-xs text-primary hover:underline"
            >
              + Beispiel hinzufügen
            </button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Vorher (schlecht)</label>
              <Textarea
                value={newBefore}
                onChange={(e) => setNewBefore(e.target.value)}
                placeholder="Schlechtes Beispiel…"
                className="text-sm min-h-[48px]"
              />
              <label className="text-xs font-medium text-muted-foreground">Nachher (gut)</label>
              <Textarea
                value={newAfter}
                onChange={(e) => setNewAfter(e.target.value)}
                placeholder="Gutes Beispiel…"
                className="text-sm min-h-[48px]"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={resetForm}>
              Abbrechen
            </Button>
            <Button size="sm" className="text-xs h-7" onClick={handleAdd} disabled={!newTitle.trim() || !newRule.trim()}>
              Speichern
            </Button>
          </div>
        </div>
      )}

      {/* Constraint Cards */}
      <div className="space-y-2">
        {filtered.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className="card-section">
              <div className="flex items-start gap-3">
                {/* Chevron + Content */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />
                  }
                </button>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <p className="font-semibold text-sm">{c.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{c.rule}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                      {c.domain}
                    </span>
                    {c.source === "rejection" && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400 rounded px-1.5 py-0.5">
                        <Sparkles className="w-[13px] h-[13px]" />
                        aus Ablehnung gelernt
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(c.createdAt).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-[11px]",
                    c.active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                  )}>
                    {c.active ? "aktiv" : "inaktiv"}
                  </span>
                  <Switch
                    checked={c.active}
                    onCheckedChange={() => handleToggle(c.id)}
                  />
                </div>
              </div>

              {/* Expanded Example */}
              {isExpanded && c.example && (
                <div className="mt-3 pt-3 border-t border-border bg-muted/30 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Beispiel</p>
                  <div className="space-y-2">
                    <div className="border-l-2 border-red-400 pl-3 py-1.5 bg-red-50/50 dark:bg-red-950/20 rounded-r">
                      <p className="text-sm">{c.example.before}</p>
                    </div>
                    <div className="border-l-2 border-emerald-400 pl-3 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-r">
                      <p className="text-sm">{c.example.after}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded Actions (no example) */}
              {isExpanded && (
                <div className="mt-3 pt-2 border-t border-border flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    Löschen
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KI-Kompetenznachweis</DialogTitle>
            <DialogDescription>
              Exportiere deinen Kompetenznachweis gemäß EU AI Act Art. 4.
            </DialogDescription>
          </DialogHeader>
          <ComplianceReport />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBadge({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground ml-1">{label}</span>
    </div>
  );
}
