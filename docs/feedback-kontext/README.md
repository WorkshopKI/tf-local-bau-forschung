# docs/feedback-kontext/

**Zweck:** Dieses Verzeichnis liefert kompakte Bildschirmseiten-Kontext-Docs, die der internen KI bei der Feedback-Verbesserung als App-Wissen mitgegeben werden. Geladen wird per `import.meta.glob` in [src/core/services/feedback/screenContext.ts](../../src/core/services/feedback/screenContext.ts) — statisch ins Single-File-Build gebündelt (kein `fetch`/dynamischer Import, siehe Pitfalls #1/#2).

**Pflege-Regel:** Bei UI- oder Datenmodell-Änderungen an einem Plugin das zugehörige `<plugin-id>.md` mit aktualisieren. Vorgehen siehe [docs/agents/update-screen-context.md](../agents/update-screen-context.md).

**Budget: ≤ 4000 Zeichen pro Doc** (erzwungen via Convention-Test `screen-context-coverage`; `kuration.md` gilt als EIN Doc für alle 8 Kurator-Seiten). Pro Feedback-Lauf gehen genau **zwei** Docs raus — `_app.md` plus das eine Seiten-Doc, nie alle — also ≤ 8000 Zeichen (~2000 Token) gegen einen Bridge-Kontext, der anderswo 62k–80k Token trägt. Das Budget ist ein Deckel gegen Wildwuchs, kein Sparzwang: **kürze nichts Richtiges weg, nur um Platz zu schaffen.** Wer an die Grenze stößt, hat meist zu viel WIE im Doc — das gehört ins Architektur-Doc, hier steht nur, was der Nutzer sieht und benennt.

**Registry:** Der Dateiname entspricht der Plugin-ID aus [src/plugins.config.ts](../../src/plugins.config.ts) (z.B. `antraege.md` für Plugin-ID `antraege`). Die 8 Kuration-Kategorie-Plugins (`kurator`, `programme-kuration`, `csv-sources-kuration`, `dokumentenquellen-kuration`, `anfragen-kuration`, `filter-kuration`, `feedback-kuration`, `dokument-review`) teilen sich `kuration.md` statt eigener Dateien.
