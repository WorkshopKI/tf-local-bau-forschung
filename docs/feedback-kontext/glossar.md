# Glossar

## Zweck

Nachschlagen, was die App und das Fachsystem benennen: Abkürzungen wie NF, RNE
oder ZuwB, dazu Begriffe wie Verfahrensschritt, Zieltage oder Betrachtungsbereich.

Die Seite **ändert nichts**. Statuswerte, Kürzel und Regeln werden weiterhin unter
„Vorgangs-Regeln" gepflegt; hier stehen sie nur lesend. Zwei Orte für dieselbe
Wahrheit wären schlimmer als ein umständlicher Weg.

## UI-Elemente & Begriffe

- **Suchfeld** — steht oben und hat beim Öffnen den Fokus. Es sucht über alles
  gleichzeitig: wer nachschlägt, weiß meist noch nicht, ob das Gesuchte eine
  Abkürzung, ein Kürzel oder ein Statuswert ist.
- **Liste links** — die Treffer, nach Art gruppiert, jede Gruppe mit Zähler.
  Gruppen ohne Treffer fallen weg.
  - **Abkürzungen & Begriffe** — der einzige eigene Bestand der Seite. Was hier
    steht, steht nirgends sonst.
- **Erklärung rechts** — der gewählte Eintrag. Ohne Auswahl steht dort, was das
  Glossar ist und was es nicht ist, mit dem Weg zur Kuration.
- **Siehe auch** — verwandte Einträge als Knöpfe unter der Erklärung. Ein Klick
  springt hin und leert dabei die Suche, damit das Ziel auch sichtbar ist.

## Typische Aktionen

- Eine Abkürzung nachschlagen, die in einer Mail oder Tabelle steht
- Von einem Eintrag über „Siehe auch" zum verwandten Begriff springen
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
