import { Card } from "@/components/ui/card";
import { ThemePresetPicker } from "@/components/ThemePresetPicker";

export function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <Card className="card-section">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
          🎨 Darstellung
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Aktuelles Theme wählen:</span>
          <ThemePresetPicker />
        </div>
      </Card>

      <Card className="card-section">
        <h3 className="font-semibold mb-2">Logo</h3>
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          Logo hochladen — kommt in v2
        </div>
      </Card>
    </div>
  );
}
