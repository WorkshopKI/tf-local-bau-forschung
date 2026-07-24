# Textbaustein-Katalog (NF / RNE / ABL)

Kuratierte, **versionierte, freigebbare** Textbausteine als App-Daten — die
gemeinsame Substanz hinter Nachforderungen (NF), Rücknahmeempfehlungen (RNE) und
Ablehnungen (ABL). Word ist nur noch **Einfuhrquelle** (Import-Assistent), nicht mehr
Ablageort; der frühere Code-Seed `nf-bausteine.seed.ts` bleibt als **Migrationsquelle**
bestehen.

Service: [src/core/services/skills/textbausteine/](../../src/core/services/skills/textbausteine/),
exportiert über das Skill-Dach-Barrel `@/core/services/skills`.

## Warum eigene Sidecar, nicht die Registry

Ablage: `_intern/skills/textbausteine.json` **neben** `registry.json`, nicht in ihr.
Zwei Gründe: kleinere Write-Konflikt-Fläche (Baustein-Pflege und Skill-Pflege sind
verschiedene Tätigkeiten, oft verschiedener Personen), und `registry.json` bleibt
unangetastet. Storage-Profil ist 1:1 das der Skill-Registry ([storage.ts](../../src/core/services/skills/textbausteine/storage.ts)):

