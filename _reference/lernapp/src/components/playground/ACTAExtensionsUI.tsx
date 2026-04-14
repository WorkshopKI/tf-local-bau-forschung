import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, BookCopy, ShieldCheck, Brain, Ban, ListChecks, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ACTAExtensions } from "./ACTATemplates";

// ── Generischer aufklappbarer Block ──

interface ExtensionBlockProps {
  icon: React.ReactNode;
  label: string;
  summary?: string;
  active?: boolean;
  children: React.ReactNode;
}

function ExtensionBlock({ icon, label, summary, active, children }: ExtensionBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-6 border-l-2 border-border pl-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full py-1.5 text-left rounded-md transition-colors",
          "hover:bg-muted/50 -ml-1 px-1",
          active && "text-primary"
        )}
      >
        {open ? <Minus className="w-3 h-3 text-muted-foreground shrink-0" /> : <Plus className="w-3 h-3 text-muted-foreground shrink-0" />}
        <span className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-medium">{label}</span>
        </span>
        {!open && summary && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 ml-auto">
            {summary}
          </Badge>
        )}
      </button>
      {open && <div className="mt-2 mb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Einzelne Extensions ──

function ExamplesExtension({ examples, onChange }: { examples: string[]; onChange: (v: string[]) => void }) {
  const filledCount = examples.filter(e => e.trim()).length;

  return (
    <ExtensionBlock icon={<BookCopy className="w-3 h-3" />} label="Beispiele (Few-Shot)" summary={filledCount > 0 ? `${filledCount} Bsp.` : undefined} active={filledCount > 0}>
      <p className="text-[10px] text-muted-foreground mb-2">Zeige der KI 1–3 Beispiele, damit sie das gewünschte Muster erkennt.</p>
      {examples.map((ex, i) => (
        <div key={i} className="flex gap-1.5 items-start">
          <Textarea value={ex} onChange={(e) => onChange(examples.map((v, j) => j === i ? e.target.value : v))} placeholder={`Beispiel ${i + 1}...`} className="text-[11px] min-h-[40px] resize-none flex-1" rows={2} />
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-1" onClick={() => onChange(examples.filter((_, j) => j !== i))}><Minus className="w-3 h-3" /></Button>
        </div>
      ))}
      {examples.length < 3 && (
        <Button variant="outline" size="sm" className="text-[10px] h-6 w-full" onClick={() => onChange([...examples, ""])}><Plus className="w-3 h-3 mr-1" /> Beispiel hinzufügen</Button>
      )}
    </ExtensionBlock>
  );
}

function RulesExtension({ rules, onChange }: { rules: string; onChange: (v: string) => void }) {
  return (
    <ExtensionBlock icon={<ListChecks className="w-3 h-3" />} label="Regeln & Einschränkungen" summary={rules.trim() ? "aktiv" : undefined} active={!!rules.trim()}>
      <p className="text-[10px] text-muted-foreground mb-2">Explizite Regeln, die die KI einhalten muss (Compliance, Formatregeln, Sprache).</p>
      <Textarea value={rules} onChange={(e) => onChange(e.target.value)} placeholder="z.B. Gendersensible Sprache. Keine Fachbegriffe ohne Erklärung. Sprachniveau B1..." className="text-[11px] min-h-[48px] resize-none" rows={2} />
    </ExtensionBlock>
  );
}

function ReasoningExtension({ reasoning, onChange }: { reasoning: string; onChange: (v: string) => void }) {
  const options = [
    { value: "none", label: "Keine Vorgabe" },
    { value: "step-by-step", label: "Schritt für Schritt (Chain-of-Thought)" },
    { value: "pros-cons", label: "Vor- & Nachteile abwägen" },
    { value: "perspectives", label: "Mehrere Perspektiven einnehmen" },
    { value: "tree-of-thought", label: "Mehrere Lösungswege parallel (Tree-of-Thought)" },
  ];
  const activeLabel = options.find(o => o.value === reasoning)?.label.split(" (")[0];

  return (
    <ExtensionBlock icon={<Brain className="w-3 h-3" />} label="Denkweise festlegen" summary={reasoning && reasoning !== "none" ? activeLabel : undefined} active={!!reasoning && reasoning !== "none"}>
      <p className="text-[10px] text-muted-foreground mb-2">Bestimme, wie die KI an die Aufgabe herangehen soll.</p>
      <Select value={reasoning || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger className="text-[11px] h-8"><SelectValue placeholder="Denkstrategie wählen..." /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (<SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </ExtensionBlock>
  );
}

function VerificationExtension({ enabled, note, onToggle, onNoteChange }: { enabled: boolean; note: string; onToggle: (v: boolean) => void; onNoteChange: (v: string) => void }) {
  return (
    <ExtensionBlock icon={<ShieldCheck className="w-3 h-3" />} label="Selbstprüfung einbauen" summary={enabled ? "aktiv" : undefined} active={enabled}>
      <p className="text-[10px] text-muted-foreground mb-2">Die KI prüft ihre eigene Antwort auf Fehler und Schwachstellen.</p>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} className="scale-75" />
        <span className="text-[11px]">{enabled ? "Selbstprüfung aktiv" : "Aus"}</span>
      </div>
      {enabled && (
        <Textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="Optional: Spezifische Prüfanweisung, z.B. 'Prüfe auf Datenschutz-Verstöße und sachliche Korrektheit'" className="text-[11px] min-h-[40px] resize-none mt-2" rows={2} />
      )}
    </ExtensionBlock>
  );
}

function ReversePromptExtension({ enabled, onToggle }: { enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <ExtensionBlock icon={<Repeat className="w-3 h-3" />} label="Reverse Prompting" summary={enabled ? "aktiv" : undefined} active={enabled}>
      <p className="text-[10px] text-muted-foreground mb-2">Die KI entwirft zuerst den idealen Prompt für deine Aufgabe und führt ihn dann selbst aus. Besonders effektiv bei komplexen Aufgaben.</p>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} className="scale-75" />
        <span className="text-[11px]">{enabled ? "KI entwirft zuerst den Prompt" : "Aus"}</span>
      </div>
    </ExtensionBlock>
  );
}

function NegativesExtension({ negatives, onChange }: { negatives: string; onChange: (v: string) => void }) {
  return (
    <ExtensionBlock icon={<Ban className="w-3 h-3" />} label="Negativ-Constraints" summary={negatives.trim() ? "aktiv" : undefined} active={!!negatives.trim()}>
      <p className="text-[10px] text-muted-foreground mb-2">Was die KI explizit NICHT tun soll. Verhindert typische Fehler.</p>
      <Textarea value={negatives} onChange={(e) => onChange(e.target.value)} placeholder="z.B. Keine Zusammenfassung. Keine Aufzählungszeichen. Keine Spekulationen..." className="text-[11px] min-h-[48px] resize-none" rows={2} />
    </ExtensionBlock>
  );
}

// ── Exportierte Wrapper (werden im ACTABuilder zwischen die Felder geschoben) ──

interface ACTAExtensionsProps {
  extensions: ACTAExtensions;
  onChange: (ext: ACTAExtensions) => void;
}

/** Erweiterungen unter dem Context-Feld */
export function ContextExtensions({ extensions, onChange }: ACTAExtensionsProps) {
  return (
    <div data-tour="acta-extensions">
      <ExamplesExtension examples={extensions.examples} onChange={(examples) => onChange({ ...extensions, examples })} />
      <RulesExtension rules={extensions.rules} onChange={(rules) => onChange({ ...extensions, rules })} />
    </div>
  );
}

/** Erweiterungen unter dem Task-Feld */
export function TaskExtensions({ extensions, onChange }: ACTAExtensionsProps) {
  return (
    <>
      <ReasoningExtension reasoning={extensions.reasoning} onChange={(reasoning) => onChange({ ...extensions, reasoning })} />
      <VerificationExtension enabled={extensions.verification} note={extensions.verificationNote} onToggle={(verification) => onChange({ ...extensions, verification })} onNoteChange={(verificationNote) => onChange({ ...extensions, verificationNote })} />
      <ReversePromptExtension enabled={extensions.reversePrompt} onToggle={(reversePrompt) => onChange({ ...extensions, reversePrompt })} />
    </>
  );
}

/** Erweiterungen unter dem Ausgabe-Feld */
export function AusgabeExtensions({ extensions, onChange }: ACTAExtensionsProps) {
  return (
    <NegativesExtension negatives={extensions.negatives} onChange={(negatives) => onChange({ ...extensions, negatives })} />
  );
}
