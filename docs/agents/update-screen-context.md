# Bildschirmseiten-Kontext-Doc pflegen

Die Docs in `docs/feedback-kontext/` haben **zwei Leser**:

1. die **Feedback-Verbesserung** (`src/core/services/feedback/feedbackImprove.ts`), die
   der internen KI pro Seite ein Doc als App-Wissen mitgibt — damit sie nicht mit
   veraltetem Wissen arbeitet (wie es `DEFAULT_SYSTEM_PROMPT` vor v2.165 tat);
2. die **Seiten-Hilfe** (`getSeitenHilfe` in derselben `screenContext.ts`), die dasselbe
   Doc als Kurzanleitung im „Hilfe"-Dialog der Seite zeigt — **ohne** den Technik-Teil.

Ein veraltetes Doc ist damit nicht mehr nur eine schlechtere KI-Antwort, sondern eine
falsche Hilfeseite. Diese Docs ziehen mit Feature-Änderungen mit.

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
3. **Technisches nach unten**: Route, Feature-Flag, Stores, Dateinamen liest nur die
   KI. Sie stehen entweder in den Zeilen `**Datenmodell dahinter:**` / `**Code:**`
   oder unter einer `## Technik`-Überschrift am Ende — beides schneidet
   `entferneTechnik()` für den Hilfe-Dialog weg. Alles andere **sieht der Nutzer**:
   also in seiner Sprache schreiben, nicht in Bezeichnern.
4. **Kein Zeichen-Budget** — schreib so lang, wie die Seite es ehrlich braucht,
   und **kürze nie etwas Richtiges weg, nur um eine Zahl zu treffen**. Die
   Disziplin ist inhaltlich: WAS der Nutzer sieht gehört hierher, das WIE ins
   Architektur-Doc. Erzwungen ist nur eine Reißleine bei 10000 Zeichen (Unfall-
   Fänger, kein Budget).
5. **Neues Plugin**: siehe zuerst [add-plugin.md](add-plugin.md) für den vollen
   Touch-Point-Katalog — ein neues Kontext-Doc ist dort ein zusätzlicher Schritt,
   sonst schlägt der Guard fehl.
6. **Verifikation**: `npm run test` — Guard `screen-context-coverage` in
   [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)
   fängt fehlende Docs (neues Plugin ohne Doc) und die Reißleine;
   [seitenHilfe.test.ts](../../src/core/services/feedback/__tests__/seitenHilfe.test.ts)
   prüft je Doc, dass außerhalb des Technik-Teils keine Datei-/Pfadangaben stehen.

## Nicht ändern

- `_app.md` ist der globale Überblick (immer mitgesendet) — nur bei App-weiten
  Änderungen (neuer Hauptbereich, geändertes Grund-Datenmodell) anfassen, nicht bei
  Einzel-Plugin-Patches.
