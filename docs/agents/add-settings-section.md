# Neue Einstellung / neuen Abschnitt anlegen

Die Seitenform gibt es **zweimal** — sie ist eine geteilte Schicht in
[src/components/settings/](../../src/components/settings/), kein Plugin:

| Hub | Route | Registry | Panels |
|---|---|---|---|
| **Einstellungen** | `/einstellungen` | `plugins/einstellungen/settingsPanels.tsx` | Mein Profil · Darstellung · Daten & Verbindungen · Interne KI |
| **Datenpflege** (kuratorOnly, id `kuration`) | `/kuration` | `plugins/kuration/kurationPanels.tsx` | Übersicht · CSV-Quellen · Förderprogramme · Suche & Index · Dienste |

Dieses Blatt gilt für beide. Was unten „Seite" heißt, ist ein **Panel** des
jeweiligen Hubs; der Rahmen (`SettingsHubPage`) und die Sprung-/Markier-Mechanik
liegen genau einmal und werden nie nachgebaut (Guard
`kuration-hub-eine-schicht`).

Die Einstellungen haben **vier Panels** (Redesign v4.28–v4.31, Handoff
`_design/handoff/einstellungen-zweispaltig`). Eine neue Einstellung bekommt
**kein fünftes** — sie kommt als Zeile in eine bestehende Gruppe oder als
neue Gruppe in eine der vier Spalten.

## 1 · Wohin gehört sie?

| Die Einstellung … | Seite | Spalte |
|---|---|---|
| beschreibt **dich** (Name, Kürzel, Fachprofil) | `profil` | links |
| folgt daraus (Sichtbarkeit, Module, Assistent) | `profil` | rechts |
| gilt **nur für dieses Gerät** (Optik, Tastatur) | `darstellung` | links |
| hängt an der Startseite | `darstellung` | rechts |
| bestimmt, **woher Daten kommen** | `daten` | links |
| entsteht **neben** den Daten (Team, Tags) | `daten` | rechts |
| betrifft die **Verbindung** zur internen KI | `ki` | links |
| betrifft, **wie die KI antwortet** | `ki` | rechts |

Links stehen weiße Karten (Hauptbereich), rechts getönte (Nebenspalte) — den
Ton setzt `SettingsZweiSpalten` selbst, die Gruppe muss nichts wissen.

## 2 · Rezept

1. **Gruppe oder Zeile?** Eine einzelne Einstellung ist eine `SettingsOption`
   in einer bestehenden `SettingsGruppe`. Erst wenn drei bis fünf Zeilen
   zusammengehören, wird daraus eine eigene Gruppe (max. fünf je Seite).

2. **Zeile bauen** — [`SettingsOption`](../../src/components/settings/settings-layout.tsx):
   links Label (+ `hint` fürs ⓘ, + `badge`), **höchstens eine** `kurzzeile`,
   rechts die Steuerung als `children`. Nie zwei Erklärzeilen, nie Steuerung
   links. **Jeder Satz, der über eine Zeile hinausgeht, gehört ins ⓘ.**

3. **Steuerung aus `@/components/ui`** — `Switch`, `SegmentedToggle`
   (`rolle="auswahl"`), `Button`, `Badge`, `ToggleChip`, `SettingsStepper`.
   Kein eigenes Toggle, kein eigenes Segment.

4. **Seltenes einklappen** — [`SettingsKlappe`](../../src/components/settings/settings-layout.tsx)
   mit `zaehler`, der aus dem **echten Zustand** kommt („8 von 28 aktiv"), nicht
   aus einer Konstanten. Standard ist zu; ändert sich ein bestehender Default,
   braucht der `storageKey` einen Bump (ein persistierter Wert schlägt den
   Code-Default).

5. **Anker + Registry** — bekommt der Abschnitt eine `sec-…`-Id, muss sie in
   [settingsPanels.tsx](../../src/plugins/einstellungen/settingsPanels.tsx)
   stehen: die Datei ist Single Source of Truth für Navigation **und**
   Suchindex. Umgekehrt gilt genauso: **kein Registry-Eintrag ohne Anker im
   DOM** — sonst springt die Suche ins Leere. Hängt der Abschnitt an einem
   Feature-Flag, hängt der Registry-Eintrag am selben Flag.

   Der Eintrag nennt drei Dinge: `label` = die **gerenderte** Überschrift am
   Anker, `gruppe` = der `titel` der Karte drumherum (wortgleich), `keywords` =
   Synonyme. Aus `gruppe` baut die Trefferzeile den Weg „Seite › Gruppe" — die
   Seite allein trägt bis zu acht Karten. Guard: `settings-treffer-weg` in
   [conventions-ui.test.ts](../../src/__tests__/conventions-ui.test.ts) prüft
   beide Richtungen und dass jede genannte Karte existiert.

6. **Keywords mitgeben**, inklusive alter Namen. Wer den früheren Menüpunkt im
   Kopf hat, muss ihn weiter finden (so tragen die Fachprofil-Abschnitte
   „meine technologien").

## 3 · Fallen

- **Aus einem Effekt heraus nie toggeln** — `SettingsKlappe` klappt Sprungziele
  über `setzeOffen(true)` auf; ein Toggle hebt sich im StrictMode auf
  (Klasse 21 in [recurring-bug-classes.md](../architecture/recurring-bug-classes.md)).
- **Die Steuerung gehört nicht zweimal beschriftet** — bringt ein Bauteil ein
  eigenes Label oder einen eigenen Erklärabsatz mit, braucht es eine
  „nur-Steuerung"-Stufe (so `KiVariantSelector`). Sonst steht die Beschriftung
  doppelt, und der Absatz sprengt in der Nebenspalte die Karte: der
  Steuerungs-Slot der `SettingsOption` ist `shrink-0` und nimmt seine
  Wunschbreite.
- **Keine lokalen `--tf-*`-Token-Blöcke** — fehlt ein Token, kommt es global in
  `theme.css` (Guard `theme-token-contract`).
- **Async-Handler über `useAsyncAction`**, nicht `onClick={() => void fn()}`
  (Pitfall #15, Guard `no-raw-async-onclick`).
- **Kürzel nur über `useMeinKuerzel`** (Pitfall #27); die einzige Schreibstelle
  ist `profil/AntraegeSichtGruppe.tsx`.
- **Der Umbruch misst die Inhaltsbreite**, nicht den Viewport
  ([settings-layout.css](../../src/components/settings/settings-layout.css)) —
  die App-Sidebar ist ziehbar.
- **Danach das Kontext-Doc nachziehen**
  ([docs/feedback-kontext/einstellungen.md](../feedback-kontext/einstellungen.md),
  Skill `feedback-kontext-pflege`) — es ist zugleich die Seiten-Hilfe.