- `atomicWrite` mit Backup-Rotation (Sidecar-Profil idempotent-overwrite, Pitfall #23).
- **Self-gated** über `queryPermission` — nur Rollen mit readwrite (Kurator/PL/dev)
  schreiben tatsächlich, alle anderen laufen als No-op (`false`).
- IDB-Cache im generischen **`kv`**-Store (`textbaustein-katalog:cache`) — **kein**
  dedizierter Object-Store und **kein** DB-Version-Bump (ein Bump triggert unter
  `file://` mit parallel offenen Varianten ein `onblocked`-Upgrade).
- Tolerante Normalisierung: unbekannte Felder fallen weg, fehlende bekommen Defaults,
  kaputte Einträge werden übersprungen. Ein von Hand editiertes JSON legt die Werkbank
  nicht lahm.

## Datenmodell

`TextbausteinRecord` ([types.ts](../../src/core/services/skills/textbausteine/types.ts)):
`id` · `artefaktTyp` (`nf`|`rne`|`abl`) · `scope?` (bei nf aus dem ID-Präfix G/T) ·
`thema` · `kategorie` · `aspekte[]` (A–J) · `stichworte[]` · `text` (verbatim) ·
`platzhalter[]` · `status` · `version` · `historie[]` · `geaendertAm`/`geaendertVon`.

Zwei Invarianten tragen den Rest:

- **Verbatim-Regel (Pitfall #34, unantastbar):** `text` ist Rechtstext und wird NIE
  umformuliert — weder beim Import noch bei der Generierung. Das LLM füllt Platzhalter
  bzw. wählt bei Alternativen die zutreffende Variante, sonst nichts. Deshalb ist
  `platzhalter` **kein Eingabefeld**, sondern wird bei jeder Bearbeitung und bei jedem
  Laden deterministisch aus `text` abgeleitet (`extractPlatzhalter` — es gibt genau
  diesen einen Parser, kein zweiter wird geschrieben). Aus der Datei gelesene
  Platzhalter werden verworfen.
- **Kein Löschen.** Ein Baustein, der nicht mehr verwendet werden soll, wird
  `stillgelegt` — er bleibt lesbar, damit alte Artefakte nachvollziehbar bleiben.

## Fassungen + Freigabe

[versionierung.ts](../../src/core/services/skills/textbausteine/versionierung.ts), rein
(Zeitstempel kommt von aussen, damit Tests nicht an der Uhr hängen), Muster
`registry/versioning.ts`: Historie **newest-first**, `historie[0]` ≙ aktueller Stand,
gekappt auf `MAX_HISTORIE`.

- **Bearbeiten** ⇒ neue Version + Snapshot. Inhaltsgleiche Bearbeitung ist ein No-op
  (kein Leerlauf-Eintrag). Der Status ist eine **eigene Achse**:
- **Freigeben / Stilllegen / Zurück-in-Entwurf** sind Statuswechsel MIT Snapshot
  (auditierbar — wer wann freigegeben hat, ist die relevante Information). Neue
  Bausteine starten **immer** als `entwurf`.
- **Rollback** auf eine Historien-Fassung = **neue** Version mit deren Inhalt (nie ein
  Zurückschneiden). Der **Status** wird bewusst NICHT mit zurückgerollt: ob ein
  Baustein freigegeben ist, gilt dem heutigen Stand, nicht dem alten Text.

## Selektoren + Suche

[suche.ts](../../src/core/services/skills/textbausteine/suche.ts), rein, Katalog als
**Argument** (kein async im Aufrufpfad):

- `freigegebeneBausteine(katalog, typ, scope?)` — die **EINZIGE** Quelle für alles, was
  ein Artefakt erzeugt. Entwürfe und Stillgelegte dürfen nie in einen Bescheid geraten.
- `bewerteBausteine` / `sucheBausteine` — Wortstamm-Vergleich, kein Ranking-Modell.
  Gewichte absteigend: **Aspekt-Tag (6)** > Thema (3) > Stichwort (2) > Text (1); je
  Suchwort zählt nur der höchste Fundort. `treffer[]` benennt, WAS angeschlagen hat —
  der Vorschlag bleibt begründbar. Eine Baustein-Auswahl ist deterministisch ableitbar
  und gehört deshalb **nicht** ans LLM.

Der MAP-Abschluss ([nf-suche.ts](../../src/plugins/map-foerderfaehig/abschluss/nf-suche.ts))
ist seit v2.309 eine **dünne Schale** um `bewerteBausteine` — Gewichte/Stoppwörter/
Wortzerlegung liegen genau einmal. Quelle dort ist weiterhin der **Seed** `NF_BAUSTEINE`
(die beiden Aufrufer sind rein/synchron, der Katalog lädt async); solange beide Stände
identisch sind, ist das folgenlos. Die Umstellung auf den Katalog gehört in dieselbe
Phase wie die Bearbeitbarkeit dort.

## NF-Seed-Migration

[migration.ts](../../src/core/services/skills/textbausteine/migration.ts): ist die
Sidecar leer/fehlend, werden die 78 `NF_BAUSTEINE` als **Version 1, `freigegeben`**
übernommen (sie sind seit v2.283 im Einsatz — als `entwurf` wären sie über Nacht aus
jeder NF verschwunden). `aspekte` bleibt zunächst leer (der Seed kennt keine Tags),
Nachpflege in der Verwaltung.

- **Idempotent, nie überschreibend:** ergänzt werden nur IDs, die im Katalog FEHLEN.
  Ein kuratierter Baustein — auch ein stillgelegter — bleibt unangetastet; weil es kein
  Löschen gibt, kann eine Stilllegung nicht durch den Seed wiederauferstehen. Zweiter
  Lauf gibt dieselbe Katalog-Referenz zurück → der Aufrufer schreibt nicht unnötig.
- **Fester Migrations-Zeitstempel** (`NF_MIGRATION_TS`), keine Uhr — sonst unterschieden
  sich zwei Installationen im Datei-Inhalt bei gleichem Stand.
- **Erst-Write erst beim Speichern:** `loadTextbausteinKatalog` füllt nur den lokalen
  IDB-Cache; die Sidecar entsteht auf dem Share, wenn ein Kurator/PL in der Verwaltung
  zum ersten Mal speichert oder importiert (STOPP-R-freigegeben, Erst-Nutzlast ~109 KB).

## Audit-Stempel am Lauf

`WorkflowRun.katalogRef?` ([gutachten/types.ts](../../src/plugins/antraege/gutachten/types.ts),
additiv-optional, kein Schema-Bump) hält `{ stand, bausteinVersionen }` — mit welchem
Katalog-Stand und welchen Baustein-Fassungen ein Artefakt erzeugt wurde (Muster
`vorlageRef`). Nur bei baustein-getragenen Artefakten (NF/RNE/ABL) gesetzt, nie beim
Gutachten. Die NF-Generierung ([useNachforderungen.ts](../../src/plugins/antraege/nachforderungen/useNachforderungen.ts))
liest ab v2.309 den Katalog (nur `freigegebeneBausteine`) und stempelt `katalogRef`.

## dev/pl/kurator-Parität

Die Pflege lebt im Skill-Verwaltungs-Plugin (`isSkillVerwaltungEnabled()`, aktiv in
dev + pl + kurator) — **kein** eigenes Varianten-Gate. Wer die Verwaltung sieht, kann
den Katalog voll pflegen. Details zum Verwaltungs-Tab und Word-Import: Phase 3 (folgt).
