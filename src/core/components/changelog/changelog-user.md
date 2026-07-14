<!--
  Nutzer-Changelog (geglättete Fassung) — HAND-GEPFLEGT.

  Diese Datei ist die nutzerfreundliche Fassung des Changelogs, die das „Was ist
  neu?"-Modal (Klick auf die Versionsnummer unten in der Sidebar) anzeigt. Sie wird
  zusammen mit CHANGELOG.md gepflegt: pro neuer Version hier einen geglätteten
  `## vX.Y`-Abschnitt ergänzen (Nutzen statt Technik, kein Jargon).

  Format (kanonisch, neueste oben):
      ## v2.98 — 2026-06
      ### Neu
      - Kurzer, verständlicher Satz …
      ### Verbesserungen
      - …
      ### Bugfixes
      - …

  Historie ab v2.100 durchgängig geglättet. Ältere Versionen (< v2.100) leitet das
  Modal automatisch aus CHANGELOG.md ab.
-->

## v2.246 — 2026-07

### Neu
- **„Neue Anträge für dich": auch ältere Anträge im Blick.** Das Startseiten-Widget zeigte bisher nur ganz frisch freigegebene Anträge (ein 7-Tage-Fenster). Anträge, die dir in der Auslastung weiterhin zuweisbar sind, deren Fenster auf der Startseite aber schon abgelaufen war, tauchten dort nicht mehr auf. Neu: darunter ein Abschnitt **„Weitere zuweisbare Anträge"**, der alle weiter für dich offenen Anträge (Haupt- und Nebenkategorie) auflistet — ohne Ablauf-Countdown, mit „Kann ich übernehmen". So verschwindet nichts mehr aus dem Blick.

## v2.245 — 2026-07

### Neu
- **Verbundprojekte: eigener Zeitplan je Teilvorhaben.** Die Anlage 5 (Arbeitsplan) gehört zu einem einzelnen Teilvorhaben — ein Verbund mit mehreren Teilvorhaben hat also mehrere. Die Antrags-Aufbereitung zeigt jetzt für **jedes Teilvorhaben** seinen eigenen Zeitplan und seine eigene Kapazitätsprüfung aus der jeweiligen Anlage 5, mit einer Gesamtübersicht oben (Personenmonate, eingesetzte Mitarbeitende, längster Zeithorizont). Du kannst einfach alle Anlagen 5 hochladen — sie werden automatisch am Förderkennzeichen im Dateinamen dem richtigen Teilvorhaben zugeordnet.
- **Fehlende Anlage 5 direkt nachreichbar.** Fehlt für ein Teilvorhaben die Anlage 5, siehst du das an dessen Stelle und kannst die Datei gleich dort ablegen — der Zeitplan aktualisiert sich automatisch.

(Einzelanträge sind unverändert.)

## v2.244 — 2026-07

