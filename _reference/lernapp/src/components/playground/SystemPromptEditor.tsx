import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";

export interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const SystemPromptEditor = ({ value, onChange }: SystemPromptEditorProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-feedback-ref="prompt-labor.system-prompt" data-feedback-label="System-Prompt">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full px-3 py-2 rounded-md hover:bg-accent">
        <Settings className="w-4 h-4" />
        <span>System-Prompt (optional)</span>
        {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Definiere hier einen System-Prompt, der das Verhalten der KI grundsätzlich steuert..."
          className="min-h-[80px] text-sm"
          rows={3}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};
