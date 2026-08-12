# Board-Komponente (`TfBoard`)

Das Kanban-Primitiv der App: **eine** Stelle, an der eine Bahn vermessen, eingeklappt und zum Drop-Ziel wird. Heimat [src/components/kanban/](../../src/components/kanban/TfBoard.tsx), Guard `no-parallel-board-geometry`.

## Warum es das gibt (und schon zweimal gab)

Es gab dieses Bauteil bereits: `KanbanBoard.tsx` wurde mit **v2.228 aus dem Feedback-Kanban extrahiert** und war von beiden Seiten genutzt. Mit **v3.17** (Design-Handoff) baute das Feedback-Board sein Lane-Layout in `ticketsystem.css` nach, und die Extraktion war rückgängig — ohne dass das irgendwo als Entscheidung stand. Der Zustand bis v3.44:

| Belegte Folge | |
|---|---|
| `spalten: 1\|2` war ein **totes Versprechen** | im Popover „Board anpassen" wählbar, in `boardKanbanConfig` persistiert, von `baueSpalten` durchgereicht — und im Nachbau nie gelesen. Zwei Minor-Versionen lang. |
| Dieselben Zahlen in zwei Sprachen | Schiene **46 px** (JSX) gegen **44 px** (CSS), `color-mix(… 30%, --tf-border)` doppelt, Lane-Kopf `10.5px`/`58%` doppelt |
| „+ N weitere" dreifach | zwei Widgets + Board, drei leicht verschiedene Fassungen |
| Zwei tote Flags | `layout='fest'` und `dense` hatten keinen Aufrufer mehr |
| Doku falsch | `home-widgets.md` behauptete, die Shell sei „geteilt mit dem Feedback-Board" |

Deshalb **kein Guard aus Prinzip, sondern aus Erfahrung**: eine getrennte Geometrie fällt niemandem auf, weil beide Seiten für sich plausibel aussehen. Auffallen tut erst, was die eine kann und die andere nicht.

## Warum keine Kanban-Bibliothek

