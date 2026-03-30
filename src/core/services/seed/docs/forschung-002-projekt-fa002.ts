import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-037',
  filename: 'Projekt_FA002.md',
  format: 'md',
  tags: ['Solar', 'Perowskit'],
  created: '2026-01-12T10:00:00Z',
  vorgangId: 'FA-2026-002',
  markdown: `---
titel: Perowskit-Tandemsolarzellen für Gebäudeintegration — Stabilität und Skalierung
aktenzeichen: FA-2026-002
datum: 2026-01-12
antragsteller: Prof. Dr. rer. nat. Lisa Photon, Institut für Photovoltaik, Universität Musterstadt
---

# Perowskit-Tandemsolarzellen für Gebäudeintegration

## 1. Wissenschaftliche Ausgangslage

Perowskit-Solarzellen haben seit ihrer Entdeckung als Photovoltaik-Material im Jahr 2009 (Kojima et al., JACS 131, 6050) eine beispiellose Effizienzsteigerung erfahren: von 3,8 Prozent auf 26,1 Prozent (Einzelzelle, NREL-Rekord 2024). In Tandemkonfiguration mit Silizium (kristallin c-Si) oder CIGSe (Kupfer-Indium-Gallium-Selenid) wurden Wirkungsgrade über 33 Prozent demonstriert (EPFL/CSEM, Nature Energy 2024). Perowskit-Absorber der Zusammensetzung (FA₀.₈₃MA₀.₁₇)Pb(I₀.₈₃Br₀.₁₇)₃ absorbieren das sichtbare Licht (Bandlücke 1,63 eV), während die untere Zelle (Si, 1,12 eV, oder CIGSe, 1,0–1,15 eV) das nahinfrarote Licht nutzt. Diese spektrale Aufteilung überwindet das Shockley-Queisser-Limit der Einzelzelle (33,7 Prozent) und ermöglicht theoretische Wirkungsgrade bis 45 Prozent.

Die zentrale Herausforderung für die Kommerzialisierung ist die Langzeitstabilität der Perowskit-Absorber. Die organisch-anorganischen Halogenid-Perowskite degradieren unter Einwirkung von Feuchtigkeit (Hydrolyse des organischen Kations), UV-Strahlung (Photokatalyse, Halogenidmigration), erhöhter Temperatur (thermische Zersetzung ab 85°C) und elektrischem Feld (Ionenmigration, Phasensegregation bei gemischten Halogeniden). Die Lebensdauer von Perowskit-Modulen in Freilandtests beträgt derzeit 2–5 Jahre — weit unter den geforderten 25 Jahren für die Gebäudeintegration. Die IEC-61215-Normprüfung (Damp Heat 1000h bei 85°C/85 Prozent rF) wird von den meisten Perowskit-Formulierungen nicht bestanden.

## 2. Projektziele und Innovationsgehalt

Das Projekt verfolgt vier Hauptziele: (1) Verständnis der Degradationsmechanismen unter realen Betriebsbedingungen durch kombinierte In-situ-Charakterisierung (Photolumineszenz-Mapping, Impedanzspektroskopie, Ramanspektroskopie) an Perowskit-Tandemzellen unter beschleunigter Alterung. (2) Entwicklung einer Encapsulation-Technologie mit ultradünnen ALD-Barriereschichten (Atomic Layer Deposition von Al₂O₃/TiO₂-Nanolaminaten, Gesamtdicke 50 nm, WVTR < 10⁻⁴ g/(m²d)), die die Perowskit-Zelle langfristig vor Feuchtigkeit und Sauerstoff schützt. (3) Skalierung der Perowskit-Abscheidung von der Laborzelle (1 cm²) auf Modulformat (30 × 30 cm²) mittels Schlitzdüsenbeschichtung (Slot-Die Coating) im Rolle-zu-Rolle-Verfahren (R2R) auf flexiblen Substraten. (4) Demonstration eines semi-transparenten BIPV-Fassadenmoduls (Building-Integrated Photovoltaics) mit einem Wirkungsgrad von mindestens 15 Prozent bei einer sichtbaren Lichttransmission von mindestens 25 Prozent.

### 2.1 Tandemarchitektur

Das Projekt fokussiert auf die 2-Terminal Tandemarchitektur Perowskit/CIGSe, die gegenüber der Perowskit/Silizium-Variante den Vorteil einer flexiblen Substratkompatibilität bietet (Dünnschicht-CIGSe auf flexiblem Stahl oder Polyimid). Die CIGSe-Unterzelle wird von der Partnerfirma Solarwerk GmbH (Assoziierter Partner, eigene Finanzierung) bereitgestellt. Die Perowskit-Oberzelle wird im Projekt entwickelt und auf die CIGSe-Zelle aufgebracht (monolithische Integration). Die Zwischenschicht (Rekombinationsschicht) besteht aus einem transparenten leitfähigen Oxid (ITO, Indium-Zinn-Oxid, gesputtert, 15 nm) und einer Elektronentransportschicht (SnO₂-Nanopartikel, 30 nm). Der Wirkungsgrad-Zielwert für die Tandemzelle im Labormaßstab beträgt 28 Prozent, für das skalierte Modul (30 × 30 cm²) mindestens 22 Prozent.

## 3. Methodik

### 3.1 Degradationsuntersuchung

Die Degradationsmechanismen werden mit folgenden In-situ-Methoden während der beschleunigten Alterung (IEC 61215 Damp Heat 1000h) untersucht: Photolumineszenz (PL) Mapping mit räumlicher Auflösung von 50 µm — die PL-Intensität korreliert mit der elektronischen Qualität des Perowskits und zeigt lokale Degradation frühzeitig an, bevor sie sich in der Leistung bemerkbar macht. Impedanzspektroskopie (EIS) im Frequenzbereich 10 mHz–1 MHz — ermöglicht die Unterscheidung zwischen Degradation des Perowskit-Bulks (Kapazität C₁), der Grenzflächen (Kapazität C₂) und der Transportschichten (Widerstand R_s). Ramanspektroskopie — detektiert Phasenumwandlungen (z.B. Umwandlung der schwarzen α-Phase des FAPbI₃ in die inaktive gelbe δ-Phase) und Halogenidsegregation (Br-reiche und I-reiche Domänen bei Belichtung). Röntgenbeugung (XRD) in regelmäßigen Intervallen — quantifiziert den Anteil der Perowskit-Phase gegenüber Degradationsprodukten (PbI₂, δ-FAPbI₃).

### 3.2 Encapsulation-Entwicklung

Die ALD-Barriereschichten werden in einem räumlich getrennten ALD-Reaktor (Spatial ALD, Leybold Optics, Substratbreite 30 cm) abgeschieden, der mit dem R2R-Prozess kompatibel ist. Das Nanolaminat Al₂O₃/TiO₂ (Schichtfolge: 5 nm Al₂O₃ / 5 nm TiO₂, 5 Wiederholungen, Gesamtdicke 50 nm) kombiniert die exzellente Feuchtebarriere von Al₂O₃ (WVTR < 10⁻⁵ g/(m²d)) mit der UV-Stabilität von TiO₂. Die Abscheidetemperatur von 80°C ist kompatibel mit den thermisch empfindlichen Perowskit-Absorbern (Degradation ab 85°C). Die Precursoren sind Trimethylaluminium (TMA) und Titantetrachlorid (TiCl₄) mit Wasser als Oxidationsmittel. Die Barrierewirkung wird mit dem MOCON Aquatran Model 3 (WVTR-Messgerät, Messbereich 10⁻⁵ g/(m²d)) quantifiziert.

### 3.3 Rolle-zu-Rolle Skalierung

Die Skalierung der Perowskit-Abscheidung vom Spin-Coating (Labormethode, 1 cm²) zum Slot-Die Coating (industriell, 30 cm Breite) ist ein kritischer Schritt. Die Herausforderungen sind: gleichmäßige Nassfilmdicke über die gesamte Breite (Toleranz ±5 Prozent), kontrollierte Kristallisation des Perowskits (Nukleation und Kornwachstum beeinflussen den Wirkungsgrad), Trocknung ohne Lösemitteleinschlüsse (Vakuumtrocknung oder Heißluft-Gegenstrom) und Substratgeschwindigkeit (Ziel: 1 m/min für wirtschaftliche Produktion). Die Slot-Die-Beschichtung wird auf einer R2R-Pilotanlage (Coatema Smartcoater, Bahnbreite 35 cm, Geschwindigkeit 0,1–5 m/min) durchgeführt. Die Prozessparameter (Nassfilmdicke 500–800 nm, Trocknungstemperatur 60–100°C, Substratgeschwindigkeit 0,5–2 m/min) werden systematisch optimiert.

## 4. Arbeitspakete und Meilensteine

AP 1 (Monat 1–8): Degradationsmechanismen — In-situ-Charakterisierung von Referenzzellen unter Damp Heat, Identification der dominanten Degradationspfade. Meilenstein M1: Degradationsmodell mit quantitativen Ratenparametern. AP 2 (Monat 4–16): ALD-Barriereschichten — Optimierung des Nanolaminats, Beschichtung auf Perowskit-Zellen, beschleunigte Alterungstests. Meilenstein M2: WVTR < 10⁻⁴ g/(m²d) nachgewiesen. AP 3 (Monat 8–20): R2R-Skalierung — Slot-Die-Prozessentwicklung, Perowskit-Module 30 × 30 cm². Meilenstein M3: Modulwirkungsgrad ≥ 18 Prozent auf 900 cm². AP 4 (Monat 14–24): BIPV-Demonstration — Semi-transparente Tandemmodule, Fassadenmock-up, Bewitterungstest im Freien. Meilenstein M4: 15 Prozent Wirkungsgrad bei 25 Prozent Lichttransmission. AP 5 (Monat 20–30): Langzeitstabilität und Verwertung — 1-jähriger Freilandtest, Wirtschaftlichkeitsanalyse, Patentanmeldung.

## 5. Erwartete Ergebnisse und Verwertung

Das Projekt wird folgende Ergebnisse liefern: Ein quantitatives Degradationsmodell für Perowskit-Tandemzellen unter realen Bedingungen, das die Lebensdauer auf Basis beschleunigter Tests prognostiziert (Arrhenius-Extrapolation). Eine ALD-Encapsulationstechnologie, die die Lebensdauer von Perowskit-Modulen auf mindestens 10 Jahre verlängert (Zielwert: T80 — Zeit bis zum Abfall auf 80 Prozent der Anfangsleistung — ≥ 10 Jahre, extrapoliert aus beschleunigten Tests). Ein skalierbarer R2R-Prozess für Perowskit-Oberzellen auf flexiblen Substraten mit einer Reproduzierbarkeit von ≤ 5 Prozent relative Wirkungsgradstreuung. Einen BIPV-Demonstrator als Fassadenelement mit semi-transparenter Gestaltung (Grauton, ästhetisch für Architekten ansprechend), der die doppelte Funktion der Energieerzeugung und des Sonnenschutzes erfüllt.

Die Verwertung erfolgt über die Partnerfirma Solarwerk GmbH, die als CIGSe-Hersteller die Tandemtechnologie in ihr Produktportfolio integrieren wird. Eine Patentanmeldung für die ALD-Encapsulation und den R2R-Prozess ist geplant (TU Musterstadt als Anmelder, exklusive Lizenz an Solarwerk GmbH). Die Ergebnisse werden in mindestens 4 Journalartikeln (Nature Energy, Joule, Advanced Energy Materials, Solar RRL) publiziert und auf der EU PVSEC und der MRS Fall Meeting präsentiert.

## Zusammenfassung in einfacher Sprache

Dieses Projekt entwickelt eine neue Art von Solarzellen, die aus zwei Schichten bestehen und dadurch mehr Sonnenlicht in Strom umwandeln koennen als herkoemmliche Zellen. Die obere Schicht besteht aus einem besonderen Material namens Perowskit, das guenstig herzustellen ist. Das groesste Problem ist, dass diese Zellen bisher nicht lange genug halten. Deshalb werden in diesem Projekt spezielle Schutzbeschichtungen entwickelt und ein Verfahren erprobt, mit dem man die Zellen in grossen Mengen herstellen kann. Am Ende soll ein halbdurchsichtiges Solarmodul entstehen, das an Hausfassaden angebracht werden kann.

Musterstadt, den 12.01.2026

_Prof. Dr. rer. nat. Lisa Photon, Universität Musterstadt_`,
};
