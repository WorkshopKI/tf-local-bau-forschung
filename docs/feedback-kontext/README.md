# docs/feedback-kontext/

**Zweck:** Dieses Verzeichnis liefert kompakte Bildschirmseiten-Kontext-Docs, die der internen KI bei der Feedback-Verbesserung als App-Wissen mitgegeben werden. Geladen wird per `import.meta.glob` in [src/core/services/feedback/screenContext.ts](../../src/core/services/feedback/screenContext.ts) — statisch ins Single-File-Build gebündelt (kein `fetch`/dynamischer Import, siehe Pitfalls #1/#2).

**Pflege-Regel:** Bei UI- oder Datenmodell-Änderungen an einem Plugin das zugehörige `<plugin-id>.md` mit aktualisieren. Vorgehen siehe [docs/agents/update-screen-context.md](../agents/update-screen-context.md).

**Budget (automatisiert erzwungen via Convention-Test):**
- Pro Plugin-Doc: ≤ 50 Zeilen / ≤ 2500 Zeichen
- `_app.md` (globaler App-Überblick, immer mitgesendet): ≤ 70 Zeilen / ≤ 4000 Zeichen
- `kuration.md` (Sammel-Doc für die 8 Kurator-Seiten): ≤ 2500 Zeichen insgesamt

**Registry:** Der Dateiname entspricht der Plugin-ID aus [src/plugins.config.ts](../../src/plugins.config.ts) (z.B. `antraege.md` für Plugin-ID `antraege`). Die 8 Kuration-Kategorie-Plugins (`kurator`, `programme-kuration`, `csv-sources-kuration`, `dokumentenquellen-kuration`, `anfragen-kuration`, `filter-kuration`, `feedback-kuration`, `dokument-review`) teilen sich `kuration.md` statt eigener Dateien.
