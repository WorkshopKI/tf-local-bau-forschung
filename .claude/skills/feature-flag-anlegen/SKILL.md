---
name: feature-flag-anlegen
description: Use when ein Feature, Plugin oder Bereich per Build-Time-Flag an- oder abschaltbar werden soll (features.<flag>, config-schema.mjs, feature-flags.ts, Variant-Configs, Prod-Verbote).
---

# Feature-Flag anlegen

Touch-Point-Liste: [docs/agents/add-feature-flag.md](../../../docs/agents/add-feature-flag.md) — die einzige Quelle; hier steht nur der Ablauf.

1. Das Cheatsheet lesen, **bevor** die erste Datei angefasst wird.
2. **Jeden** Touch-Point der Liste abarbeiten und abhaken. Erweist sich beim Bauen ein weiterer als nötig: das Cheatsheet ergänzen, nicht nur den Code.
3. `npm run check:quick`; welcher Build danach: [which-build-to-run.md](../../../docs/agents/which-build-to-run.md).
