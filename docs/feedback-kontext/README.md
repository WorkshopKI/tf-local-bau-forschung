# docs/feedback-kontext/

**Zweck:** Dieses Verzeichnis liefert kompakte Bildschirmseiten-Kontext-Docs. Geladen wird per `import.meta.glob` in [src/core/services/feedback/screenContext.ts](../../src/core/services/feedback/screenContext.ts) — statisch ins Single-File-Build gebündelt (kein `fetch`/dynamischer Import, siehe Pitfalls #1/#2).

**Zwei Leser, eine Datei:** die interne KI bekommt bei der Feedback-Verbesserung das **ganze** Doc als App-Wissen; die **Seiten-Hilfe** (`getSeitenHilfe` in derselben Datei) zeigt dasselbe Doc als Kurzanleitung im „Hilfe"-Dialog der Seite, **ohne** den Technik-Teil. Eine zweite, nutzer-eigene Doku-Datei wäre gegen diese hier gedriftet und hätte jede Feature-Änderung zweimal gekostet — der Preis dafür ist die Strip-Regel: **Route, Feature-Flag, Stores und Dateinamen gehören in die Zeilen `Datenmodell dahinter:` / `Code:` oder unter eine `## Technik`-Überschrift am Ende.** Alles andere sieht der Nutzer — also in seiner Sprache schreiben, nicht in Bezeichnern.

**Pflege-Regel:** Bei UI- oder Datenmodell-Änderungen an einem Plugin das zugehörige `<plugin-id>.md` mit aktualisieren. Vorgehen siehe [docs/agents/update-screen-context.md](../agents/update-screen-context.md).

**Es gibt kein Zeichen-Budget.** Schreib das Doc so lang, wie es die Seite ehrlich beschreibt — **kürze nie etwas Richtiges weg, nur um eine Zahl zu treffen.**

Warum kein Budget: pro Feedback-Lauf gehen genau zwei Docs raus (`_app.md` plus das eine Seiten-Doc, nie alle) — bei den heutigen Größen ~2000 Token gegen ein Modell mit 62k–256k Kontext. „Sonst sprengt es den Prompt" war jahrelang die Begründung für ein 2500-Limit und war immer falsch; das Limit band real (10 von 16 Docs klebten knapp darunter) und kostete pro Feature eine Kürz-Runde.

**Die Disziplin ist inhaltlich, nicht numerisch:** hier steht, **WAS der Nutzer sieht und benennt** — Bildschirm-Elemente, Begriffe, typische Aktionen. Das **WIE** (Datenfluss, Persistenz, Guards) gehört ins Architektur-Doc unter `docs/architecture/`. Ein Doc, das anschwillt, hat fast immer WIE drin. Dagegen hilft Lesen, keine Zahl.

Erzwungen wird nur noch zweierlei (Convention-Test `screen-context-coverage`): **jede nicht-dev Plugin-ID hat ein Doc** (`kuration.md` gilt als eines für alle 8 Kurator-Seiten), und eine **Reißleine bei 10000 Zeichen** — kein Budget, sondern ein Unfall-Fänger (Architektur-Doc reinkopiert, generierter Dump). Wer sie legitim braucht, hebt sie bewusst an.

**Registry:** Der Dateiname entspricht der Plugin-ID aus [src/plugins.config.ts](../../src/plugins.config.ts) (z.B. `antraege.md` für Plugin-ID `antraege`). Die 8 Kuration-Kategorie-Plugins (`kurator`, `programme-kuration`, `csv-sources-kuration`, `dokumentenquellen-kuration`, `anfragen-kuration`, `filter-kuration`, `feedback-kuration`, `dokument-review`) teilen sich `kuration.md` statt eigener Dateien.
