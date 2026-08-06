# Neuen Feedback-Status hinzufügen

Wenn ein neuer Status-Wert im Feedback-System gebraucht wird (z.B. `'in_review'`, `'duplikat'`, `'zurueckgestellt'`), müssen mehrere Stellen synchron aktualisiert werden — sonst rendert die UI das Label nicht, der Badge ist farblos und Filter zeigen den Status nicht in der Pill-Reihe.

Feedback-Status ist **bewusst getrennt** von Antrag-Status (CLAUDE.md Pitfall #9). Diese Checkliste gilt nur für `FeedbackStatus`-Erweiterungen.

## Touch-Points (Pflicht, in dieser Reihenfolge)

1. **Typ-Union** in [src/core/types/feedback.ts](../../src/core/types/feedback.ts):
   ```ts
   export type FeedbackStatus =
     | 'neu' | 'geplant' | 'in_bearbeitung'
     | 'umgesetzt' | 'abgelehnt' | 'archiviert'
     | 'in_review';   // ← neu
   ```

2. **Prädikate** in [src/core/services/feedback/feedback-status.ts](../../src/core/services/feedback/feedback-status.ts):
   - `FEEDBACK_STATUS` ergänzen (`Record<FeedbackStatus, …>` — der Compiler erzwingt es).
   - Entscheiden, ob `istOffen` den neuen Status mitzählt. Das ist keine Formalie: „offen" steuert die Entwickler-Sicht „Alles offen".

3. **UI-Konstanten** in [src/components/feedback/constants.ts](../../src/components/feedback/constants.ts) — **sieben** `Record<FeedbackStatus, …>`, alle vom Compiler erzwungen:
   `STATUS_LABELS` · `STATUS_COLORS` (Verwaltungs-Badges) · `STATUS_TINT` · `STATUS_SOFT` · `STATUS_DOT` · `STATUS_LANE_ACCENT` (Board-Spaltenfarbe) · `STATUS_COLUMN_ICONS` (lucide-Name).
   Bestehende Theme-Vars wiederverwenden (`--tf-fb-*`, `--tf-{warning,danger,…}-*`), **nie** eigene Hex-Farben (Guard `theme-token-contract`).

4. **Board-Spalte** in [src/components/feedback/feedbackLanes.ts](../../src/components/feedback/feedbackLanes.ts):
   - `FEEDBACK_LANE_STATUS` ist die Spaltenreihenfolge des Boards UND der Katalog wählbarer Lanes. Fehlt der Status hier, gibt es keine Spalte dafür.
   - **Key-Bump nicht vergessen**: `BOARD_KANBAN_KEY` in [boardKanbanConfig.ts](../../src/components/feedback/boardKanbanConfig.ts) hochzählen. Ein persistierter Wert schlägt jeden Code-Default — ohne Bump sieht niemand mit gespeicherter Einstellung die neue Spalte, und die Tickets darin sind unsichtbar statt bloß unsortiert.
   - Das Startseiten-Widget hat eine eigene Default-Lane-Liste ([feedbackKanbanLanes.ts](../../src/plugins/home/widgets/feedbackKanbanLanes.ts)); bestehende Widget-Instanzen behalten bewusst ihre persönliche Konfiguration.

5. **Stepper** in [feedbackStepper.ts](../../src/core/services/feedback/feedbackStepper.ts): `FEEDBACK_PIPELINE` sind nur die vier Fortschritts-Stationen. Ein Seitenzustand gehört **nicht** hinein — er bekommt in `feedbackStepperPosition` einen expliziten Zweig (Vorbild `abgelehnt`, `rueckfrage`).

6. **Klartext für den Ersteller** in [ticket/dauerText.ts](../../src/plugins/feedback-board/ticket/dauerText.ts): `dauerAussage` muss für JEDEN Status einen Satz liefern — ein Test erzwingt das. Schweigen wäre die schlechteste Antwort.

## Optional, je nach Status-Semantik

- **Sponsoring**: `isSponsoringOpen` ([feedbackSponsoring.ts](../../src/core/services/feedback/feedbackSponsoring.ts)) zählt auf, in welchen Status noch unterstützt werden darf.
- **Smart Views**: braucht der neue Status eine eigene Sicht (wie `rueckfrage` → „Wartet auf mich" / „Rückfragen offen")? → [smartViews.ts](../../src/plugins/feedback-board/smartViews.ts).
- **Board-Sichtbarkeit**: die Board-Basis blendet `archiviert` aus ([FeedbackBoardPage.tsx](../../src/plugins/feedback-board/FeedbackBoardPage.tsx), `istArchiviert`). Soll der neue Status ebenfalls verborgen sein, dort ergänzen.

## Nicht ändern

- **Legacy-`admin_status`-Field** in `FeedbackItem` — bleibt als `@deprecated` für Read-Migration von Pre-v1.9-Daten. Neuen Status NICHT dort einpflegen.

## Verifikation

- `npm run typecheck` — TS prüft die `Record<FeedbackStatus, …>`-Vollständigkeit. Das fängt die meisten Stellen, aber **nicht** die Lane-Liste und nicht den Key-Bump.
- `npm run test` — die Board-Tests fangen Reihenfolge und Bucketing.
- Selbst ansehen (`npm run dev:local`): Board zeigt die neue Spalte samt Summenzeile, die Status-Facette zählt sie, der Chip setzt sie, und im Detail steht der passende Klartext-Streifen.
