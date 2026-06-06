# Welchen Build muss ich bauen?

Entscheidungs-Cheatsheet nach dem Patchen. Die Sichtbarkeits-**Matrix** (welches Plugin steht in welcher Variante) ist die Quelle der Wahrheit in [CLAUDE.md → Build-Varianten](../../CLAUDE.md); hier steht die **Ableitung** „Was habe ich angefasst → welche(n) Build bauen".

## Default-Regel

| Angefasst | Bauen |
|-----------|-------|
| **Immer** (jeder nicht-triviale Patch) | `npm run build:devprod` (dev + prod) |
| **zusätzlich** `src/plugins/auslastung/**` oder Auslastungs-/PL-Code (Matching, Kompetenz, Korpus, Zuweisung) | `npm run build:pl` |
| **zusätzlich** kurator-only-Code (Kuration-Plugins, `kuratorOnly`-UI, Kurator-Session/-Gate) | `npm run build:kurator` |
| `demo` / alle Varianten | nur auf ausdrückliche Anfrage (`build:demo` / `build:all`) |

**Warum „zusätzlich"?** Das Auslastungs-Modul ist nur in **pl + dev** sichtbar (`features.auslastung`), die Kuration-Menüs nur in **kurator + dev** (`features.kuratorMenus`). Eine Auslastungs-/Kurator-Änderung wird im prod-Build gar nicht kompiliert/gerendert → ein grüner `build:prod` beweist dort nichts. Darum die rollen-passende Variante mitbauen.

## So entscheidest du „welche Variante zeigt das?"

1. In welchem Plugin/welcher UI liegt der Code? → Zeile in der Sichtbarkeits-Matrix (CLAUDE.md).
2. Hängt das Rendering an einem `features.*`-Flag? → [feature-flags.ts](../../src/config/feature-flags.ts) + welche `configs/*.config.json` das Flag auf `true` setzen.
3. Diese Variante(n) bauen — plus immer `build:devprod` als Basis.

## Faustregeln nach Pfad

- `src/plugins/auslastung/**` → **pl**. (Memory-Feedback: wird oft vergessen.)
- `src/plugins/{feedback,csv-sources-kuration,programme-kuration,dokumentenquellen-kuration,filter-kuration,dokument-review,kurator,suche-kuration}/**`, oder etwas hinter `features.kuratorMenus` → **kurator**.
- `src/plugins/{home,antraege,einstellungen}/**`, `src/core/**`, `src/components/**` → meist nur **devprod**; aber wenn die Änderung ein variant-gegatetes Verhalten berührt (z.B. `csvAutoRefresh`, `maLogin`, `auth`, `datenShareSchreibrecht`), auch die betroffene Variante bauen.

## Verifikation des Builds

Pro gebauter Variante: HTML unter `dist-single/` per Doppelklick in Chrome/Edge (`file://`) öffnen — keine Console-Errors, Sidebar mit korrektem Variant-Label, Tab-Titel passt. Siehe [CLAUDE.md → Build-Varianten](../../CLAUDE.md) und [README.md → Voraussetzungen für jeden Patch](README.md).
