import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, MapPin, Hand, Link2, CheckSquare, Play } from "lucide-react";

export interface AgentConfig {
  habitat: string;
  hands: string[];
  leash: number; // 0-100: 0 = step-by-step, 100 = full autonomy
  proof: string;
  task: string;
}

interface AgentKnobsProps {
  config: AgentConfig;
  onConfigChange: (config: AgentConfig) => void;
  onStartAgent: (assembledPrompt: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  bare?: boolean;
}

const HAND_OPTIONS = [
  { value: "read", label: "Lesen / Analysieren" },
  { value: "write", label: "Texte erstellen" },
  { value: "web", label: "Web-Recherche" },
  { value: "calculate", label: "Berechnen / Tabellen" },
  { value: "code", label: "Code schreiben" },
  { value: "edit", label: "Dokumente bearbeiten" },
];

const PROOF_OPTIONS = [
  { value: "sources", label: "Quellenangaben (URLs, Studien)" },
  { value: "log", label: "Arbeitsprotokoll (Schritt-für-Schritt)" },
  { value: "checklist", label: "Abgehakte Checkliste" },
  { value: "confidence", label: "Confidence-Rating pro Aussage" },
  { value: "test", label: "Testszenarien + Ergebnisse" },
];

function buildAgentPrompt(config: AgentConfig): string {
  const handLabels = HAND_OPTIONS.filter(h => config.hands.includes(h.value)).map(h => h.label);
  const proofLabel = PROOF_OPTIONS.find(p => p.value === config.proof)?.label ?? config.proof;

  let leashDesc: string;
  if (config.leash <= 20) {
    leashDesc = "Arbeite Schritt für Schritt. Zeige jeden Zwischenschritt und warte auf Bestätigung bevor du fortfährst.";
  } else if (config.leash <= 40) {
    leashDesc = "Arbeite in Abschnitten. Fasse Zwischenergebnisse zusammen und frage bei Unsicherheiten nach.";
  } else if (config.leash <= 60) {
    leashDesc = "Arbeite weitgehend selbstständig. Frage nur nach, wenn du auf echte Unklarheiten stößt.";
  } else if (config.leash <= 80) {
    leashDesc = "Arbeite autonom. Triff eigenständige Entscheidungen und melde dich nur bei schwerwiegenden Problemen.";
  } else {
    leashDesc = "Volle Autonomie. Erledige die gesamte Aufgabe ohne Rückfragen und liefere das fertige Ergebnis.";
  }

  const allHands = handLabels.length > 0 ? handLabels.join(", ") : "Nur Text-Antworten";
  const notAllowed = HAND_OPTIONS.filter(h => !config.hands.includes(h.value)).map(h => h.label);

  return `Du bist ein autonomer KI-Arbeitsagent. Befolge diese Spezifikation strikt:

## HABITAT (Arbeitsbereich)
${config.habitat || "Keine Einschränkung – nutze allgemeines Wissen."}

## HANDS (Erlaubte Werkzeuge)
ERLAUBT: ${allHands}
${notAllowed.length > 0 ? `NICHT ERLAUBT: ${notAllowed.join(", ")}` : ""}

## LEASH (Autonomie-Grad: ${config.leash}%)
${leashDesc}

## PROOF (Erfolgsnachweis)
Belege deine Arbeit durch: ${proofLabel}

---

## AUFGABE
${config.task}`;
}

export const AgentKnobs = ({ config, onConfigChange, onStartAgent, isOpen, onToggle, bare }: AgentKnobsProps) => {
  const update = (partial: Partial<AgentConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const toggleHand = (value: string) => {
    const hands = config.hands.includes(value)
      ? config.hands.filter(h => h !== value)
      : [...config.hands, value];
    update({ hands });
  };

  const handleStart = () => {
    if (!config.task.trim()) return;
    onStartAgent(buildAgentPrompt(config));
  };

  const content = (
    <div className="px-4 pb-4 space-y-4">
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          Arbeitsbereich – Wo darf der Assistent arbeiten?
        </label>
        <Textarea
          value={config.habitat}
          onChange={(e) => update({ habitat: e.target.value })}
          placeholder="z.B. Nur in öffentlichen Webquellen und Preisseiten..."
          className="text-xs min-h-[60px]"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
          <Hand className="w-3.5 h-3.5 text-primary" />
          Werkzeuge – Was darf der Assistent tun?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleHand(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                config.hands.includes(opt.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          Autonomie – Wie selbstständig?
          <span className="ml-auto text-muted-foreground font-normal">{config.leash}%</span>
        </label>
        <Slider
          value={[config.leash]}
          onValueChange={([v]) => update({ leash: v })}
          min={0}
          max={100}
          step={10}
          className="mb-1"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Schritt-für-Schritt</span>
          <span>Volle Autonomie</span>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-primary" />
          Nachweis – Wie belegt er Erfolg?
        </label>
        <Select value={config.proof} onValueChange={(v) => update({ proof: v })}>
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROOF_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs font-semibold text-foreground mb-1.5 block">
          Aufgabe für den Assistenten
        </label>
        <Textarea
          value={config.task}
          onChange={(e) => update({ task: e.target.value })}
          placeholder="Beschreibe die Aufgabe, die der Assistent autonom erledigen soll..."
          className="text-xs min-h-[80px]"
        />
      </div>

      <Button
        onClick={handleStart}
        disabled={!config.task.trim()}
        className="w-full gap-2"
        size="sm"
      >
        <Play className="w-3.5 h-3.5" />
        Assistent starten
      </Button>
    </div>
  );

  if (bare) return content;

  return (
    <div className="bg-gradient-card rounded-xl border border-border shadow-lg">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Agenten-Modus</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">4 Regler</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && content}
    </div>
  );
};
