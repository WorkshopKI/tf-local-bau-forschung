import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-059',
  filename: 'Zwischenbericht_FA001.md',
  format: 'md',
  tags: ['Zwischenbericht', 'KI', 'Brücken'],
  created: '2026-03-20T10:00:00Z',
  vorgangId: 'FA-2026-001',
  markdown: `---
titel: 12-Monats-Zwischenbericht KI-gestützte Schadenserkennung an Brückenbauwerken FA-2026-001
aktenzeichen: FA-2026-001
datum: 2026-03-20
ersteller: Prof. Dr.-Ing. Sandra Brückenbach, TU Musterstadt
---

# 12-Monats-Zwischenbericht — KI-Brückeninspektion FA-2026-001

## 1. Projektfortschritt und Meilenstein-Erreichung

Das Projekt FA-2026-001 ist nach 12 von 24 Monaten Laufzeit planmäßig fortgeschritten. Die Arbeitspakete AP 1 (Datensatz-Aufbau) und AP 2 (Modellentwicklung Klassifikation) wurden weitgehend abgeschlossen, AP 3 (Segmentierung) hat begonnen. Der zentrale Meilenstein M1 (annotierter Datensatz mit mindestens 40.000 Bildern, Inter-Annotator-Agreement κ ≥ 0,80) wurde im Monat 10 erreicht. Im Folgenden werden die Ergebnisse der einzelnen Arbeitspakete detailliert dargestellt.

## 2. AP 1: Datensatz-Aufbau (Monat 1–9, abgeschlossen)

### 2.1 Drohnenbefliegungen

Zwischen März und November 2025 wurden 12 Befliegungskampagnen an insgesamt 85 Brückenbauwerken durchgeführt. Die Brücken verteilen sich auf folgende Typen: Stahlbeton (45 Brücken, 53 Prozent), Spannbeton (18 Brücken, 21 Prozent), Stahl (12 Brücken, 14 Prozent) und Mauerwerk (10 Brücken, 12 Prozent). Die geplante Erweiterung auf Holzbrücken (Auflage des Gutachters, siehe Review FA-2026-001) wurde in die zweite Projektphase (Monat 13–18) verschoben, da die Kooperation mit dem zuständigen Forstamt erst ab Frühjahr 2026 möglich ist (Holzbrücken befinden sich überwiegend in Waldgebieten mit eingeschränktem Zugang im Winter). Die Drohne (DJI Matrice 300 RTK mit Zenmuse P1 Kamera, 45 Megapixel, RTK-Positionierung) erbrachte pro Brücke durchschnittlich 580 Aufnahmen (Auflösung 0,08–0,15 mm/Pixel bei 1,5–3 m Flugabstand). Gesamtzahl der Rohaufnahmen: 49.300 Bilder. Nach Qualitätsfilterung (Ausschluss von unscharfen Bildern, überbelichteten Aufnahmen und Bildern ohne erkennbare Brückenoberfläche): **50.200 verwertbare Bilder** (geringfügig über dem Zielwert von 50.000).

### 2.2 Annotation

Die Annotation wurde durch 3 Bauingenieure mit mindestens 5 Jahren Erfahrung in der Brückeninspektion nach DIN 1076 durchgeführt. Vor Beginn der Annotation wurde ein 2-tägiger Workshop abgehalten (Auflage des Gutachters), in dem die 5 Schadensklassen (Risse, Abplatzungen, Bewehrungskorrosion, Feuchte/Ausblühungen, Lagerschäden) anhand von 200 Referenzbildern definiert und diskutiert wurden. Ein 80-seitiges Annotationshandbuch mit Beispielbildern für jeden Schadenstyp und Schweregrad wurde erstellt und den Annotatoren bereitgestellt (online zugänglich auf der Projekt-Confluence-Seite).

Die Annotation erfolgte mit dem Tool CVAT (Computer Vision Annotation Tool, v2.7, selbst-gehostet auf dem Projekt-Server). Jedes Bild wurde von mindestens 2 Annotatoren unabhängig annotiert (Polygon-Annotation auf Pixelebene). Bei Diskrepanzen (Abweichung der Polygon-Fläche > 20 Prozent oder unterschiedliche Schadensklassifikation) wurde ein dritter Annotator als Schiedsrichter eingesetzt. Die Inter-Annotator-Reliabilität wurde als Cohen's Kappa berechnet: **κ = 0,82** (über alle Schadensklassen gemittelt). Aufgeschlüsselt nach Schadensklasse: Risse κ = 0,88 (hohe Übereinstimmung, da Risse visuell eindeutig sind), Abplatzungen κ = 0,85, Bewehrungskorrosion κ = 0,80, Feuchte/Ausblühungen κ = 0,75 (niedrigste Übereinstimmung, da die Abgrenzung zwischen normaler Feuchtigkeit und schädlicher Ausblühung subjektiv ist) und Lagerschäden κ = 0,84. Der Zielwert von κ ≥ 0,80 wird insgesamt und für 4 von 5 Klassen erreicht. Für die Klasse Feuchte/Ausblühungen wird die Annotationsrichtlinie überarbeitet (schärfere Abgrenzungskriterien), um in der zweiten Datensatz-Erweiterung (Holzbrücken, Monat 13–18) einen höheren κ-Wert zu erreichen.

### 2.3 Datensatz-Statistik

Der annotierte Datensatz umfasst 50.200 Bilder mit folgender Schadensverteilung: 18.400 Bilder mit Rissen (37 Prozent, davon 8.200 Längsrisse, 5.800 Querrisse, 4.400 Netzrisse), 12.600 Bilder mit Abplatzungen (25 Prozent), 6.800 Bilder mit Bewehrungskorrosion (14 Prozent), 8.100 Bilder mit Feuchte/Ausblühungen (16 Prozent) und 2.300 Bilder mit Lagerschäden (5 Prozent). 14.200 Bilder sind schadenfrei (28 Prozent — wichtig für die Negativklasse). Viele Bilder enthalten Mehrfachschäden (z.B. Riss + Korrosion an derselben Stelle) — die Annotation erfasst alle Schäden pro Bild (Multi-Label-Annotation). Die Klasse Lagerschäden ist stark unterrepräsentiert, da Lager geometrisch kleine Bauteile sind und auf wenigen Bildern sichtbar werden. Für das Modelltraining wird ein Over-Sampling der Lagerschäden (Faktor 3) durchgeführt.

## 3. AP 2: Modellentwicklung Klassifikation (Monat 6–14, 80 Prozent abgeschlossen)

### 3.1 Modelltraining und Ergebnisse

Das ResNet-50-Backbone (vortrainiert auf ImageNet) wurde mit Transfer Learning auf dem Brücken-Datensatz fein-getuned. Trainingsparameter: Adam-Optimizer, Learning Rate 1 × 10⁻⁴ mit Cosine Annealing (Warmup 5 Epochen), Batch Size 32 auf 4 × NVIDIA A100, 100 Epochen, frühes Stoppen bei 15 Epochen ohne Verbesserung der Validierungs-F1-Score. Datenaugmentation: Rotation ±15°, horizontale Spiegelung, Skalierung 0,8–1,2, Farbvariation (Helligkeit ±20 Prozent, Kontrast ±15 Prozent), zufälliges Beschneiden auf 512 × 512 Pixel.

Die Datenaufteilung erfolgte stratifiziert nach Brückentyp und Schadensklasse: 70 Prozent Training (35.140 Bilder), 10 Prozent Validierung (5.020 Bilder), 20 Prozent Test (10.040 Bilder). Wichtig: Die Aufteilung erfolgte auf Brückenebene (alle Bilder einer Brücke sind entweder im Training- oder im Testset, nicht gemischt) — um Data Leakage zu vermeiden (Bilder derselben Brücke aus verschiedenen Perspektiven sind visuell ähnlich und würden bei zufälliger Aufteilung die Testperformance künstlich erhöhen).

**Ergebnisse auf dem Testset:** Accuracy (Gesamt) = 94,2 Prozent. F1-Score (makro-gemittelt über alle 5 Schadensklassen + schadensfrei): **0,912**. Aufgeschlüsselt nach Klasse:

| Klasse | Precision | Recall | F1-Score |
|--------|-----------|--------|----------|
| Risse | 0,96 | 0,95 | 0,955 |
| Abplatzungen | 0,93 | 0,91 | 0,920 |
| Bewehrungskorrosion | 0,91 | 0,88 | 0,895 |
| Feuchte/Ausblühungen | 0,87 | 0,83 | 0,850 |
| Lagerschäden | 0,82 | 0,78 | 0,800 |
| Schadensfrei | 0,97 | 0,98 | 0,975 |

Der Zielwert von F1 ≥ 0,92 (Gesamtklassifikation) wird mit 0,912 knapp verfehlt — die Verbesserung wird in der laufenden Optimierungsphase (Monat 12–14) angestrebt (geplante Maßnahmen: Attention-Mechanismus im ResNet, erweitertes Augmentationsschema mit CutMix/MixUp, Oversampling der schwächeren Klassen).

### 3.2 Vergleich mit anderen Architekturen

Neben ResNet-50 wurden drei weitere Architekturen evaluiert: EfficientNet-B4 (F1 = 0,908, vergleichbar mit ResNet-50 bei geringerem Rechenaufwand — 19M vs. 25M Parameter), Vision Transformer ViT-B/16 (F1 = 0,924, bester Wert, aber höchster Rechenaufwand — 86M Parameter, Inferenzzeit 3× langsamer als ResNet-50) und YOLO v8 (F1 = 0,878, schnellste Inferenz, aber niedrigere Genauigkeit — besser geeignet für Echtzeit-Erkennung im Feld, nicht für die finale Bewertung). Der Vision Transformer übertrifft alle CNN-Architekturen, insbesondere bei den schwierigeren Klassen (Feuchte/Ausblühungen: F1 = 0,895 vs. 0,850 bei ResNet-50). Der höhere Rechenaufwand ist für die Offline-Analyse (Batch-Processing nach der Befliegung) akzeptabel. Für die Echtzeit-Analyse auf dem Jetson Orin (Edge-Computing) wird ResNet-50 mit TensorRT-Quantisierung verwendet (INT8, 5 Bilder/Sekunde bei 20 Megapixel — Zielwert erreicht).

## 4. Feldtest (Monat 10–12, vorläufige Ergebnisse)

### 4.1 Versuchsdesign

Der Feldtest wurde an 3 Brücken durchgeführt (vorläufig, Erweiterung auf 30 Brücken gemäß Gutachter-Auflage in AP 4, Monat 16–22): Brücke A — A7-Autobahnbrücke (Spannbeton, Spannweite 45 m, Baujahr 1978, letzte Hauptprüfung 2022, Zustandsnote 2,5), Brücke B — Fußgängerbrücke Stadtpark (Stahl-Fachwerk, Spannweite 22 m, Baujahr 1995, Zustandsnote 2,0), Brücke C — Eisenbahnüberführung Bahnhofstraße (Stahlbeton, Spannweite 12 m, Baujahr 1962, Zustandsnote 3,0). Jede Brücke wurde unabhängig von 2 Teams inspiziert: Team KI (Drohnenbefliegung + KI-Analyse, 2 Personen: Drohnenpilot + Ingenieur) und Team Konventionell (Handinspektion nach DIN 1076 mit Hubsteiger, 2 Personen: 2 erfahrene Brückeninspekteure). Die Teams arbeiteten doppelblind — das KI-Team kannte die Ergebnisse der Handinspektion nicht und umgekehrt.

### 4.2 Ergebnisse

**Zeitvergleich:** KI-Inspektion: Brücke A — 2,5 Stunden (Befliegung 40 min, KI-Analyse 30 min, Sichtung und Berichterstellung 1,5 h). Brücke B — 1,5 Stunden. Brücke C — 1,0 Stunden. Handinspektion: Brücke A — 8 Stunden (inkl. Anfahrt Hubsteiger, Aufbau, Verkehrssicherung, Inspektion, Abbau). Brücke B — 4 Stunden. Brücke C — 3 Stunden. Durchschnittliche Zeitersparnis: **68 Prozent** (KI: 1,7 h vs. konventionell: 5,0 h je Brücke). Zielwert (70 Prozent) wird knapp verfehlt, was primär auf die noch manuelle Berichterstellung zurückzuführen ist (die automatische Berichterstellung in AP 5 wird die Restzeit weiter reduzieren).

**Übereinstimmung:** Von insgesamt 142 identifizierten Schadstellen (vereinigte Menge beider Teams) wurden 127 von beiden Teams erkannt (89 Prozent Übereinstimmung). Das KI-Team identifizierte 4 zusätzliche Schadstellen, die das konventionelle Team nicht fand (kleine Risse an schwer zugänglichen Stellen — Untersicht der Fahrbahnplatte, die der Hubsteiger nicht erreichte). Das konventionelle Team identifizierte 11 Schadstellen, die das KI-Team nicht fand — davon 7 Lagerschäden (die vom KI-Modell am schlechtesten erkannte Klasse, F1 = 0,80) und 4 Hohlstellen unter dem Belag (die nur durch Abklopfen erkennbar sind und im Drohnenbild nicht sichtbar werden). Die **Fehldetektionsrate** (False Negative für sicherheitsrelevante Schäden: Bewehrungskorrosion, tiefe Risse ≥ 0,3 mm) beträgt **3,1 Prozent** (2 von 65 sicherheitsrelevanten Schäden nicht erkannt) — der Zielwert von < 5 Prozent wird eingehalten.

## 5. Nächste Schritte (Monat 13–24)

AP 1 Erweiterung: Datensatz-Erweiterung um 10 Holzbrücken und 10 weitere Stahlbrücken (Fokus: Ermüdungsrisse an Schweißnähten, mit schräger LED-Beleuchtung an der Drohne). AP 3: U-Net-Segmentierung und automatische Rissvermessung (Subpixel-Genauigkeit durch Skeletonisierung + Profilschnitt). AP 4: Erweiterte Feldvalidierung an 30 Brücken (Kooperation mit DB InfraGO für 5 Eisenbahnbrücken bestätigt, Kooperation mit Forstamt für 5 Holzbrücken eingeleitet). AP 5: Prototyp-Webapplikation für Inspekteure (Upload → KI-Analyse → PDF-Bericht). Publikation: 1. Journalartikel eingereicht bei Automation in Construction (aktuell in Peer Review).

## 6. Mittelverwendung

Personalkosten (12 Monate): 258.000 Euro (Postdoc: 84.000, Doktorandin: 62.000, HiWi: 12.000, Annotation: 100.000). Sachmittel: 72.000 Euro (Drohne + Ersatzbatterien: 28.000, GPU-Rechenzeit: 18.000, Reisekosten Befliegungen: 22.000, Hubsteiger-Miete Feldtest: 4.000). Gesamt verbraucht: 330.000 Euro von 700.000 Euro Budget (47 Prozent bei 50 Prozent Laufzeit — geringfügig unter Plan, da die Annotation schneller abgeschlossen wurde als geplant).

## Zusammenfassung in einfacher Sprache

Nach der Haelfte der Projektlaufzeit ist die KI-Brueckeninspektion gut vorangekommen. Drohnen haben 85 Bruecken abfotografiert und dabei ueber 50.000 Bilder gesammelt, die von Fachleuten markiert wurden. Die KI erkennt Schaeden auf den Bildern bereits mit ueber 91 Prozent Treffsicherheit, besonders gut bei Rissen und Abplatzungen. Ein erster Feldtest an drei echten Bruecken zeigte, dass die KI-Inspektion rund 68 Prozent schneller ist als die herkoemmliche Pruefung und dabei fast alle wichtigen Schaeden findet. In der zweiten Projekthaelfte sollen auch Holzbruecken und Stahlbruecken untersucht und der Feldtest auf 30 Bruecken ausgeweitet werden.

Musterstadt, den 20.03.2026

_Prof. Dr.-Ing. Sandra Brückenbach, TU Musterstadt_`,
};