Der schwierige Teil ist nicht das Board, sondern die Domäne: Lane-Schlüssel binden an `StatusCategory` (Pitfall #12) bzw. `FeedbackStatus` (Pitfall #21), Sichtbarkeit und Reihenfolge sind kuratierbar, die Persistenz ist bewusst zweigeteilt (IDB fürs Widget, localStorage fürs Board), dazu Summenzeile, Sicht-Zuschnitt und Betrachtungsbereich. Das modelliert keine Board-Bibliothek. Was sie mitbrächte — eigenes DOM und eigenes Styling — müsste gegen die `--tf-*`-Tokens zurückgekämpft werden und landet im `viteSingleFile`-Bundle als sofort fällige Zahl.

**Auch keine DnD-Bibliothek — noch nicht.** Heute zieht genau ein Board, und es funktioniert. Anträge werden voraussichtlich nie ziehbar: ihr Status kommt aus dem Fachsystem C16, die App leitet keinen ab (Pitfall #44) — eine Karte in eine andere Bahn zu ziehen hätte nichts, wohin es geschrieben werden könnte. Zum Vergleich: `@headless-tree` (~7 kB) musste seinen Preis gegen **vier** Baum-Nachbauten ohne Tastaturbedienung rechtfertigen. Die Rechnung geht auf, sobald ein zweites Board zieht oder Tastaturbedienung gefordert wird; bis dahin hält die Naht (unten) den Wechsel bei einer Datei.

## Die Grenze

Das Primitiv kennt `key`, `label`, einen Farbwert, eine Liste und eine Zahl. Es kennt **keinen Status, keinen Speicher und keine Uhr**.

| Layout (ins Primitiv) | Fachlich (bleibt im Plugin) |
|---|---|
| Bahn-Geometrie, Schmalschiene, Kopf mit Ellipse + `title`, Zähler-Pille | Lane-Schlüssel und ihre Reihenfolge/Sichtbarkeit |
| Ansichts-Rechnung `auto\|offen\|zu` × leer/voll/unerreichbar | Persistenz — das Primitiv persistiert **nichts** |
| Klick/Enter/Space auf der Schiene, `role`, `tabIndex` | Bucketing, Sortierung, Kappungs-Zahl |
| 1\|2 Kartenspalten, DOM-Budget + Nachladen | Summenzeilen-**Text**, Sicht-Zuschnitt-**Entscheidung** |
| Drop-Mechanik und ihre Fallen | Recht zu ziehen, Auswahl-Regel beim Drop |
| `aria-label` | Karten-Inhalt vollständig, inklusive Karten-Dichte |

Drei Grenzfälle sind bewusst geschnitten:

- **„+ N weitere" ist zweimal etwas anderes.** Im Board ein DOM-Budget (`nachladen` — das Primitiv kappt und lädt nach), im Widget ein Weg-Navigieren (`fuss` — der Aufrufer liefert den Knopf). Gleiche Optik, verschiedene Herkunft, deshalb zwei Props.
- **`unerreichbar`**: die Berechnung ist fachlich, die Darstellung Layout. Die Naht ist ein Objekt aus zwei Sätzen und einem Callback.
- **Dichte ist geteilt.** Bahn-Abstände sind Layout, das Karten-Innenleben nicht. Das Primitiv reicht `className` durch, damit `.fb-board.dicht .fb-karte` beim Aufrufer **wortgleich** bestehen bleibt.

## Warum CSS statt Tailwind-JSX

Zwei Regeln sind **Vorfahren-Zustands-Selektoren**:

```css
.tf-board.zieht .tfb-bahn.schmal:not(.zu) { … }   /* Schienen falten beim Ziehen auf */
.fb-board.dicht .fb-karte { … }                   /* beim Aufrufer */
```

In JSX würden beide zu Prop-Drilling; die zweite zwänge die Dichte bis in den Karten-Renderer des Aufrufers — genau die Grenze, die das Primitiv zieht. Die alte Shell bewies es selbst: an vier von sechs getönten Stellen floh sie nach `style={{…}}`, weil `color-mix()` in Tailwind ein Fremdkörper bleibt.

Tailwind bleibt für **Slot-Inhalte** (Karten, Fußtext, `LanePills`). Das Primitiv schreibt keiner Karte vor, wie sie aussieht.

## Die API in einem Blick

```tsx
<TfBoard
  label="Tickets nach Status"        // aria-label, Pflicht
  className="fb-board dicht"          // wo die Spur sitzt + Haken für Karten-CSS
  layout="gedeckelt"                  // | 'geteilt' (Widget)
  bahnen={…}                          // key/label/accent/items (+ gesamt, icon, spalten,
                                      //   zusatz, fuss, unerreichbar)
  features={{ einklappbar: true, bahnScrollt: true }}
  nachladen={{ start: 15, schritt: 25 }}
  dnd={{ idOf, onDrop }}
  renderCard={(t, bahn, zieh) => <Karte {...} zieh={zieh} />}
/>
```

**Was bewusst NICHT existiert** — jedes wäre ein Flag ohne Verbraucher, die Falle aus [tree-komponenten.md](tree-komponenten.md):

| nicht gebaut | Grund |
|---|---|
| `dense` / `layout='fest'` | die zwei toten Flags der alten Shell |
| `dichte` | wirkt in beiden Aufrufern nur auf die KARTE, nie auf das Bahn-Layout — läuft über `className` |
| `canDrag` | das Recht zu ziehen ist board-weit (Rolle + Schreibrecht), nie je Karte |
| `canDrop` | ein Ablehnen müsste im `dragover` sichtbar werden, und dort gibt der Browser die gezogene Id nicht heraus. Ein Prädikat, das erst beim Fallenlassen greift, verspräche eine Rückmeldung, die es nicht gibt |
| `onDrop(ids[])` | das Primitiv kennt genau **eine** gezogene Karte. Ob die ihre Mehrfachauswahl mitnimmt, ist eine fachliche Regel (`zuBewegen`) |
| `wunschProBahn` / `onWunschChange` | der Einklapp-Zustand wird bewusst nicht persistiert — er beantwortet „was schaue ich gerade an", nicht „wie soll mein Board aussehen" |
| `onDrop(…, index)` (Sortieren in der Bahn) | HTML5-DnD kann es nicht, kein Aufrufer will es. Kommt mit einem `reorder`-Flag, wenn jemand es braucht |

## Die DnD-Naht

Drei Zusagen, damit ein späterer Bibliotheks-Einzug **null Zeilen unter `src/plugins/`** anfasst:

1. **Der Aufrufer schreibt nie `dataTransfer`.** Er bekommt `zieh` — ein opakes Objekt — und spreizt es auf den Kartenknoten. Heute steckt `{ draggable, onDragStart }` darin, später `{ ref, …attributes, …listeners }`. Guard `no-parallel-board-dnd`.
2. **Der Aufrufer spricht nur in Ids und Bahn-Schlüsseln** — kein `React.DragEvent`, keine Bibliotheks-Instanz. Dieselbe Form, in der `TfTree` mit `@headless-tree` spricht.
3. **Die Bahn ist selbst das Drop-Ziel und bleibt EIN Knoten**, auch als Schiene — sonst hinge das Ziel an zwei Stellen und liefe auseinander.

Die HTML5-Fallen erledigt der Wrapper **einmal** statt je Aufrufer: `preventDefault` im `dragover` (die Zusage „hier darf abgelegt werden", nicht Kosmetik), `dropEffect='move'`, `contains(relatedTarget)` gegen das `dragleave` je Kind, die aufsteigenden `dragstart`/`dragend` an der Wurzel.

Offen bleiben die bekannten Löcher: kein Touch, **keine Tastaturbedienung**, kein Auto-Scroll an der waagerecht scrollenden Spur, kein Sortieren innerhalb einer Bahn. Sie gehen an genau einer Stelle zu — der Board-Wurzel in `TfBoard.tsx`, die schon heute den `zieht`-Zustand hält.

## Aufrufer

| Wer | Layout | Besonderheit |
|---|---|---|
| [TicketBoard](../../src/plugins/feedback-board/ticket/TicketBoard.tsx) | `gedeckelt` | einklappbar, bahnScrollt, nachladen, dnd, Summenzeile, Sicht-Zuschnitt |
| [AntragKanbanWidget](../../src/plugins/home/widgets/AntragKanbanWidget.tsx) | `geteilt` | read-only, einklappbar, Icon je Kategorie, `fuss` navigiert in die Liste |
| [FeedbackKanbanWidget](../../src/plugins/home/widgets/FeedbackKanbanWidget.tsx) | `geteilt` | read-only, einklappbar, `fuss` navigiert ins Board |
| [KanbanVollbild](../../src/plugins/home/widgets/KanbanVollbild.tsx) | `gedeckelt` | eigenes Fenster (v3.47), einklappbar + bahnScrollt + nachladen, alle Kategorien mit Karten, Spaltenzahl aus dem Bestand abgeleitet — [fenster-in-fenster.md](fenster-in-fenster.md) |

Der eingeklappte Widget-Zähler ist [LanePills](../../src/components/kanban/LanePills.tsx) — bis v3.44 zweimal wortgleich, bis auf `max-w-[110px]` gegen `max-w-[120px]`, was kein Entwurf war, sondern der Zwilling.

## Gemessenes

Zwei Zahlen im Primitiv tragen eine Messung und keine Meinung:

- **Kopf-Lücke 4 px, nicht 8.** Bei „Wartet auf Antragsteller" in einer 170-px-Bahn (Home, sieben Bahnen, 1280 px) standen der zweizeiligen Bezeichnung mit 8 px genau 88 px zur Verfügung, sie brauchte 92 — mit 4 px sind es 96 und sie passt ohne Ellipse. Dieselbe Messung entschied schon in der Widget-Fassung; die 8 px der Board-Fassung waren nie gegen eine lange Bezeichnung geprüft, weil das Board nur kurze Status führt.
- **Zähler rechtsbündig.** In der Board-Fassung stand die Pille bei „NEU" (23 px) an x=58 in einem 226 px breiten Kopf und ließ 148 px Leerraum hinter sich — das war die Abwesenheit einer Entscheidung, nicht eine.
- **`minmax(0, 1fr)` statt `1fr`** für die zwei Kartenspalten: das Auto-Minimum von `1fr` ließ eine Karte mit unschrumpfbarem Inhalt ihre Spalte aufdrücken (gemessen 166 px gegen 181 px). Zwei Kartenspalten sind gleich breit oder sie sind keine.
- **Zweispalten-Boden 445 px (`gedeckelt`) bzw. 329 px (`geteilt`), nicht 300 px für beide.** Sieben Bahnen in einem 1600-px-Fenster landeten alle auf dem alten gemeinsamen Boden, und die Karte maß dort **132 px** statt der 210 px einer einspaltigen Bahn — zwei Spalten machten die Karte schmaler, statt die Bahn kürzer zu machen. Die neuen Böden sind gerechnet, nicht gewählt: `2 × Kartenbreite + 7 Rasterlücke + 18 Polster`, je Form gegen deren eigenes `--tfb-min`. Nachgemessen liegt die Karte danach bei 204–209 px (zweispaltig) gegen 208 px (einspaltig).
