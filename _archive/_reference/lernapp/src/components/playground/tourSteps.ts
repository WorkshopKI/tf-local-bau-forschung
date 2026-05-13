export interface TourStep {
  /** Selektor: data-tour="..." Attribut auf dem Ziel-Element */
  target: string;
  /** Titel der Erklärung */
  title: string;
  /** Beschreibungstext */
  description: string;
  /** Tooltip-Position relativ zum Target */
  position?: "top" | "bottom" | "left" | "right";
  /** Nur in diesem Modus anzeigen? undefined = beide */
  mode?: "einsteiger" | "experte";
}

export const TOUR_STEPS: TourStep[] = [
  // Schritt 1: Prompt Browser (links)
  {
    target: "prompt-browser",
    title: "Prompt Sammlung",
    description:
      "Wähle eine Vorlage aus der Sammlung. Die Felder werden automatisch vorausgefüllt. Du kannst nach Abteilung filtern oder die Suche nutzen.",
    position: "right",
  },
  // Schritt 2: ACTA/RAKETE Felder (mode-spezifisch)
  {
    target: "acta-fields",
    title: "Die ACTA-Methode",
    description:
      "Vier Felder für den perfekten Prompt: Rolle (Act), Kontext (Context), Aufgabe (Task) und Ausgabeformat. Fülle sie aus — je mehr Kontext, desto besser.",
    position: "bottom",
    mode: "einsteiger",
  },
  {
    target: "acta-fields",
    title: "Die RAKETE-Methode",
    description:
      "Sechs Felder: Rolle, Kontext, Aufgabe, Ergebnis, Teste (Selbstprüfung) und Einschränkungen. Teste und Einschränkungen machen deinen Prompt noch präziser.",
    position: "bottom",
    mode: "experte",
  },
  // Schritt 3: Senden-Bereich
  {
    target: "acta-send",
    title: "Prompt testen",
    description:
      "Sende deinen Prompt an die KI. Nutze «Prüfen» für eine Qualitätsbewertung oder «Vorschlagen» um die KI die Felder ausfüllen zu lassen.",
    position: "top",
  },
  // Schritt 4: Chat-Bereich
  {
    target: "chat-area",
    title: "Chat-Bereich",
    description:
      "Hier erscheint die KI-Antwort. Du kannst die Antwort kopieren, exportieren, bewerten oder den Verlauf leeren und von vorn beginnen.",
    position: "left",
  },
];

/** Filtert Steps nach aktuellem Modus.
 *  DOM-Prüfung wird NICHT hier gemacht — TourOverlay überspringt fehlende Targets bereits. */
export function getStepsForMode(
  mode: "einsteiger" | "experte"
): TourStep[] {
  return TOUR_STEPS.filter((s) => !s.mode || s.mode === mode);
}
