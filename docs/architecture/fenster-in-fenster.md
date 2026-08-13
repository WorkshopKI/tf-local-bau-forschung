# App-Inhalt in einem eigenen Fenster

Zwei Stellen zeigen App-Inhalt in einem **zweiten Browser-Fenster** statt in einem Dialog:
die [Seiten-Hilfe](../../src/components/help/hilfeFenster.ts) (v2.402, rohes DOM) und das
[Kanban-Vollbild](home-widgets.md) (v3.47, zweite React-Wurzel). Die geteilte Grundlage liegt in
[src/components/fenster/](../../src/components/fenster/).

## Warum `about:blank` und nicht die App noch einmal laden

`window.open('', NAME, …)` mit **leerer** URL navigiert nicht: das Fenster bleibt das initiale
`about:blank` und **erbt die Herkunft des Openers**. Damit teilt es sich Realm, Modul-Instanzen und
Zustands-Stores mit der laufenden App — der Parent kann sein DOM beschreiben, und im Fenster läuft
kein eigenes Script.

Ein Fenster, das stattdessen `teamflow.html#/route` lädt, wäre ein zweiter **Kaltstart**: erneuter
Startbildschirm, Passwort-Gates, ein zweiter Zugriff auf IndexedDB und ein zweiter Satz
FSAPI-Ordner-Handles. Unter `file://` käme das Parsen des 20-MB-Single-File-Builds dazu.

`window.open` steht in [file-protocol-pitfalls.md](../agents/file-protocol-pitfalls.md)
ausdrücklich als „OK unter `file://`" — anders als eine Blob-URL, die dort `blob:null/…` mit
opaquer Herkunft wäre.

## Die drei Regeln, die man beim Abschreiben verliert

1. **Kein `noopener`** im Features-String — damit wäre das Handle `null` und die gesamte Mechanik
   tot. Deshalb hat `fensterFeatures` genau eine Heimat (Guard `no-parallel-fenster-features`,
   Signatur `popup=yes`).
2. **Synchron aus dem Klick** aufrufen, kein `await` davor — sonst zählt die Geste nicht mehr und
   der Popup-Blocker greift. `oeffneAppFenster` gibt dann `null` zurück; der Aufrufer **muss** das
   sagen (die App hat kein Toast-System).
3. **Nie aus einem Mount-/Init-Pfad** öffnen (Bug-Klasse 8).

## `appFenster.ts` — was es erledigt

| Schritt | Warum |
|---|---|
| `<base href={document.baseURI}>` in den Kopf | `about:blank` hat keine Basis-URL; das erledigt alle relativen Schrift- und Bild-URLs auf einmal |
| **Alle** `<style>` / `<link rel=stylesheet>` klonen | Ein React-Baum bringt Tailwind-Utilities und Modul-CSS mit. Im Single-File-Build ist das **ein** Block (gemessen 278 KB) — eine Zeichenketten-Kopie ohne Ladevorgang; am Dev-Server mehrere Vite-Knoten |
| `data-theme` / `class` / `style` / `lang` von `<html>` spiegeln | Hell/Dunkel und der gewählte Akzent stehen als Attribut bzw. Inline-Property an der Wurzel, nicht im Stylesheet |
| `MutationObserver` auf `document.documentElement` | Theme-Wechsel im Opener zieht nach |
| `MutationObserver` auf `document.head` | Am Dev-Server schiebt HMR Stile nach; ohne ihn wäre jede CSS-Änderung im Fenster unsichtbar |
| `createRoot` auf einem eigenen `<div>` im Body | Nie mit den Kopf-Schreibzugriffen kollidieren. **Kein `StrictMode`** — die Wurzel entsteht imperativ im Klick-Handler |
| `pagehide` im Fenster **und** im Opener | Der Opener geht (Reload) ⇒ das Fenster **wird geschlossen**: ohne React-Wurzel zeigte es sonst einen eingefrorenen Stand, also eine Lüge |
| `beiEnde`-Rückruf | Ohne ihn hielte der Aufrufer einen toten Griff für lebendig und öffnete beim nächsten Klick ein zweites Fenster daneben |

