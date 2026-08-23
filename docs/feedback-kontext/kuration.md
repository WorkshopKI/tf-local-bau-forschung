# Datenpflege (nur für Kuratoren sichtbar, nach Kurator-Login)

Die Seite heißt **Datenpflege** und steht in der Seitenleiste unter der Überschrift „Kuration" — die Gruppe lässt sich zuklappen, wenn man sie gerade nicht braucht.

Sie ist eine Seite mit mehreren Unterseiten links in der Spalte — genau wie die Einstellungen. Das Suchfeld darüber findet jeden Abschnitt und springt hin; der Treffer bleibt markiert, bis du weiterklickst. Was du hier änderst, gilt für alle: es liegt auf dem Daten-Share, nicht auf deinem Gerät.

Daneben steht in derselben Gruppe die Seite, die eine eigene Arbeitsfläche ist: Dokument-Review.

Solange der Kurator-Modus nicht freigeschaltet ist, steht das als Zeile oben auf der Seite: alles ist lesbar, nichts ist änderbar. Freigeschaltet wird in den Einstellungen unter „Mein Profil → Zusatz-Module".

## Übersicht
Die Landeseite: was gerade ansteht und wie die Daten stehen. Je eine Zeile für den Suchindex und die Dokument-Prüfung — mit dem echten Zustand, auch wenn nichts zu tun ist, und einem Weg dorthin; die Zeile zum CSV-Datenimport kommt mit eingeschaltetem Expertenmodus dazu. Rechts steht die Kurator-Sitzung: ob sie läuft, wie lange noch, und der Knopf zum Sperren. Freigeschaltet wird sie nicht hier, sondern in den Einstellungen — solange sie zu ist, wäre die Tür sonst im verschlossenen Raum.

## CSV-Quellen
Woher die Antragsdaten kommen. Jede Quelle ist ein CSV-Export des Fachsystems mit gemerkter Datei, Spalten-Mapping und letztem Import; ein Klick auf die Zeile öffnet ihre Details. „Neu registrieren" führt durch den Wizard.

Der Knopf **CSV Daten aktualisieren** wird aktiv, sobald am Ablageort eine neuere Datei liegt — im Streifen darüber steht, bei wie vielen Quellen das der Fall ist. **Spalten neu mappen** ordnet die gespeicherte Datei neu zu, ohne den Dateidialog. **CSV neu wählen** braucht man, wenn die Datei umgezogen ist oder der Zugriff verfallen ist.

Über der Liste der Zustand als schmaler Streifen — Quellen, Zeilen, letzter Import, neuere Datei am Ablageort: dieselbe Aussage, die der Punkt „● CSV" in der Fußzeile und die Übersicht zeigen. Er steht oben statt in einer Nebenspalte, weil die Quellen-Zeilen mit ihren vier Aktionen die volle Breite brauchen.

Eingeklappt darunter das Seltene: **Antrags-Daten zurücksetzen** (bei Encoding-Schäden aus der Quell-CSV; Schemas und Programme bleiben) und, nur im Dev-Build, das Wiederherstellen von CSV-Schemas aus einer Sicherung.

## Förderprogramme
Programme, Unterprogramme und die Filter, die daran hängen — alles darauf gilt für das **aktive Programm**; jede Gruppe sagt, für welches.

**Programme** sind der äußerste Rahmen: an der Programm-Id hängen Aktenzeichen, CSV-Schemas, Anträge, Unterprogramme und Filter. Anlegen, umbenennen, aktiv schalten; löschen geht nur bei 0 Anträgen. Umgeschaltet wird in der Seitenleiste. Weil das selten nötig ist und schwer wiegt, erscheint der Abschnitt nur mit eingeschaltetem Expertenmodus.

**Unterprogramme** legt man nicht an — sie entstehen beim CSV-Import aus der Spalte, die auf `unterprogramm_id` gemappt ist. Kuratierbar sind Label, geplanter Zeitraum und das Aktiv-Häkchen; Labels lassen sich auch aus einer XLSX übernehmen.

**Filter** sind drei Bestände nebeneinander, jeder mit seiner Anzahl: System-Filter sind eingebaut und lassen sich nur aus- und wieder einblenden. Kurator-Filter legst du hier an, sie gelten für alle im Programm. Nutzer-Vorlagen sind private Filter-Kombinationen auf dem jeweiligen Gerät — sie stehen hier nur zur Kenntnis.

## Dienste
Externe Gegenstellen, die das Team gemeinsam nutzt. Heute die URL des ZIM-FAQ-Assistenten, an den das Modul „E-Mail Anfragen" seine anonymisierten Fragen schickt. Leer lassen heißt: die Adresse aus dem Build verwenden.

## Suche &amp; Index
Was durchsuchbar ist — und wie gut. Links die Aktionen: Dokumente einlesen, Index bauen, Qualität messen. Rechts steht der Zustand daneben, während Sie arbeiten: Textabschnitte, Dokumente, Suchqualität, Modell, Backend, letztes Update.

Die Ampel oben nennt immer den **Dokumenten**-Index — auf dieser Seite stehen zwei Dinge, die „Index" heißen, und „kein Index vorhanden" ließ sich sonst auf die Vektoren darunter beziehen. Sie meldet neben „Modell gewechselt" auch „Worttrennung geändert"; dann stammt der Index aus einer Fassung vor der deutschen Worttrennung, bleibt nutzbar, und der nächste Lauf baut ihn komplett neu auf.

