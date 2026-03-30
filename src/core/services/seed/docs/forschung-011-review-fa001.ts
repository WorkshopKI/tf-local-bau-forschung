import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-046',
  filename: 'Review_FA001.md',
  format: 'md',
  tags: ['Review', 'KI', 'Förderung'],
  created: '2026-02-20T10:00:00Z',
  vorgangId: 'FA-2026-001',
  markdown: `---
titel: Fachgutachten zum Förderantrag FA-2026-001 KI-gestützte Schadenserkennung an Brückenbauwerken
aktenzeichen: FA-2026-001
datum: 2026-02-20
gutachter: Prof. Dr.-Ing. Friedrich Prüfstein, Universität Stuttgart (anonymisiert)
---

# Fachgutachten — FA-2026-001 KI-Schadenserkennung an Brückenbauwerken

## 1. Zusammenfassung der Bewertung

Der Antrag FA-2026-001 adressiert ein hochrelevantes Problem der Infrastrukturerhaltung in Deutschland. Die Kombination aus Drohneninspektion und Deep-Learning-basierter Schadenserkennung hat das Potential, den Inspektionsstau bei Brückenbauwerken signifikant zu reduzieren und die Objektivität der Schadensbewertung zu erhöhen. Das Konsortium unter Leitung von Prof. Brückenbach verfügt über ausgewiesene Expertise sowohl im Bereich Computer Vision (Publikationen in CVPR, ECCV, IEEE TPAMI) als auch im konstruktiven Ingenieurbau (langjährige Kooperation mit der BASt). Die Projektplanung ist realistisch und die Arbeitspakete logisch aufeinander aufgebaut. Die Gesamtbewertung fällt positiv aus, es bestehen jedoch Schwächen, die vor einer Förderempfehlung adressiert werden sollten.

## 2. Stärken des Antrags

### 2.1 Wissenschaftliche Qualität und Innovation

Der Antrag geht deutlich über den aktuellen Stand der Forschung hinaus. Während bisherige Arbeiten auf kleine Datensätze (1.000–5.000 Bilder) und einzelne Brückentypen (meist nur Stahlbeton) beschränkt waren, plant das Projekt einen Datensatz von 50.000 annotierten Bildern aus 200 Brücken verschiedener Bauarten. Dieser Datensatz wäre der weltweit größte und umfassendste für die Brückenschadenserkennung und hätte einen erheblichen Wert für die internationale Forschungsgemeinschaft. Die geplante Open-Data-Veröffentlichung unter CC-BY-4.0-Lizenz ist vorbildlich und wird die Reproduzierbarkeit und Weiterentwicklung durch andere Gruppen ermöglichen.

Der zweistufige Ansatz (ResNet-50 Klassifikation + U-Net Segmentierung) ist methodisch sinnvoll und dem Stand der Technik angemessen. Die Erweiterung um die automatische Rissvermessung (Subpixel-Genauigkeit durch Skeletonisierung) ist innovativ und hat hohe Praxisrelevanz, da die Rissbreite ein zentraler Parameter für die Zustandsbewertung nach DIN 1076 ist. Die geplante Deployment-Lösung auf NVIDIA Jetson Orin für die Echtzeit-Analyse am Drohnen-Basisrechner zeigt, dass das Team die praktische Umsetzung von Anfang an mitdenkt — ein häufig vernachlässigter Aspekt in der akademischen Computer-Vision-Forschung.

### 2.2 Praxisrelevanz und Kooperationspartner

Die Einbindung der BASt (Bundesanstalt für Straßenwesen) als Kooperationspartner ist ein starkes Plus: Die BASt verfügt über den größten Bestand an Brückeninspektionsdaten in Deutschland und kann Zugang zu Brückenbauwerken im Bundesfernstraßennetz ermöglichen. Die Kooperation mit 5 kommunalen Tiefbauämtern stellt sicher, dass auch kommunale Brücken (die den Großteil des Inspektionsstaus ausmachen) im Datensatz vertreten sind. Die geplante Feldvalidierung an 10 realen Brücken im Doppelblind-Design (KI vs. Handinspektion) ist methodisch korrekt und liefert belastbare Vergleichsdaten.

## 3. Schwächen und Kritikpunkte

### 3.1 Datensatz-Bias und Generalisierbarkeit

Der Datensatz mit 50.000 Bildern ist ambitioniert, aber die Verteilung der Brückentypen (60 Prozent Stahlbeton, 20 Prozent Spannbeton, 15 Prozent Stahl, 5 Prozent Mauerwerk) spiegelt nicht die tatsächliche Verteilung im deutschen Brückenbestand wider (Stahlbeton 45 Prozent, Spannbeton 30 Prozent, Stahl 15 Prozent, Mauerwerk 5 Prozent, Holz 3 Prozent, andere 2 Prozent). Insbesondere fehlen Holzbrücken vollständig im Datensatz, obwohl im kommunalen Bereich ca. 8.000 Holzbrücken existieren, die eigene Schadensbilder zeigen (Pilzbefall, Risse entlang der Faser, Verbindungsmittel-Korrosion). Die Generalisierbarkeit des trainierten Modells auf Brückentypen, die im Trainingsdatensatz unterrepräsentiert sind, ist fraglich.

Die Annotation durch 3 Bauingenieure mit einem Ziel-κ von 0,80 ist angemessen, aber die Annotationsqualität wird stark von der Erfahrung der Annotatoren abhängen. Die Unterscheidung zwischen Biegeriss (tragfähigkeitsrelevant), Schwindriss (baustofftechnisch, meist unbedenklich) und Alkali-Kieselsäure-Reaktionsriss (fortschreitend, substanzgefährdend) erfordert tiefgreifende bautechnische Expertise. Es wird empfohlen, die Annotatoren vor Beginn der Annotation in einem 2-tägigen Workshop zu schulen und ein detailliertes Annotationshandbuch mit Beispielbildern für jeden Schadenstyp und Schweregrad zu erstellen.

### 3.2 Feldvalidierung zu begrenzt

Die Feldvalidierung an nur 10 Brücken (3 Autobahn, 3 Bundesstraße, 2 kommunal, 1 Eisenbahn, 1 Fußgänger) ist für eine belastbare statistische Aussage zu gering. Bei einer erwarteten Übereinstimmungsrate von 89 Prozent (wie im Antrag genannt) und einem 95-Prozent-Konfidenzintervall beträgt die Fehlermarge bei n = 10: ±19 Prozent — das Konfidenzintervall reicht von 70 bis 100 Prozent und ist damit nicht aussagekräftig. Eine Stichprobe von mindestens 30 Brücken wäre statistisch erforderlich (Fehlermarge ±11 Prozent bei gleicher Übereinstimmungsrate). Die Erweiterung der Feldvalidierung auf 30 Brücken wird dringend empfohlen, auch wenn dies einen höheren Reise- und Koordinationsaufwand bedeutet.

### 3.3 Vergleich mit Stahlbrücken und Ermüdungsrissen

Der Antrag fokussiert auf die Schadenserkennung an Betonflächen (Risse, Abplatzungen, Korrosion), vernachlässigt aber die spezifischen Herausforderungen bei Stahlbrücken. Ermüdungsrisse an Schweißnähten sind die gefährlichste Schadensform bei Stahlbrücken und erfordern eine deutlich höhere Detektionsgenauigkeit (Risslänge ab 2 mm, oft in schwer zugänglichen Bereichen wie Steg-Flansch-Übergängen). Die Übertragbarkeit des CNN-Ansatzes auf diese Schadensform ist nicht trivial, da Ermüdungsrisse visuell sehr fein sind und oft nur unter bestimmten Beleuchtungsbedingungen erkennbar werden. Eine Erweiterung der Methodik um spezialisierte Beleuchtungstechniken (schräges LED-Licht an der Drohne zur Kontrastverbesserung) wird empfohlen.

## 4. Bewertung der Arbeitspakete

### 4.1 Zeitplan und Meilensteine

Der Zeitplan von 24 Monaten ist ambitioniert, insbesondere für AP 1 (Datensatz-Aufbau, 9 Monate für 50.000 annotierte Bilder). Die Annotation von 50.000 Bildern durch 3 Personen (je 16.667 Bilder) bei einer geschätzten Annotationszeit von 5 Minuten pro Bild (Polygon-Annotation eines Risses auf Pixelebene ist zeitaufwändig) ergibt 1.389 Stunden je Person — das sind 87 volle Arbeitstage (8 Stunden/Tag), also 4 Monate Vollzeit-Annotation je Person. Bei einem 9-Monats-Zeitfenster und der Tatsache, dass die Annotatoren auch andere Aufgaben haben (Befliegungen, Qualitätssicherung), ist die Zeitplanung knapp, aber realisierbar, wenn die Annotationstools gut vorbereitet sind und der Workflow effizient gestaltet wird.

Die Personalausstattung (1 Postdoc, 1 Doktorand/in, 1 HiWi, 3 freiberufliche Bauingenieure, 1 Drohnenpilot) ist für das Projektvolumen angemessen. Die Doktorand/in-Stelle sollte idealerweise zum Projektstart besetzt sein (keine Verzögerung durch Stellenausschreibung), was im Antrag nicht explizit adressiert wird.

## 5. Empfehlung

Der Antrag wird zur **Förderung unter Auflagen** empfohlen. Die Auflagen betragen: (1) Erweiterung des Datensatzes um Holzbrücken und Stahlbrücken mit Ermüdungsrissen (mindestens 5 Prozent Holz, 20 Prozent Stahl im Datensatz). (2) Erweiterung der Feldvalidierung auf mindestens 30 Brücken verschiedenen Typs. (3) Erstellung eines Annotationshandbuchs und Durchführung eines Annotator-Trainings vor Beginn der Datenerhebung. (4) Kooperation mit der DB Netz AG für den Zugang zu Eisenbahnbrücken (im Antrag nur als Wunsch formuliert, sollte vor Projektstart vertraglich gesichert werden). Die Auflagen sind innerhalb des bestehenden Budgets realisierbar, wenn die Schwerpunkte leicht verschoben werden (weniger Betonbrücken, mehr Diversität).

Gesamtnote: **1,7 (sehr gut bis gut)**. Förderempfehlung: **Ja, mit Auflagen.**

## Zusammenfassung in einfacher Sprache

Ein unabhaengiger Gutachter hat den Foerderantrag zur KI-gestuetzten Brueckeninspektion bewertet. Er findet das Projekt insgesamt sehr gut, besonders den grossen Bilddatensatz und die Zusammenarbeit mit Strassenbehoerden. Es gibt aber auch Verbesserungsvorschlaege: Der Datensatz sollte auch Holzbruecken enthalten, die Pruefung an echten Bruecken sollte an mindestens 30 statt nur 10 Bauwerken stattfinden, und die Beschriftung der Bilder sollte besser vorbereitet werden. Der Gutachter empfiehlt die Foerderung mit der Note 1,7, wenn diese Punkte beruecksichtigt werden.

_Prof. Dr.-Ing. Friedrich Prüfstein, Gutachter_`,
};