### Bugfixes
- **Kein Fehler mehr, wenn „neuer Datenbestand" und „neue CSV-Quellen" gleichzeitig anstehen.** Bisher konnten oben zwei Aktualisierungs-Hinweise gleichzeitig erscheinen; klickte man beide, liefen sie parallel und einer meldete einen Fehler („… — 1 Fehler"). Jetzt fasst die App beides zu **einem** Knopf „Datenbestand aktualisieren" zusammen, der alles in der richtigen Reihenfolge und in einem Durchlauf erledigt. Steht nur eines an, erscheint wie gewohnt der einzelne Hinweis — und solange eine Aktualisierung läuft, sind die anderen Knöpfe gesperrt, damit sich nichts überschneidet.

## v2.243 — 2026-07

### Bugfixes
- **Absturz beim Öffnen einer Antrags-/Verbund-Detailseite behoben.** Zuvor konnte das Öffnen einer Detailseite — etwa über „Weiter" im Startseiten-Bereich „Weitermachen" — statt der Seite eine Fehlermeldung zeigen. Detailseiten öffnen jetzt wieder zuverlässig.

### Neu
- **Neuer Tab „Verwertung/Markt" in der Antrag-Aufbereitung.** Er fasst die Aussagen zu Zielmärkten, Wettbewerb, Verwertungswegen, geplantem Markteintritt und erwarteten Umsätzen zusammen — jeweils mit Fundstelle im Antrag. Ob diese Angaben in einem eigenen Marketing-/Verwertungskonzept oder schon in der Vorhabensbeschreibung stehen, spielt keine Rolle.

## v2.242 — 2026-07

### Neu
- **Dokumente direkt in der Antrag-Aufbereitung nachreichen.** Fehlt beim Aufbereiten ein Dokument — etwa die Anlage 5 mit dem Arbeits-/Zeitplan —, kannst du es jetzt direkt auf der Seite ablegen: im neuen Bereich „Dokumente zum Vorhaben" per Drag & Drop, und beim Ablegen wählst du, was drinsteht (Vorhabensbeschreibung, Arbeitsplan/Anlage 5, Marketing-/Verwertungskonzept …). Danach wird automatisch neu aufbereitet — kein Umweg mehr über eine andere Seite.
- **Egal, wie die Unterlagen aufgeteilt sind.** Ob das Marketing-/Verwertungskonzept in einem eigenen Dokument liegt oder schon in der Vorhabensbeschreibung steht, macht für die Aufbereitung keinen Unterschied mehr — Inhalt und Fundstellen sind in beiden Fällen gleich.

## v2.241 — 2026-07

### Verbesserungen
- **Gutachten „Technische Risiken": erst Entwurf, dann geschliffener Fließtext.** Der Abschnitt „Technische Risiken" sammelt die Risiken zunächst als Entwurf (einklappbar im Prüf-Panel sichtbar) und formuliert daraus einen zusammenhängenden Fließtext ohne Kurztitel — beschränkt auf die zentralen Risiken, die auf dem Lösungsweg des Vorhabens liegen und vom Vorhaben beeinflussbar sind. Externe, nicht beeinflussbare Risiken (z.B. Marktlage, Regulatorik) bleiben im finalen Text außen vor; bei mehr als drei Risiken werden die drei wichtigsten ausgewählt. Die Wortanzahl ist dabei nur noch ein Hinweis, kein blockierender Fehler.
- **Teilvorhaben-Titel auf einen Blick.** In der Verbund-Ansicht steht bei jedem Teilvorhaben jetzt direkt der Titel des Teilvorhabens unter dem Partner-Namen — man sieht sofort, was der jeweilige Partner im Projekt macht, ohne die Zeile erst aufklappen zu müssen.
- **Alle Teilvorhaben-Titel mit einem Klick kopieren.** Neben der Überschrift „Verbundpartner und Teilvorhaben" gibt es jetzt ein kleines Kopier-Symbol: Ein Klick legt alle Teilvorhaben-Titel als Textliste (ein Titel pro Zeile) in die Zwischenablage — praktisch, um sie in andere Dokumente zu übernehmen. Tragen alle Teilvorhaben denselben Titel, wird er nur einmal kopiert.
- **Sortierung und Filter bleiben in den Förderanträgen gemerkt.** Wie du die Liste sortierst (Klick auf eine Spaltenüberschrift) und welche Filter du gesetzt hast (Status, Antragstyp, PreCheck und die Filter in der Seitenleiste), bleibt jetzt beim nächsten Aufruf der Seite erhalten — auch nach einem Neuladen. Die Sicht-Tabs oben, die Gruppierung und die Spaltenbreiten wurden schon vorher gemerkt. (Der freie Suchtext startet weiterhin bewusst leer.)

## v2.240 — 2026-07

### Verbesserungen
- **Auslastungs-Widget: ein Balken statt zwei.** Aktuelles Quartal und Altanträge stehen jetzt in einem gemeinsamen Balken, von links nach rechts nach Alter sortiert: links die ältesten offenen Anträge (Q-3 bis 7, dunkelste Farbe), rechts das aktuelle Quartal (hellste Farbe). Das ist kompakter und liest sich als Zeitachse.
- **Widget-Einstellungen zeigen jetzt beide Spalten.** In Einstellungen › Darstellung ist die Liste der Startseiten-Widgets jetzt in „Hauptspalte" und „Seitenspalte" unterteilt — genau wie die Startseite selbst. So ist auf einen Blick klar, welches Widget in welcher Spalte steht, und die Hoch/Runter-Pfeile sortieren jede Spalte für sich (kein wirkungsloses Verschieben mehr über die Spaltengrenze hinweg).

## v2.239 — 2026-07

### Verbesserungen
- **Notizen griffbereit unten rechts.** Das Notizen-Feld steht standardmäßig am unteren Ende der rechten Spalte, damit du schnell etwas festhalten kannst — du kannst es bei Bedarf aber weiterhin in den Einstellungen verschieben. Der Hinweis heißt jetzt klarer „Nur lokal gespeichert, nie im Team Bereich".
- **Auslastungs-Widget aufgeräumt.** Es startet eingeklappt (klappt bei Bedarf auf) und zeigt die Zahlen zu den Altanträgen jetzt direkt in den farbigen Balken, wie im Auslastungs-Modul — jetzt mit besser lesbarem Kontrast. Die Fußzeile mit dem Vorquartals-Vergleich und dem „Zum Cockpit"-Link ist weggefallen; das Widget ist damit kompakter. Die Belegungs-Prozentzahl steht jetzt nur noch einmal (nicht mehr doppelt im Kopf und im Balken).
- **AI-Assistent kompakter.** Status und „Verbinden" stehen auf einer Zeile; der „Chat öffnen"-Link ist weg — den Assistenten öffnest du jetzt über das Symbol rechts am Bildschirmrand.
- Ein- und ausgeklappte Widgets bleiben pro Gerät gemerkt.

## v2.238 — 2026-07

### Verbesserungen
- **„Neue Anträge für dich" ist jetzt ein Widget.** Der Bereich mit passenden offenen Anträgen zum Selbst-Übernehmen sieht jetzt aus wie die anderen Startseiten-Karten (Rahmen, Ein-/Ausklappen) und lässt sich in Einstellungen › Widgets ein-/ausblenden und verschieben. Hinweis: Nach diesem Update ist er zunächst ausgeblendet — einmal in den Einstellungen auf „Sichtbar" stellen, dann ist er wieder da.

## v2.237 — 2026-07

### Verbesserungen
- **Startseite: mehr Platz für den Kanban.** Zwischen der breiten Hauptspalte und der schmalen rechten Spalte gibt es jetzt einen Zieh-Griff: einfach nach rechts ziehen, dann wird die Hauptspalte breiter und der Kanban zeigt mehr Spalten statt „+ N weitere". Die eingestellte Breite bleibt auf diesem Gerät gemerkt; Doppelklick setzt sie zurück.
- **Aufgeräumte Widget-Köpfe.** Der Bearbeiten-Stift erscheint nur noch bei Widgets, die sich wirklich einstellen lassen (Kanban und Antragseingang) — bei allen anderen ist er weg, statt ein leeres „keine Einstellungen"-Fenster zu öffnen. Außerdem ragt der Stift in der schmalen rechten Spalte nicht mehr über den Kartenrand hinaus. Und im Antragseingang-Widget stehen die kleinen Zähler-Punkte im Kopf nur noch im eingeklappten Zustand — aufgeklappt stehen die gleichen Zahlen ja schon in den Zeilen darunter.
- **Kompaktere Widget-Karten.** Die Karten auf der Startseite haben oben und unten etwas weniger Luft — so passt mehr auf einen Blick auf den Bildschirm, ohne dass es gedrängt wirkt.

## v2.236 — 2026-07

### Verbesserungen
- **Einstellungen ohne Scrollen:** Unter „Darstellung & Bedienung" lassen sich „Tastatur Shortcuts" und „Widgets auf der Startseite" jetzt auf- und zuklappen. Die lange Shortcut-Liste ist standardmäßig eingeklappt und steht direkt unter dem Erscheinungsbild, sodass die Widgets sofort im Blick sind — und die Widget-Liste selbst ist kompakter. Der aufgeklappte/zugeklappte Zustand bleibt gemerkt.

## v2.235 — 2026-07

### Bugfixes
- **Befehlspalette bleibt jetzt offen:** Mit Strg+K öffnest du die Schnellsuche für Aktionen — bisher klappte sie manchmal sofort wieder zu. Das ist behoben; geschlossen wird über Esc, einen Klick daneben oder eine Auswahl.

### Verbesserungen
- **Aufgeräumte Einstellungen:** „KI-Assistent" heißt jetzt „Interne KI". Der Entwickler-Bereich „Assistent & Gedächtnis" ist in „Mein Profil" umgezogen — ein Menüpunkt weniger.
- **Mehr Tastatur-Kürzel:** Strg+Umschalt+H springt zur Startseite, +F zu den Förderanträgen, +E zu den Einstellungen. Die anzeigten Kürzel in der Befehlspalette stimmen jetzt mit der Wirklichkeit überein.
- **Klarere Texte & mehr Ruhe:** Die langen Erklärungen zu „Thinking" und „Kontextfenster" sind kurz gefasst — das Detail steckt hinter dem kleinen „i". Die Speicherorte stehen luftiger, und die Startseiten-Widgets sind deutlicher vom Erscheinungsbild abgesetzt.

## v2.234 — 2026-07

### Neu
- **Registry-Änderungen auf der Startseite (nur Kurator):** Ein neues Widget zeigt Kurator:innen die jüngsten Änderungen an Skills und Regeln — neu, geändert, aktiviert oder deaktiviert, jeweils mit Zeitpunkt. Eine feste Erinnerung im Fuß hält den wichtigsten Grundsatz vor Augen: Aktivierungen wirken sofort für alle Varianten.

## v2.233 — 2026-07

### Neu
- **QS-Freigaben auf der Startseite:** Ein neues Widget sammelt alle Gutachten-/Artefakt-Entwürfe, die fertig generiert sind, aber noch auf deine Freigabe warten — mit „Entwurf seit N Tagen" und dem Regel-Status. Steht alles auf grün, führt „Freigeben →" direkt zum Artefakt; sonst „Prüfen →". Freigegeben wird weiterhin nur im Artefakt selbst, nie im Widget.

## v2.232 — 2026-07

### Neu
- **Auslastung auf der Startseite:** Ein neues Widget zeigt deine Quartals-Belegung auf einen Blick — belegt/frei in TVs, offene Altanträge nach Alter und der Vergleich zum Vorquartal. Führst du ein eigenes Kürzel, siehst du deine Zahlen; als Projektleitung („alle") das Team-Aggregat inkl. „N von M über 100 %". Nur dort verfügbar, wo das Auslastungs-Modul aktiv ist.

## v2.231 — 2026-07

### Neu
- **Feedback-Neuigkeiten auf der Startseite:** Ein neues Widget zeigt auf einen Blick, was sich seit deinem letzten Besuch im Feedback getan hat — Antworten des Teams auf deine Tickets, neue Ideen/Probleme von Kolleg:innen und wenn deine Vorschläge Stimmen bekommen. „Alles gelesen" setzt den Zähler zurück; ein Klick führt zum Feedback-Board. Einschalten in den Widget-Einstellungen.

## v2.230 — 2026-07

### Neu
- **Feedback als Kanban auf der Startseite:** Das Kanban-Widget kann jetzt statt der Förderanträge auch das Team-Feedback anzeigen — bunte Spalten nach Status (Neu, In Bearbeitung, Geplant, Umgesetzt …). Ein Klick auf eine Karte öffnet das passende Ticket direkt im Feedback-Board. Umschalten in den Widget-Einstellungen unter „Quelle".

### Verbesserungen
- **Wessen Zahlen sind das?** Die Widgets „Anträge — Kanban", „Meine Anträge" und „Antragseingang" zeigen jetzt in der Kopfzeile, ob sie deine eigenen Anträge („Kürzel THU") oder alle Bearbeiter zusammen zeigen — so liest man Team-Zahlen nicht mehr versehentlich als die eigenen.

## v2.229 — 2026-07

### Neu
- **Startseite anpassen:** Über den Stift am Widget-Kopf oder die neue Einstellungs-Sektion „Widgets auf der Startseite" (Darstellung & Bedienung) kannst du Widgets umsortieren, ein-/ausblenden und einstellen — z.B. das neue Kanban einschalten, seine Spalten und Farben wählen. Alles gilt nur für dein Gerät.
- **Notizen-Widget:** Ein einfacher Notizzettel für die Startseite — nur lokal auf deinem Gerät, landet nie im geteilten Datenordner.

### Verbesserungen
- **Antragseingang-Ampel:** Die Warn- und Kritisch-Schwellen (bisher fest 30/90 Tage) sind jetzt einstellbar, und ein Klick auf eine Ampel-Zeile öffnet direkt die passend gefilterte Antragsliste (mit sichtbarem, entfernbarem Filter-Chip). Die farbigen Punkte in den Listenzeilen behalten ihre gewohnten Stufen.

## v2.228 — 2026-07

### Neu
- **Kanban-Ansicht für Anträge auf der Startseite (Vorschau):** Ein neues Widget zeigt deine Förderanträge als Board mit farbigen Spalten je Bearbeitungsphase — mit kompakten Karten (Akronym, nächster Schritt, Eingangsalter) und Klick direkt in den Antrag. Wahlweise bunt oder in Abstufungen deiner Akzentfarbe, als Datenbasis auch ein gespeicherter Filter. Das Widget ist zunächst ausgeblendet; einschalten lässt es sich mit der Einstellungs-Seite der nächsten Version.

## v2.227 — 2026-07

### Neu
- **Startseite als Widgets:** Die Bereiche der Startseite (Weitermachen, Meine Anträge, Antragseingang, AI-Assistent) sind jetzt eigenständige Karten mit einheitlichem Kopf — jede lässt sich per Klick auf den Pfeil ein- und ausklappen. Eingeklappt bleibt eine kompakte Zeile mit den wichtigsten Zahlen sichtbar (z.B. die drei Ampel-Werte beim Antragseingang).

### Verbesserungen
- Inhalte und Reihenfolge der Startseite bleiben unverändert — nur der Rahmen ist neu. Das Umsortieren und Ein-/Ausblenden der Widgets folgt in einer der nächsten Versionen.

## v2.226 — 2026-07

### Verbesserungen
- **Unter der Haube:** Vorbereitung für die anpassbare Startseite — künftig lassen sich die Startseiten-Bereiche (Widgets) umsortieren, ein- und ausblenden. Sichtbar wird das in den nächsten Versionen; an der Startseite ändert sich in dieser Version noch nichts.

## v2.225 — 2026-07

### Neu
- **Kompakte Ansicht im Feedback-Board:** Ein neuer Knopf rechts neben dem Listen-/Board-Umschalter schaltet auf eine dichtere Darstellung — mehr Einträge auf einen Blick, in der Liste wie im Board. Die Wahl merkt sich die App auf deinem Gerät.

### Verbesserungen
- **Feedback-Board mit farbigen Spalten:** Die Board-Spalten haben jetzt eigene Farben und Symbole (Neu · Abgelehnt · Geplant · In Bearbeitung · Umgesetzt) — der Stand eines Beitrags ist auf einen Blick erkennbar. Die Karten sind aufgeräumter: Typ-Farbkante, Titel, optionales Vorschaubild und unten Autor, Kommentare und Punkte.
- **Lob hat einen festen Platz in der Liste:** Lob durchläuft keinen Bearbeitungs-Workflow und taucht deshalb nicht mehr als eigene Board-Spalte auf — du findest es weiterhin in der Listenansicht (Typ-Filter „Lob").

## v2.224 — 2026-07

### Neu
- **Persönliches Gedächtnis für den Assistenten (Vorschau, nur Entwicklungsversion):** Der Assistent kann sich jetzt — wenn du es aktivierst — wenige, knappe Notizen über deine Arbeit merken (woran du gerade arbeitest, bevorzugte Abläufe, offene Fäden). Ein Hintergrundlauf fasst dein Arbeitsprotokoll gelegentlich zusammen; die Notizen sind in den Einstellungen einsehbar, einzeln oder komplett löschbar, und fließen als „Hintergrundwissen" in die Antworten des Assistenten ein. Die Auswertung läuft ausschließlich über die **interne** KI vor Ort — nichts verlässt dein Gerät ins Internet. Doppelte Zustimmung nötig (erst Arbeitsprotokoll, dann Gedächtnis), jederzeit abschaltbar. Zunächst nur in der Entwicklungsversion.

## v2.223 — 2026-07

### Verbesserungen
- **Unter der Haube — bessere Qualitätsprüfung der KI-Bausteine (nur Entwicklungsversion):** Das interne Test-Werkzeug für die Antrag-Aufbereitung kann seine Übungsläufe jetzt zusätzlich gegen ein starkes Vergleichs-Modell fahren. So lässt sich sauber unterscheiden, ob ein schwaches Ergebnis an unserer Software liegt oder an den Grenzen des internen KI-Modells. Dabei werden ausschließlich fiktive Übungs-Anträge verwendet — echte Antragsdaten sind technisch ausgeschlossen. Für dich ändert sich im Alltag nichts.

## v2.222 — 2026-07

### Neu
- **Assistent-Panel (Vorschau, nur Entwicklungsversion):** Ein neues Panel rechts beantwortet Fragen zu deiner aktuellen Arbeit — „Was ist mein nächster Schritt?", „Welche Fristen stehen an?", „Was steht im Antrag zu Thema X?". Es sieht nur die gerade geöffnete Ansicht und die zugehörigen Dokumente (oben transparent als Kontext angezeigt) und antwortet ausschließlich über die **interne** KI — Antragsinhalte verlassen das Haus nie. Es merkt sich nichts über die Sitzung hinaus. Kommt als Probelauf zunächst nur in der Entwicklungsversion.

## v2.220 — 2026-07

### Verbesserungen
- **Unter der Haube — Grundstein für einen persönlichen Assistenten:** In der Entwicklungsversion kann jetzt optional ein rein lokales Arbeitsprotokoll geführt werden (welche Anträge und Dokumente geöffnet, was gesucht wurde) — als Basis für einen späteren persönlichen Assistenten. Standardmäßig aus, jederzeit ein- und ausschaltbar und vollständig löschbar; die Daten bleiben ausschließlich auf dem eigenen Gerät und gehen nie an eine KI oder aufs Laufwerk. Für dich ändert sich im Alltag nichts.

## v2.214 — 2026-07

### Verbesserungen
- **Unter der Haube — sauberer KI-Kontext:** Werkzeuge, die die interne KI nutzen (z. B. Gutachten-Entwürfe), starten den KI-Chat jetzt vor jedem Lauf automatisch frisch. So kann kein alter Gesprächsverlauf mehr das Ergebnis verfälschen; klappt das Zurücksetzen einmal nicht, weist ein Hinweis darauf hin. Für dich ändert sich im Alltag nichts.

## v2.213 — 2026-07

### Verbesserungen
- **Lesezeichen leichter erkennbar:** In den Einstellungen (KI-Tab) sieht der „Interne KI"-Knopf, den man in die Lesezeichenleiste zieht, jetzt wie ein ziehbares Lesezeichen aus (mit Greif-Punkten) statt wie ein normaler Klick-Knopf — so ist klarer, dass man ihn hinaufziehen und nicht anklicken soll.
- **Unter der Haube:** Ein neues internes Prüf-Werkzeug hilft dem Team, die KI-gestützte Antrag-Aufbereitung vor der Freischaltung zu testen. Für dich ändert sich sichtbar nichts.

## v2.212 — 2026-07

### Verbesserungen
- **Ruhigere Statusanzeige der internen KI:** Im KI-Tab zeigt die kleine Anzeige unten rechts jetzt nur noch **eine** dezente Status-Pill statt drei nebeneinander. Sie durchläuft kurz die Prüfungen und ruht dann auf „Verbunden"; ein Klick darauf prüft die Verbindung erneut. Sie sitzt außerdem etwas weiter links, damit Chromes Bildschirmfreigabe-Hinweis sie nicht mehr überdeckt. Hinweis: Das Lesezeichen muss dafür einmal neu installiert werden (aus den Einstellungen erneut in die Lesezeichenleiste ziehen).

## v2.211 — 2026-07

### Neu
- **Dein Rückstand auf einen Blick auf der Startseite:** Über „Meine Anträge" siehst du jetzt einen kleinen Balken, der deine offenen Anträge nach Alter aufteilt — „Ab Q-3 · Q-2 · Q-1 · aktuelles Quartal". So erkennst du sofort, wie viele Altlasten sich angesammelt haben. Wenn du mit der Maus über ein Segment fährst, klappt eine Liste der konkreten Anträge dieses Quartals auf (Förderkennzeichen, Akronym, Status, Datum, TVs) — genau wie im Auslastungs-Modul. Ein Klick auf „Zu meinen Anträgen →" bringt dich direkt in die nach Frist sortierte Liste.

### Verbesserungen
- **Einstellungen aufgeräumt:** Der Menüpunkt „Profil" heißt jetzt „Mein Profil", und der „KI-Assistent" steht im Bereich „System" nun an letzter Stelle.

## v2.210 — 2026-07

### Neu
- **Sponsoring direkt auf den Feedback-Karten:** Bei Ideen und Verbesserungen siehst du jetzt schon in der Liste, wie viele Punkte gesammelt sind und wie nah ein Vorschlag am Ziel ist („X/Y Pkt · N Sponsoren", grün bei „Ziel erreicht"). Sponsern selbst geht wie gewohnt im Detail — dort mit großer Anzeige, +/−-Knöpfen und deinem Rest-Budget.
- **Fortschritt auf einen Blick:** Jedes Feedback zeigt jetzt seinen Stand als kleine Schritt-Anzeige (Neu → Geplant → In Bearbeitung → Umgesetzt); im Detail als voller Fortschritts-Balken. Bei deinen eigenen Beiträgen ist die Schritt-Anzeige direkt in der Liste.
- **Du wirst benachrichtigt, wenn das Team antwortet:** Oben erscheint eine Glocke mit der Zahl neuer Antworten auf deine Feedbacks — ein Klick bringt dich direkt zu „Von mir". Beantwortete Beiträge sind mit „Antwort" markiert, und in der Sicht „Von mir" siehst du eine kleine Fortschritts-Übersicht deiner Beiträge.

### Verbesserungen
- **Übersichtlichere Karten:** Statt vieler Textzeilen zeigt jede Karte nur noch Titel und eine kurze Vorschau — schneller zu überfliegen. Details stehen weiterhin im aufklappbaren Bereich rechts.
- **Bessere Filter und Sortierung:** Neue Sortierungen (u. a. „Meiste Punkte" und „Kurz vor dem Ziel") und ein Status-Filter. Die Sichten „Alle / Von mir / Vom Team" sind jetzt deutlicher als Umschalter gestaltet.
- **Aufgeräumtes Board (Kanban):** eigene „Lob"-Spalte, und leere Spalten schrumpfen platzsparend zu einer schmalen Leiste.

## v2.209 — 2026-07

### Neu
- **„Weitere passende Anträge" auf der Startseite:** In „Neue Anträge für dich" gibt es jetzt einen Knopf, der dir auch Anträge zeigt, bei denen du nicht der erste Vorschlag bist — praktisch, wenn in deinem Hauptgebiet gerade nichts frei ist. Jeder dieser Anträge zeigt deine persönliche „Passung", damit du siehst, wie gut er zu dir passt.

### Verbesserungen
- **Mehr Anträge direkt einblenden:** „Neue Anträge für dich" lässt sich jetzt Schritt für Schritt („+10 mehr anzeigen") aufklappen, statt in einem separaten Fenster — genau wie „Meine Anträge" darüber.
- **Details beim Darüberfahren:** Fahre mit der Maus über einen Antrag, um den vollen Verbund- und Teilvorhaben-Titel, den Antragsteller und das Eingangsdatum zu sehen — so kannst du besser einschätzen, ob er für dich passt.

### Bugfixes
- **„Weitere passende Anträge" klappt nicht mehr zu:** Wenn du bei den weiteren Anträgen auf „Kann ich übernehmen" geklickt hast, klappte die Liste bisher jedes Mal zusammen und musste neu geöffnet werden. Jetzt bleibt sie offen, und der übernommene Antrag wird direkt als „Vorgemerkt" markiert.

## v2.208 — 2026-07

### Verbesserungen
- **Feedback wieder direkt in der Seitenleiste:** „Feedback" ist wieder ein eigener Menüpunkt (oben im Arbeitsbereich); das kleine Sprechblasen-Symbol unten in der Leiste ist dafür entfallen. Feedback geben geht weiterhin über den Knopf unten rechts.
- **Auslastung an neuer Stelle:** steht jetzt direkt unter „Förderanträge" (vor „E-Mail Anfragen").
- **Klarere Schreibweise:** der Menüpunkt heißt jetzt **„E-Mail Anfragen"**.
- **Aufgeräumte Seitenleiste:** das Globus-Symbol bei „Skill-Verwaltung" ist entfernt, und das Ein-/Ausklapp-Symbol zeigt jetzt eindeutig, in welche Richtung es klappt.
- **Eingeklappte Leiste:** die farbigen Status-Punkte (Sync / CSV / KI) sitzen enger beieinander; der Tooltip beim Darüberfahren bleibt.

