import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-053',
  filename: 'Review_FA016.md',
  format: 'md',
  tags: ['Review', 'Biokunststoff', 'LCA'],
  created: '2026-03-14T10:00:00Z',
  vorgangId: 'FA-2026-016',
  markdown: `---
titel: Technisches Gutachten FA-2026-016 Biokunststoffe aus Lignocellulose
aktenzeichen: FA-2026-016
datum: 2026-03-14
gutachter: Prof. Dr.-Ing. Werner Werkstoff, Fraunhofer ICT (anonymisiert)
---

# Technisches Gutachten — FA-2026-016 Biokunststoffe aus Lignocellulose

## 1. Zusammenfassung

Der Antrag FA-2026-016 plant die Skalierung der PLA- und PHA-Herstellung aus Lignocellulose-Reststoffen (Weizenstroh, Buchenholz) vom Labormaßstab (5-Liter-Bioreaktor) zur Pilotanlage (500 kg/d Durchsatz). Das Projekt adressiert eine zentrale Herausforderung der biobasierten Wirtschaft: die wirtschaftliche Skalierung biobasierter Kunststoffe aus Non-Food-Biomasse. Die Antragstellerin (Prof. Polymer, TU Musterstadt) hat einschlägige Vorarbeiten in der enzymatischen Hydrolyse von Lignocellulose publiziert (8 Journalartikel 2020–2025, darunter 2 in Green Chemistry und 1 in Bioresource Technology). Der Industriepartner BASF SE bringt Compounding-Expertise und Zugang zu Anwendungsmärkten ein. Die Gesamtbewertung ist positiv, es bestehen jedoch Scale-up-Risiken und LCA-methodische Fragen, die im Antrag adressiert werden sollten.

## 2. Scale-up-Risiken

### 2.1 Enzymatische Hydrolyse bei hoher Feststoffkonzentration

Die enzymatische Hydrolyse von Lignocellulose im Labormaßstab erfolgt typischerweise bei 5–10 Prozent Feststoffkonzentration (w/v), was zu einer verdünnten Glucose-Lösung (40–80 g/l) führt. Für die wirtschaftliche Fermentation ist eine Glucose-Konzentration von ≥ 100 g/l erforderlich, was eine Feststoffkonzentration von 15–20 Prozent in der Hydrolyse voraussetzt. Bei hoher Feststoffkonzentration treten jedoch Probleme auf: Die Viskosität der Suspension steigt stark an (bei 15 Prozent Stroh-Suspension: dynamische Viskosität > 10 Pa·s, vergleichbar mit Honig), was das Rühren und den Enzym-Substrat-Kontakt erschwert. Die Endprodukt-Inhibierung der Cellulasen durch Glucose und Cellobiose nimmt zu. Die Enzym-Adsorption an Lignin (unproduktive Bindung) verbraucht einen Teil des teuren Enzym-Cocktails. Der Antrag plant ein Fed-Batch-Verfahren (schrittweise Substratzugabe), was die Viskositätsproblematik teilweise löst, aber die Enzyminhibierung nicht adressiert.

Empfehlung: Aufnahme einer systematischen Optimierung der Fed-Batch-Strategie im Technikumsmaßstab (AP 3) mit Variation der Zugabeintervalle (2, 4, 8, 12 Stunden), der Anfangsfeststoffkonzentration (5, 8, 10 Prozent) und der Enzymdosierung (5, 10, 15 FPU/g Cellulose). Die Enzym-Kosten sind ein kritischer Wirtschaftlichkeitsfaktor: Bei einem Enzympreis von 4–8 Euro/kg (Novozymes Cellic CTec3, Großbestellmenge) und einer Dosierung von 10 FPU/g Cellulose (≈ 20 mg Enzymprotein/g Cellulose) betragen die Enzymkosten 80–160 Euro/t Substrat — der größte Einzelkostenblock im Verfahren. Eine Reduktion der Enzymdosierung um 30 Prozent (durch optimiertes Fed-Batch und Enzymrecycling) würde die Wirtschaftlichkeit erheblich verbessern.

### 2.2 Kontaminationsrisiko im Pilotmaßstab

Die Milchsäurefermentation mit Lactobacillus delbrueckii erfordert sterile Bedingungen, da die Glucose-Lösung ein ideales Nährmedium für Kontaminanten (Hefen, Schimmelpilze, Essigsäurebakterien) darstellt. Im 500-Liter-Fermenter ist die Sterilhaltung deutlich anspruchsvoller als im 5-Liter-Laborfermenter: größere Oberflächen, mehr Anschlüsse (Probennahme, pH-Sonde, Säurezugabe), längere Fermentationsdauer (48 Stunden) und die nicht-sterile Glucose-Lösung aus der Hydrolyse (enthält Mikroorganismen aus dem Lignocellulose-Substrat, die bei 50°C Hydrolysetemperatur nicht vollständig abgetötet werden). Empfehlung: Sterilisation der Glucose-Lösung (Kurzzeiterhitzung auf 121°C für 15 Minuten im Durchlauferhitzer) vor der Fermentation. Aufnahme einer Kontaminationskontrolle im Batch Record (Probennahme zu Beginn und in der Mitte der Fermentation, Mikroskopie und Plattierung auf Agarplatten). CIP-System (Cleaning-in-Place) für den Fermenter nach DIN EN ISO 22000.

### 2.3 Wärmeabfuhr im Pilotmaßstab

Die enzymatische Hydrolyse bei 50°C und die Fermentation bei 37°C erzeugen metabolische Wärme, die im Labormaßstab über die Glaswand des Fermenters an die Umgebung abgeführt wird. Im 500-Liter-Pilotmaßstab sinkt das Oberfläche-zu-Volumen-Verhältnis drastisch, und die Wärmeabfuhr muss über einen Kühlmantel oder interne Kühlschlangen erfolgen. Der Antrag erwähnt die Temperaturregelung, aber nicht die Dimensionierung der Kühlleistung. Empfehlung: Berechnung der erforderlichen Kühlleistung (Wärmeproduktionsrate der Fermentation ≈ 5 kW/m³ bei Lactobacillus, Gesamtwärme bei 500 l: 2,5 kW) und Auslegung des Kühlsystems.

## 3. Materialperformance

### 3.1 Vergleich mit Petrochemie-PLA

PLA aus Lignocellulose enthält im Vergleich zu Mais-PLA (NatureWorks Ingeo 4043D, Referenz) potenziell Verunreinigungen aus dem Lignocellulose-Aufschluss: Furfural und Hydroxymethylfurfural (HMF) als Degradationsprodukte der Hemicellulose, lösliches Lignin (Phenolverbindungen) und mineralische Bestandteile (Asche aus Stroh: 5–8 Prozent). Diese Verunreinigungen können die Polymerisation stören (Kettenlängenreduktion, Verfärbung) und die mechanischen Eigenschaften verschlechtern. Der Antrag nennt Zielwerte für die Materialperformance (Zugfestigkeit ≥ 45 MPa, E-Modul ≥ 3.000 MPa), aber nicht die aktuelle Performance im Labormaßstab. Aus der Literatur ist bekannt, dass Lignocellulose-PLA derzeit etwa 70 Prozent der Zugfestigkeit von Mais-PLA erreicht (32 vs. 45 MPa) — die Schließung dieser Lücke erfordert eine hochreine Milchsäure (≥ 99,5 Prozent), die im Pilotmaßstab noch nachzuweisen ist.

### 3.2 PLA/PHB-Blending

Die geplante Compoundierung von PLA mit 20 Prozent PHB zur Verbesserung der Schlagzähigkeit ist ein vielversprechender Ansatz, der in der Literatur für Mais-PLA bereits erfolgreich demonstriert wurde (Noda et al. 2004, Blend-Schlagzähigkeit +200 Prozent bei -15 Prozent Zugfestigkeit). Die Übertragbarkeit auf Lignocellulose-basierte Polymere mit den oben genannten Verunreinigungsprofilen muss jedoch experimentell nachgewiesen werden. Empfehlung: Systematische Variation des PLA/PHB-Verhältnisses (90:10, 80:20, 70:30) und der Compounding-Parameter (Temperatur, Schneckendrehzahl, Verweilzeit) mit vollständiger Materialcharakterisierung (Zug, Schlag, HDT, DSC, TGA).

## 4. LCA-Methodik

### 4.1 Systemgrenzen

Die geplante Cradle-to-Gate-Bilanz (von der Biomasse-Bereitstellung bis zum Kunststoffgranulat) ist ein häufiger, aber unvollständiger LCA-Ansatz. Entscheidend für die Umweltbewertung von Biokunststoffen ist die End-of-Life-Phase: Wird das PLA kompostiert (CO₂-neutral, aber Verlust des Kohlenstoffs), mechanisch recycelt (Erhalt des Materialwerts, aber eingeschränkte Recyclingfähigkeit von PLA-Blends) oder verbrannt (energetische Verwertung, CO₂-Emission, aber biogener Kohlenstoff)? Die Wahl des End-of-Life-Szenarios beeinflusst die CO₂-Bilanz um den Faktor 2–3. Empfehlung: Erweiterung der LCA auf Cradle-to-Grave mit mindestens 3 End-of-Life-Szenarien (industrielle Kompostierung nach DIN EN 13432, mechanisches Recycling, thermische Verwertung in MVA). Die Sensitivitätsanalyse der End-of-Life-Szenarien zeigt den Entscheidungsträgern, welcher Verwertungsweg den größten Umweltvorteil bietet.

### 4.2 Allokation der Koppelprodukte

Das Organosolv-Verfahren erzeugt neben Cellulose auch Lignin (20–25 Prozent der Biomasse) als verwertbares Koppelprodukt. Die Allokation der Umweltlasten zwischen Cellulose und Lignin beeinflusst die CO₂-Bilanz des PLA erheblich: Bei Massenallokation (75/25) trägt die Cellulose 75 Prozent der Umweltlast, bei ökonomischer Allokation (Cellulosepreis 500 Euro/t, Ligninpreis 200 Euro/t → 71/29) weniger. Empfehlung: Durchführung der Allokation nach ISO 14044 Prioritätsreihenfolge (1. Vermeidung durch Systemerweiterung, 2. physikalische Allokation, 3. ökonomische Allokation) und Darstellung der Sensitivität.

## 5. Empfehlung

Der Antrag wird zur **Förderung** empfohlen. Die Scale-up-Risiken sind dem Projektcharakter (anwendungsorientierte Grundlagenforschung → Pilotanlage) inhärent und werden durch das erfahrene Team und den Industriepartner BASF angemessen gemanagt. Die genannten Verbesserungsvorschläge (Enzymoptimierung, Kontaminationskontrolle, LCA-Erweiterung) sollten in den Arbeitsplan integriert werden. Die Einbindung eines Industriepartners für die spätere Verwertung der Ergebnisse erhöht die Wirksamkeit der öffentlichen Förderung.

Gesamtnote: **2,0 (gut)**. Empfehlung: **Förderung.**

_Prof. Dr.-Ing. Werner Werkstoff, Fraunhofer ICT_`,
};
