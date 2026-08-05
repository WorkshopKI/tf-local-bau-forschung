# Welchen Build muss ich bauen?

Entscheidungs-Cheatsheet nach dem Patchen. Die Sichtbarkeits-**Matrix** (welches Plugin steht in welcher Variante) ist die Quelle der Wahrheit in [CLAUDE.md → Build-Varianten](../../CLAUDE.md); hier steht die **Ableitung** „Was habe ich angefasst → welche(n) Build bauen".

## Default-Regel

| Angefasst | Bauen |
|-----------|-------|
| **Immer** (jeder nicht-triviale Patch) | `npm run build:devprod` (dev + prod) |
| **zusätzlich** Fach-Stack: `src/plugins/auslastung/**`, Kuration-Plugins, Gutachten-/Artefakt-Kette, Erprobungs-Bereiche | `npm run build:pl` |
| alle drei | `npm run build:all` |

**Warum „zusätzlich"?** Der prod-Build (`zim-dashboard.html`) ist bewusst schlank — Auslastung,
Kuration, Gutachten und die Erprobungs-Bereiche werden dort gar nicht kompiliert oder gerendert.
Ein grüner `build:prod` beweist für diesen Code also nichts. Seit v3.0 liegt der ganze Fach-Stack
in **einer** Variante (`pl`); ein eigener kurator-Build existiert nicht mehr.

## So entscheidest du „welche Variante zeigt das?"

1. In welchem Plugin/welcher UI liegt der Code? → Zeile in der Sichtbarkeits-Matrix (CLAUDE.md).
2. Hängt das Rendering an einem `features.*`-Flag? → [feature-flags.ts](../../src/config/feature-flags.ts) + welche `configs/*.config.json` das Flag auf `true` setzen.
3. Diese Variante(n) bauen — plus immer `build:devprod` als Basis.

## Faustregeln nach Pfad

- `src/plugins/auslastung/**` → **pl**. (Memory-Feedback: wird oft vergessen.)
- `src/plugins/{feedback,csv-sources-kuration,programme-kuration,dokumentenquellen-kuration,filter-kuration,dokument-review,kurator}/**` oder etwas hinter `features.kuratorMenus` → **pl** (dort liegt die Kuration seit v3.0).
- `src/plugins/{home,antraege,einstellungen}/**`, `src/core/**`, `src/components/**` → meist nur **devprod**; aber wenn die Änderung ein variant-gegatetes Verhalten berührt (z.B. `csvAutoRefresh`, `maLogin`, `auth`, `moduleAuth`, `datenShareSchreibrecht`), auch **pl** bauen.

## Achtung: gesperrte Module im pl-Build

Auslastung und Kuration liegen in `pl` hinter je einem Zusatzpasswort
([modul-freischaltung.md](../architecture/modul-freischaltung.md)). Ein frisch geöffneter
`zah-pl.html` zeigt sie **nicht** — das ist kein Fehler. Zum Prüfen entweder das Modul-Passwort
an der Start-Wall eingeben oder in den Einstellungen freischalten.

Für Sicht-Checks ohne Passwort ist `npm run dev:local` der schnellere Weg: die Variante „local"
trägt keinen `moduleAuth`-Block, dort ist alles offen.

## Verifikation des Builds

Pro gebauter Variante: HTML unter `dist-single/` per Doppelklick in Chrome/Edge (`file://`) öffnen — keine Console-Errors, Sidebar mit korrektem Variant-Label, Tab-Titel passt. Siehe [CLAUDE.md → Build-Varianten](../../CLAUDE.md) und [README.md → Voraussetzungen für jeden Patch](README.md).
