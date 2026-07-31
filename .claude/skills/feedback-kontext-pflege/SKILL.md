---
name: feedback-kontext-pflege
description: Use when a code change alters a plugin's visible UI, terminology, or data model — checks whether the plugin's docs/feedback-kontext/<id>.md needs updating so the internal AI feedback-improvement feature doesn't work from stale app knowledge.
---

# Feedback-Kontext pflegen

Nach einer Feature-Änderung an einem Plugin:

1. Betroffene Plugin-ID(s) bestimmen (`src/plugins.config.ts`).
2. Prüfen ob `docs/feedback-kontext/<id>.md` (bzw. `kuration.md` für
   Kuration-Plugins) noch zum neuen Ist-Zustand passt — Schablone: Zweck /
   UI-Elemente & Begriffe (Aufzählung je UI-Bereich) / Typische Aktionen
   (Aufzählung) / `## Technik` als **letzte** Sektion. Das Doc ist zugleich die
   Hilfeseite: Leerzeile zwischen allen Blöcken, kein Absatz über 1200 Zeichen,
   oberhalb von `## Technik` keine Route/Flag/Komponente in Backticks.
   Volle Schablone: [docs/feedback-kontext/README.md](../../../docs/feedback-kontext/README.md).
3. Bei Bedarf aktualisieren. **Kein Zeichen-Budget** — nie etwas Richtiges
   wegkürzen, nur um eine Zahl zu treffen. Nur eine Reißleine bei 10000 Zeichen
   (Unfall-Fänger). Disziplin ist inhaltlich: WAS der Nutzer sieht, nicht WIE.
4. `npm run test` — Guards `screen-context-coverage` und `seitenHilfe.test.ts`
   müssen grün bleiben.

Detail + Ausnahmen: [docs/agents/update-screen-context.md](../../../docs/agents/update-screen-context.md).
