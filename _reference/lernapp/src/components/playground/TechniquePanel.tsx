import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Wand2, Send, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import { TECHNIQUE_TEMPLATES, type TechniqueTemplate } from "./TechniqueTemplates";

export interface TechniquePanelProps {
  onApplyToChat: (prompt: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  bare?: boolean;
}

const CATEGORIES = [...new Set(TECHNIQUE_TEMPLATES.map((t) => t.category))];

export const TechniquePanel = ({ onApplyToChat, isOpen, onToggle, bare }: TechniquePanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredTechniques = TECHNIQUE_TEMPLATES.filter(
    (t) => t.category === selectedCategory
  );

  const handleApply = (template: TechniqueTemplate) => {
    onApplyToChat(template.promptTemplate);
  };

  const handleCopy = (template: TechniqueTemplate) => {
    navigator.clipboard.writeText(template.promptTemplate);
    toast.success("Technik-Vorlage kopiert!");
  };

  const content = (
    <div className="px-3 pb-3 space-y-3">
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            className="text-[11px] h-7 px-2"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2 pr-2">
          {filteredTechniques.map((technique) => (
            <Card
              key={technique.id}
              className="p-3 hover:shadow-md transition-shadow"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold">{technique.name}</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() =>
                      setExpandedId(
                        expandedId === technique.id ? null : technique.id
                      )
                    }
                  >
                    <Info className="w-3 h-3" />
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {technique.description}
                </p>

                {expandedId === technique.id && (
                  <div className="space-y-2 pt-1">
                    <div className="bg-muted/50 rounded-md p-2 text-[11px] whitespace-pre-wrap font-mono leading-relaxed">
                      {technique.promptTemplate}
                    </div>
                    <p className="text-[10px] text-primary">
                      {technique.useCase}
                    </p>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="text-[11px] h-6 flex-1"
                    onClick={() => handleApply(technique)}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Anwenden
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6"
                    onClick={() => handleCopy(technique)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  if (bare) return content;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="bg-gradient-card rounded-xl border border-border shadow-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/50 rounded-t-xl transition-colors">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Fortgeschrittene Techniken</span>
            <Badge variant="secondary" className="text-xs">
              {TECHNIQUE_TEMPLATES.length}
            </Badge>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {content}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
