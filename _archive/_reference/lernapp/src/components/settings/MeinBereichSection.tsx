import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgContext, ORG_SCOPE_LABELS } from "@/contexts/OrgContext";
import type { OrgScope } from "@/types";

export function MeinBereichSection() {
  const { scope, setScope } = useOrgContext();

  return (
    <div className="border-t border-border pt-3">
      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
        Mein Bereich
      </label>
      <Select value={scope} onValueChange={(v) => setScope(v as OrgScope)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(ORG_SCOPE_LABELS) as [OrgScope, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1.5">
        Bestimmt welche Prompts und Beispiele dir angezeigt werden.
      </p>
    </div>
  );
}
