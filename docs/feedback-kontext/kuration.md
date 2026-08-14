# Kuration (nur für Kuratoren sichtbar, nach Kurator-Login)

Die Kuration ist eine Seite mit mehreren Unterseiten links in der Spalte — genau wie die Einstellungen. Das Suchfeld darüber findet jeden Abschnitt und springt hin; der Treffer bleibt markiert, bis du weiterklickst. Was du hier änderst, gilt für alle: es liegt auf dem Daten-Share, nicht auf deinem Gerät.

Daneben steht in der Seitenleiste weiterhin die Seite, die eine eigene Arbeitsfläche ist: Dokument-Review.

Solange der Kurator-Modus nicht freigeschaltet ist, steht das als Zeile oben auf der Seite: alles ist lesbar, nichts ist änderbar. Freigeschaltet wird in den Einstellungen unter „Mein Profil → Zusatz-Module".

## Übersicht
Die Landeseite: was gerade ansteht und wie die Daten stehen. Je eine Zeile für den Suchindex, den CSV-Datenimport und die Dokument-Prüfung — mit dem echten Zustand, auch wenn nichts zu tun ist, und einem Weg dorthin. Rechts steht die Kurator-Sitzung: ob sie läuft, wie lange noch, und der Knopf zum Sperren. Freigeschaltet wird sie nicht hier, sondern in den Einstellungen — solange sie zu ist, wäre die Tür sonst im verschlossenen Raum.

## CSV-Quellen
Woher die Antragsdaten kommen. Jede Quelle ist ein CSV-Export des Fachsystems mit gemerkter Datei, Spalten-Mapping und letztem Import; ein Klick auf die Zeile öffnet ihre Details. „Neu registrieren" führt durch den Wizard.

Der Knopf **CSV Daten aktualisieren** wird aktiv, sobald am Ablageort eine neuere Datei liegt — rechts steht, bei wie vielen Quellen das der Fall ist. **Spalten neu mappen** ordnet die gespeicherte Datei neu zu, ohne den Dateidialog. **CSV neu wählen** braucht man, wenn die Datei umgezogen ist oder der Zugriff verfallen ist.

Rechts der Zustand: dieselbe Aussage, die der Punkt „● CSV" in der Fußzeile und die Übersicht zeigen — Anzahl Quellen, Zeilen, letzter Import.

Eingeklappt darunter das Seltene: **Antrags-Daten zurücksetzen** (bei Encoding-Schäden aus der Quell-CSV; Schemas und Programme bleiben) und, nur im Dev-Build, das Wiederherstellen von CSV-Schemas aus einer Sicherung.

## Verzeichnisse
Die Ordnung, in der die importierten Daten stehen — und alles darauf gilt für das **aktive Programm**; jede Gruppe sagt, für welches.

**Programme** sind der äußerste Rahmen: an der Programm-Id hängen Aktenzeichen, CSV-Schemas, Anträge, Unterprogramme und Filter. Anlegen, umbenennen, aktiv schalten; löschen geht nur bei 0 Anträgen. Umgeschaltet wird in der Seitenleiste.

**Unterprogramme** legt man nicht an — sie entstehen beim CSV-Import aus der Spalte, die auf `unterprogramm_id` gemappt ist. Kuratierbar sind Label, geplanter Zeitraum und das Aktiv-Häkchen; Labels lassen sich auch aus einer XLSX übernehmen.

**Filter** sind drei Bestände nebeneinander, jeder mit seiner Anzahl: System-Filter sind eingebaut und lassen sich nur aus- und wieder einblenden. Kurator-Filter legst du hier an, sie gelten für alle im Programm. Nutzer-Vorlagen sind private Filter-Kombinationen auf dem jeweiligen Gerät — sie stehen hier nur zur Kenntnis.

## Dienste
Externe Gegenstellen, die das Team gemeinsam nutzt. Heute die URL des ZIM-FAQ-Assistenten, an den das Modul „E-Mail Anfragen" seine anonymisierten Fragen schickt. Leer lassen heißt: die Adresse aus dem Build verwenden.

## Suche &amp; Index
Was durchsuchbar ist — und wie gut. Links die Aktionen: Dokumente einlesen, Index bauen, Qualität messen; darunter die Dokumentenquellen, also die DMS-Ordner, die der Index einliest (read-only, die App schreibt dort nie hinein). Rechts steht der Zustand daneben, während Sie arbeiten: Textabschnitte, Dokumente, Suchqualität, Modell, Backend, letztes Update.

Die Ampel oben meldet neben „Modell gewechselt" auch „Worttrennung geändert" — dann stammt der Index aus einer Fassung vor der deutschen Worttrennung; er bleibt nutzbar, der nächste Lauf baut ihn komplett neu auf.

Selten Gebrauchtes steht eingeklappt: Modellwahl und Suchqualitäts-Einstellungen, das Zurücksetzen, und der Status des Embedding-Korpus (gebaut wird der im Auslastungs-Modul).

## Dokument-Review
Review-Queue für Phase-2-Triage-Ergebnisse: Dokument-Typ korrigieren, Antrag zuordnen, als irrelevant markieren, re-triagieren.
