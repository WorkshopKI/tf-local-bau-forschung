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

2. **UI-Konstanten** in [src/components/feedback/constants.ts](../../src/components/feedback/constants.ts):
   - `STATUS_LABELS` — sichtbares Label (`'In Review'`).
   - `STATUS_COLORS` — Badge-Klassen, eine bestehende Theme-Var wiederverwenden (z.B. `bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]`), **nicht** eigene Hex-Farben.
   Beide sind `Record<FeedbackStatus, …>` — TypeScript erzwingt nach Step 1 die Vollständigkeit.

3. **Kurator-Filter** in [src/plugins/feedback/sections/FeedbackTicketList.tsx](../../src/plugins/feedback/sections/FeedbackTicketList.tsx):
   - Wenn dort eine Status-Filter-Reihe mit hartcodierter Liste existiert (statt `STATUS_LABELS`-Iteration), die Liste ergänzen.
   - Sortierreihenfolge im Dropdown beachten (typischerweise: aktive Stati zuerst, archivierte am Ende).

4. **Kurator-Aktionen** in [src/plugins/feedback/sections/FeedbackTicketDetail.tsx](../../src/plugins/feedback/sections/FeedbackTicketDetail.tsx):
   - Falls dort ein Status-Wechsel-Dropdown existiert — entweder iteriert es über `STATUS_LABELS` (dann nichts zu tun) oder hat eine eigene Liste (ergänzen).

## Optional, je nach Status-Semantik

- **Counter** auf der Sidebar-Tab: wenn der neue Status zum Tab-Badge zählen soll, in `FeedbackAdminPage.tsx` die Filter-Logik anpassen (`tickets.length` zählt aktuell alle).
- **Sponsoring-Workflow**: Stati `umgesetzt` und `abgelehnt` lösen Punkte-Rückbuchung in [budgetService.ts](../../src/core/services/feedback/budgetService.ts) aus. Wenn der neue Status auch eine Rückbuchung triggern soll, dort ergänzen.
- **Board-Sichtbarkeit**: das öffentliche Board (`feedback-board`-Plugin) filtert standardmäßig `archiviert` aus. Wenn der neue Status auch versteckt werden soll, in der Board-Filter-Logik ergänzen.

## Nicht ändern

- **Legacy-`admin_status`-Field** in `FeedbackItem` — bleibt als `@deprecated` für Read-Migration von Pre-v1.9-Daten. Neuen Status NICHT dort einpflegen.

## Verifikation

- `npm run typecheck` — TS prüft die `Record<FeedbackStatus, …>`-Vollständigkeit.
- `npm run test` — vorhandene Feedback-Tests fangen Mapping-Lücken.
- Manuell: Feedback-Plugin im Kurator-Tab öffnen, Test-Ticket erstellen, Status setzen, Badge rendert mit dem neuen Label + Farbe.
