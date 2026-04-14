import { useState, useMemo } from "react";
import { ShieldAlert, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { RedactionDrill } from "@/data/redactionDrills";

interface Props {
  drill: RedactionDrill;
  onComplete?: (score: number) => void;
}

const typeLabels: Record<string, string> = {
  name: "Name",
  aktenzeichen: "Aktenzeichen",
  ip: "IP/Server",
  email: "E-Mail",
  telefon: "Telefon",
  adresse: "Adresse",
  personalnummer: "Personalnr.",
  gehalt: "Gehalt",
  gesundheit: "Gesundheitsdaten",
  passwort: "Zugangsdaten",
};

interface SpanOption {
  text: string;
  type: string;
  explanation: string;
  isSensitive: boolean;
}

export const RedactionExercise = ({ drill, onComplete }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  // Stabile Reihenfolge mit deterministischem Mischen
  const allSpans = useMemo<SpanOption[]>(() => {
    const words = drill.prompt.split(" ");
    const opts: SpanOption[] = [
      ...drill.sensitiveSpans.map((s) => ({ ...s, isSensitive: true })),
      { text: words.slice(0, 3).join(" "), type: "harmless", explanation: "Allgemeine Aufgabenbeschreibung — nicht sensibel", isSensitive: false },
      { text: drill.prompt.includes("Format") ? "Format" : "Erstelle", type: "harmless", explanation: "Standardanweisung — nicht sensibel", isSensitive: false },
    ];
    const seed = drill.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return opts.sort((a, b) => {
      const ha = (a.text.split("").reduce((x, c) => x + c.charCodeAt(0), 0) * seed) % 1000;
      const hb = (b.text.split("").reduce((x, c) => x + c.charCodeAt(0), 0) * seed) % 1000;
      return ha - hb;
    });
  }, [drill]);

  const toggle = (text: string) => {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    let correct = 0;
    for (const opt of allSpans) {
      const sel = selected.has(opt.text);
      if (opt.isSensitive && sel) correct++;
      if (!opt.isSensitive && !sel) correct++;
    }
    const score = Math.round((correct / allSpans.length) * 100);
    onComplete?.(score);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">{drill.title}</h3>
        <Badge variant="outline" className="text-[10px]">Schwierigkeit {drill.difficulty}/3</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Dieser Prompt enthält sensible Daten die NICHT an eine externe KI gesendet werden dürfen. Markiere alle problematischen Stellen.
      </p>

      {/* Prompt + Checkboxen zweispaltig */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Prompt links */}
        <Card className="p-4 bg-muted/30 rounded-lg h-fit">
          <div className="text-sm font-mono leading-relaxed whitespace-pre-wrap">
            {drill.prompt}
          </div>
        </Card>

        {/* Checkboxen rechts */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Welche Textstellen sind sensibel?</p>
          {allSpans.map((span) => (
            <label
              key={span.text}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                submitted
                  ? span.isSensitive && selected.has(span.text)
                    ? "border-primary bg-primary/5"
                    : span.isSensitive && !selected.has(span.text)
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : !span.isSensitive && selected.has(span.text)
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-border opacity-50"
                  : selected.has(span.text)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => toggle(span.text)}
            >
              <Checkbox checked={selected.has(span.text)} disabled={submitted} className="mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-mono bg-muted/60 px-1.5 py-0.5 rounded">{span.text}</span>
                {submitted && (
                  <span className="ml-2">
                    {span.isSensitive && selected.has(span.text) && <CheckCircle2 className="inline w-4 h-4 text-primary" />}
                    {span.isSensitive && !selected.has(span.text) && <XCircle className="inline w-4 h-4 text-red-500" />}
                    {!span.isSensitive && selected.has(span.text) && <XCircle className="inline w-4 h-4 text-red-500" />}
                  </span>
                )}
                {submitted && span.isSensitive && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-[9px] mr-1">{typeLabels[span.type] || span.type}</Badge>
                    {span.explanation}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {!submitted ? (
        <Button onClick={handleSubmit} disabled={selected.size === 0} className="gap-1.5">
          <Eye className="w-4 h-4" /> Auswertung
        </Button>
      ) : (
        <Card className="p-4 bg-primary/5 border-primary/20 rounded-lg text-sm">
          <p className="font-medium mb-1">
            {[...selected].filter((s) => drill.sensitiveSpans.some((sp) => sp.text === s)).length === drill.sensitiveSpans.length
              && [...selected].every((s) => drill.sensitiveSpans.some((sp) => sp.text === s))
              ? "Perfekt! Alle sensiblen Daten erkannt."
              : `${[...selected].filter((s) => drill.sensitiveSpans.some((sp) => sp.text === s)).length} von ${drill.sensitiveSpans.length} sensiblen Stellen erkannt.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Tipp: Verwende immer Platzhalter wie [NAME], [AKTENZEICHEN], [ADRESSE] statt echter Daten. Bei vertraulichen Inhalten: nur die interne KI nutzen.
          </p>
        </Card>
      )}
    </div>
  );
};
