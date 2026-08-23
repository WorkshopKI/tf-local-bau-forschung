# Doppelförderung

## Zweck

Die zweimal im Monat gemeldete Liste der Frühkoordinierung (Excel, Blatt „Ergebnisliste") zeilenweise gegen den ZIM-Bestand halten — um inhaltliche Doppelförderung zu vermeiden und gleichgerichtete Forschungsbestrebungen zu koordinieren. Bisher Handarbeit.

## Einstieg

Kein Eintrag in der Navigation. Der Weg führt über das **⋯-Menü im Kopf der Suchseite** → „Doppelförderung". Die Adresse der Seite bleibt trotzdem gültig — ein Lesezeichen darauf funktioniert weiter.

## Aufbau

Drei Phasen auf einer Seite.

- **Aufnehmen** — Drop-Zone für die .xlsx, Feld für die Betragsschwelle (Vorbelegung 300.000 €), darunter die Vorschau in **drei** Gruppen: wird geprüft / unter der Schwelle / Betrag nicht lesbar. Die dritte Gruppe ist zuschaltbar. Darunter die drei Chips des Betrachtungsbereichs.
- **Prüfen** — Fortschrittsbalken „i von n", die laufende Zeile im Klartext, Abbrechen. Fertige Zeilen bleiben beim Abbruch stehen.
- **Ergebnis** — eine Karte je Meldung mit Urteils-Marke, den drei Schlagworten und der aufklappbaren Trefferliste. Kopfzeile: Trefferzahl, der Schwellen-Umschalter und der Excel-Export.

## Wie das Urteil entsteht

1. Die interne KI bildet je Zeile **drei Schlagworte** aus Thema und Aufgabenbeschreibung — ein Lauf je Zeile, mit frischem Chat.
2. **Wortlaut-Stufe:** je Schlagwort eine Suche. Jeder Treffer trägt damit seine **Abdeckung** — wie viele der drei Schlagworte er führt (`3/3`, `2/3`, `1/3`).
3. **Ähnlichkeits-Stufe:** Thema + Beschreibung werden eingebettet und gegen die Vektoren des Bestands gehalten. Findet dasselbe Vorhaben unter anderem Namen. Entfällt mit sichtbarem Hinweis, wenn kein Embedding-Modell geladen ist.
4. **Übereinstimmung** gilt ab **2 von 3** Schlagworten (umstellbar auf 1 oder 3) oder bei sehr hoher inhaltlicher Ähnlichkeit. Die Marke nennt, was ausgelöst hat.

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
