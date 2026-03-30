import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-036',
  filename: 'Projekt_FA001.md',
  format: 'md',
  tags: ['KI', 'Brücken', 'Drohnen'],
  created: '2026-01-10T10:00:00Z',
  vorgangId: 'FA-2026-001',
  markdown: `---
titel: KI-gestützte Schadenserkennung an Brückenbauwerken mittels Drohneninspektion
aktenzeichen: FA-2026-001
datum: 2026-01-10
antragsteller: Prof. Dr.-Ing. Sandra Brückenbach, Lehrstuhl für Digitale Bautechnik, TU Musterstadt
---

# KI-gestützte Schadenserkennung an Brückenbauwerken

## 1. Problemstellung und Motivation

Deutschland verfügt über rund 130.000 Brücken im Bundesfernstraßennetz und geschätzt weitere 100.000 Brücken in kommunaler Trägerschaft. Die regelmäßige Inspektion dieser Bauwerke nach DIN 1076 (Ingenieurbauwerke im Zuge von Straßen und Wegen — Überwachung und Prüfung) erfordert erhebliche personelle und finanzielle Ressourcen. Eine Hauptprüfung dauert je nach Brückengröße 4–16 Stunden und erfordert geschulte Bauingenieure, Hubsteiger oder Brückenuntersichtgeräte und teilweise Sperrungen des Verkehrs. Die Kosten für eine einzelne Hauptprüfung belaufen sich auf 5.000–30.000 Euro. Bei einem Inspektionsintervall von 6 Jahren und 230.000 Brücken ergibt sich ein jährlicher Inspektionsbedarf von ca. 38.000 Prüfungen — ein Aufwand, der mit dem vorhandenen Fachpersonal kaum zu bewältigen ist. Der Inspektionsstau wächst: Schätzungen zufolge sind 20 Prozent der Brücken in kommunaler Trägerschaft überfällig für eine Hauptprüfung.

Gleichzeitig hat sich der Zustand des Brückenbestands verschlechtert. Der Anteil der Brücken mit Zustandsnote ≥ 3,0 (nicht ausreichend bis ungenügend) ist von 12 Prozent (2010) auf 18 Prozent (2024) gestiegen. Typische Schäden sind: Risse in Betonbauteilen (Biegerisse, Schwindrisse, Alkali-Kieselsäure-Reaktion), Abplatzungen der Betondeckung (Frostschäden, Karbonatisierungsfront erreicht Bewehrung), freiliegende und korrodierte Bewehrung (Chloridinduzierte Korrosion durch Tausalz), Risse und Korrosion an Stahlbauteilen (Ermüdungsrisse an Schweißnähten, Flächenkorrosion) und Schäden an Lagern und Fahrbahnübergängen. Die frühzeitige Erkennung dieser Schäden ist entscheidend, um teure Instandsetzungen zu vermeiden und die Tragfähigkeit der Bauwerke sicherzustellen.

## 2. Stand der Forschung

### 2.1 Drohnenbasierte Inspektion

Der Einsatz von Drohnen (Unmanned Aerial Vehicles, UAV) für die Brückeninspektion hat in den letzten Jahren erhebliche Fortschritte gemacht. Multikopter-Drohnen (DJI Matrice 300 RTK, Flyability Elios 3) können Brückenbauwerke aus allen Perspektiven (Ober- und Untersicht) hochauflösend fotografieren und video-dokumentieren. Die Vorteile sind: keine Verkehrssperrung erforderlich, Inspektion auch schwer zugänglicher Bereiche (Hohlkasteninneres, Widerlager-Rückseite), hohe Bildauflösung (0,1 mm/Pixel bei 2 m Abstand) und schnelle Durchführung (30–60 Minuten je Brücke). Die Nachteile: Die Bilddaten müssen von Experten ausgewertet werden, was zeitintensiv ist, und die subjektive Bewertung der Schäden variiert zwischen Inspekteuren (Inter-Rater-Reliabilität κ = 0,65 nach Studien der BASt).

### 2.2 Deep Learning für Schadenserkennung

Convolutional Neural Networks (CNN) haben bei der Bildklassifikation in vielen Domänen menschliche Leistung erreicht oder übertroffen. Für die Schadenserkennung an Brücken existieren bereits erste Ansätze: ResNet-50 und VGG-16 wurden für die binäre Klassifikation (Schaden/kein Schaden) auf kleinen Datensätzen (1.000–5.000 Bilder) trainiert und erreichen Genauigkeiten von 85–92 Prozent (Cha et al. 2017, Hüthwohl et al. 2019). YOLO (You Only Look Once) wurde für die Echtzeit-Objektdetektion von Rissen verwendet (Liu et al. 2020). U-Net und Mask R-CNN wurden für die semantische Segmentierung von Rissen und Abplatzungen eingesetzt (Dung & Anh 2019, Kim et al. 2021). Die bisherigen Arbeiten sind jedoch auf spezifische Schadenstypen und Brückenmaterialien beschränkt (meist nur Stahlbetonbrücken) und verwenden relativ kleine Datensätze, die die Vielfalt realer Brückenschäden nicht abbilden.

## 3. Methodik

### 3.1 Datensatz-Aufbau

Das zentrale Innovationselement des Projekts ist der Aufbau eines umfassenden annotierten Bilddatensatzes für die Schadenserkennung an Brückenbauwerken. Der Datensatz wird folgende Merkmale aufweisen: 50.000 hochauflösende Drohnenaufnahmen (20 Megapixel, RGB) von 200 Brückenbauwerken in Deutschland (Stichprobe aus Bundesfernstraßen, Kreisstraßen und Gemeindestraßen). Brückentypen: Stahlbetonbrücken (60 Prozent), Spannbetonbrücken (20 Prozent), Stahlbrücken (15 Prozent), Mauerwerksbrücken (5 Prozent). 5 Schadensklassen: Risse (mit Unterteilung in Längsrisse, Querrisse, Netzrisse), Abplatzungen (Fläche und Tiefe), Bewehrungskorrosion (sichtbare Rost- und Freilegungsstellen), Feuchte- und Ausblühungsspuren und Lagerschäden (Verformung, Risse, Verschmutzung). Annotation durch 3 unabhängige Bauingenieure mit Inspektionserfahrung nach einem standardisierten Annotationsprotokoll (Polygon-Annotation auf Pixelebene mit LabelImg und CVAT-Tool). Inter-Annotator-Agreement: Cohen's Kappa κ ≥ 0,80 (Zielwert, bei niedrigerem κ wird ein Schiedsrichter eingesetzt).

### 3.2 Modellarchitektur

Das Projekt verfolgt einen zweistufigen Ansatz: (1) Schadensklassifikation: Ein ResNet-50 Backbone mit Transfer Learning von vortrainierten ImageNet-Gewichten wird für die Grobklassifikation in die 5 Schadensklassen eingesetzt. Die letzten 3 Blöcke des ResNet werden fein-getuned, die früheren Blöcke werden eingefroren. Datenaugmentation: Rotation (±15°), Skalierung (0,8–1,2), Farbvariation (Helligkeit ±20 Prozent, Kontrast ±15 Prozent), zufälliges Beschneiden. Trainingsparameter: Adam-Optimizer, Learning Rate 1 × 10⁻⁴ mit Cosine Annealing, Batch Size 32, 100 Epochen. (2) Schadenssegmentierung: Ein U-Net mit ResNet-34-Encoder für die pixelgenaue Lokalisierung der Schäden. Die Segmentierung ermöglicht die automatische Vermessung von Rissbreiten (Subpixel-Genauigkeit durch Skeletonisierung und Profilschnitt) und Abplatzungsflächen. Verlustfunktion: Dice Loss + Focal Loss (gewichtet 0,5/0,5), da die Schadensklassen stark unbalanciert sind (Schadensfläche typisch 2–5 Prozent der Bildfläche).

### 3.3 Hardware und Training

Das Training erfolgt auf dem GPU-Cluster des Rechenzentrums der TU Musterstadt (4 × NVIDIA A100 80GB). Trainingszeit geschätzt: 48 Stunden für das Klassifikationsmodell, 72 Stunden für das Segmentierungsmodell. Inferenz: Das Modell wird für die Feldanwendung auf einen NVIDIA Jetson Orin (Edge-Computing, 275 TOPS) optimiert (Quantisierung INT8 mit TensorRT), sodass die Bildanalyse direkt auf dem Drohnen-Basisrechner in Echtzeit erfolgen kann (Ziel: 5 Bilder/Sekunde bei 20 Megapixel).

## 4. Arbeitspakete und Zeitplan

### AP 1: Datensatz-Aufbau (Monat 1–9)

Akquise von 200 Brücken in Kooperation mit der Bundesanstalt für Straßenwesen (BASt), dem Landesbetrieb Straßenbau NRW und 5 kommunalen Tiefbauämtern. Drohnenbefliegung (12 Befliegungskampagnen à 2 Wochen, 15–20 Brücken je Kampagne). Annotation der Bilddaten durch 3 Bauingenieure (geschätzter Aufwand: 4.500 Mannstunden). Qualitätssicherung der Annotation (Inter-Annotator-Agreement, Korrekturdurchläufe). Veröffentlichung des Datensatzes als Open Data auf dem Repositorium der TU Musterstadt (DOI-registriert, CC-BY-4.0 Lizenz).

### AP 2: Modellentwicklung Klassifikation (Monat 6–14)

Training und Evaluation des ResNet-50-Klassifikators. Vergleich mit weiteren Architekturen (EfficientNet-B4, Vision Transformer ViT-B/16). Hyperparameter-Optimierung mit Optuna. Kreuzvalidierung (5-Fold) und Test auf gehaltenem Testset (20 Prozent der Daten, stratifiziert nach Brückentyp und Schadensklasse).

### AP 3: Modellentwicklung Segmentierung (Monat 10–18)

Training und Evaluation des U-Net-Segmentierers. Vergleich mit DeepLab v3+ und Mask R-CNN. Automatische Rissvermessung (Breite, Länge, Orientierung). Abplatzungsflächenberechnung und Tiefenschätzung (monokulare Tiefenschätzung mit MiDaS-Modell).

### AP 4: Feldvalidierung (Monat 16–22)

Feldtest an 10 realen Brücken (3 Autobahnbrücken, 3 Bundesstraßen, 2 kommunale Brücken, 1 Eisenbahnüberführung, 1 Fußgängerbrücke) in Kooperation mit den Straßenbaulastträgern. Vergleich der KI-Ergebnisse mit der konventionellen Handinspektion (Doppelblind-Design: KI-Team und Inspektionsteam arbeiten unabhängig). Metriken: Übereinstimmung der Zustandsnote (±0,3 Toleranz), Detektionsrate der kritischen Schäden (Recall ≥ 95 Prozent, False Negative Rate < 5 Prozent), Zeitersparnis gegenüber konventioneller Inspektion.

### AP 5: Dokumentation und Verwertung (Monat 20–24)

Wissenschaftliche Publikationen (Ziel: 3 Journalartikel in Automation in Construction, Engineering Structures und Computer-Aided Civil and Infrastructure Engineering). Open-Source-Veröffentlichung des Modells und des Datensatzes. Entwicklung eines Prototyp-Softwaretools für Ingenieure (Web-Anwendung: Bildupload → automatische Schadensanalyse → Inspektionsbericht als PDF).

## 5. Personal und Kosten

Das Projektteam umfasst: 1 Postdoc (Deep Learning, 100 Prozent, TV-L E14), 1 Doktorand/in (Bauingenieurwesen mit Informatik-Kenntnissen, 100 Prozent, TV-L E13), 1 wissenschaftliche Hilfskraft (Annotation, 20 Stunden/Woche), 3 freiberufliche Bauingenieure (Annotation, Honorar), 1 Drohnenpilot (Befliegungen, Honorar). Gesamtkosten (24 Monate): Personalkosten 520.000 Euro, Sachmittel (Drohne, GPU-Rechenzeit, Reisekosten Befliegungen) 180.000 Euro, Gesamt 700.000 Euro. Beantragte Fördersumme: 700.000 Euro (100 Prozent Förderung, Grundlagenforschung).

## 6. Erwartete Ergebnisse und Impact

Die erwarteten Ergebnisse sind: Ein offener, annotierter Bilddatensatz mit 50.000 Brückenschadensbildern (der weltweit größte seiner Art). Ein KI-Modell mit einer Klassifikationsgenauigkeit von mindestens 92 Prozent (F1-Score) und einer Segmentierungs-IoU von mindestens 0,75. Eine nachgewiesene Reduktion der Inspektionszeit um mindestens 70 Prozent (von 8 Stunden auf 2 Stunden je Brücke inklusive Drohnenbefliegung und KI-Analyse). Eine Fehldetektionsrate (False Negative) unter 5 Prozent für sicherheitsrelevante Schäden (Bewehrungskorrosion, tiefe Risse). Der gesellschaftliche Impact ist erheblich: Die KI-gestützte Inspektion kann den Inspektionsstau abbauen, die Kosten pro Inspektion um 50 Prozent senken und die Objektivität der Schadensbewertung erhöhen (Eliminierung der subjektiven Bewertungsunterschiede zwischen Inspekteuren).

## Zusammenfassung in einfacher Sprache

In Deutschland gibt es ueber 200.000 Bruecken, die regelmaessig auf Schaeden untersucht werden muessen. Das kostet viel Zeit und Geld, und es gibt nicht genug Fachleute dafuer. In diesem Projekt sollen Drohnen die Bruecken abfotografieren, und eine kuenstliche Intelligenz soll auf den Bildern automatisch Schaeden wie Risse oder Rost erkennen. Dadurch koennten Bruecken-Pruefungen bis zu 70 Prozent schneller und deutlich guenstiger werden, und gefaehrliche Schaeden wuerden frueher entdeckt.

Musterstadt, den 10.01.2026

_Prof. Dr.-Ing. Sandra Brückenbach, TU Musterstadt_`,
};
