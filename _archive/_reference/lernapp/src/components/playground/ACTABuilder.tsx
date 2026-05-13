import { useState, useMemo, useRef, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronUp, ChevronRight, User, FileText, Target, Layout, Send, Copy, Loader2, Wand2, Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLibraryTemplates, EMPTY_EXTENSIONS, type ACTAFields, type ACTAExtensions } from "./ACTATemplates";
import { ContextExtensions, TaskExtensions, AusgabeExtensions } from "./ACTAExtensionsUI";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/contexts/OrgContext";
import { useACTAAssist } from "@/hooks/useACTAAssist";
import { extractVariables } from "@/lib/promptUtils";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";

export interface ACTABuilderProps {
  fields: ACTAFields;
  onFieldsChange: (fields: ACTAFields) => void;
  onSendToPlayground: (assembledPrompt: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  bare?: boolean;
  mode?: "einsteiger" | "experte";
  selectedModel?: string;
  layout?: "vertical" | "horizontal";
  sourceTitle?: string | null;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  confidentiality?: "open" | "internal" | "confidential";
  onReset?: () => void;
}

const FIELD_CONFIG = [
  { key: "act" as const, label: "Act (Rolle)", icon: User, placeholder: "z.B. ein erfahrener Marketing-Experte..." },
  { key: "context" as const, label: "Context (Kontext)", icon: FileText, placeholder: "Beschreibe die Ausgangssituation und den Hintergrund..." },
  { key: "task" as const, label: "Task (Aufgabe)", icon: Target, placeholder: "Was genau soll die KI tun?" },
  { key: "ausgabe" as const, label: "Ausgabe (Format)", icon: Layout, placeholder: "Wie soll das Ergebnis aussehen? (Länge, Struktur, Sprache...)" },
];

// ACTA — Einsteiger (4 Felder)
const ACTA_FIELDS = [
  { key: "act" as const, letter: "A", label: "Act", sublabel: "Rolle", icon: "👤", placeholder: "Welche Expertenrolle soll die KI einnehmen?" },
  { key: "context" as const, letter: "C", label: "Context", sublabel: "Kontext", icon: "📋", placeholder: "Hintergrund, Situation, Rahmenbedingungen..." },
  { key: "task" as const, letter: "T", label: "Task", sublabel: "Aufgabe", icon: "🎯", placeholder: "Was genau soll die KI tun?" },
  { key: "ausgabe" as const, letter: "A", label: "Ausgabe", sublabel: "Ergebnis", icon: "📄", placeholder: "Länge, Struktur, Sprache des Ergebnisses..." },
];

// RAKETE — Fortgeschritten (6 Felder, die ersten 4 = ACTA umbenannt)
const RAKETE_FIELDS = [
  { key: "act" as const, letter: "R", label: "Rolle", sublabel: "= Act", icon: "👤", placeholder: "Welche Expertenrolle soll die KI einnehmen?", isExtension: false, isNew: false },
  { key: "context" as const, letter: "K", label: "Kontext", sublabel: "= Context", icon: "📋", placeholder: "Hintergrund, Situation, Rahmenbedingungen...", isExtension: false, isNew: false },
  { key: "task" as const, letter: "A", label: "Aufgabe", sublabel: "= Task", icon: "🎯", placeholder: "Was genau soll die KI tun?", isExtension: false, isNew: false },
  { key: "ausgabe" as const, letter: "E", label: "Ergebnis", sublabel: "= Ausgabe", icon: "📄", placeholder: "Länge, Struktur, Sprache des Ergebnisses...", isExtension: false, isNew: false },
  { key: "verification" as const, letter: "T", label: "Teste", sublabel: "Selbstprüfung", icon: "🧪", placeholder: "Worauf soll die KI ihre Antwort überprüfen? z.B. Vollständigkeit, Korrektheit, Bias...", isExtension: true, isNew: true },
  { key: "negatives" as const, letter: "E", label: "Einschränkungen", sublabel: "Was NICHT", icon: "🚫", placeholder: "Was soll die KI NICHT tun? z.B. keine Floskeln, nicht spekulieren, keine Aufzählungen...", isExtension: true, isNew: true },
];

function replaceVariables(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(values)) {
    if (val.trim()) {
      result = result.replace(new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, "g"), val.trim());
    }
  }
  return result;
}

