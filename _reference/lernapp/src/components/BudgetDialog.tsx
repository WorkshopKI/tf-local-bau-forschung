import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertCircle, Key, ExternalLink } from "lucide-react";
import { saveUserKey } from "@/services/llmService";
import { toast } from "sonner";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BudgetDialog = ({ open, onOpenChange }: BudgetDialogProps) => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    const result = await saveUserKey(apiKey.trim());
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("API-Key gespeichert! Du kannst die KI-Features jetzt weiter nutzen.");
      setApiKey("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            KI-Budget aufgebraucht
          </DialogTitle>
          <DialogDescription>
            Dein kostenloses KI-Kontingent ist erschöpft. Um weiterhin KI-gestützte Funktionen zu nutzen,
            kannst du einen eigenen OpenRouter API-Key hinterlegen.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="howto">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Eigenen API-Key hinterlegen
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  Erstelle ein Konto bei{" "}
                  <a
                    href="https://openrouter.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-1"
                  >
                    OpenRouter <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Lade Guthaben auf (ab $5)</li>
                <li>Erstelle einen API-Key unter „Keys"</li>
                <li>Füge den Key hier ein:</li>
              </ol>

              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                  {saving ? "Speichern…" : "Speichern"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Dein Key wird verschlüsselt gespeichert und nur serverseitig für KI-Anfragen verwendet.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Später
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
