# Glossar

## Zweck

Nachschlagen, was die App und das Fachsystem benennen: Abkürzungen wie NF, RNE
oder ZuwB, dazu Begriffe wie Verfahrensschritt, Zieltage oder Betrachtungsbereich.

Die Seite **ändert nichts**. Statuswerte, Kürzel und Regeln werden weiterhin unter
„Vorgangs-Regeln" gepflegt; hier stehen sie nur lesend. Zwei Orte für dieselbe
Wahrheit wären schlimmer als ein umständlicher Weg.

## UI-Elemente & Begriffe

- **Suchfeld** — steht oben **links**, vor den Reitern, und hat beim Öffnen den
  Fokus. Es sucht über alles gleichzeitig: wer nachschlägt, weiß meist noch
  nicht, ob das Gesuchte eine Abkürzung, ein Kürzel oder ein Statuswert ist. Es
  wirkt in **beiden** Reitern, und der Suchbegriff bleibt beim Wechsel stehen.
  Gesucht wird über Abkürzung, Begriff, Erklärung, Statuscode, Kürzel,
  Spaltenname und Ordner — Groß-/Kleinschreibung egal.
  - **Bedienung** — „/" springt ins Feld, Pfeil hoch/runter wandert durch die
    Treffer (die Erklärung rechts wechselt mit), Enter nimmt den ersten Treffer,
    Escape oder das ×-Zeichen leert.
  - **Markierung** — die Fundstelle ist im Treffer farbig hervorgehoben. Steht
    sie in Text, den die Liste nicht zeigt (Erklärung, Ordner), bleibt die Zeile
    unmarkiert; gefunden wurde sie trotzdem darüber.
- **Reiter „Nachschlagen" und „Für meine Rolle wichtig"** — die eine Sicht sucht
  über alles, die andere zeigt die Kürzel einer Fachrolle. Die Zahl am zweiten
  Reiter zählt die Kürzel, die die laufende Suche übrig lässt.
- **Liste links** — die Treffer, nach Art gruppiert, jede Gruppe mit Zähler.
  Gruppen ohne Treffer fallen weg.
  - **Abkürzungen & Begriffe** — der einzige eigene Bestand der Seite. Was hier
    steht, steht nirgends sonst.
  - **Statuswerte** — Code, Bezeichnung, Verfahrensschritt, Arbeitsliste,
    Zieltage und wie oft der Status im Bestand vorkommt.
  - **Kürzel** — Spalte, wer es setzt, Ordner, Vorkommen.
  - **To-do-Regeln** — unter welcher Bedingung eine Regel greift und was sie
    dann sagt.
- **Erklärung rechts** — der gewählte Eintrag. Ohne Auswahl steht dort, was das
  Glossar ist und was es nicht ist, mit dem Weg zur Kuration.
- **Siehe auch** — verwandte Einträge als Knöpfe unter der Erklärung. Ein Klick
  springt hin und leert dabei die Suche, damit das Ziel auch sichtbar ist.
- **Wodurch dieser Status entsteht** — im Statuswert: welche Kürzel ihn setzen,
  in welchen Richtlinien.
- **Löst aus** — im Kürzel: was es im Fachsystem bewirkt, gleich lautende
  Aussagen zusammengefasst („in 131, 133 und 137"). Setzt es einen Status,
  führt ein Sprung dorthin.
- **Wird verwendet von** — im Kürzel: welche To-do-Regeln es prüfen. Nur wo es
  geprüft wird, nicht welches To-do daraus folgt — das entscheidet die ganze
  Kaskade samt ihren Sperren.
- **Für meine Rolle wichtig** — die Kürzel einer Fachrolle, nach Vorkommen
  sortiert, mit einem Filter auf die Richtlinie. Kürzel ohne Rollen-Vermerk
  stehen abgesetzt darunter: die darf jeder setzen. Rolle und Richtlinien-Wahl
  bleiben beim Reiterwechsel stehen.

## Typische Aktionen

- Eine Abkürzung nachschlagen, die in einer Mail oder Tabelle steht
- Tippen und mit den Pfeiltasten durch die Treffer gehen, ohne zur Maus zu greifen
- In der Rollensicht ein bestimmtes Kürzel suchen, statt 585 durchzublättern
- Von einem Eintrag über „Siehe auch" zum verwandten Begriff springen
- Von einem Kürzel zum Status springen, den es setzt, und von dort zum
  Verfahrensschritt
- Nachsehen, welche Kürzel in der aktuellen Richtlinie für die eigene Rolle
  häufig gesetzt werden
- Aus dem Glossar heraus zur Kuration wechseln, wenn ein Eintrag geändert
  gehört

## Grenzen

- Steht eine Bedeutung nirgends im Team belegt, fehlt der Eintrag lieber, als
  dass er geraten wird. Eine falsche Auflösung im Glossar trägt sich weiter.
- Ist kein Katalog geladen, fehlen die datengetriebenen Gruppen. Die
  Abkürzungen bleiben; die Seite sagt an Ort und Stelle, warum der Rest fehlt.

## Technik

**Route & Sichtbarkeit:** `/glossar`, kein Feature-Flag, Kategorie `tools` (order 21, neben `suche`); in jeder Ausgabe sichtbar.
**Datenmodell dahinter:** Seed `GLOSSAR_BEGRIFFE` in `src/core/glossar/abkuerzungen.seed.ts` — der einzige eigene Bestand. Alles Weitere zur Laufzeit aus `getAktiveVersion()` und `ladeTrigger()`.
**Code:** `src/plugins/glossar/` — `GlossarPage.tsx` (Aufbau), `glossarSuche.ts` (reine Suche/Gruppierung), `GlossarListe.tsx` / `GlossarDetail.tsx`.
