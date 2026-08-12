# Tree-Komponenten (`TfTree`)

Die gemeinsame Basis für alles Baumartige: [src/components/tree/](../../src/components/tree/). Sie ist der **einzige** Ort, der `@headless-tree/*` importieren darf — der Guard `no-headless-tree-outside-wrapper` in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts) hält das fest (Inline-Ausnahme `// allow-no-headless-tree-outside-wrapper: <grund>`).

## Warum überhaupt

Vier Module bauten Baum-Verhalten je selbst nach, alle mit eigenem Aufklapp-Set und keines mit Tastaturbedienung:

| Modul | was dort stand |
|---|---|
| Status-Filter | Phasen-Akkordeon mit `openPhases`-Set, Shift-Klick statt Ordner-Checkbox, nur-visuelle „n/m"-Anzeige |
| Textbaustein-Katalog | flache 340px-Spalte über 72 Einträge; die Hierarchie im Datensatz blieb unsichtbar |
| Status-Ordnerbaum | **fünf** Zustandsstücke (`zu`, `ziehId`, `ueber`, `editId`, `umhaengenId`) + hand-geschriebenes HTML5-Drag |
| Meilenstein-Konfiguration | `offene`-Set, Hoch/Runter-Schalter statt Ziehen, Einzug von Hand über `tiefeVon` |

Bibliothek: `@headless-tree/core` + `@headless-tree/react` (1.7.0, MIT, **keine** Runtime-Dependencies, ~7 kB gzip). Headless — gerendert wird mit unseren `--tf-*`-Tokens.

## Schnittstelle

Verbraucher reichen einen **flachen Knoten-Bestand** herein und sehen **keine** Lib-Typen:

```ts
TfTreeItems<T> = Readonly<Record<string, {
  id: string; name: string; isFolder: boolean; data: T; children?: readonly string[];
}>>
```

**Feature-Flags** (`TfTreeFeatureFlags`) — hier steht nur, was auch verdrahtet ist; ein Flag, das nichts tut, wäre eine Falle:

| Flag | Wirkung |
|---|---|
| `checkboxes` | Tri-State; das Ordner-Häkchen wirkt auf alle Blätter darunter (`propagateCheckedState`). Zeilen-Klick auf einem **Blatt** schaltet das Häkchen |
| `selection` | Auswahl einzelner Knoten |
| `hotkeys` | Pfeiltasten, Pfeil rechts/links (auf/zu), Pos1/Ende. **Default an** — der Grund für die gemeinsame Basis |
| `renaming` | F2 / Doppelklick; das Eingabefeld nimmt die Breite der Beschriftung |
| `dnd` | Ziehen und Ablegen, inkl. Tastatur-Variante (`keyboardDragAndDropFeature`) |
| `reorder` | Ablegen **zwischen** Geschwistern statt nur hinein; zeigt die Einfüge-Marke |
| | Ein Zug hat **zwei** Ausgänge, und beide sind sichtbar: die Marke (3 px, Punkt am Anfang, Einzug = Ziel-Ebene) für „dazwischen", der 2-px-Rahmen der Zeile für „hinein". Die Bibliothek entscheidet nach der Zeigerhöhe — äußere 30 % oben/unten dazwischen, die Mitte hinein |
| `dragHandle` | Gezogen wird an einem Griff (`dragHandleProps`), nicht an der Zeile. **Pflicht, sobald die Zeile Eingabefelder trägt** — sonst startet der Versuch, eine Zahl zu markieren, einen Drag |

**Zustand ist controlled by default**: Für jede Achse (`expandedItems`, `checkedItems`, `selectedItems`) gilt — wofür ein `on…`-Callback gesetzt ist, gehört dem Verbraucher; alles andere hält der Baum selbst. So bleibt der Filter-Store bzw. der Katalog-Entwurf die Quelle der Wahrheit, und es entsteht keine zweite Kopie daneben.

**Callbacks** sprechen in Ids, nicht in Lib-Instanzen: `onPrimaryAction`, `canRename`/`onRename`, `canDrag`/`canDrop`/`onDrop`, dazu `onZeilenKlick` (Capture-Phase, `stopPropagation()` unterdrückt die Baum-Reaktion — der Weg für Modifier-Kürzel wie Shift-Klick).

## Zeilen-Inhalt über Slots

`TfTreeSlots<T>`: `leading` (vor dem Chevron, z. B. der Griff), `icon`, `label`, `trailing` (rechtsbündig), `hoverContent` (reicher Tooltip, Inhalt entsteht erst beim Öffnen), `contextMenu`, `body` (aufklappbarer Bereich **unter** der Zeile), `zeilenStil` (Zustands-Akzente).

