# Bildschirmseiten-Kontext-Doc pflegen

Die Feedback-Verbesserung (`src/core/services/feedback/feedbackImprove.ts`) gibt der
internen KI pro Seite ein kompaktes Markdown-Doc aus `docs/feedback-kontext/` als
Kontext mit. Damit die KI nicht mit veraltetem App-Wissen arbeitet (wie es
`DEFAULT_SYSTEM_PROMPT` vor v2.165 tat), müssen diese Docs mit Feature-Änderungen
mitziehen.

## Wann pflegen

Wenn ein Patch **UI-Elemente, sichtbare Begriffe oder das Datenmodell** eines
bestehenden Plugins wesentlich ändert (neuer Tab, neue Haupt-Aktion, umbenannte
Begriffe, neue zentrale Entität). Reine interne Refactorings ohne sichtbare/
fachliche Änderung: nicht anfassen.

## Touch-Points

1. **Doc aktualisieren**: `docs/feedback-kontext/<plugin-id>.md` (Plugin-ID aus
   [src/plugins.config.ts](../../src/plugins.config.ts)). Kuration-Plugins (siehe
   `KURATION_PLUGIN_IDS` in [screenContext.ts](../../src/core/services/feedback/screenContext.ts))
   teilen sich `kuration.md` — dort den passenden Unterabschnitt anfassen.
2. **Schablone einhalten** (siehe [README.md](../feedback-kontext/README.md)):
   Zweck / UI-Elemente & Begriffe / Datenmodell dahinter / Typische Aktionen / Code.
3. **Kein Zeichen-Budget** — schreib so lang, wie die Seite es ehrlich braucht,
   und **kürze nie etwas Richtiges weg, nur um eine Zahl zu treffen**. Die
   Disziplin ist inhaltlich: WAS der Nutzer sieht gehört hierher, das WIE ins
   Architektur-Doc. Erzwungen ist nur eine Reißleine bei 10000 Zeichen (Unfall-
   Fänger, kein Budget).
4. **Neues Plugin**: siehe zuerst [add-plugin.md](add-plugin.md) für den vollen
   Touch-Point-Katalog — ein neues Kontext-Doc ist dort ein zusätzlicher Schritt,
   sonst schlägt der Guard fehl.
5. **Verifikation**: `npm run test` — Guard `screen-context-coverage` in
   [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)
   fängt fehlende Docs (neues Plugin ohne Doc) und Budget-Überschreitungen.

## Nicht ändern

- `_app.md` ist der globale Überblick (immer mitgesendet) — nur bei App-weiten
  Änderungen (neuer Hauptbereich, geändertes Grund-Datenmodell) anfassen, nicht bei
  Einzel-Plugin-Patches.
