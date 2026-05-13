import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const roles = [
  {
    name: "Admin",
    description: "Vollzugriff auf alle Funktionen",
    color: "bg-primary/15 text-primary font-semibold",
    permissions: ["Prompts erstellen & bearbeiten", "Prompts verifizieren", "Rollen verwalten", "Einstellungen ändern", "Analytics einsehen", "Team verwalten"],
  },
  {
    name: "Prompt Champion",
    description: "Kann Prompts verifizieren und freigeben",
    color: "bg-primary/15 text-primary",
    permissions: ["Prompts erstellen & bearbeiten", "Prompts verifizieren", "Analytics einsehen", "Reviews durchführen"],
  },
  {
    name: "Editor",
    description: "Kann Prompts erstellen und bearbeiten",
    color: "bg-muted text-muted-foreground",
    permissions: ["Prompts erstellen & bearbeiten", "Eigene Prompts verwalten", "Onboarding absolvieren"],
  },
  {
    name: "Viewer",
    description: "Kann Prompts nutzen und bewerten",
    color: "bg-muted text-muted-foreground",
    permissions: ["Prompts ansehen & kopieren", "Prompts bewerten", "Onboarding absolvieren"],
  },
];

export function RolesSettings() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
        👥 Rollen & Rechte
      </h3>
      {roles.map((role) => (
        <Card key={role.name} className="card-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge className={role.color}>{role.name}</Badge>
              <span className="text-sm text-muted-foreground">{role.description}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" disabled>Bearbeiten</Button>
              </TooltipTrigger>
              <TooltipContent>Kommt in v2</TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-1.5">
            {role.permissions.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked disabled className="rounded" />
                {perm}
              </label>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
