import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-041',
  filename: 'Projekt_FA009.md',
  format: 'md',
  tags: ['Lithium', 'Recycling', 'Bioleaching'],
  created: '2026-01-22T10:00:00Z',
  vorgangId: 'FA-2026-009',
  markdown: `---
titel: Lithium-Rückgewinnung aus Altbatterien durch Bioleaching — Vom Labormaßstab zur Pilotanlage
aktenzeichen: FA-2026-009
datum: 2026-01-22
antragsteller: Prof. Dr.-Ing. Helena Kreislauf, Institut für Verfahrenstechnik, TU Musterstadt
---

# Lithium-Rückgewinnung aus Altbatterien durch Bioleaching

## 1. Motivation und Ressourcenbedarf

Die Nachfrage nach Lithium-Ionen-Batterien (LIB) wächst exponentiell: Der globale Batteriemarkt wird von 700 GWh (2023) auf voraussichtlich 4.700 GWh (2030) ansteigen, getrieben durch die Elektromobilität und stationäre Energiespeicher. Die Kathodenmaterialien — insbesondere NMC (Nickel-Mangan-Cobalt), NCA (Nickel-Cobalt-Aluminium) und LFP (Lithium-Eisenphosphat) — enthalten strategische Rohstoffe, deren Verfügbarkeit zunehmend kritisch wird. Lithium steht auf der EU-Liste der kritischen Rohstoffe (CRM Act 2024), Cobalt wird zu 70 Prozent im Kongo unter ethisch fragwürdigen Bedingungen abgebaut und Nickel unterliegt starken Preisschwankungen. In Deutschland fallen bereits heute 50.000 Tonnen Altbatterien pro Jahr an (Tendenz: Verdoppelung bis 2030), aus denen theoretisch 3.000 Tonnen Lithium, 2.500 Tonnen Cobalt und 5.000 Tonnen Nickel rückgewonnen werden könnten.

Die konventionellen Recyclingverfahren — Pyrometallurgie (Einschmelzen bei 1.400°C) und Hydrometallurgie (Auflösen in Schwefelsäure/Salzsäure bei 80°C) — haben erhebliche Nachteile: Die Pyrometallurgie verbraucht große Mengen Energie (2.500 kWh/t Kathodenmaterial) und verliert das Lithium in der Schlacke (Rückgewinnungsrate Lithium < 5 Prozent). Die Hydrometallurgie erreicht hohe Rückgewinnungsraten (Li > 90 Prozent, Co > 95 Prozent), benötigt aber aggressive Chemikalien (konzentrierte Säuren, Oxidationsmittel) und erzeugt Abwasser mit Schwermetall-Rückständen. Bioleaching — die mikrobielle Laugung mit acidophilen Bakterien — bietet eine umweltfreundliche Alternative, die bei Raumtemperatur und atmosphärischem Druck arbeitet und die Säure biogen erzeugt.

## 2. Stand der Forschung

Bioleaching wird seit Jahrzehnten im Bergbau für die Kupfer- und Gold-Gewinnung aus Erzen eingesetzt (10–15 Prozent der weltweiten Kupferproduktion stammen aus Bioleaching). Die Anwendung auf LIB-Kathodenmaterialien ist ein vergleichsweise neues Forschungsfeld (erste Publikationen 2015, seither > 200 Studien). Der Organismus Acidithiobacillus ferrooxidans (Af) oxidiert zweiwertiges Eisen (Fe²⁺) zu dreiwertigem Eisen (Fe³⁺) und elementaren Schwefel (S⁰) zu Schwefelsäure (H₂SO₄). Die biogen erzeugte Schwefelsäure (Konzentration 15–30 g/l, pH 1,0–2,0) löst die Metalloxide der Kathode auf: LiNi₀.₃₃Mn₀.₃₃Co₀.₃₃O₂ + 6H₂SO₄ → Li₂SO₄ + NiSO₄ + MnSO₄ + CoSO₄ + 6H₂O + 3/2 O₂. Die Rückgewinnungsraten im Labormaßstab liegen bei: Li 85–95 Prozent, Co 80–90 Prozent, Ni 75–88 Prozent, Mn 80–92 Prozent (je nach Studie und Prozessbedingungen). Die Herausforderung liegt in der Skalierung: Im Labormaßstab (250-ml-Schüttelkolben) dauert der Laugungsprozess 5–14 Tage, die Feststoffkonzentration ist auf 1–2 Prozent (w/v) begrenzt (höhere Konzentrationen hemmen die Bakterienaktivität durch Schwermetalltoxizität) und die Prozessstabilität über Wochen ist nicht nachgewiesen.

## 3. Projektziele und Innovationsgehalt

Das Projekt verfolgt die Skalierung des Bioleaching-Prozesses für LIB-Kathodenmaterialien vom Labormaßstab (250 ml) über den Technikumsmaßstab (50 Liter) zur Pilotanlage (500 Liter). Die spezifischen Innovationen sind: (1) Adaptierte Bakterienkultur — durch selektiven Druck (schrittweise Erhöhung der Schwermetallkonzentration im Medium über 6 Monate) wird ein Af-Stamm mit erhöhter Toleranz gegenüber Co und Ni gezüchtet, der bei Feststoffkonzentrationen von 5 Prozent (w/v) statt 1–2 Prozent arbeitet. (2) Zweistufiges Bioleaching — die biogene Säureerzeugung (Stufe 1: Af wächst in Schwefel-Medium und erzeugt H₂SO₄ ohne Kontakt zum Kathodenmaterial) wird von der Metallauflösung (Stufe 2: das saure Medium wird auf das Kathodenmaterial gegeben, kein Bakterienkontakt) entkoppelt. Dies vermeidet die toxische Hemmung der Bakterien durch die Schwermetalle und ermöglicht höhere Feststoffkonzentrationen. (3) Selektive Metallfällung — aus dem Leachat werden die Metalle in der Reihenfolge Mn (als MnCO₃ bei pH 8–9), Co (als Co(OH)₂ bei pH 9–10), Ni (als NiCO₃ bei pH 10–11) und Li (als Li₂CO₃ bei pH 12 + Na₂CO₃-Zugabe) selektiv ausgefällt. Die Reinheit der Metallsalze soll ≥ 99,5 Prozent (battery grade) betragen.

## 4. Methodik

### 4.1 Vorbehandlung der Altbatterien

Die Altbatterien (NMC 111, NMC 622, NMC 811 aus E-Fahrzeugen, Lieferant: Recycling-Betrieb Duesenfeld GmbH) werden mechanisch vorbehandelt: Tiefentladung auf 0 V (Sicherheit), Zerlegung in Einzelzellen, Zerkleinerung (Hammermühle, Partikelgröße < 1 mm), Trennung von Kathoden-Schwarzpulver (Flotation, Luft-Klassierung von Kupferfolie und Aluminium), thermische Vorbehandlung des Schwarzpulvers bei 500°C für 2 Stunden (Verbrennung des PVDF-Binders und des Kohlenstoff-Leitfähigkeitsadditivs). Das resultierende Kathodenoxid-Pulver (Zusammensetzung typisch: 20 Prozent Li, 12 Prozent Co, 12 Prozent Ni, 12 Prozent Mn, 44 Prozent O) ist das Einsatzmaterial für das Bioleaching.

### 4.2 Bakterienkultivierung und Säureproduktion

Acidithiobacillus ferrooxidans (DSMZ 583T) wird in 9K-Medium (nach Silverman & Lundgren 1959, modifiziert) mit elementarem Schwefel (10 g/l, gemahlen < 100 µm) als Energiequelle kultiviert. Die Kulturbedingungen: pH 2,0 (Startbedarf, sinkt durch biogene H₂SO₄-Produktion auf pH 1,0–1,5), Temperatur 30°C (Optimum für Af), Belüftung 1 vvm (Volumen Luft je Volumen Medium je Minute), Rührergeschwindigkeit 200 rpm (Rushton-Turbine). Die Säureproduktion wird über den pH-Wert und die Sulfatkonzentration (IC, Ionenchromatographie) online überwacht. Im Technikumsmaßstab (50-Liter-Bioreaktor, Sartorius Biostat B) wird eine Säureproduktionsrate von 2–3 g H₂SO₄/(l·d) angestrebt.

### 4.3 Bioleaching-Prozess

Im zweistufigen Prozess wird das biogen erzeugte saure Medium (pH 1,0–1,5, H₂SO₄ 20–30 g/l) vom Bakterien-Bioreaktor abgetrennt (Hohlfaser-Mikrofiltration, Porengröße 0,2 µm) und auf das Kathodenoxid-Pulver gegeben (Pulp-Dichte 5 Prozent w/v, Rührkesselreaktor, 30°C, 72 Stunden). Die Metallauflösung wird durch Zugabe von FeSO₄ (Fe²⁺ als Reduktionsmittel, 10 g/l) beschleunigt: Das Fe³⁺ (biogen erzeugt oder durch Oxidation von Fe²⁺ am Kathodenoxid) reduziert die höherwertigen Metalloxide (Co³⁺ → Co²⁺, Ni³⁺ → Ni²⁺, Mn⁴⁺ → Mn²⁺), die in der sauren Lösung löslich sind. Die Reaktionskinetik wird durch Probennahme alle 6 Stunden und ICP-OES-Analyse (Agilent 5800, simultane Multielement-Analyse: Li, Co, Ni, Mn, Fe, Al) verfolgt.

### 4.4 Pilotanlage 500 Liter

Die Pilotanlage besteht aus: 2 Bioreaktoren à 500 Liter für die Säureproduktion (Edelstahl V4A, säurebeständig), 1 Leaching-Reaktor 500 Liter mit Rührwerk und pH/Temperatur-Regelung, Mikrofiltrations-Einheit (keramische Membranen, beständig gegen pH < 1), Selektive Fällungsanlage (4 Rührkessel à 100 Liter, pH-Regelung mit NaOH/Na₂CO₃), Filterpresse (Kammerfilterpresse, 10 Kammern) für die Feststoff-Flüssig-Trennung der Metallpräzipitate, Abwasseraufbereitung (Neutralisation, Schwermetall-Fällung). Die Pilotanlage wird in der Technikumshalle des Instituts für Verfahrenstechnik aufgebaut (Fläche 80 m², Abluftanlage mit Aktivkohlefilter für H₂S-Spuren, Auffangwanne nach AwSV). Der Durchsatz beträgt 50 kg Kathodenoxid-Pulver je Batch (5 Batches geplant, Gesamtdurchsatz 250 kg).

## 5. Lebenszyklusanalyse und Wirtschaftlichkeit

### 5.1 LCA-Vergleich

Eine vergleichende Lebenszyklusanalyse (LCA) nach ISO 14040/14044 wird für die drei Recycling-Routen durchgeführt: Pyrometallurgie, konventionelle Hydrometallurgie und Bioleaching. Systemgrenze: Cradle-to-Gate (von der Altbatterie-Anlieferung bis zu den gereinigten Metallsalzen). Funktionelle Einheit: 1 kg rückgewonnenes Lithiumcarbonat (battery grade, ≥ 99,5 Prozent). Wirkungskategorien: Global Warming Potential (GWP, kg CO₂-eq), Versauerungspotential (AP, kg SO₂-eq), Humantoxizität (HTP, kg 1,4-DCB-eq), Wasserverbrauch (m³). Die LCA-Daten für die konventionellen Verfahren stammen aus der Ecoinvent-Datenbank (v3.9), die Bioleaching-Daten aus den Projektmessungen. Erwarteter Vorteil des Bioleachings: GWP -40 Prozent gegenüber Hydrometallurgie (kein Heizen auf 80°C, keine konzentrierte Säure), AP -60 Prozent (biogene Säure statt H₂SO₄ aus Schwefelverbrennung).

### 5.2 Wirtschaftlichkeit

Die Wirtschaftlichkeitsberechnung basiert auf einer hypothetischen industriellen Anlage (Durchsatz 5.000 t Kathodenpulver/a). Betriebskosten Bioleaching (geschätzt): Schwefel 50 Euro/t, Stromverbrauch Bioreaktoren 200 kWh/t, Chemikalien Fällung 300 Euro/t, Personal und Wartung 150 Euro/t. Gesamt: 700 Euro/t Kathodenpulver. Erlöse: 1 t Kathodenpulver enthält ca. 60 kg Li (Preis 40 Euro/kg LiCO₃) + 120 kg Co (30 Euro/kg) + 120 kg Ni (18 Euro/kg) + 120 kg Mn (2 Euro/kg). Erlös: 2.400 + 3.600 + 2.160 + 240 = 8.400 Euro/t. Marge: 8.400 - 700 = 7.700 Euro/t — wirtschaftlich hochattraktiv, selbst bei konservativen Metallpreisen.

## 6. Arbeitspakete und Zeitplan (30 Monate)

AP 1 (Monat 1–6): Bakterien-Adaptierung (Schwermetalltoleranz). AP 2 (Monat 4–12): Laborversuche (250 ml, Optimierung Prozessparameter). AP 3 (Monat 10–18): Technikum (50 Liter). AP 4 (Monat 16–26): Pilotanlage (500 Liter, 5 Batches). AP 5 (Monat 20–28): LCA und Wirtschaftlichkeit. AP 6 (Monat 24–30): Publikation und Verwertung. Personal: 1 Postdoc Mikrobiologie, 1 Doktorand/in Verfahrenstechnik, 1 MTA. Gesamtkosten: 780.000 Euro.

Musterstadt, den 22.01.2026

_Prof. Dr.-Ing. Helena Kreislauf, TU Musterstadt_`,
};
