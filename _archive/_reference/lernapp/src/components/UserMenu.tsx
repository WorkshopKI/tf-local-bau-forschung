import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { LogOut, Users, Coins, Settings, ArrowLeftRight, ClipboardCheck, MessageSquare } from "lucide-react";
import { CreditsDialog } from "@/components/CreditsDialog";
import { useAppMode } from "@/contexts/AppModeContext";
import { useSyncContext } from "@/contexts/SyncContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  scopeLabel?: string;
}

export const UserMenu = ({ scopeLabel }: UserMenuProps) => {
  const { isLoggedIn, isLoading, profile, user, signOut } = useAuthContext();
  const { isStandalone, isWorkshop, setMode } = useAppMode();
  const { syncStatus } = useSyncContext();
  const navigate = useNavigate();
  const [creditsOpen, setCreditsOpen] = useState(false);

  if (isLoading) return null;

  if (!isLoggedIn) {
    return (
      <button
        onClick={() => navigate("/login")}
        className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
      >
        Anmelden →
      </button>
    );
  }

  const isGuest = profile?.auth_method === "guest";
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const courseId = profile?.course_id;

  return (
    <div data-feedback-ref="navigation.user-menu" data-feedback-label="Benutzer-Menü">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors text-left">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">{displayName}</p>
              {scopeLabel && (
                <p className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">{scopeLabel}</p>
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-none">
                {isGuest ? `${displayName} (Gast)` : user?.email}
              </p>
              {courseId && (
                <p className="text-xs text-muted-foreground">{courseId}</p>
              )}
              {isWorkshop && syncStatus && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === "synced" ? "bg-emerald-500" :
                    syncStatus === "syncing" ? "bg-amber-500 animate-pulse" :
                    syncStatus === "error" ? "bg-red-500" :
                    "bg-muted-foreground/30"
                  }`} />
                  {syncStatus === "synced" ? "Synchronisiert" :
                   syncStatus === "syncing" ? "Wird synchronisiert…" :
                   syncStatus === "error" ? "Sync-Fehler" :
                   "Offline"}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Einstellungen
          </DropdownMenuItem>
          {isWorkshop && (
            <>
              <DropdownMenuItem onClick={() => navigate("/team")}>
                <Users className="mr-2 h-4 w-4" />
                Team
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/reviews")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Reviews
              </DropdownMenuItem>
            </>
          )}
          {isWorkshop && (
            <DropdownMenuItem onClick={() => setCreditsOpen(true)}>
              <Coins className="mr-2 h-4 w-4" />
              Credits
            </DropdownMenuItem>
          )}
          {profile?.is_admin && (
            <>
              <DropdownMenuItem onClick={() => navigate("/admin/teilnehmer")}>
                <Users className="mr-2 h-4 w-4" />
                Teilnehmer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/feedback")}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {isStandalone ? (
            <DropdownMenuItem onClick={() => {
              if (confirm("Modus wechseln? Lokale Daten bleiben erhalten.")) {
                setMode(null);
                window.location.href = "/";
              }
            }}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Modus wechseln
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreditsDialog open={creditsOpen} onOpenChange={setCreditsOpen} />
    </div>
  );
};
