import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  loadKIContext,
  updateKIContextProfile,
  addWorkRule,
  updateWorkRule,
  deleteWorkRule,
  toggleWorkRuleActive,
} from "@/services/kiContextService";
import { getActiveRuleCount } from "@/lib/contextBuilder";
import { buildContextPrefix } from "@/lib/contextBuilder";
import type { KIContext } from "@/types";

const DOMAIN_OPTIONS = ["Allgemein", "Recht", "Kommunikation", "Personal", "IT"];

const PROFILE_FIELDS: { key: keyof KIContext["profile"]; label: string }[] = [
  { key: "abteilung", label: "Abteilung" },
  { key: "fachgebiet", label: "Fachgebiet" },
  { key: "aufgaben", label: "Typische Aufgaben" },
  { key: "stil", label: "Stil" },
];

export function KIContextEditor() {
  const [ctx, setCtx] = useState<KIContext>(loadKIContext);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDomain, setNewDomain] = useState("Allgemein");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeCount = getActiveRuleCount();

  const reload = useCallback(() => setCtx(loadKIContext()), []);

  const handleProfileBlur = (field: keyof KIContext["profile"], value: string) => {
    if (value !== ctx.profile[field]) {
      const updated = updateKIContextProfile(field, value);
      setCtx(updated);
      toast.success("Gespeichert");
    }
  };

  const handleAddRule = () => {
    if (!newText.trim()) return;
    const updated = addWorkRule(newText.trim(), newDomain);
    setCtx(updated);
    setNewText("");
    setNewDomain("Allgemein");
    setAdding(false);
    toast.success("Regel hinzugefügt");
  };

  const handleToggle = (id: string) => {
    const updated = toggleWorkRuleActive(id);
    setCtx(updated);
  };

  const handleDelete = (id: string) => {
    const updated = deleteWorkRule(id);
    setCtx(updated);
    toast.success("Regel gelöscht");
  };

  const handleStartEdit = (id: string) => {
    const rule = ctx.workRules.find((r) => r.id === id);
    if (!rule) return;
    setEditingId(id);
    setEditText(rule.text);
    setEditDomain(rule.domain);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editText.trim()) return;
    const updated = updateWorkRule(editingId, { text: editText.trim(), domain: editDomain });
    setCtx(updated);
    setEditingId(null);
    toast.success("Regel aktualisiert");
  };

  return (
    <div className="card-section space-y-6">
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">Mein KI-Kontext</h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {activeCount} Arbeitsregeln aktiv
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Wird bei jeder KI-Anfrage automatisch mitgesendet.
        </p>
      </div>

      {/* Bereich 1: Rolle & Domäne */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Rolle & Domäne
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROFILE_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                {label}
              </label>
              <Input
                defaultValue={ctx.profile[key]}
                onBlur={(e) => handleProfileBlur(key, e.target.value)}
                className="text-sm"
                placeholder={`${label} eingeben…`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bereich 2: Arbeitsregeln */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Arbeitsregeln
          </h4>
          <Button
            variant="default"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3 h-3" />
            Regel hinzufügen
          </Button>
        </div>

        {/* Add Rule Inline Editor */}
        {adding && (
          <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/20">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Regel beschreiben…"
              className="text-sm min-h-[72px]"
            />
            <div className="flex items-center gap-2">
              <Select value={newDomain} onValueChange={setNewDomain}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setAdding(false); setNewText(""); }}>
                Abbrechen
              </Button>
              <Button size="sm" className="text-xs h-7" onClick={handleAddRule} disabled={!newText.trim()}>
                Speichern
              </Button>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-2">
          {ctx.workRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex items-start gap-3 border border-border rounded-lg p-3 transition-opacity",
                !rule.active && "opacity-50"
              )}
            >
              {editingId === rule.id ? (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex items-center gap-2">
                    <Select value={editDomain} onValueChange={setEditDomain}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOMAIN_OPTIONS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingId(null)}>
                      Abbrechen
                    </Button>
                    <Button size="sm" className="text-xs h-7" onClick={handleSaveEdit}>
                      Speichern
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Checkbox
                    checked={rule.active}
                    onCheckedChange={() => handleToggle(rule.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{rule.text}</p>
                    <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 mt-1 inline-block">
                      {rule.domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(rule.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {ctx.workRules.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Arbeitsregeln. Regeln helfen der KI, deinen Arbeitsstil zu verstehen.
            </p>
          )}
        </div>
      </div>

      {/* Bereich 4: Vorschau */}
      <div>
        <button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {previewOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Was die KI sieht
        </button>
        {previewOpen && (
          <pre className="mt-2 p-3 bg-muted/40 rounded-lg text-xs font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed overflow-auto max-h-60">
            {buildContextPrefix() || "Kein Kontext konfiguriert."}
          </pre>
        )}
      </div>
    </div>
  );
}
