import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { FlawChallenge } from "@/types";
import { SEVERITY_COLORS, BADGE_COLORS } from "@/lib/constants";

interface Props {
  challenge: FlawChallenge;
  onComplete?: (score: number) => void;
  compact?: boolean;
}

interface FlawOption {
  id: string;
  text: string;
  isReal: boolean;
  severity: "kritisch" | "mittel" | "hinweis";
}

export const FlawExercise = ({ challenge, onComplete, compact }: Props) => {
  const [selectedFlaws, setSelectedFlaws] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [showHints, setShowHints] = useState(false);

  // Stabile Reihenfolge: Mische basierend auf Challenge-ID (deterministisch)
  const allOptions = useMemo<FlawOption[]>(() => {
    const opts: FlawOption[] = [
      ...challenge.flaws.map((f) => ({ id: f.id, text: f.description, isReal: true, severity: f.severity })),
      { id: "distractor-1", text: "Der Text ist zu kurz für den Anwendungsfall", isReal: false, severity: "hinweis" as const },
      { id: "distractor-2", text: "Die Formatierung entspricht nicht dem Standardformat", isReal: false, severity: "hinweis" as const },
    ];
    // Deterministisches Mischen basierend auf Challenge-ID
    const seed = challenge.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return opts.sort((a, b) => {
      const ha = (a.id.split("").reduce((x, c) => x + c.charCodeAt(0), 0) * seed) % 1000;
      const hb = (b.id.split("").reduce((x, c) => x + c.charCodeAt(0), 0) * seed) % 1000;
      return ha - hb;
    });
  }, [challenge]);

  const toggleFlaw = (id: string) => {
    if (submitted) return;
    setSelectedFlaws((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const realIds = new Set(challenge.flaws.map((f) => f.id));
    let correct = 0;
    for (const opt of allOptions) {
      const selected = selectedFlaws.has(opt.id);
      if (opt.isReal && selected) correct++;
      if (!opt.isReal && !selected) correct++;
    }
    const score = Math.round((correct / allOptions.length) * 100);
    onComplete?.(score);
  };

  const severityClass = (severity: string) => SEVERITY_COLORS[severity] || SEVERITY_COLORS.hinweis;

  const optionItems = allOptions.map((opt) => (
    <label
      key={opt.id}
      className={`flex items-start gap-3 ${compact ? "p-2" : "p-3"} rounded-lg border cursor-pointer transition-colors ${
        submitted
          ? opt.isReal && selectedFlaws.has(opt.id)
            ? "border-primary bg-primary/5"
            : opt.isReal && !selectedFlaws.has(opt.id)
            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
            : !opt.isReal && selectedFlaws.has(opt.id)
            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
            : "border-border opacity-50"
          : selectedFlaws.has(opt.id)
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      }`}
      onClick={() => toggleFlaw(opt.id)}
    >
      <Checkbox
        checked={selectedFlaws.has(opt.id)}
        disabled={submitted}
        className="mt-0.5"
      />
      <div className="flex-1 text-sm">
        {opt.text}
        {submitted && (
          <span className="ml-2">
            {opt.isReal && selectedFlaws.has(opt.id) && <CheckCircle2 className="inline w-4 h-4 text-primary" />}
            {opt.isReal && !selectedFlaws.has(opt.id) && <XCircle className="inline w-4 h-4 text-red-500" />}
            {!opt.isReal && selectedFlaws.has(opt.id) && <XCircle className="inline w-4 h-4 text-red-500" />}
          </span>
        )}
      </div>
    </label>
  ));

  const resultBlock = !submitted ? (
    <div className="flex gap-2">
      <Button onClick={handleSubmit} disabled={selectedFlaws.size === 0} className="gap-1.5">
        <Eye className="w-4 h-4" /> Auswertung
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setShowHints(!showHints)}>
        {showHints ? <EyeOff className="w-4 h-4 mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
        {showHints ? "Tipps ausblenden" : "Tipps anzeigen"}
      </Button>
    </div>
  ) : (
    <Card className="p-3 bg-primary/5 border-primary/20 rounded-lg">
      <p className="text-sm font-medium mb-2">
        {[...selectedFlaws].filter((id) => challenge.flaws.some((f) => f.id === id)).length === challenge.flaws.length
          ? "Alle Fehler erkannt!"
          : `${[...selectedFlaws].filter((id) => challenge.flaws.some((f) => f.id === id)).length} von ${challenge.flaws.length} Fehlern erkannt.`}
      </p>
      <div className="space-y-1">
        {challenge.flaws.map((f) => (
          <div key={f.id} className="flex items-start gap-2 text-xs">
            <Badge className={severityClass(f.severity)}>
              {f.severity}
            </Badge>
            <span className="text-muted-foreground">{f.description}</span>
          </div>
        ))}
      </div>
    </Card>
  );

  const hintsBlock = showHints && !submitted && (
    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
      Achte besonders auf: Datenschutz (echte Namen, Aktenzeichen), Compliance (fehlende Pflichtbestandteile),
      Halluzinationen (erfundene Zitate, unbelegte Zahlen) und logische Widersprüche.
    </p>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{challenge.context}</p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Linke Spalte: KI-Output */}
          <Card className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px]">KI-Output</Badge>
              <Badge className={`${BADGE_COLORS.medium} text-[10px]`}>
                Enthält Fehler
              </Badge>
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {challenge.generatedOutput}
            </div>
          </Card>

          {/* Rechte Spalte: Checkboxen + Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Welche Probleme erkennst du?</p>
            <div className="space-y-1.5">
              {optionItems}
            </div>
            {resultBlock}
            {hintsBlock}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{challenge.context}</p>

      {/* KI-Output */}
      <Card className="p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px]">KI-Output</Badge>
          <Badge className={`${BADGE_COLORS.medium} text-[10px]`}>
            Enthält Fehler
          </Badge>
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
          {challenge.generatedOutput}
        </div>
      </Card>

      {/* Optionen */}
      <div>
        <p className="text-sm font-medium mb-2">Welche Probleme erkennst du?</p>
        <div className="space-y-2">
          {optionItems}
        </div>
      </div>

      {resultBlock}
      {hintsBlock}
    </div>
  );
};
