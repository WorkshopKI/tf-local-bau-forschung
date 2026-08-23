# Doppelförderung

## Zweck

Die zweimal im Monat gemeldete Liste der Frühkoordinierung (Excel, Blatt „Ergebnisliste") zeilenweise gegen den ZIM-Bestand halten — um inhaltliche Doppelförderung zu vermeiden und gleichgerichtete Forschungsbestrebungen zu koordinieren. Bisher Handarbeit.

## Einstieg

Kein Eintrag in der Navigation. Der Weg führt über das **⋯-Menü im Kopf der Suchseite** → „Doppelförderung". Die Adresse der Seite bleibt trotzdem gültig — ein Lesezeichen darauf funktioniert weiter.

## Aufbau

Drei Phasen auf einer Seite.

- **Aufnehmen** — Drop-Zone für die .xlsx, Feld für die Betragsschwelle (Vorbelegung 300.000 €), Schalter „Teilvorhaben zusammenfassen" (an), darunter die Vorschau in **drei** Gruppen: wird geprüft / unter der Schwelle / Betrag nicht lesbar. Die dritte Gruppe ist zuschaltbar. Darunter die drei Chips des Betrachtungsbereichs.
- **Prüfen** — Fortschrittsbalken „i von n", die laufende Zeile im Klartext, Abbrechen. Fertige Zeilen bleiben beim Abbruch stehen.
- **Ergebnis** — eine Karte je Meldung mit Urteils-Marke, den drei Schlagworten und der aufklappbaren Trefferliste. Kopfzeile: Trefferzahl, der Schwellen-Umschalter und der Excel-Export.

## Teilvorhaben zusammenfassen

Die Zuarbeit führt Teilvorhaben als eigene Zeilen — `01MF26003A` bis `…F` sind sechs Zeilen **eines** Zentrums. Zusammengefasst wird nach dem Förderkennzeichen-Stamm: die Aufgabenbeschreibungen werden aneinandergehängt, die Beträge summiert. Das spart nicht nur KI-Läufe (an der 72er-Liste **45 → 29** Prüfungen), es verhindert auch, dass ein Vorhaben über 1,2 Mio € als sechs Zeilen à 200.000 € unter die Betragsschwelle fällt. Abschaltbar; Zeilen ohne Kennung werden nie gefaltet.

## Wie das Urteil entsteht

**Schlagworte.** Die interne KI bildet je Zeile drei Schlagworte aus Thema und Aufgabenbeschreibung — ein Lauf je Zeile, mit frischem Chat. Der Prompt verlangt drei **verschiedene Achsen**: Verfahren, Gegenstand, Anwendung.

**Wortlaut-Stufe.** Je Schlagwort eine Suche. Jeder Treffer trägt damit seine **Abdeckung** — wie viele der drei Schlagworte er führt (`3/3`, `2/3`, `1/3`). Ein Schlagwort über 2 % des Bereichs zählt **nicht** mit und ist am Chip als „zählt nicht" markiert.

**Ähnlichkeits-Stufe.** Thema + Beschreibung werden eingebettet und gegen die Vektoren des Bestands gehalten. Findet dasselbe Vorhaben unter anderem Namen. Entfällt mit sichtbarem Hinweis, wenn kein Embedding-Modell geladen ist.

**Träger-Stufe.** Führt ein Antrag des Bereichs denselben Zuwendungsempfänger wie die Meldung, trägt er die Marke „gleicher Träger" und steht in der Trefferliste ganz oben — auch wenn kein Schlagwort und keine Ähnlichkeit ihn gefunden hat. Braucht keine KI.

**Das Urteil.** „Übereinstimmung" gilt, wenn ein Antrag desselben Trägers inhaltlich nah liegt, **oder** ab 2 von 3 Schlagworten (umstellbar auf 1 oder 3), **oder** bei hoher inhaltlicher Ähnlichkeit. Die Marke nennt, was ausgelöst hat.

**„nicht beurteilbar"** steht statt „keine Übereinstimmung", wenn kein einziges Schlagwort im Bereich vorkam — dann hat die Wortlaut-Stufe nichts geprüft, und ein Nein wäre eine Behauptung.

## Wenn die interne KI nicht erreichbar ist

Der erste Verbindungsfehler beendet den Stapel, aber **alle** Meldungen bekommen ihre Karte mit dem Vermerk „Nicht geprüft — die Verbindung brach vorher ab". Über „ändern" lassen sich die Schlagworte von Hand eintragen; Wortlaut- und Träger-Stufe laufen dann sofort, und die Ähnlichkeit wird nachgereicht — sie hängt am Text der Meldung, nicht am KI-Lauf. Sie braucht dafür nur das Embedding-Modell.

**Fehlen die Ähnlichkeitswerte, steht dabei, woran es lag.** Betrifft es den ganzen Lauf, sagt es der Seitenkopf — etwa „das Embedding-Modell war nicht geladen. Laden Sie es einmal über die Suche". Betrifft es eine einzelne Zeile, steht der Satz an ihrer Karte, mit der Meldung des Modells in Klammern. Ein leeres Ergebnis ohne Grund sah vorher genauso aus wie ein Vorhaben, zu dem es wirklich nichts Ähnliches gibt.

Warum nicht einfach ODER: in der App gegen den echten Bestand gemessen findet ein weit gefasstes Trio („Digitalisierung / Künstliche Intelligenz / Mittelstand") ODER-verknüpft **1.150** Vorhaben — ein Viertel des Bereichs; mit zwei von drei Schlagworten sind es **103**. Ein einzelnes weites Wort trifft allein sehr viel: „Entwicklung" 75 %, „KI" 36 %, „Sensor" 24 %. Ein spezifisch formuliertes Trio derselben Zeile kommt dagegen schon ODER-verknüpft auf **2** Treffer — die Schwelle rettet ein schlechtes Schlagwort, ein gutes braucht sie nicht.

## Betrachtungsbereich

Vorbelegt und im Kopf sichtbar, jede Achse einzeln abschaltbar:

- Antragsdatum der letzten fünf Jahre,
- FuE-Vorhaben, Netzwerke und Studien (Dienstleistung und Irrläufer draußen),
- ohne abgelehnte und zurückgezogene Vorhaben.

Zusammen bleiben 4.327 von 14.225 Anträgen. Die Zahl steht im Seitenkopf.

## Was der Nutzer korrigieren kann

- **Schlagworte je Zeile ändern.** Neben jedem Chip steht, wie viele Vorhaben dieses Wort trägt — daran ist zu sehen, welches Wort die Liste aufreißt. Eine Änderung rechnet nur die Wortlaut-Suche dieser Zeile neu, ohne neuen KI-Lauf.
- **Schwelle umstellen** (1/2/3 von 3). Wirkt sofort auf alle Zeilen.
- **Betragsschwelle** vor dem Lauf setzen.

## Typische Aktionen

- Gemeldete Liste ablegen, Vorschau lesen, Schwelle prüfen
- Betrachtungsbereich zuschneiden und die Prüfung starten
- Trefferliste einer Meldung aufklappen, Titel und Kurzbeschreibung lesen, auf den Antrag springen
- Ein zu weites Schlagwort ersetzen und das Ergebnis neu lesen
- Ergebnis als Excel exportieren (eine Zeile je Meldung × Treffer)

## Grenzen

- Ohne verbundene interne KI läuft nichts: die Schlagworte sind der erste Schritt. Bricht die Verbindung ab, endet der Stapel und die fertigen Zeilen bleiben stehen.
- Ein Lauf dauert einige Sekunden **je Zeile** — bei siebzig Zeilen ist das spürbar.
- Die Trefferliste zeigt zehn Vorhaben und nennt darüber die Gesamtzahl; nichts wird still abgeschnitten.
- Das Urteil ist ein Hinweis, keine Feststellung. Ob es wirklich dieselbe Sache ist, entscheidet die Fachprüfung.

## Technik

**Sichtbarkeit:** dev + pl, Flag `doppelfoerderung`, zusätzlich als **Beta** markiert (`seite('doppelfoerderung', …)` im Sichtbarkeits-Katalog) — der ⋯-Menüpunkt erscheint nur, wenn beides zutrifft.

**Datenhaltung:** keine. Die hochgeladene Liste lebt im Speicher der Seite, nichts wird in die IndexedDB, auf den Share oder in einen Snapshot geschrieben. Der Export ist eine Datei im Download-Ordner.

**Transport:** ausschließlich intern (`getTransportForDatenLauf` über den einschüssigen Lauf). Die Aufgabenbeschreibungen verlassen das Haus nicht.

**Code:** `src/plugins/doppelfoerderung/`, Einstieg `src/plugins/suche/SuchAktionenMenu.tsx`. Architektur: [doppelfoerderung.md](../architecture/doppelfoerderung.md).
