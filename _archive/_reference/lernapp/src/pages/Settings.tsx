import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building2, Check, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ProfileContent } from "@/pages/Profile";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { AIRoutingSettings } from "@/components/settings/AIRoutingSettings";
import { ComplianceSettingsTab } from "@/components/settings/ComplianceSettingsTab";
import { RolesSettings } from "@/components/settings/RolesSettings";
import { useAppMode } from "@/contexts/AppModeContext";
import { KIContextEditor } from "@/components/settings/KIContextEditor";
import { Card } from "@/components/ui/card";
import { themePresets } from "@/components/themePresets";

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const dark = theme?.endsWith("-dark") ?? false;
  const baseTheme = theme?.replace(/-dark$/, "") || "muted-stone-contrast";

  const handlePresetClick = (presetId: string) => {
    const preset = themePresets.find((p) => p.id === presetId);
    if (!preset) return;
    setTheme(dark ? preset.darkId : preset.id);
  };

  const toggleDarkMode = () => {
    const preset = themePresets.find((p) => p.id === baseTheme);
    if (!preset) return;
    setTheme(dark ? preset.id : preset.darkId);
  };

  return (
    <Card className="card-section space-y-4">
      <h3 className="font-semibold text-sm">Darstellung</h3>
      {/* Theme-Presets */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Theme</label>
        <div className="flex gap-2">
          {themePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                baseTheme === preset.id
                  ? "border-primary bg-primary/5 text-foreground font-medium"
                  : "border-border hover:border-primary/30 text-muted-foreground"
              }`}
            >
              {preset.name}
              {baseTheme === preset.id && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </div>
      {/* Dark Mode Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          {dark ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm">Dunkler Modus</span>
        </div>
        <button
          onClick={toggleDarkMode}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            dark ? "bg-primary" : "bg-muted-foreground/20"
          }`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
            dark ? "left-[18px]" : "left-0.5"
          }`} />
        </button>
      </div>
    </Card>
  );
}

const Settings = () => {
  const { isWorkshop } = useAppMode();

  return (
    <div className="space-y-6" data-feedback-ref="einstellungen.tabs" data-feedback-label="Einstellungen">
      <Tabs defaultValue="profil" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profil" className="gap-1.5">
            <User className="w-3.5 h-3.5" />
            Mein Profil
          </TabsTrigger>
          {isWorkshop && (
            <TabsTrigger value="organisation" className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Organisation
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profil" className="space-y-6" data-feedback-ref="einstellungen.profil" data-feedback-label="Profil-Einstellungen">
          {/* KI-Kontext Editor — häufig editiert, daher ganz oben */}
          <KIContextEditor />
          {/* Darstellung — Theme + Dark Mode */}
          <AppearanceSection />
          {/* Kontoinformationen + KI-Einstellungen (aus Profile.tsx) */}
          <ProfileContent />
        </TabsContent>

        {isWorkshop && (
          <TabsContent value="organisation" className="space-y-6">
            {/* Zeile 1: Plattform + Sicherheit & Compliance (nebeneinander) */}
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <GeneralSettings />
              <ComplianceSettingsTab />
            </div>

            {/* Zeile 2: KI-Endpunkte (volle Breite, intern schon 2-spaltig) */}
            <AIRoutingSettings />

            {/* Zeile 3: Rollen & Rechte (volle Breite) */}
            <RolesSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
