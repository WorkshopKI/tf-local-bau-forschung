# Prompt: Tooltips für Eval-Metriken

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Die Fachdetail-Zeile im Eval-Dashboard zeigt ML-Metriken die für Fachanwender
unverständlich sind. Füge erklärende Tooltips hinzu.

═══════════════════════════════════════════════════
TEIL 1: Tooltip-Komponente
═══════════════════════════════════════════════════

Erstelle src/ui/Tooltip.tsx (falls nicht vorhanden):

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

Verhalten:
- Wrapper um beliebiges Element (inline)
- On hover: Tooltip erscheint oberhalb des Elements
- Tooltip: Kleines Popup mit dunklem Hintergrund (var(--tf-text)), 
  heller Text (var(--tf-bg)), padding 6px 10px, border-radius 4px,
  font-size 12px, max-width 260px, line-height 1.4
- Kleines Dreieck (CSS :after) unten mittig zeigt auf das Element
- Erscheint mit kurzer Verzögerung (150ms) und fade-in (opacity transition 150ms)
- Verschwindet sofort bei mouse-leave
- z-index hoch genug um über anderen Elementen zu liegen
- Position: Zentriert über dem Element, wenn kein Platz oben dann unten

Styling gemäß Design Guide: Monochrom, keine bunten Farben.
Exportiere aus src/ui/index.ts.

═══════════════════════════════════════════════════
TEIL 2: Tooltips an die Fachdetail-Zeile
═══════════════════════════════════════════════════

In der Eval-Dashboard Komponente (EvalDashboard.tsx oder IndexManager.tsx):

Aktuell:
  "Fachdetail: P@3 50% · P@5 61% · Top-1 Accuracy 75%"

Nachher: Jeder Wert wird ein Tooltip-Wrapper mit ⓘ Icon:

  <span style="font-size: 12px; color: var(--tf-text-tertiary)">
    Fachdetail:
    <Tooltip text="Precision bei 3 Ergebnissen — Wie viele der erwarteten Dokumente erscheinen unter den ersten 3 Suchergebnissen? Höher = der Nutzer findet das Richtige schneller.">
      <span style="cursor: help; border-bottom: 1px dotted var(--tf-text-tertiary)">
        P@3 {value}%
      </span>
    </Tooltip>
    {" · "}
    <Tooltip text="Precision bei 5 Ergebnissen — Wie viele der erwarteten Dokumente erscheinen unter den ersten 5? Sollte höher sein als P@3.">
      <span style="cursor: help; border-bottom: 1px dotted var(--tf-text-tertiary)">
        P@5 {value}%
      </span>
    </Tooltip>
    {" · "}
    <Tooltip text="Treffergenauigkeit — Bei wie vielen Suchanfragen steht das beste Ergebnis ganz oben? 100% = perfekte Sortierung.">
      <span style="cursor: help; border-bottom: 1px dotted var(--tf-text-tertiary)">
        Top-1 Accuracy {value}%
      </span>
    </Tooltip>
  </span>

Visueller Hinweis dass es hoverable ist:
- Dotted Underline auf den Werten (border-bottom: 1px dotted)
- cursor: help

═══════════════════════════════════════════════════
TEIL 3: Tooltips auch an die Metric Cards
═══════════════════════════════════════════════════

Die zwei großen Cards ("Trefferquote 85%", "Genauigkeit 75%") haben
bereits Untertitel. Ergänze Tooltips auf den Untertiteln:

Trefferquote-Card:
  Untertitel: "Richtiges Dokument in Top 5 gefunden"
  Tooltip: "Anteil der Testfälle bei denen mindestens eines der erwarteten Dokumente unter den ersten 5 Suchergebnissen erscheint. Basiert auf 20 Testabfragen mit vordefinierten erwarteten Ergebnissen."

Genauigkeit-Card:
  Untertitel: "Richtiges Dokument an erster Stelle"
  Tooltip: "Anteil der Testfälle bei denen das erwartete Dokument das allererste Suchergebnis ist. Dies ist die strengste Metrik — nicht 'irgendwo in der Liste', sondern 'ganz oben'."

═══════════════════════════════════════════════════
TEIL 4: Tooltips an den Balken
═══════════════════════════════════════════════════

Exakte Suche-Balken:
  Tooltip auf "Exakte Suche": "Testfälle bei denen der Nutzer den genauen Fachbegriff eingibt, z.B. 'Brandschutz' oder 'Tiefgarage'. Hier zählt die Keyword-Suche."

Bedeutungssuche-Balken:
  Tooltip auf "Bedeutungssuche": "Testfälle bei denen der Nutzer mit eigenen Worten sucht, z.B. 'Gift im Boden' statt 'Altlastengutachten'. Hier zählt die KI-gestützte Vektorsuche."

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. npm run dev → Admin/Suchindex → Eval muss existieren (oder neu starten)
2. Hover über "P@3 50%" → Tooltip erscheint mit Erklärung
3. Hover über "P@5 61%" → Tooltip erscheint
4. Hover über "Top-1 Accuracy 75%" → Tooltip erscheint
5. Hover über "Trefferquote" Untertitel → Tooltip
6. Hover über "Genauigkeit" Untertitel → Tooltip
7. Hover über "Exakte Suche" → Tooltip
8. Hover über "Bedeutungssuche" → Tooltip
9. Tooltips haben dunklen Hintergrund, hellen Text, Dreieck-Pfeil
10. Tooltips verschwinden sauber bei Mouse-Leave
11. Tooltips clippen NICHT am Rand (genug Abstand zum Viewport)
12. Console: Keine Errors

Committe und pushe: "feat: tooltips for eval metrics with user-friendly explanations"
```
