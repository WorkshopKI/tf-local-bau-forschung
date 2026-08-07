# Welchen Build muss ich bauen?

Entscheidungs-Cheatsheet nach dem Patchen. Die Sichtbarkeits-**Matrix** (welches Plugin steht in welcher Variante) ist die Quelle der Wahrheit in [CLAUDE.md → Build-Varianten](../../CLAUDE.md); hier steht die **Ableitung** „Was habe ich angefasst → welche(n) Build bauen".

## Default-Regel

| Angefasst | Bauen |
|-----------|-------|
| **Immer** (jeder nicht-triviale Patch) | `npm run build:devpl` (dev + pl) |
| **zusätzlich** Code, der auch im schlanken End-User-Build läuft: `src/core/**`, `src/components/**`, `home`/`antraege`/`einstellungen` | `npm run build:prod` |
| alle drei | `npm run build:all` |

**Warum dev + pl als Standard?** Aus diesen beiden Builds testet der User
(`dist-single/dev/zah-dev.html` + `dist-single/zah-pl.html`); seit v3.0 liegt der ganze Fach-Stack
in **einer** Variante (`pl`) — Auslastung, Kuration, Gutachten und die Erprobungs-Bereiche werden
im prod-Build gar nicht kompiliert. Ein grüner `build:prod` beweist für diesen Code also nichts.
Umgekehrt beweist ein grüner `build:pl` nichts über prod, sobald geteilter Code angefasst wurde:
prod schaltet andere Flags, und was dort nicht mitkompiliert, fällt erst im prod-Build auf.

## So entscheidest du „welche Variante zeigt das?"

1. In welchem Plugin/welcher UI liegt der Code? → Zeile in der Sichtbarkeits-Matrix (CLAUDE.md).
2. Hängt das Rendering an einem `features.*`-Flag? → [feature-flags.ts](../../src/config/feature-flags.ts) + welche `configs/*.config.json` das Flag auf `true` setzen.
3. Diese Variante(n) bauen — plus immer `build:devpl` als Basis.

## Faustregeln nach Pfad

- `src/plugins/auslastung/**` → **pl**, also von `build:devpl` schon abgedeckt. (Memory-Feedback: wurde früher oft vergessen — deshalb steckt pl jetzt im Standard-Paar.)
- `src/plugins/{feedback,csv-sources-kuration,programme-kuration,dokumentenquellen-kuration,filter-kuration,dokument-review,kurator}/**` oder etwas hinter `features.kuratorMenus` → **pl** (dort liegt die Kuration seit v3.0).
- `src/plugins/{home,antraege,einstellungen}/**`, `src/core/**`, `src/components/**` → `build:devpl` **plus** `build:prod`: dieser Code läuft auch im End-User-Build, und ein variant-gegatetes Verhalten (z.B. `csvAutoRefresh`, `maLogin`, `auth`, `moduleAuth`, `datenShareSchreibrecht`) schaltet dort anders.

## Achtung: gesperrte Module im pl-Build

Auslastung und Kuration liegen in `pl` hinter je einem Zusatzpasswort
([modul-freischaltung.md](../architecture/modul-freischaltung.md)). Ein frisch geöffneter
`zah-pl.html` zeigt sie **nicht** — das ist kein Fehler. Zum Prüfen entweder das Modul-Passwort
an der Start-Wall eingeben oder in den Einstellungen freischalten.

Für Sicht-Checks ohne Passwort ist `npm run dev:local` der schnellere Weg: die Variante „local"
trägt keinen `moduleAuth`-Block, dort ist alles offen.

## Verifikation des Builds

Pro gebauter Variante: HTML unter `dist-single/` per Doppelklick in Chrome/Edge (`file://`) öffnen — keine Console-Errors, Sidebar mit korrektem Variant-Label, Tab-Titel passt. Siehe [CLAUDE.md → Build-Varianten](../../CLAUDE.md) und [README.md → Voraussetzungen für jeden Patch](README.md).
