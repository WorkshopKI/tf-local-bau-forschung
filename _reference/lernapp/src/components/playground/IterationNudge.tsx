import { useState, useMemo } from "react";
import { Lightbulb, X } from "lucide-react";
import { LS_KEYS } from "@/lib/constants";
import { loadStringFromStorage } from "@/lib/storage";

const suggestions = [
  "Kürze die Einleitung auf maximal 2 Sätze.",
  "Füge konkrete Zahlen oder Beispiele hinzu.",
  "Ändere den Ton: formeller / informeller.",
  "Bitte um eine alternative Variante.",
  "Frage: 'Was fehlt noch in deiner Antwort?'",
  "Begrenze die Ausgabe auf 100 Wörter.",
  "Bitte um Bulletpoints statt Fließtext.",
  "Frage nach Quellen oder Begründungen.",
];

interface Props {
  turnCount: number;
  onSendSuggestion: (text: string) => void;
}

export const IterationNudge = ({ turnCount, onSendSuggestion }: Props) => {
  const [dismissed] = useState(
    () => loadStringFromStorage(LS_KEYS.NUDGE_DISMISSED, "false") === "true"
  );
  const [visible, setVisible] = useState(true);

  // Stabile Auswahl von 2 Vorschlägen pro Session
  const shown = useMemo(() => {
    const seed = Date.now() % suggestions.length;
    return [suggestions[seed], suggestions[(seed + 3) % suggestions.length]];
  }, []);

  // Nur nach der ersten Antwort zeigen (turnCount === 1)
  if (turnCount !== 1 || dismissed || !visible) return null;

  return (
    <div className="flex items-start gap-2 mt-2">
      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-1.5" />
      <div className="flex gap-2 flex-wrap">
        {shown.map((s, i) => (
          <button
            key={i}
            onClick={() => {
              onSendSuggestion(s);
              setVisible(false);
            }}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 text-foreground transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-1"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
