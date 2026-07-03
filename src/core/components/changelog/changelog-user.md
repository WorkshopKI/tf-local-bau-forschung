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
