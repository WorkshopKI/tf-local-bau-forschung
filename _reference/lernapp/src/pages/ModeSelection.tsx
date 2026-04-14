import { useNavigate } from "react-router-dom";
import { useAppMode } from "@/contexts/AppModeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Users, Key, Cloud, HardDrive, Shield, Sparkles } from "lucide-react";

const ModeSelection = () => {
  const navigate = useNavigate();
  const { setMode } = useAppMode();

  const handleWorkshop = () => {
    setMode("workshop");
    navigate("/login");
  };

  const handleStandalone = () => {
    setMode("standalone");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Willkommen</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Souverän arbeiten mit KI — wie möchtest du starten?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card
            className="p-6 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all border-2 border-transparent hover:border-primary/20"
            onClick={handleWorkshop}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-base">Workshop-Modus</h2>
                <p className="text-xs text-muted-foreground">Für Workshop-Teilnehmer</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground mb-5">
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" /> Login mit Workshop-Code
              </li>
              <li className="flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5 text-primary shrink-0" /> Cloud-Sync für Fortschritt
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" /> KI-Budget inklusive
              </li>
              <li className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-primary shrink-0" /> Team-Features & Reviews
              </li>
            </ul>
            <Button className="w-full">Zum Workshop-Login</Button>
          </Card>

          <Card
            className="p-6 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all border-2 border-transparent hover:border-primary/20"
            onClick={handleStandalone}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-muted">
                <Key className="w-5 h-5 text-foreground/70" />
              </div>
              <div>
                <h2 className="font-bold text-base">Eigener API-Key</h2>
                <p className="text-xs text-muted-foreground">Ohne Workshop-Anbindung</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground mb-5">
              <li className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Kein Login erforderlich
              </li>
              <li className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Alles lokal gespeichert
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Eigener OpenRouter-Key
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> Volle Datenkontrolle
              </li>
            </ul>
            <Button variant="outline" className="w-full">Direkt starten</Button>
          </Card>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Du kannst den Modus jederzeit in den Einstellungen ändern.
        </p>
      </div>
    </div>
  );
};

export default ModeSelection;
