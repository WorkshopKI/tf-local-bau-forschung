import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, ShieldAlert } from "lucide-react";

type Level = "open" | "internal" | "confidential";

const config: Record<Level, {
  label: string;
  labelShort: string;
  className: string;
  tooltip: string;
  icon?: React.ComponentType<{ className?: string }>;
  hidden?: boolean;
}> = {
  open: {
    label: "Offen",
    labelShort: "Offen",
    className: "",
    tooltip: "Externe Business-API erlaubt. Keine vertraulichen Daten.",
    hidden: true, // Default — nicht anzeigen
  },
  internal: {
    label: "Intern",
    labelShort: "Intern",
    className: "bg-muted text-muted-foreground",
    tooltip: "Interne KI empfohlen. Externe API nur ohne sensible Daten.",
    icon: Lock,
  },
  confidential: {
    label: "Vertraulich",
    labelShort: "Vertr.",
    className: "bg-foreground/10 text-foreground",
    tooltip: "NUR interne KI. Externe API blockiert.",
    icon: ShieldAlert,
  },
};

interface Props {
  level?: Level;
  reason?: string;
  compact?: boolean;
}

export const ConfidentialityBadge = ({ level = "open", reason, compact = false }: Props) => {
  const c = config[level];

  // "Offen" ist der Default — nicht anzeigen
  if (c.hidden) return null;

  const Icon = c.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${c.className} text-[10px] gap-1 cursor-help`}>
          {Icon && <Icon className="w-3 h-3" />}
          {compact ? c.labelShort : c.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="font-medium mb-0.5">{c.label}</p>
        <p>{reason || c.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export const getConfidentialityConfig = (level: Level) => config[level];
