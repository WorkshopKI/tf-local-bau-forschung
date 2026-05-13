import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Lightbulb } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { loadStringFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export const GuestBanner = () => {
  const { isLoggedIn, authMethod, profile } = useAuthContext();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => loadStringFromStorage(LS_KEYS.GUEST_BANNER_DISMISSED, "false") === "true");

  if (!isLoggedIn || authMethod !== "guest" || profile?.auth_method !== "guest" || dismissed) {
    return null;
  }

  return (
    <div className="bg-accent/30 border-b border-accent/50 px-4 py-2 flex items-center justify-center gap-2 text-sm">
      <Lightbulb className="w-4 h-4 text-accent-foreground shrink-0" />
      <span className="text-foreground">
        Hinterlege eine E-Mail-Adresse für dauerhaften Zugriff auf deine Daten.{" "}
        <button
          onClick={() => navigate("/settings")}
          className="text-primary font-medium hover:underline"
        >
          E-Mail hinterlegen →
        </button>
      </span>
      <button
        onClick={() => { setDismissed(true); saveToStorage(LS_KEYS.GUEST_BANNER_DISMISSED, "true"); }}
        className="ml-2 text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