function assembleACTAPrompt(fields: ACTAFields, varValues?: Record<string, string>): string {
  const ext = fields.extensions;
  const innerParts: string[] = [];

  // Act
  if (fields.act.trim()) innerParts.push(`Du bist ${fields.act.trim()}.`);

  // Context + Extensions
  if (fields.context.trim()) innerParts.push(`\nKontext: ${fields.context.trim()}`);
  if (ext?.examples && ext.examples.filter(e => e.trim()).length > 0) {
    const exList = ext.examples.filter(e => e.trim()).map((e, i) => `Beispiel ${i + 1}: ${e.trim()}`).join("\n");
    innerParts.push(`\nBeispiele zur Orientierung:\n${exList}`);
  }
  if (ext?.rules?.trim()) innerParts.push(`\nWichtige Regeln:\n${ext.rules.trim()}`);

  // Task + Extensions
  if (fields.task.trim()) innerParts.push(`\nAufgabe: ${fields.task.trim()}`);
  if (ext?.reasoning && ext.reasoning !== "none") {
    const map: Record<string, string> = {
      "step-by-step": "Gehe Schritt für Schritt vor und erkläre jeden Denkschritt.",
      "pros-cons": "Analysiere zunächst Vor- und Nachteile, bevor du zu einer Empfehlung kommst.",
      "perspectives": "Betrachte die Aufgabe aus mindestens 3 verschiedenen Perspektiven, bevor du zu einem Ergebnis kommst.",
      "tree-of-thought": "Entwickle mehrere mögliche Lösungswege parallel, bewerte jeden, und verfolge den vielversprechendsten weiter.",
    };
    if (map[ext.reasoning]) innerParts.push(`\nDenkweise: ${map[ext.reasoning]}`);
  }
  if (ext?.verification) {
    innerParts.push(ext.verificationNote?.trim()
      ? `\nSelbstprüfung: ${ext.verificationNote.trim()}`
      : `\nSelbstprüfung: Überprüfe deine Antwort auf Vollständigkeit, Korrektheit und mögliche Schwachstellen. Korrigiere identifizierte Probleme.`
    );
  }

  // Ausgabe + Extensions
  if (fields.ausgabe.trim()) innerParts.push(`\nAusgabeformat: ${fields.ausgabe.trim()}`);
  if (ext?.negatives?.trim()) innerParts.push(`\nWICHTIG — NICHT:\n${ext.negatives.trim()}`);

  const innerPrompt = innerParts.join("\n");

  // Reverse Prompting Hülle
  let finalPrompt: string;
  if (ext?.reversePrompt) {
    finalPrompt = `Du bist ein Experte für Prompt-Design.\n\nSchritt 1: Lies die folgende Aufgabenbeschreibung und entwirf den bestmöglichen Prompt dafür. Berücksichtige fehlende Details, das optimale Output-Format und die effektivste Denkstrategie.\n\nAufgabenbeschreibung:\n---\n${innerPrompt}\n---\n\nSchritt 2: Zeige den von dir entworfenen Prompt.\n\nSchritt 3: Führe deinen entworfenen Prompt aus und liefere das Ergebnis.`;
  } else {
    finalPrompt = innerPrompt;
  }

  if (varValues) {
    finalPrompt = replaceVariables(finalPrompt, varValues);
  }
  return finalPrompt;
}

interface ACTACardProps {
  icon: string;
  shortLabel: string;
  longLabel: string;
  sublabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxHeight?: number;
  isNew?: boolean;
}