## v2.207 — 2026-07

### Verbesserungen
- Im Modul **Auslastung** heißt der letzte Tab jetzt **„Verwaltung"** (vorher „Einstellungen" — das ließ sich leicht mit deinen persönlichen App-Einstellungen verwechseln).
- Der Knopf **„Passwörter für alle aktiven MAs"** sitzt jetzt in der **Verwaltung** direkt bei der zugehörigen E-Mail-Vorlage — Passwörter erzeugen/versenden und die Vorlage anpassen liegen damit an einem Ort.

### Bugfixes
- Wenn du dein Feedback **per KI verbessern** lässt, kommt jetzt auch wirklich die verbesserte Fassung beim Team an — vorher wurde in manchen Fällen noch dein ursprünglicher Text übermittelt.

## v2.206 — 2026-07

### Verbesserungen
- **Feedback mit KI verbessern — jetzt ein geführter Ablauf mit der internen KI:** Wenn du „Feedback speichern & verbessern" wählst, stellt die interne KI dir 1–3 kurze Rückfragen, formt daraus eine klare, vollständige Fassung samt umsetzbarer Anforderung und zeigt sie dir zum Anpassen. Du bearbeitest sie und speicherst — dein ursprünglicher Text bleibt erhalten. Die früheren zwei getrennten Funktionen („verbessern" und „Details ergänzen") sind damit zu einem Schritt zusammengefasst.

### Bugfixes
- Die **KI-Verbesserung von Feedback** funktioniert jetzt zuverlässig mit der **internen KI** (vorher kam oft eine Antwort, aber kein Ergebnis).
- „Details ergänzen" verlangt **nicht mehr OpenRouter** — es läuft jetzt über die interne KI wie erwartet.

## v2.205 — 2026-07

### Neu
- In der Tabelle **Auslastung MA** zeigt der **Rückstands-Balken** jetzt beim Überfahren mit der Maus eine kleine Liste der konkreten Anträge dieses Zeitraums (Akronym, Status, Datum, TVs) — so sieht man auf einen Blick, welche Altanträge hinter dem Balken stecken, ohne die Zeile aufzuklappen.

## v2.204 — 2026-07

### Bugfixes
- In der Tabelle **Auslastung MA** sitzen die beiden Balken (Rückstand und aktuelles Quartal) jetzt exakt auf gleicher Höhe nebeneinander.

## v2.203 — 2026-07

### Neu
- **Zweites internes KI-Modell (Erprobung):** Die interne KI hat einen neuen Reiter „Agentischer Chat" mit einem anderen Modell. Die Verbindung kann jetzt gezielt einen der beiden Chats ansprechen — zunächst als Test-Funktion für Entwickler, später z. B. für Qualitätssicherung oder eine Zweitmeinung.