Darunter die Vektoren der Ähnlichkeitssuche — ein Vektor je Vorhaben, die zweite Hälfte desselben Index. Der Volltext-Index findet Wörter, diese Vektoren finden Themen. Hier steht, wie viele Vorhaben einen Vektor haben, aus welcher Textfassung er stammt und ob ein Neuaufbau fällig ist; dazu die Knöpfe zum Neuaufbauen, Holen vom Datenspeicher, Nachziehen und Zurücksetzen.

Während eines Laufs zeigt ein Balken den Stand des **ganzen** Laufs — Vorhaben und Verbünde auf einer Skala — samt geschätzter Restzeit; die Zeile darüber nennt die laufende Phase.

Nach einem Lauf steht dort, wie viele Vektoren entstanden sind, wie viele Vorhaben keinen Text hatten und wie viele **fehlgeschlagen** sind — das sind zwei verschiedene Dinge. Schlägt die Einbettung reihenweise fehl (Speicher voll oder Grafik-Kontext verloren), bricht der Lauf ab und nennt den ersten Fehlertext.

Ein unsauberer Lauf wird **nicht** auf den Datenspeicher gespiegelt: der Stand des Teams bleibt unberührt. Der Knopf „Erneut spiegeln" wiederholt allein den Upload, wenn der Bau stand und nur die Übertragung scheiterte.

Zwei Aussagen, die leicht zu verwechseln sind: „mit dem Datenspeicher synchron" heißt, dass hier derselbe Korpus liegt wie dort — nicht, dass er zu diesem Bestand vollständig ist. Ein Korpus deckt den Bestand ab, den sein Erbauer beim Bau hatte; kamen seitdem Vorhaben dazu oder hat sich ihr Text geändert, sagt die Karte das mit der Zahl, und „Nachziehen" holt genau diese nach.

Gebaut wird einmal für das ganze Team: der Lauf lädt ein rund 200 MB großes Modell in diesen Browser-Tab und dauert je nach Bestand und Rechner viele Minuten, danach spiegelt die App das Ergebnis auf den Datenspeicher. Wie lange es auf diesem Rechner dauert, steht am Knopf — aber erst, nachdem hier einmal gebaut wurde; vorher nennt er nur die Anzahl. Jeder andere Rechner holt es von dort in etwa zehn Sekunden. Ein Schalter darunter zieht neue CSV-Daten künftig automatisch nach — nur auf diesem Rechner, und nur solange kein Fassungswechsel ansteht.

Erst unter den Vektoren stehen die **Dokumentenquellen**, also die DMS-Ordner, die der Index einliest (read-only, die App schreibt dort nie hinein). Sie stehen dort und nicht weiter oben, weil man sie einmal einstellt und danach kaum wieder anfasst — die Vektoren dagegen schaut man immer wieder an. Ganz unten liegt eingeklappt das Seltene: Modellwahl, Suchqualität, Zurücksetzen.

Selten Gebrauchtes steht eingeklappt: Modellwahl und Suchqualitäts-Einstellungen sowie das Zurücksetzen.

## Sichtbarkeit
Hier steht, was nur mit eingeschalteten Beta-Funktionen oder eingeschaltetem Expertenmodus erscheint. Die Festlegung gilt team-weit; ob jemand die Schalter umlegt, entscheidet er in seinem Profil.

Der Baum zeigt zunächst nur die Seiten — eine Zeile je Seite, alles auf einem Bildschirm. Ein Klick auf das Dreieck klappt eine Seite auf und zeigt ihre Reiter, Abschnitte und einzelnen Karten; „Alles aufklappen" oben öffnet alle auf einmal. Karten sind die Blöcke mit eigener Überschrift auf den großen Fachseiten — etwa „Statistik-Übersicht" in der Auslastung oder „Fristrisiko" im Vorgangs-Board. Die Startseiten-Widgets stehen am Ende unter einem eigenen Eintrag.

An einer zugeklappten Seite steht rechts, wie viel darunter markiert ist („3 markiert") — so sieht man ohne Aufklappen, wo überhaupt etwas festgelegt wurde.

Jede Zeile trägt zwei Marken: „Beta" heißt, es funktioniert, kann sich aber noch ändern; eingeschaltet ist die Marke blau ausgefüllt, in derselben Farbe wie das „Beta"-Abzeichen in der App. „Experte" heißt, es ist ausgereift, aber selten gebraucht; eingeschaltet ist die Marke dunkel ausgefüllt. Ausgeschaltet sind beide nur ein feiner Umriss. Beide zusammen heißt neu und tief — dann müssen auch beide Schalter an sein.

Rechts stehen die Zähler nach Standard, nur Beta, nur Experte und beides, darunter das Zurücksetzen auf die mitgelieferte Vorbelegung. Gespeichert werden nur Abweichungen davon; eine geänderte Zeile bekommt deshalb einen kleinen Rückstell-Pfeil, der die ursprüngliche Festlegung nennt.

Einige Zeilen sind gesperrt: über sie erreicht man die Schalter selbst, den Kurator-Zugang und die Modul-Freischaltung. Wären sie ausblendbar, gäbe es keinen Weg zurück. Eine markierte Seite nimmt ihre Reiter und Abschnitte ohnehin mit — die brauchen dann keine eigene Marke.

## Nicht auf dieser Seite
**Dokument-Review** steht in derselben Seitenleisten-Gruppe, ist aber eine eigene Arbeitsfläche mit eigener Anleitung: dort werden die vorsortierten Dokumente geprüft — Typ korrigieren, Antrag zuordnen, Irrelevantes abhaken.
