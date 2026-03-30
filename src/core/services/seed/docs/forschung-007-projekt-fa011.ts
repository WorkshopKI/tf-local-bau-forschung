import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-042',
  filename: 'Projekt_FA011.md',
  format: 'md',
  tags: ['Digital Twin', 'Wasser', 'ML'],
  created: '2026-01-25T10:00:00Z',
  vorgangId: 'FA-2026-011',
  markdown: `---
titel: Digitale Zwillinge für kommunale Wassernetze — Leckageerkennung und prädiktive Instandhaltung
aktenzeichen: FA-2026-011
datum: 2026-01-25
antragsteller: Prof. Dr.-Ing. Robert Rohrnetz, Lehrstuhl für Siedlungswasserwirtschaft, TU Musterstadt
---

# Digitale Zwillinge für kommunale Wassernetze

## 1. Problemstellung

Kommunale Wassernetze in Deutschland transportieren jährlich 4,7 Milliarden Kubikmeter Trinkwasser über ein Leitungsnetz von 530.000 km Länge. Die durchschnittliche Wasserverlustrate beträgt 7 Prozent (DVGW-Statistik 2023), in einigen Kommunen bis zu 15 Prozent. Bei einem mittleren Wasserpreis von 2 Euro pro Kubikmeter entsprechen 7 Prozent Verlust einem jährlichen Werteverlust von 660 Millionen Euro bundesweit. Die Hauptursache für Wasserverluste sind Leckagen in den Transportleitungen und Versorgungsleitungen, die durch Materialermüdung (Korrosion bei Gusseisen- und Stahlrohren, Versprödung bei PVC-Rohren), Bodenbewegungen (Setzungen, Frost-Tau-Wechsel), Druckschwankungen (Druckstöße bei Pumpenschaltungen) und Alterung der Dichtungen verursacht werden. Das mittlere Alter der Leitungen in Deutschland beträgt 38 Jahre, viele Netze stammen aus den 1960er- und 1970er-Jahren und erreichen das Ende ihrer technischen Nutzungsdauer.

Die konventionelle Leckerkennung erfolgt durch akustische Korrelationsmessung (Geophon, Korrelator), die zwar hochgenau ist (Ortungsgenauigkeit ±0,5 m), aber zeitintensiv und teuer: Ein Lecksuch-Team kann 2–3 km Leitung pro Tag untersuchen, die Kosten betragen 15–25 Euro pro laufendem Meter. Eine flächendeckende Netzüberwachung ist damit wirtschaftlich nicht darstellbar. Die Konsequenz: Leckagen werden oft erst entdeckt, wenn sie an der Oberfläche sichtbar werden (Wasseraustritt, Straßenabsenkung) — zu diesem Zeitpunkt kann der Wasserverlust bereits über Monate angedauert und erhebliche Folgeschäden verursacht haben.

## 2. Lösungsansatz: Digitaler Zwilling

Ein digitaler Zwilling (Digital Twin) des Wassernetzes kombiniert ein hydraulisches Simulationsmodell mit Echtzeit-Sensordaten und Machine-Learning-basierter Anomalieerkennung zu einem lebendigen Abbild des physischen Netzes. Der digitale Zwilling ermöglicht: Echtzeit-Überwachung des Netzbetriebs (Drücke, Durchflüsse, Pumpenzustände) auf einem zentralen Dashboard, automatische Leckage-Erkennung durch Vergleich der gemessenen Sensordaten mit dem Simulationsmodell (Residuenanalyse: Abweichung Messung — Simulation > Schwellenwert → Leckage-Alarm), Lokalisierung der Leckage auf 50 m Genauigkeit durch Triangulation der Drucksignale und prädiktive Instandhaltung — Vorhersage der Rohrbruch-Wahrscheinlichkeit auf Basis historischer Schadensdaten, Rohrmaterial, Alter, Bodenverhältnissen und Betriebsdrücken, um die Erneuerung gezielt auf die gefährdetsten Leitungsabschnitte zu priorisieren.

## 3. Methodik

### 3.1 Sensornetzwerk

Das Projekt installiert ein IoT-Sensornetzwerk in der Pilotkommune Musterstadt (Versorgungsgebiet 180.000 Einwohner, Netzlänge 850 km, 4 Wasserwerke, 12 Hochbehälter, 15 Druckzonen). Die Sensorausstattung umfasst: 200 Drucksensoren (Endress+Hauser Ceraphant PTP31, Messbereich 0–16 bar, Genauigkeit ±0,1 Prozent FS, Messintervall 1 Minute) an strategischen Netzknoten (Druckzonenübergänge, Endpunkte, Kreuzungen), 50 Durchflussmesser (Endress+Hauser Proline Promag W 300, magnetisch-induktiv, DN 80–300, Genauigkeit ±0,5 Prozent) an Versorgungsleitungen und Zoneneinspeisungen, 30 Wasserqualitätssensoren (Trübung, Chlor, Leitfähigkeit) an kritischen Punkten (Netzeinspeisung, Mischzonen, Endpunkte) und 15 akustische Sensoren (Seba Sebalog N-3, Dauerschall-Logger auf Armaturen) für die hochgenaue Leckerkennung in Pilotbezirken.

Die Datenübertragung erfolgt über LoRaWAN (Long Range Wide Area Network) mit 12 Gateways (Sendereichweite 5 km urban) an eine zentrale IoT-Plattform (ThingsBoard, selbst-gehostet auf den Servern der Stadtwerke Musterstadt). Die Batterielebensdauer der Drucksensoren beträgt 10 Jahre bei 1-Minuten-Messintervall (Lithium-Thionylchlorid-Batterie, 3,6 V, 19 Ah). Die Durchflussmesser werden netzbetrieben (230V) und mit einer USV (unterbrechungsfreie Stromversorgung, 4 Stunden) gegen Netzausfall gesichert.

### 3.2 Hydraulisches Netzmodell

Das hydraulische Simulationsmodell basiert auf EPANET 2.2 (Open-Source, EPA) und wird aus den GIS-Daten des Wasserversorgers kalibriert. Das Modell umfasst 12.400 Knoten, 14.200 Leitungsabschnitte, 85 Pumpen und 120 Ventile. Die Rohrrauheiten (Hazen-Williams-Koeffizienten C) werden über einen automatisierten Kalibrierungsprozess (genetischer Algorithmus, 200 Generationen, Populationsgröße 100) an die gemessenen Drücke und Durchflüsse angepasst. Ziel der Kalibrierung: mittlere Abweichung Druck < 0,5 bar, mittlere Abweichung Durchfluss < 5 Prozent. Das kalibrierte Modell wird als Echtzeit-Simulationsmodell betrieben: Alle 5 Minuten wird ein Simulationslauf mit den aktuellen Randbedingungen (Einspeisemengen, Pumpenzustände, Ventilstellungen) durchgeführt und die berechneten Drücke und Durchflüsse mit den Messwerten verglichen.

### 3.3 Machine Learning Leckage-Erkennung

Die Leckage-Erkennung basiert auf einem LSTM-Netzwerk (Long Short-Term Memory), das auf die Zeitreihen der Drucksensoren und Durchflussmesser trainiert wird. Das LSTM lernt das normale Betriebsverhalten des Netzes (tägliche Verbrauchsmuster, Wochenend-/Werktagsunterschiede, saisonale Schwankungen, Pumpenschalt-Effekte) und erkennt Abweichungen als Anomalien. Architektur: 2 LSTM-Schichten (128 und 64 Neuronen), Dropout 0,2, Dense-Ausgabeschicht für jeden Sensor (prognostizierter Wert für den nächsten Zeitschritt). Verlustfunktion: MAE (Mean Absolute Error). Trainingsdaten: 6 Monate Normalbetriebs-Daten (Januar–Juni 2026, nach Sensorinstallation). Anomalie-Schwellenwert: Residuum > 3σ (dreifache Standardabweichung des Trainingsfehlers) → Alarm. Die Lokalisierung erfolgt durch Analyse des räumlichen Musters der Anomalien: Die Drucksensoren in der Nähe einer Leckage zeigen die stärkste Abweichung, weiter entfernte Sensoren eine schwächere — durch Triangulation (gewichtete Mittelung der Sensorpositionen, Gewicht = inverse Residuengröße) wird der Leckageort auf 50 m Genauigkeit bestimmt.

### 3.4 Prädiktive Instandhaltung

Das prädiktive Instandhaltungsmodell berechnet die Rohrbruch-Wahrscheinlichkeit für jeden der 14.200 Leitungsabschnitte. Features: Rohrmaterial (GG, GGG, PE, PVC, Stahl, AZ), Alter (Einbaujahr), Durchmesser, Betriebsdruck (Mittelwert und Varianz aus Sensoraten), Bodenart (Sand, Lehm, Ton — aus Bodenkarte), Grundwasserstand, Anzahl bisheriger Schäden auf dem Abschnitt (Schadenshistorie der Stadtwerke, 2000–2025), Straßenverkehrsbelastung (DTV aus der Verkehrszählung, als Proxy für dynamische Bodenbelastung). Modell: Gradient Boosted Trees (XGBoost, 500 Bäume, max. Tiefe 6, Learning Rate 0,05). Training: 2.800 dokumentierte Rohrbrüche 2000–2025 auf 14.200 Abschnitten (Klassifikation: Bruch innerhalb der nächsten 5 Jahre ja/nein). Validierung: 5-Fold Cross-Validation, AUC-ROC ≥ 0,80 (Zielwert). Ergebnis: Ranking der Leitungsabschnitte nach Bruchwahrscheinlichkeit, das der Erneuerungsplanung der Stadtwerke als Entscheidungsgrundlage dient.

## 4. Dashboard und Integration

### 4.1 Echtzeit-Dashboard

Das Dashboard (React-Frontend, Python/Django-Backend, PostgreSQL + TimescaleDB für Zeitreihen) zeigt: Netzübersichtskarte mit farbkodierten Druckzonen (Ampelsystem: grün = Normalbetrieb, gelb = Abweichung, rot = Alarm), Sensorwerte in Echtzeit (Druckkurven, Durchflussdiagramme), Leckage-Alarme mit Lokalisierung auf der Karte (Symbol mit geschätzter Leckagerate in l/h), prädiktive Instandhaltungskarte (Leitungsabschnitte farbkodiert nach Bruchwahrscheinlichkeit) und historische Analyse (Trends, Verbrauchsmuster, Nachtminimum als Leckage-Indikator).

### 4.2 SCADA-Integration

Der digitale Zwilling wird über die OPC-UA-Schnittstelle in das bestehende SCADA-System (Siemens WinCC OA) der Stadtwerke Musterstadt integriert. Die Pumpen- und Ventilzustände werden automatisch aus dem SCADA-System übernommen, sodass das Simulationsmodell stets die aktuellen Betriebsbedingungen abbildet. Umgekehrt können Leckage-Alarme und Druckwarnungen aus dem digitalen Zwilling als Meldungen in das SCADA-System zurückgeschrieben werden, sodass der Netzleitstand-Mitarbeiter die Information im gewohnten Arbeitsumfeld erhält.

## 5. Arbeitspakete und Zeitplan (36 Monate)

AP 1 (Monat 1–8): Sensorinstallation und Inbetriebnahme (200 Druck, 50 Durchfluss, 30 Qualität, 15 Akustik). AP 2 (Monat 4–14): Hydraulisches Modell (EPANET, Kalibrierung, Echtzeit-Betrieb). AP 3 (Monat 10–22): LSTM-Training und Leckage-Erkennung (nach 6 Monaten Trainingsdaten). AP 4 (Monat 14–26): Prädiktives Modell (Schadenshistorie, XGBoost). AP 5 (Monat 16–30): Dashboard und SCADA-Integration. AP 6 (Monat 24–36): Feldvalidierung (Verifikation der Leckage-Alarme durch akustische Leckortung), Publikation, Verwertung. Personal: 1 Postdoc Hydraulische Modellierung, 1 Doktorand/in Data Science, 1 Softwareentwickler/in, 1 Techniker/in Sensorinstallation. Kooperationspartner: Stadtwerke Musterstadt (Netzdaten, SCADA-Zugang, Sensorinstallation), Endress+Hauser (Sensorleihgabe). Gesamtkosten: 980.000 Euro.

## 6. Erwartete Ergebnisse

Die erwarteten Ergebnisse sind: Reduktion der Wasserverluste in der Pilotkommune von 7 Prozent auf unter 4 Prozent innerhalb von 2 Jahren (Einsparung: 380.000 m³/a × 2 Euro/m³ = 760.000 Euro/a). Leckage-Erkennungszeit: Reduktion von durchschnittlich 45 Tagen (Bemerken durch Oberflächenaustritt) auf 24 Stunden (LSTM-Alarm). Lokalisierungsgenauigkeit: 50 m (ausreichend für gezielte akustische Nachsuche auf einem 100-m-Abschnitt). Prädiktive Instandhaltung: Reduktion der ungeplanten Rohrbrüche um 30 Prozent innerhalb von 5 Jahren (durch priorisierte Erneuerung der kritischsten 5 Prozent des Netzes). Übertragbarkeit: Das entwickelte System ist modular und kann auf andere Kommunen übertragen werden (die Software wird Open Source veröffentlicht, die Sensorhardware ist kommerziell verfügbar).

## Zusammenfassung in einfacher Sprache

In vielen Staedten geht ein grosser Teil des Trinkwassers durch undichte Leitungen verloren, oft unbemerkt ueber Monate. Dieses Projekt baut ein digitales Abbild des Wassernetzes von Musterstadt auf. Hunderte Sensoren messen laufend den Druck und den Wasserfluss im Leitungsnetz. Eine kuenstliche Intelligenz vergleicht die Messwerte mit einem Computermodell und kann so Lecks innerhalb von 24 Stunden erkennen und auf 50 Meter genau orten. Zusaetzlich sagt ein Vorhersagemodell voraus, welche Leitungsabschnitte in den naechsten Jahren am wahrscheinlichsten kaputtgehen, damit sie rechtzeitig erneuert werden koennen.

Musterstadt, den 25.01.2026

_Prof. Dr.-Ing. Robert Rohrnetz, TU Musterstadt_`,
};