### Verbesserungen
- **Interne KI hält jetzt auch lange Antworten durch:** Wenn der KI-Server stark ausgelastet ist und eine Antwort mehrere Minuten dauert, wartet die App mit, solange die KI erkennbar arbeitet — statt vorzeitig mit „Zeitüberschreitung" abzubrechen.
- Die kleine **Status-Leiste im KI-Tab** sitzt jetzt **unten rechts** (dort verdeckt sie nichts und wird nicht mehr von der KI-Oberfläche überlagert) und stellt sich selbst wieder her, wenn die KI-Seite sich umbaut.
- Die Antwort-Erkennung übersteht jetzt auch Oberflächen-Änderungen der KI-Seite besser (zweites Erkennungs-Verfahren als Reserve).

### Wichtig
- **Bitte das Lesezeichen „Interne KI" einmal neu einrichten** (Einstellungen → KI-Assistent → Interne KI): das alte Lesezeichen kennt die Verbesserungen noch nicht.

## v2.200 — 2026-07

### Neu
- Die **Einstellungen** haben ein neues, aufgeräumtes Layout: statt einer langen Reiter-Leiste gibt es jetzt links eine **Navigation** mit den Gruppen **Persönlich** (Profil, Meine Technologien) und **System** (Darstellung & Bedienung, KI-Assistent, Daten & Verbindungen).
- **Einstellungs-Suche:** Oben in der Navigation nach jeder Einstellung suchen (oder **Strg + Komma** drücken) — die App springt direkt zum passenden Abschnitt und hebt ihn kurz hervor. Auch die alten Reiter-Namen („Speicher", „Online", „Tastatur" …) werden gefunden.

### Verbesserungen
- Verwandte Einstellungen sind zusammengelegt: **Tastatur-Kürzel** stehen jetzt bei „Darstellung & Bedienung", und **Speicher, Dokumentenquellen, Tags und Team-Status** (früher „Online") unter „Daten & Verbindungen".
- Beim **Datenordner** sitzen „Letzter Import" und **„Jetzt aktualisieren"** direkt in der Zeile — kein separater Abschnitt mehr.
- Lange Erklärtexte stecken jetzt hinter kleinen **ⓘ-Symbolen**, sodass die Seite ruhiger wirkt.
- Das **Feedback-Board** ist weiter verfeinert: Suche, Sortierung und Ansichts-Umschalter sitzen jetzt aufgeräumt neben den Typ-Filtern, die **Karten sind kompakter** (kurze Frage/Antwort-Paare stehen nebeneinander), und die **Board-Spalten** grenzen sich klarer voneinander ab. **Lob** erscheint nur noch in der Listen-Ansicht.

## v2.199 — 2026-07

### Neu
- Das **Feedback-Board** ist komplett neu gestaltet: übersichtliche Karten mit **Titel**, Typ-Symbol, Status und Bild-Vorschau statt langer Textblöcke. Oben umschaltbar zwischen **„Alle / Von mir / Vom Team"**, mit **Suche**, **Sortierung** (Neueste ↔ Meiste Stimmen) und einer neuen **Board-Ansicht** (Spalten nach Bearbeitungs-Status).
- **Stimmen (Daumen hoch):** Für ein Feedback abstimmen zeigt dem Team, wie gefragt es ist — unabhängig vom bisherigen Sponsoring, das erhalten bleibt.
- **Kommentare:** Zu jedem Feedback lässt sich jetzt ein Gespräch führen — Rückfragen stellen, ergänzen, mitdiskutieren.
- Beim **Feedback-Geben** kann optional ein kurzer **Titel** vergeben werden (sonst wird er automatisch aus der Antwort abgeleitet).
- Beim **Feedback-Geben** lassen sich jetzt auch **Dateien anhängen** (PDF, Word, Excel, PowerPoint, CSV, TXT, MD — z. B. ein erläuterndes Dokument oder eine Tabelle), zusätzlich zu Screenshots. Sie erscheinen im Detail als Download.

## v2.198 — 2026-07

### Verbesserungen
- Die **Feedback-Übersicht** ist übersichtlicher: In der Vorschau steht jetzt **jede Frage mit ihrer Antwort auf einer eigenen Zeile** (Frage fett) statt alles in einer langen Zeile hintereinander. Das Kennzeichen **„Dein Feedback" sitzt jetzt ganz links**.
- Die **Antragsliste neben dem geöffneten Detail** ist jetzt **nach Verbund gruppiert**: Statt jedes Teilvorhaben einzeln aufzuführen, steht pro Verbund nur noch ein Eintrag (mit der Anzahl seiner Teilvorhaben). Ein Klick öffnet den Verbund — die Teilvorhaben stehen dann übersichtlich im Detail.
- Die **Detailseite eines Antrags** wurde aufgeräumt: Die Kurzbeschreibung steht wieder als eigene Karte ganz oben, die Eckdaten (Programm, Antragsdatum …) stehen kompakt in der Titelzeile, und das Gutachten ist als **ein** zusammenhängender Bereich nach oben gewandert — Fortschrittsbalken und „Weiter bei …" bleiben erhalten.
- Doppelte Angaben sind raus: Die Verbundpartner erscheinen nur noch einmal (in der Teilvorhaben-Liste), und die überflüssige Rückzeile über dem Gutachten wurde entfernt.

### Bugfixes
- Bei manchen Verbünden fehlte die **Kurzbeschreibungs-Karte** auf der Detailseite — unter dem Titel stand nur eine kurze Zeile. Jetzt wird die Kurzzusammenfassung zuverlässig über alle Teilvorhaben gefunden und immer als Karte angezeigt.
- Der **obere Bereich der Detailseite** (Titel, Untertitel, Fortschritt, Kurzbeschreibung) hat jetzt mehr Luft zwischen den Zeilen und wirkt weniger gedrängt.

## v2.197 — 2026-07

