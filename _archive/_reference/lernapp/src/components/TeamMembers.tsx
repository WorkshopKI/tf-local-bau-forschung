import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserPlus } from "lucide-react";

const mockMembers = [
  { name: "Maria K.", role: "Admin", department: "Management", promptsCreated: 24, onboardingComplete: true, status: "online" },
  { name: "Anna B.", role: "Editor", department: "Marketing", promptsCreated: 18, onboardingComplete: true, status: "online" },
  { name: "Jan M.", role: "Editor", department: "Engineering", promptsCreated: 12, onboardingComplete: false, status: "offline" },
  { name: "Lisa R.", role: "Viewer", department: "Support", promptsCreated: 7, onboardingComplete: true, status: "online" },
  { name: "Tom S.", role: "Viewer", department: "HR", promptsCreated: 3, onboardingComplete: false, status: "offline" },
  { name: "Dr. Meier", role: "Editor", department: "Legal", promptsCreated: 9, onboardingComplete: true, status: "offline" },
];

const roleColors: Record<string, string> = {
  Admin: "bg-primary/15 text-primary font-semibold",
  Editor: "bg-muted text-muted-foreground",
  Viewer: "bg-muted text-muted-foreground",
};

const avatarColors = ["bg-primary/15 text-primary", "bg-muted text-foreground/70", "bg-primary/10 text-primary", "bg-muted text-muted-foreground"];

export const TeamMembers = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{mockMembers.length} Team-Mitglieder</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" disabled className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Team einladen
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kommt in v2</TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-2">
        {mockMembers.map((member, i) => (
          <Card key={member.name} className="p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${avatarColors[i % avatarColors.length]}`}>
                {member.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{member.name}</span>
                  <Badge className={`text-[10px] ${roleColors[member.role] || ""}`}>{member.role}</Badge>
                  <span className={`w-2 h-2 rounded-full ${member.status === "online" ? "bg-primary" : "bg-muted-foreground/30"}`} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{member.department}</span>
                  <span>{member.promptsCreated} Prompts</span>
                  <span>{member.onboardingComplete ? "Onboarding: Abgeschlossen" : "Onboarding: Offen"}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
