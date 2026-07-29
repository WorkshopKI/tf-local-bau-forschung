---
name: feedback-kontext-pflege
description: Use when a code change alters a plugin's visible UI, terminology, or data model — checks whether the plugin's docs/feedback-kontext/<id>.md needs updating so the internal AI feedback-improvement feature doesn't work from stale app knowledge.
---

# Feedback-Kontext pflegen

Nach einer Feature-Änderung an einem Plugin:

1. Betroffene Plugin-ID(s) bestimmen (`src/plugins.config.ts`).
2. Prüfen ob `docs/feedback-kontext/<id>.md` (bzw. `kuration.md` für
   Kuration-Plugins) noch zum neuen Ist-Zustand passt — Schablone: Zweck / UI-Elemente
   & Begriffe / Datenmodell dahinter / Typische Aktionen / Code.
3. Bei Bedarf aktualisieren, Budget einhalten (≤ 4000 Zeichen pro Doc,
   `kuration.md` insgesamt). Der Deckel ist reichlich — nichts Richtiges
   wegkürzen, nur um Platz zu schaffen.
4. `npm run test` — Guard `screen-context-coverage` muss grün bleiben.

Detail + Ausnahmen: [docs/agents/update-screen-context.md](../../../docs/agents/update-screen-context.md).