### Verbesserungen
- In der **Mitarbeiter-Übersicht** der Auslastung („Auslastung MA") lässt sich die Grenze zwischen den beiden Balken „Altlasten" und „Aktuelles Quartal" jetzt **mit der Maus verschieben** — die Trennlinie im Spaltenkopf greifen und ziehen, wenn die Altlasten-Spalte schmaler sein soll. Die Einstellung bleibt erhalten; ein Doppelklick auf die Trennlinie setzt sie zurück.
- Der **Rückstands-Balken** („Altlasten") liest sich jetzt chronologisch von links nach rechts — die ältesten Quartale ganz links und in der **kräftigsten Farbe**, das jüngste rechts und am hellsten.

## v2.196 — 2026-07

### Verbesserungen
- Die **Mitarbeiter-Übersicht** in der Auslastung („Auslastung MA") zeigt Auslastung und Rückstand jetzt in **zwei getrennten Balken nebeneinander**: Die aktuelle Quartals-Auslastung ist dadurch zwischen Mitarbeitern direkt vergleichbar, der aufgelaufene Rückstand („Altanträge") steht daneben. Die Rückstands-Farben wechseln von Gelb/Orange/Rot zu einer ruhigen Blau-Abstufung (dunkel = neu, hell = alt), damit sie nicht mehr mit den Status- und Kategorie-Farben verwechselt werden. Überbuchte Mitarbeiter bleiben am roten Balken erkennbar.

## v2.195 — 2026-07

### Verbesserungen
- In der **Auslastung** (Anträge zuweisen) fließt die inhaltliche Ähnlichkeit jetzt wieder in die **Reihenfolge der Mitarbeiter-Vorschläge** ein, wenn die reine Stichwort-Übereinstimmung dünn ist. Bei klaren Stichwort-Treffern bleibt die Reihenfolge wie gewohnt; bei schwacher Stichwortlage rücken thematisch passende Mitarbeiter nach oben. Bitte im Blick behalten und Bescheid geben, falls Vorschläge unpassend wirken.

## v2.194 — 2026-07

### Bugfixes
- In der **Auslastung** (Anträge zuweisen) werden unter jedem Mitarbeiter wieder die **ähnlichen früheren Projekte** angezeigt. Seit dem Quartalswechsel stand dort bei allen Mitarbeitern „keine ähnlichen Projekte", obwohl die Passung korrekt berechnet wurde — das ist behoben. Die Reihenfolge der Vorschläge ändert sich dadurch nicht.
- In der **Suche** passt sich die Trefferliste jetzt der verfügbaren Breite an: Ziehst du den **Assistenten** rechts weit auf, werden die Tabellenspalten schmaler und bleiben sichtbar — statt dass sofort ein waagerechter Rollbalken erscheint und die rechten Spalten (Status, Bewertung …) abgeschnitten werden. Erst wenn es wirklich eng wird, taucht der Rollbalken auf.

## v2.193 — 2026-07

### Verbesserungen
- Die **Suche** begrüßt dich jetzt mit einem hilfreichen Startbildschirm statt einer nüchternen Zahl: Er nennt, wie viele Anträge durchsuchbar sind, erklärt kurz die Suchfelder und bietet **anklickbare Beispiele**, die direkt eine Suche starten. Der Hinweis auf die (noch nicht eingerichtete) Volltextsuche in Dokumenten ist jetzt eine dezente Zeile am Rand — die Einrichtung ist Sache der Kuratoren, nicht deine.

## v2.192 — 2026-07

### Verbesserungen
- Im Einstellungen-Tab **„Meine Technologien"** sehen alle Auswahl-Chips (Kategorien, ergänzende Erfahrungen, Antragstypen, erkannte Themen) jetzt einheitlich aus: Ausgewählte sind gefüllt und mit einem Häkchen markiert, nicht ausgewählte als schlichte Umrandung — **nichts wird mehr durchgestrichen**, gesperrte Chips sind klar erkennbar mit Erklärung beim Draufzeigen. Bei „Aus deinen bisherigen Anträgen" zeigt der Kopf, **wie viele Themen gewählt** sind, und lange Listen werden auf die wichtigsten gekürzt („+ N weitere" zum Aufklappen — Ausgewähltes bleibt immer sichtbar).

## v2.191 — 2026-07

### Verbesserungen
- **Frisches Erscheinungsbild:** Der Arbeitsbereich „schwebt" jetzt als weißes Blatt mit sanften Ecken über einer dezent grauen Grundfläche, auf der die Seitenleiste liegt. Dadurch sind Navigation und Arbeitsbereich klarer voneinander getrennt und die App wirkt aufgeräumter — ohne dass sich an den Inhalten oder der Bedienung etwas ändert. Der aktuell geöffnete Menüpunkt ist als kleine helle Kachel markiert. Gilt in allen Bereichen und funktioniert auch im dunklen Modus.
- In der **Auslastung** (Tab „Auslastung MA") ist der Altanträge-Balken jetzt so herum gestapelt, dass die **ältesten Anträge links liegen** (rot = am dringendsten), gefolgt von orange und gelb. Die Farben sind zudem etwas weicher und der Balken einen Tick kräftiger — insgesamt leichter auf einen Blick zu erfassen.
- Klappt man in der **Auslastung** eine Mitarbeiter-Zeile auf, sind „Auslastung pro Antragstyp" und „Aktuelle Buchung" jetzt in einer Karte zusammengefasst. Das Detail ist dadurch kompakter und man sieht mehr auf einen Blick, ohne zu scrollen.

## v2.190 — 2026-07

### Verbesserungen
- In der **Suche** lässt sich der **Assistent** rechts jetzt viel breiter ziehen. Bisher war bei einer festen Breite Schluss — jetzt können Sie ihn fast bis zum Fensterrand aufziehen, wenn Sie mehr Platz zum Lesen brauchen. Die Trefferliste bleibt dabei immer sichtbar.
- In der **Auslastung** (Tab „Auslastung MA") zeigt der Balken der **Altanträge** jetzt auf einen Blick, *wie dringend* sie sind: Er ist nicht mehr grau, sondern nach Alter eingefärbt — **Gelb** (letztes Quartal), **Orange** (vorletztes Quartal) und **Rot** (noch älter). Je röter, desto länger liegt der offene Antrag schon.
- Dabei werden jetzt auch **ältere offene Anträge** berücksichtigt (bis zu sieben Quartale zurück statt bisher nur zwei) — die Spalte „Altanträge" kann dadurch höhere Zahlen zeigen als vorher.

## v2.189 — 2026-07

### Neu
- Die **Feedback-Übersicht** ist wieder mit einem Klick aus der Seitenleiste erreichbar: Das Feedback-Symbol unten in der Seitenleiste öffnet jetzt direkt die Übersicht aller gemeldeten Punkte. Eigenes Feedback *geben* geht weiterhin über den runden Knopf unten rechts.
- Im Feedback-Board ist **dein eigenes Feedback hervorgehoben** (farbige Markierung + „Dein Feedback"-Kennzeichen) — so siehst du auf einen Blick den Bearbeitungs-Status deiner Tickets (z. B. „In Bearbeitung"). Neu ist außerdem der Filter **„Mein Feedback"**, der die Liste auf deine eigenen Meldungen einschränkt.

## v2.188 — 2026-07

### Verbesserungen
- Die KI nutzt jetzt standardmäßig das **volle Kontextfenster** des internen Sprachmodells (80.000 statt 62.000 Token). Vorhabensbeschreibungen, die vorher unnötig gekürzt wurden, werden jetzt **komplett** analysiert.
- Neu in **Einstellungen → KI-Assistent**: der Knopf **„Vom Server erkennen"** liest die tatsächliche Kontextgröße direkt vom laufenden Modell aus — kein Wert mehr, der von Hand nachgetragen werden muss.
- Ist ein Dokument **wirklich zu lang** fürs Kontextfenster, warnt die App jetzt schon **beim Hochladen/Konvertieren** (statt erst nach der Generierung) — mit dem klaren Hinweis, es außerhalb der App zu kürzen (z. B. Anhänge, Literaturverzeichnis, große Tabellen entfernen) und erneut hochzuladen.
- Beim Hochladen einer Vorhabensbeschreibung sieht man jetzt direkt, dass **eingebettete Bilder nicht mitgelesen** werden (sie enthalten keinen Text für die KI) und wie viele Tabellen als Text übernommen wurden.

### Bugfixes
- Die nachträgliche, große Warnung „…wurde gekürzt" ist einem **unaufdringlichen Hinweis** gewichen; die eigentliche Warnung kommt jetzt rechtzeitig beim Hochladen.

## v2.187 — 2026-07

### Verbesserungen
- Findet die Prüfung eine **beanstandete Formulierung** (z. B. eine Passiv-Floskel), gibt es jetzt daneben einen Link **„Anzeigen"** — ein Klick springt im Entwurf direkt zur betroffenen Stelle und hebt den Satz kurz hervor. Bei mehreren Stellen springen weitere Klicks reihum zur nächsten („Anzeigen (2)").

## v2.186 — 2026-07

### Verbesserungen
- Die **Prüfung** im Gutachten (rechte Spalte „Quelle & Prüfung") zeigt jetzt auf einen Blick, wie ernst ein Punkt ist: erfüllte Regeln mit grünem Haken, kleinere Hinweise mit gelbem Punkt und **echte Fehler als rote Karte** mit dem gemessenen Wert und dem Limit (z. B. „1117 / 1000 Zeichen"). Die Kopfzeile fasst zusammen: „1 Fehler · 1 Hinweis".
- Bei einem Fehler gibt es direkt einen Knopf **„Mit KI kürzen/erweitern/korrigieren"** — ein Klick startet eine gezielte Überarbeitung genau in die richtige Richtung (mit konkretem Zielwert), und die Prüfung aktualisiert sich anschließend von selbst. Die vorherige Fassung bleibt über den Versionsverlauf erhalten. Stilfragen (z. B. Passiv-Floskeln) bekommen bewusst **keinen** Auto-Knopf — die entscheiden Sie selbst.
- Wenn die KI gerade **nicht erreichbar** ist, steht dort jetzt ein freundlicher Hinweis „Offline: manuell bearbeiten und prüfen weiter möglich." statt einer Warnung — die Prüfung und das manuelle Bearbeiten funktionieren offline unverändert weiter.

## v2.183 — 2026-07

### Verbesserungen
- Die **fertige Antwort** im Modul „Anfragen" lässt sich jetzt **mit Formatierung** kopieren: fette Überschriften und Absätze bleiben erhalten, wenn Sie sie in Outlook einfügen — statt der rohen `**`-Zeichen wie bisher. Ein kurzer **Haken** am Knopf bestätigt, dass kopiert wurde.
- Neuer Knopf **„Kopieren & Mail öffnen"**: kopiert die formatierte Antwort und öffnet in einem Schritt einen bereits adressierten Mail-Entwurf an den Absender (Betreff „Re: …") — Sie fügen nur noch mit Strg+V ein. Die frühere Meldung „Antwort zu lang für Direkt-Mail" entfällt damit.
- Der selten genutzte Knopf **„Vor dem Einsetzen intern glätten"** wurde entfernt — die Antwort wird direkt und zuverlässig mit den Originaldaten befüllt.

## v2.182 — 2026-07

### Verbesserungen
- Wenn Sie einen Antrag öffnen, wird die Liste daneben jetzt zu einer **schlanken Kompakt-Spalte** statt einer zusammengequetschten Tabelle: eine Zeile pro Antrag mit farbigem Fristpunkt, Kurzname und relativer Frist. Der gerade geöffnete Antrag ist deutlich hervorgehoben, und ein kleines **Filter-Feld** oben durchsucht schnell nur die sichtbare Liste. So behalten Sie beim Bearbeiten den Überblick und springen mit einem Klick zum nächsten Antrag. Beim Schließen des Details kehrt die volle Tabelle **an genau der Stelle** zurück, an der Sie waren.

## v2.181 — 2026-07

### Verbesserungen
- Die **Verbund-Detailseite** zeigt jetzt direkt unter dem Kopf **Fortschritts-Karten** für Gutachten und Nachforderung: auf einen Blick, wie viele Abschnitte freigegeben bzw. wie viele Teilvorhaben versendet sind, mit Sprung-Button direkt in die Bearbeitung. Karten erscheinen nur, wenn das jeweilige Thema für den Antrag relevant ist — keine leeren Platzhalter. Die Nachforderungs-Karte zeigt zusätzlich die Frist.
- Die **Datenbereiche** (Antragsdaten & Verbundpartner, Teilvorhaben, Alle Felder, Historie) sind jetzt **eingeklappte Zeilen** mit einer kurzen Vorschau rechts (z. B. „Symate GmbH · 2 weitere" oder „zuletzt 22.06."). So passt die ganze Seite kompakt auf einen Blick; jeder Bereich lässt sich bei Bedarf aufklappen. Einmal gewählte Auf-/Zu-Zustände bleiben erhalten.

## v2.180 — 2026-07

### Verbesserungen
- Der **Kopf der Verbund-Detailseite** ist aufgeräumt: oben Kurzname und Kennzeichen, eine kurze Projektbeschreibung (auf Wunsch per „… mehr" ausklappbar) und die wichtigsten Eckdaten (Programm/Typ, Anzahl Teilvorhaben, Antragsdatum, beantragte Summe) auf einen Blick.
- Der **Fortschritts-Balken (Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss)** zeigt jetzt zuverlässig den **richtigen** Stand — auch bei älteren, bereits abgeschlossenen Anträgen (vorher standen die oft fälschlich ganz am Anfang). Abgelehnte oder zurückgezogene Anträge sind mit einem roten ✕ an der Abbruchstelle klar erkennbar. Der Fortschritts-Balken ist damit selbst die Statusanzeige — das frühere separate Status-Schild entfällt.

## v2.179 — 2026-07

### Verbesserungen
- Der Tab **„Alle"** trennt jetzt aktive von abgeschlossenen Anträgen: oben Ihr **Arbeitsvorrat („In Arbeit")**, darunter das eingeklappte **Archiv („Abgeschlossen")** mit Anzahl und Kurzüberblick (z. B. „Schlussvermerk 128 · abgelehnt/zurückgez. 14"). Ein Klick klappt das Archiv auf oder zu. Die abgeschlossenen Anträge verstopfen so nicht mehr die Liste — sind aber jederzeit einen Klick entfernt.
- **Beim Suchen** klappt das Archiv automatisch auf, wenn es Treffer enthält — so „verschwinden" gefundene Anträge nicht im zugeklappten Bereich.
- Sortieren, Filtern und Gruppieren wirken weiterhin über beide Bereiche. Wählen Sie eine Gruppierung (z. B. nach Status), tritt diese an die Stelle der Arbeitsvorrat/Archiv-Aufteilung.

## v2.178 — 2026-07

### Verbesserungen
- Die Frist-Spalte der Anträge-Tabelle liest sich jetzt in Klartext: **„in 45 T", „seit 12 T" oder „heute"** mit einem farbigen Ampelpunkt (grün → gelb → orange → rot), statt einer nackten Tageszahl wie „-2807d". Überfällige Fristen stehen rot hervorgehoben. Abgeschlossene Anträge zeigen keine Frist mehr.
- Die Ansichten sortieren jetzt sinnvoller vor: **„Alle" zeigt die neuesten Antragseingänge zuerst**, „Offen" die dringendsten Fristen zuerst. Eine selbst gewählte Sortierung bleibt erhalten.

## v2.177 — 2026-07

### Verbesserungen
- Die Anträge-Tabelle hat jetzt **eine** klare Spalte „Status und nächster Schritt" statt drei verstreuter Status-Spalten: Sie sehen auf einen Blick den amtlichen Status **und** was als Nächstes zu tun ist (z. B. „Beantragt → PreCheck durchführen"). Abgeschlossene Anträge zeigen nur noch den Status, ohne Handlungsaufforderung.
- Die alten Einzelspalten (Status, FB-Status, PreCheck-Status) bleiben über „Spalten" weiterhin zuschaltbar. Wenn Sie Ihre Spaltenauswahl schon angepasst hatten, bleibt sie unverändert.

## v2.176 — 2026-07

### Neu
- Neuer Schnellfilter **PreCheck** über der Anträge-Liste: mit einem Klick nur Anträge mit positivem, negativem oder noch offenem PreCheck anzeigen.

### Verbesserungen
- Die Schnellfilter über der Anträge-Liste sitzen jetzt in **einer aufgeräumten Zeile**: Es ist immer nur ein Filter aufgeklappt, das Öffnen eines anderen klappt den vorherigen automatisch zu. Ihre zuletzt geöffnete Auswahl wird je Ansicht gemerkt.
- „Gruppieren" ist von den Schnellfiltern in ein eigenes „Gruppierung: … ▾"-Menü rechts neben „Spalten" umgezogen – die Filter-Zeile bleibt so übersichtlich. Aktive Filter und die Trefferzahl stehen jetzt in einer eigenen Zeile darunter.

## v2.175 — 2026-07

### Verbesserungen
- „Meine Anträge" auf der Startseite denkt den PreCheck mit: Ein früher Antrag ohne PreCheck zeigt jetzt „PreCheck durchführen", einer mit negativem PreCheck „PreCheck-Ergebnis klären" – so sehen Sie sofort, was als Nächstes ansteht, statt nur den Status.

## v2.174 — 2026-07

### Neu
- Anfragen werden jetzt automatisch getaggt: Sobald Sie eine `.msg` aufnehmen, erkennt die interne KI Antragsart, Absender-Name, Firma und Themengruppe und hängt sie an die Anfrage. So sehen Sie auf einen Blick, worum es geht – ganz ohne Handarbeit (alles bleibt lokal).
- Die Anfragen-Tabelle lässt sich jetzt filtern und sortieren: Die erkannten Tags (Art, Thema, Firma) sind direkt Filter in den Spaltenköpfen – so finden Sie z. B. alle Anfragen einer Themengruppe sofort.

### Verbesserungen
- Beim Kopieren zum ZIM-FAQ-Assistenten wird dem Text jetzt ein kurzer Hinweis vorangestellt: die Anrede ans Team soll ignoriert, nur die Fragen beantwortet und die Platzhalter unverändert übernommen werden. Das sorgt für passendere Antworten und verhindert, dass Platzhalter verloren gehen.
- Im Assistent-Verlauf können Sie Unterhaltungen jetzt anheften (bleiben oben) und umbenennen – nicht mehr nur öffnen und löschen.

## v2.173 — 2026-07

### Verbesserungen
- Der Assistent ist jetzt direkt in der Suche: Ein Klick auf „Assistent" öffnet ihn als Panel rechts neben den Treffern – so können Sie zu dem, was Sie gerade gefunden haben, gleich Fragen stellen. Er kennt dabei Ihre aktuellen Suchtreffer als Kontext (kleiner Hinweis „Kontext: N Suchtreffer", jederzeit entfernbar).
- Frühere Unterhaltungen erreichen Sie im Panel über das Verlauf-Symbol; „Chat"-Lesezeichen landen automatisch im geöffneten Assistenten. Der eigene „Chat"-Eintrag in der Seitenleiste entfällt dadurch.

## v2.172 — 2026-07

### Verbesserungen
- Die Startseite spricht jetzt eine einheitliche Sprache: Die Kopfzeile zeigt auf einen Blick, wie viele Vorgänge offen sind, wie viele über der 90-Tage-Frist liegen und wie viele sich ihr nähern – dieselben Zahlen wie die Ampel-Karte rechts.
- In „Meine Anträge" steht jetzt statt eines Status-Etiketts, was als Nächstes zu tun ist – z.B. „Fachprüfung → Gutachten beginnen". Ein farbiger Punkt und das Eingangsalter („vor N Tagen") zeigen die Dringlichkeit. Die vollständigen Details finden Sie weiterhin mit einem Klick in der Förderanträge-Liste.

## v2.171 — 2026-07

### Neu
- Neue „Weitermachen"-Karte auf der Startseite: Sie zeigt Ihre drei zuletzt bearbeiteten Gutachten, Nachforderungen und Kurzfassungen – ein Klick auf „Weiter →" bringt Sie direkt zurück an die richtige Stelle.
- Dieser Verlauf bleibt bewusst nur lokal auf Ihrem Gerät: Er wird nicht auf das Netzlaufwerk übertragen und nicht exportiert, und speichert keine Textinhalte. In den Einstellungen unter „Speicher" können Sie ihn jederzeit einsehen und löschen.

## v2.170 — 2026-07

### Verbesserungen
- Aufgeräumte Seitenleiste: Ihre Arbeitsbereiche (Home, Förderanträge, E-Mail-Anfragen, Auslastung, Suche) stehen oben zusammen, „Skill-Verwaltung" und „Einstellungen" ruhig am unteren Rand.
- Feedback geben ist jetzt auch direkt unten in der Seitenleiste möglich – neben der Versionsnummer. Das öffentliche Feedback-Board erreichen Sie weiterhin über den Feedback-Dialog.
- Das Modul „Anfragen" heißt jetzt „E-Mail-Anfragen" – damit klarer ist, worum es geht.

## v2.169 — 2026-07

### Verbesserungen
- Die Freischaltung der KI-Anonymisierung im Modul „Anfragen" greift jetzt automatisch: Nach dem Verbinden mit dem Ablageort schaltet die App den Anonymisierer einmalig team-weit frei – ohne dass jemand ihn von Hand aktivieren muss. Eine spätere bewusste Deaktivierung bleibt erhalten.

## v2.168 — 2026-07

### Neu
- Die KI-Anonymisierung im Modul „Anfragen" ist jetzt freigeschaltet: Nach bestandener Qualitätsprüfung kann eine Kurzanfrage in allen Rollen (außer der reinen End-User-Version) automatisch anonymisiert werden. Hinweis für bestehende Installationen: Der Anonymisierer muss einmalig unter Kuration → Skill-Verwaltung → „Anfrage anonymisieren" aktiviert werden – danach gilt das team-weit für alle.

## v2.167 — 2026-07

### Neu
- In der Kurator-Version ist das Modul „Anfragen" jetzt verfügbar. Damit können Kuratoren u. a. die Adresse (URL) des externen ZIM-FAQ-Assistenten zentral einstellen – sie wird team-weit auf dem gemeinsamen Ablageort gespeichert, sodass alle dieselbe Ziel-Adresse nutzen.

## v2.166 — 2026-07

### Neu
- Im Modul „Anfragen" lässt sich jetzt auch der **Original-Mailtext** (linke Spalte) direkt bearbeiten — z. B. um die Anrede, Signatur oder Textstellen zu entfernen, die die KI beim Anonymisieren nur verwirren. Änderungen werden automatisch lokal gespeichert. Wird der Originaltext nach dem Anonymisieren noch geändert, weist die Ansicht darauf hin und sperrt den Export, bis erneut anonymisiert wurde – so passt die anonyme Fassung immer zum Original.

## v2.165 — 2026-07

### Neu
- Beim Absenden von Feedback erscheint jetzt zusätzlich der Button „Feedback speichern & verbessern", sobald die interne KI verbunden ist. Sie formt das Feedback dann in eine klare, umsetzbare Anforderung um (mit Ist/Soll-Beschreibung und Prüfpunkten) — sichtbar direkt nach dem Speichern und später im generierten Claude-Code-Prompt.

### Verbesserungen
- Die interne KI kennt jetzt die aktuellen App-Bereiche statt einer veralteten Beschreibung — dadurch bessere, treffendere Feedback-Zusammenfassungen.

## v2.164 — 2026-07

### Verbesserungen
- Wartungs-Release: Aufräumen von Dokumentation, Tests und internem Code. Keine sichtbaren Änderungen – aber eine sauberere Basis für schnellere und fehlerärmere Weiterentwicklung.

## v2.163 — 2026-07

### Verbesserungen
- In der Feedback-Verwaltung lässt sich die Grenze zwischen Ticket-Liste und Detail-Ansicht jetzt mit der Maus verschieben – so kann man dem Detail-Panel mehr oder weniger Platz geben; die eingestellte Breite bleibt erhalten. Ist kein Ticket ausgewählt, nutzt die Liste die volle Breite.
- Der Haken zum Abhaken eines Tickets als „Umgesetzt" ist jetzt deutlich besser sichtbar.

## v2.162 — 2026-07

### Neu
- In der Feedback-Verwaltung lässt sich ein Ticket jetzt mit einem Klick auf den Haken links in der Zeile direkt als „Umgesetzt" abhaken – ohne das Ticket zu öffnen und ohne zu speichern. Nochmal klicken macht es wieder rückgängig.

## v2.161 — 2026-07

### Neu
- Die Förderanträge-Tabelle lässt sich jetzt am rechten Rand mit einem Griff insgesamt breiter oder schmaler ziehen; die Spalten skalieren dabei proportional mit. Ein Doppelklick setzt sie zurück auf „Fensterbreite füllen".

### Verbesserungen
- In der Suche zeigt die Spalte „Programm" jetzt zusätzlich das Unterprogramm im Format „Programm/Unterprogramm" (z.B. „ZIM/ZIM FuE-Projekte 2025"), statt nur „ZIM" – so lassen sich Treffer besser unterscheiden und auch nach Unterprogramm filtern.
- Diese Änderungsliste ist jetzt durchgängig in verständlicher Sprache verfasst.
- Der selten genutzte Filter „Letzter Monat" in diesem Fenster wurde entfernt — die Ansicht ist damit aufgeräumter.

### Bugfixes
- Behoben, dass dieses „Was ist neu?"-Fenster manchmal eine ältere Version anzeigte, als tatsächlich installiert war — die neueste Version erscheint jetzt zuverlässig.
- In der Feedback-Verwaltung stimmen die Zahlen an den Filter-Knöpfen (Status, Kategorie, Bereich) jetzt mit der Anzahl der angezeigten Tickets überein — vorher zählten sie archivierte Tickets mit, obwohl diese in der Liste ausgeblendet waren (z.B. „Bug 5", aber nur 1 sichtbar).

## v2.160 — 2026-07

### Neu
- Der Nutzer-Changelog kann jetzt auch im Kurator-Build direkt „mit KI geglättet" und aktuell gehalten werden – vorher ging das nur im Entwickler-Build.

## v2.159 — 2026-07

### Neu
- Die Statusleiste am unteren Sidebar-Rand ist jetzt zweizeilig, damit auch bei schmaler Sidebar alles sichtbar bleibt (Einstieg oben, Status-Anzeigen darunter). Auf Unterseiten führt „Zeig es mir" zu einem kurzen Info-Hinweis.

### Verbesserungen
- Die Tabellenansicht der Förderanträge nutzt jetzt die volle Fensterbreite; auf breiten Monitoren sind alle eingeblendeten Spalten ohne seitliches Scrollen sichtbar.

### Bugfixes
- Die KI-Klassifizierung im Auslastungs-Modul kam trotz sichtbar korrekter Antwort nicht in der App an – die Verbindung greift jetzt zuverlässig die richtige Antwort ab (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.158 — 2026-07

### Neu
- Die Statistik-Übersicht im Auslastungs-Modul bietet jetzt einen Quartals-Vergleich: ein zurückliegendes Quartal des laufenden Jahres lässt sich als dezente Vergleichs-Anzeige einblenden.

### Bugfixes
- Das aktuelle Quartal rollt jetzt automatisch mit dem Kalender weiter – nach einem Quartalswechsel hing das Auslastungs-Modul nicht mehr im alten Quartal fest.
- Die Tabellenspalten „FB Status" und „PreCheck Status" bleiben nach einer nachträglichen Feld-Zuordnung nicht mehr leer.

## v2.157 — 2026-07

### Verbesserungen
- Die Filter-Einstellungen in den Auslastungs-Tabs bleiben jetzt über einen Neustart hinweg erhalten und werden beim nächsten Aufruf wieder angewandt.

### Bugfixes
- Die „Anträge mit KI klassifizieren"-Antwort kommt wieder zuverlässig in der App an; bei getrennter interner KI erscheint sofort ein klarer Hinweis statt eines endlosen Ladekreisels (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.156 — 2026-07

### Bugfixes
- Behoben, dass ein Import zwar durchlief, aber keine neuen Anträge ankamen (verursacht durch eine leere Unterprogramm-Konfiguration). Übersprungene Anträge sind jetzt zudem sichtbar nachvollziehbar.

### Verbesserungen
- Das Diagnose-Werkzeug „Erzwungen neu prüfen" ist jetzt nur noch für Kuration/Entwicklung sichtbar und verwirrt normale Nutzer nicht mehr.

## v2.155 — 2026-07

### Verbesserungen
- Der automatische CSV-Import macht jetzt sichtbar, wenn Quellen still übersprungen wurden (z. B. Demo-Quellen oder nicht erreichbare Dateien), statt fälschlich „Aktuell" anzuzeigen.
- Neuer Knopf „Erzwungen neu prüfen", der eine verknüpfte Quelle garantiert neu einliest – hilfreich, wenn eine geänderte Datei nicht automatisch erkannt wurde.

## v2.154 — 2026-07

### Neu
- Eine kuratierte CSV-Quellen-Konfiguration (Name, Spalten-Zuordnung, Beschriftungen) lässt sich jetzt exportieren und in einer anderen Umgebung wieder importieren.

## v2.153 — 2026-07

### Neu
- Das Modul „Anfragen" ist jetzt auch in den Projektleitungs- und AS-Varianten verfügbar.

### Verbesserungen
- Der tägliche automatische CSV-Import wird nicht mehr durch reine Zusatzspalten blockiert; nur noch tatsächlich fehlende Felder erfordern eine Rückfrage.

### Bugfixes
- Der CSV-Status zeigt jetzt pro Quelle Dateiname, Export-Datum und Zeilenzahl, damit man sieht, welche Datei-Version wirklich eingelesen wurde.

## v2.152 — 2026-06

### Neu
- Im Modul „Anfragen" trennt die interne Anonymisierung jetzt zwei Schritte in einem Durchlauf – Namen/Kennungen werden ersetzt, beschreibende Passagen fachlich verallgemeinert –, damit der externe Assistent den Sinn behält. (Der Anonymisierer bleibt bis zur manuellen Freigabe inaktiv.)

## v2.151 — 2026-06

### Verbesserungen
- Aktive Schaltflächen, Filter-Pillen und Auswahl-Elemente tragen jetzt app-weit die im Profil gewählte Akzentfarbe statt Schwarz – einheitlicheres Erscheinungsbild, keine Funktionsänderung.

## v2.150 — 2026-06

### Verbesserungen
- Aktions-Schaltflächen in der ganzen App verwenden jetzt einheitlich die im Profil wählbare Primärfarbe statt teils schwarzer oder abweichender Knöpfe.

## v2.149 — 2026-06

### Neu
- Im Feedback-Modul lassen sich archivierte Tickets jetzt gezielt ausblenden oder einblenden, und die Aufwand-Schätzung bietet feinere Stufen (von 2 Stunden bis über 2 Wochen).

### Verbesserungen
- Das öffentliche Feedback-Board startet jetzt mit dem Filter „Offen", damit offene Themen zuerst sichtbar sind; die Auswahl wird gemerkt.

## v2.148 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.147 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.146 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.145 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.144 — 2026-06

### Verbesserungen
- Die Haupt-Schaltfläche (Aktions-Button) trägt jetzt die im Profil gewählte Akzentfarbe statt Anthrazit; die Farbauswahl bleibt dabei immer gut lesbar.

## v2.143 — 2026-06

### Neu
- Neue Status-Anzeige „● CSV" unten in der Sidebar (für Import-Rollen): zeigt grün, ob alle CSV-Exporte eingelesen sind, und bietet per Klick einen direkten „Jetzt importieren"-Weg.

## v2.142 — 2026-06

### Verbesserungen
- Die Detailansicht einer Anfrage zeigt Original und anonymisierten bzw. finalen Text jetzt nebeneinander (Vorher/Nachher) mit synchronem Scrollen und farbigen Hervorhebungen.

## v2.141 — 2026-06

### Neu
- Das Anfragen-Modul bietet jetzt drei Ansichten (Liste, Tabelle, Karten), einklappbare Detail-Abschnitte, einen prominenten Status-Badge und eine Löschen-Funktion – analog zu den Förderanträgen.

## v2.140 — 2026-06

### Neu
- Ein Kurator kann eine versehentlich auf einem Produktiv-System gelandete Demo-Quelle jetzt ohne Neu-Zuordnung in eine echte Quelle umwandeln.

### Bugfixes
- Demo-/Fixture-Quellen werden nicht mehr versehentlich auf den gemeinsamen Datenbestand geschrieben und können echte Quellen nicht mehr überschreiben.

## v2.139 — 2026-06

### Neu
- Beim erneuten Einlesen einer CSV lässt sich jetzt die Zeichenkodierung wählen (inkl. Auto-Erkennung), damit Umlaute nicht mehr als Fragezeichen erscheinen.

### Verbesserungen
- Ein deutliches Warn-Banner weist jetzt darauf hin, wenn nur Demo-Quellen registriert sind und echte CSV-Exporte gar nicht importiert werden.

## v2.138 — 2026-06

### Neu
- Die Speicher-Einstellungen zeigen jetzt Datum und Uhrzeit des letzten CSV-Imports, damit sofort erkennbar ist, ob man auf aktuellen Daten arbeitet.

## v2.137 — 2026-06

### Neu
- Neue Kuration-Seite „Anfragen" zum Pflegen der Modul-Einstellungen inkl. der team-weit editierbaren Adresse des externen FAQ-Assistenten.

### Bugfixes
- Behoben, dass eine nächtlich geänderte CSV-Quelle auf manchen Rechnern nicht als „neu importieren" erkannt wurde und der Datenbestand still veraltete.

## v2.136 — 2026-06

### Verbesserungen
- Die Status-Anzeigen unten in der Sidebar sind jetzt als farbiger Punkt mit kurzem Wort („● Sync", „● KI") sofort verständlich, ohne Tooltip. „Getrennt" wird als handlungsbarer Gelb-Zustand statt als harter Fehler dargestellt.
- Kleinere Anpassungen im Anfragen-Modul: kompaktere Aufnahmefläche, klarere Umbenennung in „ZIM FAQ-Assistent" und übersichtlichere Panels.

### Bugfixes
- Behoben, dass der Anonymisieren-Schritt bei Nutzung der lokalen KI endlos im Ladezustand hängen bleiben konnte.

## v2.135 — 2026-06

### Neu
- Die Verbindung zur internen KI wird jetzt automatisch erkannt und überall angezeigt (Startseite und Sidebar); die KI lässt sich direkt per „Verbinden"-Button öffnen, und ein Hinweis erscheint, wenn der KI-Tab versehentlich geschlossen wurde. Der manuelle „Verbindung testen"-Klick entfällt.

## v2.134 — 2026-06

### Neu
- Im Entwickler-Test lässt sich im Antrag auswählen, welchen Gutachten-Workflow der Ablauf verwenden soll.

### Bugfixes
- Der „Speichern"-Knopf im Skill- und Workflow-Editor fragt nach erfolgreichem Speichern nicht mehr fälschlich nach ungespeicherten Änderungen.
- Die Anonymisierung im Anfragen-Modul kommt jetzt robust mit Eigenheiten der internen KI zurecht.

## v2.133 — 2026-06

### Neu
- Die Workflow-Verwaltung pflegt jetzt alle Workflows (Gutachten, Nachforderungen, …) mit einem Freigabe-Modell: im Entwickler-Build als Entwurf bauen und testen, per Freigabe für die anderen Varianten verfügbar machen.

### Bugfixes
- Die Statusleiste der internen KI-Seite war hinter der neuen Tab-Leiste verschwunden und ist jetzt wieder sichtbar (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.132 — 2026-06

### Neu
- Erkennungs-Regeln lassen sich jetzt ohne Regex-Wissen pflegen – über einfache Phrasen oder Synonym-Gruppen mit Live-Test – und der erzeugte KI-Hinweis gibt keine technischen Muster mehr preis.

## v2.131 — 2026-06

### Verbesserungen
- Die Filterleiste der Qualitätsregeln wurde aufgeräumt (gruppierte Facetten, eigene Zeile für „Verwendet in", übersichtlichere Spaltenbreiten) und der Intro-Text hinter ein Info-Icon verlegt, damit die Tabelle sofort sichtbar ist.

### Bugfixes
- Behoben, dass eine Spalte beim Anfassen des Breiten-Griffs ansprang und der Griff nicht mehr bündig am Spaltenende stand.

## v2.130 — 2026-06

### Verbesserungen
- Die Qualitätsregeln-Liste (Skill-Verwaltung) hat jetzt eine sichtbare Filterleiste nach Art, Typ, Prüfart, Schweregrad und Verwendung — in allen Ansichten, mit Treffer-Zähler und „Zurücksetzen".
- Der Spalten-Umschalter der Tabellenansicht sitzt jetzt platzsparend direkt in der Filterzeile.

## v2.129 — 2026-06

### Neu
- Neues Modul „Anfragen": Eine kurze E-Mail-Anfrage aufnehmen, per interner KI anonymisieren, extern beantworten lassen und die Originaldaten anschließend automatisch wieder einsetzen — bis zur versandfertigen Antwort. (Nur in der Entwickler-Version.)

### Verbesserungen
- Tabellen zeigen im Kopf jetzt dünne Trennlinien, damit klarer erkennbar ist, wo eine Spalte endet und wo man sie zum Vergrößern greifen kann.

## v2.128 — 2026-06

### Neu
- Im Changelog-Fenster gibt es wieder einen Umschalter „Alle aufklappen / Alle zuklappen".

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.127 — 2026-06

### Verbesserungen
- Das Changelog-Fenster ist bei vielen Versionen übersichtlicher: ältere Versionen werden in Zehnerpakete gebündelt, die neuesten bleiben einzeln offen.
- Das Changelog-Fenster lässt sich frei in der Größe verändern; die gewählte Größe bleibt beim nächsten Öffnen erhalten.

## v2.126 — 2026-06

### Verbesserungen
- Der nutzerfreundliche Changelog wird jetzt zentral gespeichert und steht allen Varianten sofort zur Verfügung, ohne dass die App neu gebaut werden muss.

## v2.125 — 2026-06

### Verbesserungen
- Das Fenster „Änderungen & Updates" ist kompakter, zeigt beim Öffnen die drei neuesten Versionen offen und bietet einen neuen Zeitfilter „Letzter Monat".

## v2.124 — 2026-06

### Neu
- Die AS-Variante zeigt die Bearbeiter-Auswahl in den Einstellungen jetzt als Auswahlliste („Alle" + alle Kürzel) statt als Freitextfeld.

### Bugfixes
- Wählt man in der AS-Variante „Alle", zeigt die Startseite jetzt die Gesamtübersicht statt eines Hinweises, dass kein Kürzel gesetzt sei.
- Bei einer Datenaktualisierung wird jetzt der Name der Person angezeigt, die aktualisiert hat, statt „unbekannt".
- Vor „Mit KI analysieren" in der Suche wird der interne KI-Chat automatisch zurückgesetzt, damit alte Gesprächsverläufe die Begründungen nicht mehr verfälschen. (Lesezeichen einmalig neu installieren.)

## v2.123 — 2026-06

### Neu
- Neue einblendbare Tabellen-Spalte „PreCheck Status" (grauer Badge mit dem jeweiligen Datum als Tooltip) in den Förderanträgen.

## v2.122 — 2026-06

### Verbesserungen
- „Mit KI analysieren" in der Suche ergänzt jetzt die gewohnten Treffer um eine zusätzliche Spalte „Begründung" (2–3 Sätze pro Treffer), statt die Tabelle zu ersetzen. Der Anweisungstext lässt sich vor dem Lauf anpassen, und die Begründung ist im Export enthalten.

## v2.121 — 2026-06

### Neu
- Neue einblendbare Tabellen-Spalte „FB Status" in den Förderanträgen: zeigt den jüngsten Status als Badge, mit Datum im Tooltip; sortier- und filterbar.

## v2.120 — 2026-06

### Neu
- Die Förderanträge-Liste zeigt jetzt nach dem Filtern eine Trefferzahl (z. B. „1.054 Anträge") in allen drei Ansichten.

### Bugfixes
- Die Tab-Zähler oben (z. B. „Offen") stimmen jetzt wieder mit der Anzahl der tatsächlich angezeigten Zeilen überein.

## v2.119 — 2026-06

### Bugfixes
- Fehlerhafte Darstellung einzelner Bereiche („nackt" gerenderte Komponenten) strukturell behoben; die Schrift ist jetzt überall einheitlich.

## v2.118 — 2026-06

### Verbesserungen
- Die Sektion „Alle Felder" der Antrags-/Verbund-Detailseite ist neu gestaltet: ein kompaktes 8-Fakten-Raster auf einen Blick, eine übersichtliche Verbundpartner-Tabelle (eine Zeile pro Teilvorhaben) und die vielen Technologie-Kennzeichen gebündelt in einem aufklappbaren Cluster.

### Bugfixes
- Der Technologie-Kennzeichen-Cluster bündelt die Kennzeichen jetzt auch mit echten Daten korrekt; das Zeilen-Layout klafft nicht mehr auseinander.

## v2.117 — 2026-06

### Neu
- Die Abschnitte der Verbund-Detailseite (Antragsdaten, Gutachten, Kurzfassung, Nachforderungen, Historie) lassen sich jetzt einzeln ein- und ausklappen, um beim Arbeiten gezielt Platz zu schaffen; der Zustand bleibt erhalten.

### Verbesserungen
- Die Abschnitts-Überschriften der Verbund-Detailseite sind einheitlich und bündig gestaltet.

## v2.116 — 2026-06

### Verbesserungen
- Der Editor für Gutachten-Abschnitte zeigt Formatierungen (fett, kursiv, Überschriften) jetzt direkt als Vorschau an, während man tippt; Format-Zeichen erscheinen nur in der Zeile, in der man gerade schreibt.

## v2.115 — 2026-06

### Neu
- Neue Programm-Variante „AS" (wie PL, aber ohne das Auslastungs-Modul) mit eigenem Zugangspasswort.

## v2.114 — 2026-06

### Verbesserungen
- Die Gutachten-Werkstatt ist aufgeräumter: kompaktere Kopf- und Meta-Zeile, Anpassen-Werkzeuge direkt am Text und ein deutlicher Warnhinweis, sobald eine externe KI im Einsatz wäre.
- Die Abschnitts-Leiste der Gutachten-Werkstatt lässt sich zu reinen Kreis-Symbolen einklappen, um mehr Breite zu gewinnen.
- Kleine Wording-Korrektur an der Anpassen-Zeile.

## v2.113 — 2026-06

### Neu
- Die Abschnitts-Leiste der Gutachten-Werkstatt lässt sich einklappen (nur Kreise), wenn mehr Platz für Entwurf und Kontext gebraucht wird; der Zustand bleibt erhalten.

## v2.112 — 2026-06

### Verbesserungen
- Der Denkprozess-Schalter (Thinking) ist jetzt ein kompakter An/Aus-Umschalter.
- Das Layout der Gutachten-Werkstatt wurde überarbeitet: die Abschnitts-Leiste dockt direkt an die Entwurf-Karte an, die Aktionsleiste ist kompakter.

### Bugfixes
- Vom Skill erzeugte Formatierungen (z. B. **fett**) werden jetzt in der Vorschau und im Word-Export korrekt dargestellt, statt als Sternchen im Text zu erscheinen.

## v2.111 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Aufräumen und Wartung, ohne sichtbare Änderung).

## v2.110 — 2026-06

### Verbesserungen
- Die Verbund-/Antrags-Detailseite hat ein kompakteres Layout (kompakter Kopf, klemmbare Kurzbeschreibung, Sprung-Navigation, schlankere Teilvorhaben-Liste), damit Gutachten und Nachforderungen ohne langes Scrollen erreichbar sind.

### Bugfixes
- Eine unvollständig veröffentlichte Verbund-Datei wird jetzt bereits an der Quelle vollständig geschrieben, sodass Startseite und Historie keine lückenhaften Daten mehr erhalten.

## v2.109 — 2026-06

### Neu
- Die Gutachten-Werkstatt bekommt ein neues 3-Spalten-Layout und erlaubt jetzt das direkte Bearbeiten des Entwurfstexts (mit „bearbeitet"-Markierung und Zurücksetzen).

### Verbesserungen
- Der Dialog „Persönlicher Stil" ist übersichtlicher gestaltet (zentriert, mit Vorschau der Kombination).

## v2.108 — 2026-06

### Neu
- Neuer Artefakt-Typ „Nachforderungen" (ZIM): Aus kuratierten Textbausteinen entstehen pro Teilvorhaben ein Word-Dokument und ein E-Mail-Entwurf — es wird nichts automatisch versendet. (Nur in der Entwickler-Version.)
- Die Gutachten-Maschine wurde zu einem allgemeinen Baukasten für solche Dokument-Artefakte verallgemeinert, inklusive Qualitätsprüf-Regeln.

## v2.107 — 2026-06

### Verbesserungen
- Im Gutachten-Detail lässt sich die Antragsliste einklappen, um mehr Platz zu schaffen, und die Abschnitte werden über eine benannte Navigationsliste (mit Statussymbol) statt über Buchstaben-Tabs angesteuert.

## v2.106 — 2026-06

### Neu
- Im Gutachten-Workflow erzeugt ein Klick jetzt alle noch fehlenden Abschnitte nacheinander als Entwurf, ohne zwischendurch freigeben zu müssen; der Vorgang lässt sich jederzeit fortsetzen.

## v2.105 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund für den Gutachten-Workflow (gezielterer KI-Kontext), ohne sichtbare Änderung im Normalbetrieb.

## v2.104 — 2026-06

### Verbesserungen
- In der Skill-Verwaltung lässt sich jetzt frei zwischen Einträgen wechseln, auch wenn ein Editor offen ist — bei ungespeicherten Änderungen kommt eine Nachfrage (Speichern / Verwerfen / Abbrechen).

## v2.103 — 2026-06

### Neu
- Die KI-Qualitäts-Regel „nur interne KI für Dokumentinhalte" ist jetzt fest im Programm verankert, damit Dokumentinhalte zuverlässig nicht an externe Dienste gelangen.

### Bugfixes
- Beim Öffnen einer Verbund-Detailseite mit KI-generierten Abschnitten öffnet sich kein ungefragter zweiter Browser-Tab mehr.
- Die Meldung „Verbund nicht gefunden" auf der Detailseite tritt nicht mehr auf; die Ansicht heilt sich selbst und baut fehlende Daten aus den Teilvorhaben auf.

## v2.102 — 2026-06

### Neu
- Der Gutachten-Workflow kann einen Abschnitt jetzt optional per KI beratend auf Qualität prüfen (Erdung, Kohärenz, Vollständigkeit, Ton) — der Text wird dabei nie automatisch überschrieben.
- Optionaler, streng begrenzter automatischer Neuversuch, wenn ein generierter Abschnitt zu lang oder zu kurz ist.

## v2.101 — 2026-06

### Neu
- Der Gutachten-Workflow (Abschnitte A–G) ist jetzt frei anpassbar: Schritte lassen sich in der Skill-Verwaltung umsortieren, Skills zuordnen und in Unterschritte zerlegen.

## v2.100 — 2026-06

### Neu
- Das Changelog-Fenster (Klick auf die Versionsnummer) hat jetzt einen Filter nach Kategorie: „Alle", „Neu & Verbesserungen" oder „Bugfixes", jeweils mit Anzahl.

### Bugfixes
- Die eingebauten Demo-Daten lösen im Entwickler-Build keine fälschliche CSV-Aktualisierung mehr aus.