Jeder DOM-Zugriff steht in `try/catch`: wurde das Fenster weg-navigiert, ist es cross-origin und
`win.document` wirft.

## Warum eine zweite React-Wurzel und kein Portal

`createPortal` in ein fremdes Dokument **rendert**, aber **reagiert nicht**: React hängt seine
Ereignis-Zuhörer an den Wurzel-Container, und ein Klick in einem anderen Dokument erreicht ihn nie.

Die Folge für den Inhalt: **reine Props, keine App-Hooks**. Im zweiten Baum gibt es weder Router-
noch Storage-Kontext — `useNavigation()` liefe ins Leere. Alles, was nach draußen wirkt, kommt als
Callback aus dem mountenden Widget. Zustand-Stores dagegen sind Modul-Singletons und funktionieren.

## Was ein Bauteil braucht, das doch Kontext will

Die Kanban-Einstellungen im Fenster sind **dasselbe** `WidgetConfigForm` wie auf der Startseite, und
das ruft `useStorage()`. Statt einer zweiten Fassung reicht
[VollbildEinstellungen](../../src/plugins/home/widgets/VollbildEinstellungen.tsx) den Kontext nach:

- **Der Dienst kommt als Wert herein** und wird im Fenster neu bereitgestellt
  (`<StorageContext.Provider value={storage}>`). Das trägt, weil beide Bäume im selben Realm laufen —
  dasselbe React-Modul, dasselbe Kontext-Objekt. Das Element entsteht im Widget, seine **Hooks laufen
  dort, wo es gerendert wird**.
- **Der Store wird gelesen, nicht durchgereicht.** Zustand braucht keinen Kontext, also ist das
  Formular von sich aus lebendig — auch dann noch, wenn die Startseite ausgehängt ist.
- **Kein Radix-Overlay im Fenster.** Ein `Select`/`Popover` portaliert in den Body des Haupt-
  dokuments (`document` ist modulglobal) und erschiene hinter dem Fenster, in dem man es geöffnet
  hat. Deshalb dort der Popover-Umfang (Bahnen + Farben), nicht der volle mit „Quelle"/„Datenbasis".
- **`Escape` hat zwei Bedeutungen.** Der Zuhörer am Dokument schließt das Fenster; steht ein Panel
  offen, hält der Griff an der Seitenwurzel das Ereignis auf und schließt erst das Panel.

## Der Griff überlebt sein Widget

Ein Klick auf eine Karte im Fenster navigiert die App und hängt damit die Startseite aus dem Baum.
Läge der Griff im Widget, wäre das Fenster danach unerreichbar. Er liegt deshalb in einem
Modul-Register (`useKanbanVollbild.ts`), gekeyt nach Widget-Instanz.

Beim Aushängen bekommt das Fenster **einen letzten Zustand mit `verwaist`** — es sagt selbst, dass
es nicht mehr nachgeführt wird, statt einen alten Stand als aktuellen auszugeben. Kehrt die
Startseite zurück, klinkt sich das Widget wieder ein und der Hinweis verschwindet.

Daraus folgt, **wo Zustand liegen darf**: Bedienbares gehört ins Fenster. Der Einklapp-Zustand der
Bahnen ist deshalb `useState` in `KanbanVollbild` und wird nur *beim Aufbau* aus der Config
gelesen — läge er drüben, ließe sich nach dem ersten Karten-Klick keine Bahn mehr klappen, weil
niemand mehr nachzeichnet. Umgekehrt schreibt das Fenster **nie** auf einem mitgeschleppten Stand:
`mutiereConfig` patcht den aktuellen, sonst nähme ein verwaistes Fenster fremde Änderungen zurück.

## Was der Dev-Server nicht zeigen kann

Die Browser-Pane der Entwicklungsumgebung **blockiert `window.open` grundsätzlich** — auch bei
echter Geste, ohne Features, mit `about:blank`. Prüfbar ist dort alles außer der
Fenster-Beschaffung selbst; die Transplantation lässt sich am identischen Verfahren in einem
`<iframe>` messen (fremdes Dokument, eigener Stylesheet-Bereich). Das echte Fenster gehört in den
`file://`-Handtest.