Zwei Regeln dabei:

- **Liefert ein Slot für eine Zeile `null`, entsteht das Element gar nicht.** Kein leerer HoverCard-Kasten über Ordnerzeilen, keine Kontextmenü-Hülle, die den Rechtsklick schluckt, ohne etwas anzubieten. Die Entscheidung fällt im **Slot**, nicht in einer Komponente darin: ein Element, das intern `null` rendert, ist für den Baum trotzdem Inhalt.
- **Interaktive Elemente im `trailing`-Slot brauchen `stopPropagation`** — der Zeilen-Klick klappt sonst den Zweig auf.

`renderNode` ist der Notausgang für eine völlig eigene Zeile; im Regelfall reichen Slots.

## Zwei Fallen, beide im Wrapper erledigt

1. **Neuaufbau bei geändertem Bestand.** Die Bibliothek baut ihre Zeilenliste nur bei ZUSTANDS-Änderungen neu. Ein Umbenennen ändert aber die *Daten*: die Id eines Gruppenknotens trägt seine Beschriftung, nach dem Umbenennen ist es eine andere Id — und die Kinder standen ohne Elternzeile da. `TfTree` ruft `rebuildTree()`, sobald sich `items` ändert. Verbraucher, deren Gruppen-Ids aus Beschriftungen entstehen, übertragen zusätzlich den Aufklapp-Zustand auf die neue Id (Beispiel: `uebertrageOffen` in [TextbausteinBaum.tsx](../../src/plugins/skill-verwaltung-kuration/TextbausteinBaum.tsx)).
2. **Zeilen aus der noch nicht neu gebauten Liste.** Ändert sich `items`, rendert React einmal mit der neuen Menge, während die Bibliothek noch die alte Zeilenliste hält. `TfTree` überspringt Zeilen, deren Id nicht mehr in `items` steht — sonst wäre `data` ein Platzhalter und jeder Slot, der darauf zugreift, würde werfen.

## Verbraucher und das Muster dahinter

| Modul | Adapter | Besonderheit |
|---|---|---|
| Status-Filter | [statusTreeAdapter.ts](../../src/plugins/antraege/filter/statusTreeAdapter.ts) | Ein Blatt ist ein **Code**, nicht eine Schreibweise; Werte, die zu keinem Blatt gehören (gespeicherte Presets), überleben jeden Klick |
| Textbaustein-Katalog | [bausteinBaum.ts](../../src/plugins/skill-verwaltung-kuration/bausteinBaum.ts) | Gruppen nach kleinster Id statt Alphabet; `canDrop` sperrt Bereich-, Überkategorie- und Scope-Wechsel |
| Status-Ordnerbaum | [kategorieBaum.ts](../../src/plugins/status-cockpit/kategorieBaum.ts) | Verbund und Teilvorhaben bleiben getrennte Bäume; Regeln aus `ordnerDrag.ts` |
| Meilenstein-Konfiguration | [meilensteinBaum.ts](../../src/plugins/meilensteine/meilensteinBaum.ts) | Waisen hängen an der Wurzel; Umhängen über `haengeKnotenUm` |

Das Muster ist überall dasselbe: **der Adapter ist rein und UI-frei**, und die fachlichen Regeln (darf hier abgelegt werden, wen trifft ein Umbenennen) liegen bei den Daten — `darfAblegen` in [ordnerDrag.ts](../../src/plugins/status-cockpit/ordnerDrag.ts), `darfUmhaengen`/`haengeKnotenUm` in [knoten-edit.ts](../../src/core/meilensteine/knoten-edit.ts), `darfVerschieben` in `bausteinBaum.ts`. Im Component wird keine davon nachgebaut.

## Bewusst nicht drin

- **Kein Typeahead.** `searchFeature` bindet jeden Buchstaben und schaltet währenddessen die Pfeiltasten ab (`isEnabled: !isSearchOpen`). Wo eine Suche gebraucht wird, gibt es ein sichtbares Eingabefeld daneben (Status-Filter); eine zweite, versteckte Suche wäre schlechter und würde die Navigation blockieren.
- **Keine Virtualisierung.** Der größte Baum hat ~80 sichtbare Zeilen. Sie käme mit `@tanstack/react-virtual` als weiterer Dependency und ist erst nötig, wenn eine echte Liste in den Baum wandert.
- **Komponententests.** Vitest läuft hier node-only und sammelt nur `src/**/__tests__/*.test.ts`; geprüft wird deshalb die reine Adapter-Logik, das UI-Verhalten über den `dev:local`-Selbstcheck.