function ACTACard({ icon, shortLabel, longLabel, sublabel, value, onChange, placeholder, maxHeight = 120, isNew }: ACTACardProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !value.trim();

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      autoResize(textareaRef.current);
    }
  }, [editing]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  };

  return (
    <div
      onClick={() => !editing && setEditing(true)}
      className={cn(
        "flex-1 min-w-0 rounded-lg p-2.5 transition-all cursor-pointer flex flex-col gap-1",
        editing
          ? "border-[1.5px] border-primary bg-card shadow-[0_0_0_3px_rgba(192,105,74,0.08)]"
          : isEmpty
            ? "border border-dashed border-border bg-muted/30 hover:border-primary/30"
            : "border border-border bg-card shadow-sm hover:shadow-md"
      )}
      style={{ cursor: editing ? "text" : "pointer" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm leading-none">{icon}</span>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          isEmpty ? "text-muted-foreground/50" : "text-primary"
        )}>
          <span className="text-xs">{shortLabel}</span> {longLabel}
        </span>
        <span className="text-[9px] text-muted-foreground/60">({sublabel})</span>
        {isNew && !value.trim() && (
          <span className="text-[8px] bg-primary/15 text-primary px-1.5 py-0 rounded-full font-semibold ml-auto animate-pulse">
            NEU
          </span>
        )}
        {!editing && !isEmpty && (
          <span className="ml-auto text-muted-foreground/40 text-xs">✏️</span>
        )}
        {editing && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(false); }}
            className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5 hover:bg-primary/15 transition-colors"
          >
            ✓ Fertig
          </button>
        )}
      </div>
      {editing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); autoResize(e.target); }}
          onBlur={() => setEditing(false)}
          placeholder={placeholder}
          className="w-full border-none outline-none resize-none text-xs leading-relaxed text-foreground bg-transparent font-[inherit] p-0"
          style={{ minHeight: 36, maxHeight, overflow: "auto" }}
        />
      ) : isEmpty ? (
        <span className="text-xs text-muted-foreground/50 leading-relaxed italic">
          {placeholder}
        </span>
      ) : (
        <div
          className="text-xs text-foreground leading-relaxed overflow-hidden break-words"
          style={{
            maxHeight,
            display: "-webkit-box",
            WebkitLineClamp: Math.floor(maxHeight / 18),
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

const EXTENSION_CHIPS = [
  { key: "examples" as const, label: "Few-Shot", type: "array" as const },
  { key: "rules" as const, label: "Regeln", type: "string" as const },
  { key: "reasoning" as const, label: "Denkweise", type: "select" as const },
  { key: "verification" as const, label: "Selbstprfg.", type: "boolean" as const },
  { key: "reversePrompt" as const, label: "Reverse", type: "boolean" as const },
  { key: "negatives" as const, label: "Negativ", type: "string" as const },
];

const REASONING_OPTIONS = [
  { value: "", label: "Keine" },
  { value: "step-by-step", label: "Schritt für Schritt" },
  { value: "pros-cons", label: "Vor- und Nachteile" },
  { value: "perspectives", label: "Mehrere Perspektiven" },
  { value: "tree-of-thought", label: "Lösungswege vergleichen" },
];

interface VariableComboInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  kiOptions: string[];
  kiLoading: boolean;
  onLoadMore: () => void;
  kiLoaded: boolean;
}

function VariableComboInput({ label, value, onChange, kiOptions, kiLoading, onLoadMore, kiLoaded }: VariableComboInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filled = value.trim().length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter suggestions by input
  const filtered = kiOptions.filter(s =>
    !value.trim() || s.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div ref={ref} className="flex-1 min-w-[100px] relative">
      <label className={cn(
        "text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1",
        filled ? "text-primary" : "text-muted-foreground"
      )}>
        {filled && <span>✓</span>}
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Eintippen oder auswählen..."
          className={cn(
            "w-full h-7 text-xs pl-2 pr-7 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors",
            filled
              ? "border-primary/30 bg-primary/5"
              : open ? "border-primary" : "border-border"
          )}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors border-b border-border/40 last:border-b-0"
              >
                {s}
              </button>
            ))
          ) : (
            <div className="px-2.5 py-2 text-xs text-muted-foreground italic">
              Keine Treffer — eigenen Wert eintippen
            </div>
          )}
          {/* "Mehr Vorschläge" — lädt KI-Optionen */}
          {!kiLoaded && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLoadMore(); }}
              disabled={kiLoading}
              className="w-full text-left px-2.5 py-2 text-xs border-t border-border bg-primary/5 text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
            >
              {kiLoading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Generiere Vorschläge...</>
              ) : (
                <><Wand2 className="w-3 h-3" /> Mehr Vorschläge laden</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const ACTABuilder = ({
  fields,
  onFieldsChange,
  onSendToPlayground,
  isOpen,
  onToggle,
  bare,
  mode,
  selectedModel,
  layout,
  sourceTitle,
  isExpanded: isExpandedProp,
  onExpandedChange,
  confidentiality,
  onReset,
}: ACTABuilderProps) => {
  const [internalOpen, setInternalOpen] = useState(true);
  const effectiveOpen = isOpen !== undefined ? isOpen : internalOpen;
  const effectiveToggle = onToggle || (() => setInternalOpen(prev => !prev));

  const { scope } = useOrgContext();
  const templateGroups = useMemo(() => getLibraryTemplates(scope), [scope]);

  const isExperte = mode === "experte";
  const fieldConfig = isExperte ? RAKETE_FIELDS : ACTA_FIELDS;
  const frameworkName = isExperte ? "RAKETE" : "ACTA";
  const ext = fields.extensions ?? EMPTY_EXTENSIONS;
  const updateExtensions = (updated: ACTAExtensions) => {
    onFieldsChange({ ...fields, extensions: updated });
  };
  const hasActiveExtensions =
    ext.examples.some(e => e.trim()) ||
    ext.rules.trim() !== "" ||
    (ext.reasoning !== "" && ext.reasoning !== "none") ||
    ext.verification ||
    ext.reversePrompt ||
    ext.negatives.trim() !== "";

  const { suggest, improve, fillVariables, suggestVariableOptions, isLoading: aiLoading } = useACTAAssist();
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestInput, setSuggestInput] = useState("");

  // Inline prompt evaluation (auto-triggered from Prüfen popover)
  const [evalResult, setEvalResult] = useState<{ hasContext: boolean; isSpecific: boolean; hasConstraints: boolean; feedback: string } | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const evalMaxScore = isExperte ? 5 : 3;
  const evalScore = evalResult ? [
    evalResult.hasContext,
    evalResult.isSpecific,
    evalResult.hasConstraints,
    ...(isExperte ? [
      !!(ext.verificationNote || "").trim(),
      !!(ext.negatives || "").trim(),
    ] : []),
  ].filter(Boolean).length : 0;

  const evaluatePrompt = async (promptText: string) => {
    if (!promptText.trim() || evalLoading) return;
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Bitte melde dich an."); setEvalLoading(false); return; }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            userPrompt: promptText,
            badPrompt: "Ein unspezifischer Prompt ohne Kontext.",
            context: "Freie Prompt-Bewertung im Playground",
            goodExample: "",
            improvementHints: ["Kontext hinzufügen", "Spezifischer werden", "Constraints definieren"],
            model: "google/gemini-3-flash-preview",
          }),
        }
      );
      if (!resp.ok) {
        if (resp.status === 402) toast.error("KI-Budget aufgebraucht.");
        else if (resp.status === 429) toast.error("Zu viele Anfragen. Bitte warte kurz.");
        else toast.error("Bewertung fehlgeschlagen.");
        setEvalLoading(false);
        return;
      }
      setEvalResult(await resp.json());
    } catch {
      toast.error("Verbindungsfehler bei der Bewertung.");
    }
    setEvalLoading(false);
  };

  // Variablen-Erkennung
  const allFieldsText = `${fields.act} ${fields.context} ${fields.task} ${fields.ausgabe} ${ext.verificationNote || ""} ${ext.negatives || ""}`;
  const variables = useMemo(() => extractVariables(allFieldsText), [allFieldsText]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const hasUnfilledVars = variables.length > 0 && variables.some(v => !variableValues[v]?.trim());
  const hasEmptyRaketeFields = isExperte && (
    !(ext.verificationNote || "").trim() || !(ext.negatives || "").trim()
  );

  const baseFilledCount = FIELD_CONFIG.filter((f) => fields[f.key].trim().length > 10).length;
  const raketeFilledCount = isExperte ? (
    ((ext.verificationNote || "").trim().length > 5 ? 1 : 0) +
    ((ext.negatives || "").trim().length > 5 ? 1 : 0)
  ) : 0;
  const filledCount = baseFilledCount + raketeFilledCount;
  const assembled = assembleACTAPrompt(fields, variableValues);
  const hasContent = assembled.trim().length > 0;

  // Horizontal layout state — controlled/uncontrolled pattern
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = isExpandedProp !== undefined ? isExpandedProp : internalExpanded;
  const setExpanded = (val: boolean) => {
    if (onExpandedChange) onExpandedChange(val);
    else setInternalExpanded(val);
  };
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [extensionsOpen, setExtensionsOpen] = useState(false);

  // KI-Vorschläge für Variablen (Combobox) — sessionStorage-Cache pro Template
  const cacheKey = sourceTitle ? `acta-suggestions::${sourceTitle}` : null;
  const [variableOptions, setVariableOptions] = useState<Record<string, string[]>>(() => {
    if (!cacheKey) return {};
    try {
      const cached = sessionStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  const [kiOptionsLoaded, setKiOptionsLoaded] = useState(() => {
    if (!cacheKey) return false;
    try { return !!sessionStorage.getItem(cacheKey); }
    catch { return false; }
  });

  // Cache bei Template-Wechsel laden/zurücksetzen
  useEffect(() => {
    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setVariableOptions(JSON.parse(cached));
          setKiOptionsLoaded(true);
          return;
        }
      } catch { /* ignore */ }
    }
    setVariableOptions({});
    setKiOptionsLoaded(false);
  }, [cacheKey, variables.join(",")]);

  const handleLoadMoreOptions = async () => {
    if (kiOptionsLoaded || aiLoading) return;
    const result = await suggestVariableOptions(variables, fields, selectedModel);
    if (result) {
      setVariableOptions(result);
      setKiOptionsLoaded(true);
      if (cacheKey) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify(result)); }
        catch { /* sessionStorage voll — ignorieren */ }
      }
    }
  };

  const updateField = (key: "act" | "context" | "task" | "ausgabe", value: string) => {
    onFieldsChange({ ...fields, [key]: value });
  };

  const handleTemplateSelect = (value: string) => {
    const [groupLabel, idxStr] = value.split("::");
    const idx = parseInt(idxStr, 10);
    const group = templateGroups.find(g => g.label === groupLabel);
    const template = group?.templates[idx];
    if (template) {
      onFieldsChange({ ...template.fields });
      setVariableValues({});
    }
  };

  const handleSend = () => {
    if (!hasContent) return;
    onSendToPlayground(assembled);
    setExpanded(false);
  };

  const handleCopy = () => {
    if (!hasContent) return;
    navigator.clipboard.writeText(assembled);
    toast.success("Prompt kopiert!");
  };

  const isChipActive = (key: string): boolean => {
    switch (key) {
      case "examples": return ext.examples.some(e => e.trim());
      case "rules": return ext.rules.trim() !== "";
      case "reasoning": return ext.reasoning !== "" && ext.reasoning !== "none";
      case "verification": return ext.verification;
      case "reversePrompt": return ext.reversePrompt;
      case "negatives": return ext.negatives.trim() !== "";
      default: return false;
    }
  };

  const handleChipClick = (chip: typeof EXTENSION_CHIPS[number]) => {
    if (chip.type === "boolean") {
      const key = chip.key as "verification" | "reversePrompt";
      updateExtensions({ ...ext, [key]: !ext[key] });
    } else {
      setActiveChip(activeChip === chip.key ? null : chip.key);
    }
  };

  // ── Horizontal layout (desktop) ──
  if (layout === "horizontal") {
    return (
      <div className={cn(
        "bg-background transition-shadow flex flex-col",
        expanded ? "border-b border-border shadow-sm" : "shadow-sm"
      )}>
        {/* Header row — click to collapse/expand, always visible */}
        <div
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none transition-colors shrink-0",
            expanded
              ? "hover:bg-muted/30"
              : "bg-muted/40 hover:bg-muted/60 dark:bg-muted/20 dark:hover:bg-muted/30"
          )}
        >
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            !expanded && "-rotate-90"
          )} />
          <span className="text-xs font-bold shrink-0">{frameworkName}</span>
          {sourceTitle && (
            <span className="text-xs text-primary font-medium truncate min-w-0 flex-1">{sourceTitle}</span>
          )}
          {confidentiality && confidentiality !== "open" && (
            <ConfidentialityBadge level={confidentiality} compact />
          )}
          {/* Offene Variablen-Warnung — nur collapsed */}
          {!expanded && variables.length > 0 && hasUnfilledVars && (
            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600">
              {variables.filter(v => !variableValues[v]?.trim()).length} offen
            </Badge>
          )}

          {/* Spacer — drückt Reset nach rechts */}
          <div className="flex-1" />
          {/* Reset — nur wenn Felder befüllt */}
          {hasContent && onReset && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-[10px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors shrink-0 mr-1"
              title={`${frameworkName}-Felder leeren und neu beginnen`}
            >
              <RotateCcw className="w-3 h-3" /> Neu
            </button>
          )}
        </div>

        {expanded && (
          <div className="px-4 pb-3 space-y-2">
            {/* KI-Suggest Eingabe — wenn aktiv */}
            {isExperte && showSuggest && (
              <div data-tour="acta-ki-suggest" className="bg-primary/5 border border-primary/15 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Beschreibe kurz was du brauchst:</span>
                  <button
                    type="button"
                    onClick={() => { setShowSuggest(false); setSuggestInput(""); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Schließen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Textarea
                  value={suggestInput}
                  onChange={(e) => setSuggestInput(e.target.value)}
                  placeholder="z.B. 'Pressemitteilung für die Eröffnung eines neuen Bürgerservice-Zentrums'"
                  className="text-xs min-h-[48px] resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="w-full text-xs h-7"
                  disabled={!suggestInput.trim() || aiLoading}
                  onClick={async () => {
                    const result = await suggest(suggestInput, selectedModel, mode);
                    if (result) {
                      onFieldsChange(result);
                      setVariableValues({});
                      setShowSuggest(false);
                      setSuggestInput("");
                    }
                  }}
                >
                  {aiLoading ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generiert...</>
                  ) : (
                    <><Wand2 className="w-3 h-3 mr-1" /> {frameworkName} generieren</>
                  )}
                </Button>
              </div>
            )}

            {/* ACTA/RAKETE Cards */}
            <div
              data-tour="acta-fields"
              className={cn(
                "grid gap-2",
                isExperte ? "grid-cols-3" : "grid-cols-4"
              )}
            >
              {fieldConfig.map((field) => {
                const isExtField = "isExtension" in field && field.isExtension;
                const isNewField = "isNew" in field && field.isNew;
                let value: string;
                let onChange: (val: string) => void;
                if (isExtField && field.key === "verification") {
                  value = ext.verificationNote || "";
                  onChange = (val) => {
                    updateExtensions({
                      ...ext,
                      verification: val.trim().length > 0,
                      verificationNote: val,
                    });
                  };
                } else if (isExtField && field.key === "negatives") {
                  value = ext.negatives || "";
                  onChange = (val) => updateExtensions({ ...ext, negatives: val });
                } else {
                  value = (fields[field.key as keyof typeof fields] as string) || "";
                  onChange = (val) => updateField(field.key as "act" | "context" | "task" | "ausgabe", val);
                }
                return (
                  <ACTACard
                    key={field.key}
                    icon={field.icon}
                    shortLabel={field.letter}
                    longLabel={field.label}
                    sublabel={field.sublabel}
                    value={value}
                    onChange={onChange}
                    placeholder={field.placeholder}
                    isNew={isNewField}
                  />
                );
              })}
            </div>

            {/* ═══ NUDGE BAR — Was als nächstes? ═══ */}
            {(variables.length > 0 || isExperte) && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border-l-[3px] transition-all",
                (hasUnfilledVars || hasEmptyRaketeFields)
                  ? "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500 dark:border-l-amber-400"
                  : "bg-primary/10 border-l-primary"
              )}>
                {hasUnfilledVars ? (
                  <>
                    <span className="text-sm">👋</span>
                    <span className="text-xs font-semibold text-foreground">
                      Noch {variables.filter(v => !variableValues[v]?.trim()).length} {variables.filter(v => !variableValues[v]?.trim()).length === 1 ? "Angabe" : "Angaben"} offen
                    </span>
                    <span className="text-xs text-muted-foreground">— fülle die Felder unten aus</span>
                  </>
                ) : hasEmptyRaketeFields ? (
                  <>
                    <span className="text-sm">💡</span>
                    <span className="text-xs font-semibold text-foreground">
                      RAKETE-Tipp: Fülle auch
                      {!(ext.verificationNote || "").trim() && !(ext.negatives || "").trim()
                        ? ' „Teste" und „Einschränkungen"'
                        : !(ext.verificationNote || "").trim()
                          ? ' „Teste"'
                          : ' „Einschränkungen"'
                      }
                      {" "}für bessere Ergebnisse
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">✅</span>
                    <span className="text-xs font-semibold text-primary">Prompt vollständig — bereit zum Senden</span>
                  </>
                )}
              </div>
            )}
            {/* ═══ VARIABLEN — Combobox-Inputs ═══ */}
            {variables.length > 0 && (
              <div data-tour="acta-variables" className="flex items-end gap-2 flex-wrap relative z-10">
                {variables.map((v) => (
                  <VariableComboInput
                    key={v}
                    label={v}
                    value={variableValues[v] || ""}
                    onChange={(val) => setVariableValues(prev => ({ ...prev, [v]: val }))}
                    kiOptions={variableOptions[v] || []}
                    kiLoading={aiLoading}
                    onLoadMore={handleLoadMoreOptions}
                    kiLoaded={kiOptionsLoaded}
                  />
                ))}
              </div>
            )}

            {/* ═══ ACTIONS + PROGRESSIVE DISCLOSURE ═══ */}
            <div className="flex items-center gap-1.5">
              {/* ▸ Erweiterte Optionen — nur Experte */}
              {isExperte && (
                <button
                  type="button"
                  onClick={() => setExtensionsOpen(!extensionsOpen)}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors"
                >
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-transform",
                    extensionsOpen && "rotate-90"
                  )} />
                  Erweiterte Optionen
                </button>
              )}
              {!isExperte && <div className="flex-1" />}
              <div className="flex-1" />
              {/* Action Buttons */}
              <div className="flex gap-1.5 shrink-0" data-tour="acta-send">
                {/* ✨ Vorschlagen — nur Experte, nur wenn kein sourceTitle (leeres Template) */}
                {isExperte && !sourceTitle && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    title={`KI füllt ${frameworkName}-Felder basierend auf deiner Beschreibung aus`}
                    onClick={() => setShowSuggest(!showSuggest)}
                  >
                    <Wand2 className="w-3 h-3" /> Vorschlagen
                  </Button>
                )}
                {/* 🔍 Prüfen — nur Experte + Inhalt */}
                {isExperte && hasContent && (
                  <Popover onOpenChange={(open) => { if (open) evaluatePrompt(assembled); }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        title="Prompt auf Qualität prüfen und Verbesserungsvorschläge erhalten"
                      >
                        <Search className="w-3 h-3" /> Prüfen
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[380px] max-h-[450px] overflow-y-auto p-4 space-y-3">
                      <h4 className="text-sm font-semibold">Prompt-Qualität prüfen</h4>
                      {evalLoading && (
                        <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Wird geprüft...</span>
                        </div>
                      )}
                      {evalResult && (
                        <Card className="p-3 space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold">Prompt-Check</span>
                            <span className={cn(
                              "text-xs font-bold",
                              evalScore === evalMaxScore ? "text-primary" : evalScore >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {evalScore}/{evalMaxScore}
                            </span>
                          </div>
                          {[
                            { label: "Kontext", met: evalResult.hasContext },
                            { label: "Spezifik", met: evalResult.isSpecific },
                            { label: "Constraints", met: evalResult.hasConstraints },
                            ...(isExperte ? [
                              { label: "Teste (Selbstprüfung)", met: !!(ext.verificationNote || "").trim() },
                              { label: "Einschränkungen", met: !!(ext.negatives || "").trim() },
                            ] : []),
                          ].map((c) => (
                            <div key={c.label}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
                                <span className={cn("text-[11px] font-semibold", c.met ? "text-primary" : "text-red-600 dark:text-red-400")}>
                                  {c.met ? "✓ Gut" : "✗ Fehlt"}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-500", c.met ? "bg-primary w-full" : "bg-red-500/60 w-[15%]")} />
                              </div>
                            </div>
                          ))}
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{evalResult.feedback}</p>
                        </Card>
                      )}
                      {evalResult && evalScore === evalMaxScore && (
                        <p className="text-xs text-primary font-medium text-center py-1">✓ Dein Prompt erfüllt alle Kriterien.</p>
                      )}
                      {evalResult && evalScore < evalMaxScore && (
                        <div className="border-t border-border pt-3">
                          <Button
                            onClick={async () => {
                              const result = await improve(fields, selectedModel, mode);
                              if (result) { onFieldsChange(result); setVariableValues({}); }
                            }}
                            disabled={aiLoading}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-7 gap-1.5"
                          >
                            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Verbesserungsvorschläge übernehmen
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
                {/* → An KI senden — disabled wenn Variablen offen */}
                <Button
                  onClick={handleSend}
                  disabled={!hasContent || hasUnfilledVars}
                  size="sm"
                  className="text-xs h-7 gap-1"
                >
                  <Send className="w-3 h-3" /> An KI senden
                </Button>
                {/* 📋 Kopieren */}
                <Button
                  onClick={handleCopy}
                  disabled={!hasContent}
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Assemblierten Prompt in die Zwischenablage kopieren"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {/* ═══ EXTENSIONS — nur wenn aufgeklappt ═══ */}
            {isExperte && extensionsOpen && (
              <div className="bg-muted/30 border border-border rounded-lg p-2.5 space-y-2">
                {/* Extension Chips — in Experte mode, hide verification/negatives (they are cards now) */}
                <div className="flex gap-1 flex-wrap" data-tour="acta-extensions">
                  {(isExperte
                    ? EXTENSION_CHIPS.filter(c => c.key !== "verification" && c.key !== "negatives")
                    : EXTENSION_CHIPS
                  ).map((chip) => {
                    const active = isChipActive(chip.key);
                    return (
                      <button
                        key={chip.key}
                        onClick={() => handleChipClick(chip)}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border transition-colors font-medium",
                          active
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {active ? "✓ " : "+ "}{chip.label}
                      </button>
                    );
                  })}
                </div>
                {/* Active Chip Input Area */}
                {activeChip === "examples" && (
                  <div className="bg-muted/30 border border-border rounded-md p-2.5 space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Zeige der KI 1–3 Beispiele (Few-Shot):</p>
                    {ext.examples.map((ex, i) => (
                      <div key={i} className="flex gap-1.5 items-start">
                        <Textarea
                          value={ex}
                          onChange={(e) => {
                            const updated = ext.examples.map((v, j) => j === i ? e.target.value : v);
                            updateExtensions({ ...ext, examples: updated });
                          }}
                          placeholder={`Beispiel ${i + 1}...`}
                          className="text-xs min-h-[40px] resize-none flex-1"
                          rows={2}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 mt-1"
                          onClick={() => updateExtensions({ ...ext, examples: ext.examples.filter((_, j) => j !== i) })}
                        >
                          <span className="text-xs">✕</span>
                        </Button>
                      </div>
                    ))}
                    {ext.examples.length < 3 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 w-full"
                        onClick={() => updateExtensions({ ...ext, examples: [...ext.examples, ""] })}
                      >
                        + Beispiel hinzufügen
                      </Button>
                    )}
                  </div>
                )}
                {activeChip === "rules" && (
                  <Textarea
                    value={ext.rules}
                    onChange={(e) => updateExtensions({ ...ext, rules: e.target.value })}
                    placeholder="Wichtige Regeln und Einschränkungen..."
                    className="text-xs"
                    rows={2}
                  />
                )}
                {activeChip === "reasoning" && (
                  <select
                    value={ext.reasoning || ""}
                    onChange={(e) => updateExtensions({ ...ext, reasoning: e.target.value })}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-background w-full focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {REASONING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
                {activeChip === "negatives" && (
                  <Textarea
                    value={ext.negatives}
                    onChange={(e) => updateExtensions({ ...ext, negatives: e.target.value })}
                    placeholder="Was die KI NICHT tun soll..."
                    className="text-xs"
                    rows={2}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Vertical layout (existing sidebar / mobile) ──
  const verticalContent = (
    <div className="px-4 pb-4 space-y-4" data-feedback-ref="prompt-labor.acta-baukasten.content" data-feedback-label="ACTA-Baukasten Inhalt">
      <div data-tour="acta-template-select">
      <Select onValueChange={handleTemplateSelect}>
        <SelectTrigger className="w-full text-xs">
          <SelectValue placeholder="Vorlage aus Sammlung laden..." />
        </SelectTrigger>
        <SelectContent className="max-h-[280px] z-[120]">
          {templateGroups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {group.label}
              </SelectLabel>
              {group.templates.map((t, i) => (
                <SelectItem key={`${group.label}-${i}`} value={`${group.label}::${i}`}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      </div>

      {isExperte && (
        <div data-tour="acta-ki-suggest" className="space-y-2">
          <button
            type="button"
            onClick={() => setShowSuggest(!showSuggest)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Wand2 className="w-3 h-3" />
            KI: {frameworkName}-Felder vorschlagen lassen
          </button>
          {showSuggest && (
            <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Beschreibe kurz was du brauchst:</span>
                <button
                  type="button"
                  onClick={() => { setShowSuggest(false); setSuggestInput(""); }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  title="Schließen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <Textarea
                value={suggestInput}
                onChange={(e) => setSuggestInput(e.target.value)}
                placeholder="z.B. 'Pressemitteilung für die Eröffnung eines neuen Bürgerservice-Zentrums'"
                className="text-xs min-h-[48px] resize-none"
                rows={2}
              />
              <Button
                size="sm"
                className="w-full text-xs h-7"
                disabled={!suggestInput.trim() || aiLoading}
                onClick={async () => {
                  const result = await suggest(suggestInput, selectedModel, mode);
                  if (result) {
                    onFieldsChange(result);
                    setVariableValues({});
                    setShowSuggest(false);
                    setSuggestInput("");
                  }
                }}
              >
                {aiLoading ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generiert...</>
                ) : (
                  <><Wand2 className="w-3 h-3 mr-1" /> {frameworkName} generieren</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <div data-tour="acta-fields" className="space-y-4">
      {fieldConfig.map((field) => {
        const isExtField = "isExtension" in field && field.isExtension;
        const isNewField = "isNew" in field && field.isNew;
        let value: string;
        let onChange: (val: string) => void;
        const placeholder: string = field.placeholder;
        if (isExtField && field.key === "verification") {
          value = ext.verificationNote || "";
          onChange = (val) => updateExtensions({ ...ext, verification: val.trim().length > 0, verificationNote: val });
        } else if (isExtField && field.key === "negatives") {
          value = ext.negatives || "";
          onChange = (val) => updateExtensions({ ...ext, negatives: val });
        } else {
          value = (fields[field.key as keyof typeof fields] as string) || "";
          onChange = (val) => updateField(field.key as "act" | "context" | "task" | "ausgabe", val);
        }
        const Icon = "icon" in field && typeof field.icon === "function" ? field.icon : null;
        const isFilled = value.trim().length > 10;

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              {Icon ? <Icon className="w-4 h-4 text-primary" /> : <span className="text-sm">{field.icon}</span>}
              <label className="text-xs font-medium">{"label" in field ? field.label : ""}</label>
              {isNewField && !value.trim() ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto text-primary border-primary/30 animate-pulse">
                  NEU
                </Badge>
              ) : (
                <Badge
                  variant={isFilled ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 ml-auto"
                >
                  {isFilled ? "✓" : "–"}
                </Badge>
              )}
            </div>
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="text-xs min-h-[72px] resize-none"
              rows={3}
            />
            {!isExtField && isExperte && field.key === "context" && <ContextExtensions extensions={ext} onChange={updateExtensions} />}
            {!isExtField && isExperte && field.key === "task" && <TaskExtensions extensions={ext} onChange={updateExtensions} />}
            {!isExtField && isExperte && field.key === "ausgabe" && <AusgabeExtensions extensions={ext} onChange={updateExtensions} />}
          </div>
        );
      })}
      </div>

      {variables.length > 0 && (
        <div data-tour="acta-variables" className="bg-muted/30 border border-border rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground">
              Angaben ausfüllen ({variables.filter(v => variableValues[v]?.trim()).length}/{variables.length})
            </p>
            {hasUnfilledVars && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 gap-1 text-primary"
                disabled={aiLoading}
                onClick={async () => {
                  const result = await fillVariables(
                    variables.filter(v => !variableValues[v]?.trim()),
                    fields,
                    selectedModel,
                  );
                  if (result) {
                    setVariableValues(prev => ({ ...prev, ...result }));
                  }
                }}
              >
                {aiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                Beispielwerte
              </Button>
            )}
          </div>
          {variables.map((v) => (
            <div key={v} className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] shrink-0 font-mono">
                {v}
              </Badge>
              <input
                type="text"
                value={variableValues[v] || ""}
                onChange={(e) => setVariableValues(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder={`z.B. ...`}
                className="flex-1 h-7 text-xs px-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mb-1">
        {fieldConfig.map((field, i) => {
          const isExtField = "isExtension" in field && field.isExtension;
          let filled: boolean;
          if (isExtField && field.key === "verification") {
            filled = (ext.verificationNote || "").trim().length > 10;
          } else if (isExtField && field.key === "negatives") {
            filled = (ext.negatives || "").trim().length > 10;
          } else {
            filled = ((fields[field.key as keyof typeof fields] as string) || "").trim().length > 10;
          }
          const stepLabel = "label" in field ? field.label : field.key;
          return (
            <div key={field.key} className="flex items-center">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors",
                filled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {filled ? "✓" : i + 1}
              </div>
              <span className={cn(
                "text-[10px] ml-1 font-medium",
                filled ? "text-foreground" : "text-muted-foreground"
              )}>
                {stepLabel}
              </span>
              {i < fieldConfig.length - 1 && <div className={cn(
                "w-4 h-0.5 mx-1.5 transition-colors",
                filled ? "bg-primary" : "bg-muted"
              )} />}
            </div>
          );
        })}
      </div>

      {hasContent && (
        <Card data-tour="acta-preview" className="p-3 bg-background/50">
          <p className="text-xs font-medium text-muted-foreground mb-1">Vorschau:</p>
          {hasUnfilledVars && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1.5">
              {variables.filter(v => !variableValues[v]?.trim()).length} Angabe{variables.filter(v => !variableValues[v]?.trim()).length > 1 ? "n" : ""} noch offen
            </p>
          )}
          <p className="text-xs whitespace-pre-wrap leading-relaxed">{assembled}</p>
        </Card>
      )}

      <div data-tour="acta-send" className="flex gap-2">
        {isExperte && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            title={`KI füllt ${frameworkName}-Felder basierend auf deiner Beschreibung aus`}
            onClick={() => setShowSuggest(!showSuggest)}
          >
            <Wand2 className="w-3 h-3" /> {frameworkName} Inhalte vorschlagen
          </Button>
        )}
        {isExperte && hasContent && (
          <Popover onOpenChange={(open) => { if (open) evaluatePrompt(assembled); }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                title="Prompt auf Qualität prüfen und Verbesserungsvorschläge erhalten"
              >
                <Search className="w-3 h-3" /> Prüfen
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[380px] max-h-[450px] overflow-y-auto p-4 space-y-3">
              <h4 className="text-sm font-semibold">Prompt-Qualität prüfen</h4>
              {evalLoading && (
                <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Wird geprüft...</span>
                </div>
              )}
              {evalResult && (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold">Prompt-Check</span>
                    <span className={cn(
                      "text-xs font-bold",
                      evalScore === evalMaxScore ? "text-primary" : evalScore >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {evalScore}/{evalMaxScore}
                    </span>
                  </div>
                  {[
                    { label: "Kontext", met: evalResult.hasContext },
                    { label: "Spezifik", met: evalResult.isSpecific },
                    { label: "Constraints", met: evalResult.hasConstraints },
                    ...(isExperte ? [
                      { label: "Teste (Selbstprüfung)", met: !!(ext.verificationNote || "").trim() },
                      { label: "Einschränkungen", met: !!(ext.negatives || "").trim() },
                    ] : []),
                  ].map((c) => (
                    <div key={c.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
                        <span className={cn("text-[11px] font-semibold", c.met ? "text-primary" : "text-red-600 dark:text-red-400")}>
                          {c.met ? "✓ Gut" : "✗ Fehlt"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", c.met ? "bg-primary w-full" : "bg-red-500/60 w-[15%]")} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{evalResult.feedback}</p>
                </Card>
              )}
              {evalResult && evalScore === evalMaxScore && (
                <p className="text-xs text-primary font-medium text-center py-1">✓ Dein Prompt erfüllt alle Kriterien.</p>
              )}
              {evalResult && evalScore < evalMaxScore && (
                <div className="border-t border-border pt-3">
                  <Button
                    onClick={async () => {
                      const result = await improve(fields, selectedModel, mode);
                      if (result) { onFieldsChange(result); setVariableValues({}); }
                    }}
                    disabled={aiLoading}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 gap-1.5"
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Verbesserungsvorschläge übernehmen
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
        <Button onClick={handleSend} disabled={!hasContent} className="flex-1" size="sm">
          <Send className="w-3 h-3 mr-1.5" />
          An KI senden
        </Button>
        <Button
          onClick={handleCopy}
          disabled={!hasContent}
          variant="outline"
          size="sm"
          title="Assemblierten Prompt in die Zwischenablage kopieren"
        >
          <Copy className="w-3 h-3 mr-1.5" />
          Kopieren
        </Button>
      </div>
    </div>
  );

  if (bare) return verticalContent;

  return (
    <Collapsible open={effectiveOpen} onOpenChange={effectiveToggle} data-feedback-ref="prompt-labor.acta-baukasten" data-feedback-label="ACTA-Baukasten">
      <div className="bg-gradient-card rounded-xl border border-border shadow-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/50 rounded-t-xl transition-colors">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{frameworkName}-Baukasten</span>
            <Badge variant="secondary" className="text-xs">
              {filledCount}/{isExperte ? 6 : 4}{hasActiveExtensions ? " +" : ""}
            </Badge>
          </div>
          {effectiveOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {verticalContent}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
