# docs/feedback-kontext/

**Zweck:** Dieses Verzeichnis liefert kompakte Bildschirmseiten-Kontext-Docs, die der internen KI bei der Feedback-Verbesserung als App-Wissen mitgegeben werden. Geladen wird per `import.meta.glob` in [src/core/services/feedback/screenContext.ts](../../src/core/services/feedback/screenContext.ts) — statisch ins Single-File-Build gebündelt (kein `fetch`/dynamischer Import, siehe Pitfalls #1/#2).

**Pflege-Regel:** Bei UI- oder Datenmodell-Änderungen an einem Plugin das zugehörige `<plugin-id>.md` mit aktualisieren. Vorgehen siehe [docs/agents/update-screen-context.md](../agents/update-screen-context.md).

**Grenze: ≤ 4000 Zeichen pro Doc** (erzwungen via Convention-Test `screen-context-coverage`; `kuration.md` gilt als EIN Doc für alle 8 Kurator-Seiten).

Das ist eine **Kurations-Disziplin, kein Kontext-Budget.** Pro Feedback-Lauf gehen genau zwei Docs raus — `_app.md` plus das eine Seiten-Doc, nie alle — zusammen ~8000 Zeichen ≈ 2000 Token gegen ein Modell mit 62k–256k. Der Prompt-Anteil ist belanglos; „sonst sprengt es den Prompt" ist die falsche Begründung.

Was die Grenze leistet: sie schlägt an, wenn ein Doc von **WAS sieht und benennt der Nutzer** nach **WIE funktioniert es** driftet — Letzteres gehört ins Architektur-Doc. Der Feedback-Lauf ist einschüssig (ein Zug, ein JSON-Block); da entscheidet Relevanzdichte, nicht Menge.

Deshalb: **kürze nichts Richtiges weg, nur um Platz zu schaffen.** Wer anstößt, prüft zuerst, ob WIE-Text drinsteht. Wenn ein Doc die 4000 legitim braucht, ist das Anheben der Grenze die richtige Antwort — nicht das Verstümmeln des Docs.

**Registry:** Der Dateiname entspricht der Plugin-ID aus [src/plugins.config.ts](../../src/plugins.config.ts) (z.B. `antraege.md` für Plugin-ID `antraege`). Die 8 Kuration-Kategorie-Plugins (`kurator`, `programme-kuration`, `csv-sources-kuration`, `dokumentenquellen-kuration`, `anfragen-kuration`, `filter-kuration`, `feedback-kuration`, `dokument-review`) teilen sich `kuration.md` statt eigener Dateien.
