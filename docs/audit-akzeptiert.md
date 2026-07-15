# Akzeptierte / beobachtete npm-audit-Findings

Home für bewusst akzeptierte `npm audit`-Findings, die (noch) nicht behoben werden — plus eine Beobachtungsliste transitiver Pakete, die erfahrungsgemäß auffällig werden.

**Ist-Zustand (Stand 2026-07-15):** `npm audit` meldet **0 Findings**. Aktuell ist **nichts** bewusst akzeptiert.

Kontext: In dieser Runde wurden `@zip.js/zip.js`, `file-saver`, `@types/file-saver`, `docx` (tot) entfernt, `xlsx` auf `0.20.3` (SheetJS-Registry-Tarball) gehoben und `npm audit fix` (ohne `--force`) gelaufen — damit sind die vormals 15 Findings (u.a. `xlsx` High, `react-router`/`qs`/`vite` moderate/high) auf 0 zurückgegangen.

## Format für künftige Einträge

Eine Zeile je Finding:

| Paket | Advisory | Warum akzeptiert | Re-Check-Trigger |
|---|---|---|---|
| _(Beispiel)_ `foo` 1.2.3 | GHSA-xxxx | transitiv, kein untrusted Input auf dem Pfad | beim nächsten `foo`-Upgrade |

## Beobachtungsliste (nicht akzeptiert, nur im Blick)

- **`protobufjs`** — transitiv via `@huggingface/transformers` → `onnxruntime-web` gepinnt. Aktuell `7.6.5` und **nicht** als verwundbar gemeldet. Historisch war protobufjs eine Critical-Quelle; Angriffsfläche hier minimal (es werden ausschließlich lokal bereitgestellte ONNX-Modelle geparst, kein untrusted Input). **Re-Check beim nächsten Transformers-Upgrade** — sollte dann ein Advisory greifen und kein Fix verfügbar sein, hier als akzeptiertes Finding eintragen.
- **`shadcn` → `@modelcontextprotocol/sdk` → `express` → `qs`** — `shadcn` (CLI, via `theme.css`-`@import` build-relevant, deshalb **nicht** entfernbar) zieht diesen Ast in den Baum. Aktuell alle Versionen gefixt (`qs@6.15.3`), keine Findings. Falls hier künftig ein Advisory ohne Fix auftaucht: prüfen, ob `shadcn` durch ein reines CSS-Asset ersetzbar ist, sonst hier akzeptieren.
