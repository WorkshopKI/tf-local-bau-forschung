import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-045',
  filename: 'Projekt_FA016.md',
  format: 'md',
  tags: ['Biokunststoff', 'Lignocellulose', 'Pilotanlage'],
  created: '2026-02-05T10:00:00Z',
  vorgangId: 'FA-2026-016',
  markdown: `---
titel: Biokunststoffe aus Lignocellulose — Vom Labormaßstab zur Pilotanlage
aktenzeichen: FA-2026-016
datum: 2026-02-05
antragsteller: Prof. Dr.-Ing. Christina Polymer, Institut für Bioverfahrenstechnik, TU Musterstadt
---

# Biokunststoffe aus Lignocellulose — Pilotanlage

## 1. Ausgangslage und Marktpotential

Die globale Kunststoffproduktion beträgt 400 Millionen Tonnen pro Jahr (Plastics Europe 2024), davon werden 99 Prozent aus fossilen Rohstoffen (Erdöl, Erdgas) hergestellt. Die Substitution durch biobasierte Kunststoffe — hergestellt aus nachwachsenden Rohstoffen — ist ein Schlüsselelement der biobasierten Wirtschaft (Bioeconomy Strategy der EU 2018, Nationale Bioökonomiestrategie 2020). Biokunststoffe machen derzeit nur 1 Prozent der globalen Produktion aus (ca. 4,2 Millionen Tonnen/Jahr), das Marktwachstum beträgt jedoch 15–20 Prozent pro Jahr. Die wichtigsten Biokunststoffe sind Polymilchsäure (PLA, aus Stärkepflanzen wie Mais) und Polyhydroxyalkanoate (PHA, aus bakterieller Fermentation).

Das Problem der aktuellen PLA-Produktion: Der Rohstoff ist Maisstärke oder Zuckerrohr — Nahrungsmittelpflanzen, deren Nutzung für Kunststoffe ethisch umstritten ist (Food-vs.-Fuel-Debatte, auch auf Biokunststoffe übertragbar: Food-vs.-Material). Lignocellulose — der Hauptbestandteil von Holz, Stroh und anderen Pflanzenresten — ist der weltweit häufigste nachwachsende Rohstoff (180 Milliarden Tonnen jährliche Produktion durch Photosynthese) und steht nicht in Konkurrenz zur Nahrungsmittelproduktion. In Deutschland fallen jährlich 30 Millionen Tonnen Lignocellulose-Reststoffe an (Weizenstroh, Maisstroh, Holzreste aus der Forstwirtschaft, Sägespäne), die derzeit unterwertfig genutzt werden (Verbrennung, Kompostierung).

## 2. Verfahrenskonzept

### 2.1 Rohstoff-Aufschluss

Lignocellulose besteht aus drei Hauptkomponenten: Cellulose (40–50 Prozent, kristallines Polysaccharid aus Glucose-Einheiten), Hemicellulose (25–35 Prozent, verzweigtes Polysaccharid aus verschiedenen Zuckern) und Lignin (15–25 Prozent, aromatisches Polymer, Klebstoff zwischen den Fasern). Die Herausforderung beim Aufschluss ist die Trennung dieser Komponenten, ohne die Cellulose zu degradieren. Das Projekt untersucht zwei Aufschlussverfahren:

**Steam Explosion (Dampfexplosion):** Das zerkleinerte Lignocellulose-Material (Hackschnitzel 2–5 cm oder Stroh-Häcksel 5–10 cm) wird in einem Druckreaktor (Parr Instruments, 20 Liter) mit Sattdampf bei 180–220°C und 10–25 bar für 3–15 Minuten behandelt. Der plötzliche Druckabfall (Expansion auf Atmosphärendruck innerhalb von 0,1 Sekunden) zerreißt die Zellstruktur und spaltet die Hemicellulose-Lignin-Bindungen. Die Cellulose-Fasern werden freigelegt und sind für den enzymatischen Angriff zugänglich. Vorteile: Kein Chemikalieneinsatz (nur Wasser und Wärme), hohe Cellulose-Ausbeute (85–95 Prozent), kurze Reaktionszeit. Nachteile: Hoher Energiebedarf (Dampferzeugung), Bildung von Inhibitoren (Furfural, HMF) aus der Hemicellulose-Degradation, die die nachfolgende Fermentation hemmen können.

**Organosolv-Aufschluss:** Das Material wird in einem Gemisch aus Ethanol und Wasser (60:40 v/v) bei 180°C und 15 bar für 60 Minuten gekocht. Das Lignin löst sich im organischen Lösemittel und wird nach Abkühlung und Verdünnung mit Wasser als fester Ligninkuchen ausgefällt. Das Ethanol wird destillativ zurückgewonnen (Kreislaufführung, Verluste < 2 Prozent). Vorteile: Saubere Fraktionierung in Cellulose, Hemicellulose und Lignin (das Lignin ist als Koppelprodukt verwertbar: Klebstoffe, Carbonfasern), weniger Inhibitoren als Steam Explosion. Nachteile: Lösemittelkosten (trotz Kreislaufführung), längere Reaktionszeit, brandgefährliches Ethanol erfordert Explosionsschutz.

### 2.2 Enzymatische Hydrolyse

Die aufgeschlossene Cellulose wird enzymatisch zu Glucose hydrolysiert. Der Enzym-Cocktail besteht aus drei Enzymklassen: Endoglucanasen (spalten die Cellulosekette zufällig), Cellobiohydrolasen (spalten Cellobiose-Einheiten vom Kettenende) und β-Glucosidasen (spalten Cellobiose in 2 Glucose). Das Projekt verwendet den kommerziellen Enzym-Cocktail Cellic CTec3 (Novozymes, Dosierung 5–15 FPU/g Cellulose) und optimiert die Hydrolysebedingungen: Feststoffkonzentration 10–20 Prozent (w/v) in einem Fed-Batch-Verfahren (schrittweise Zugabe des Substrats, um die Viskosität handhabbar zu halten), Temperatur 50°C (Optimum der Enzyme), pH 5,0 (Natriumcitratpuffer), Reaktionszeit 48–72 Stunden. Die Glucose-Ausbeute soll ≥ 85 Prozent der theoretischen Ausbeute betragen (bezogen auf den Cellulose-Gehalt des Substrats).

### 2.3 Fermentation zu Milchsäure und PHA

**PLA-Route:** Die Glucose wird mit Lactobacillus delbrueckii (homofermentativ, L(+)-Milchsäure) zu Milchsäure (Lactic Acid, LA) fermentiert. Fermentationsbedingungen: 37°C, pH 6,0 (Neutralisation mit Ca(OH)₂), anaerob, 48 Stunden. Milchsäure-Ausbeute: ≥ 90 Prozent (g LA / g Glucose). Die Milchsäure wird durch Ansäuerung mit H₂SO₄ (Freisetzung aus Calciumlactat), Filtration und Kurzweg-Destillation auf ≥ 99 Prozent Reinheit aufgereinigt. Die Polykondensation zu PLA erfolgt über den Zwischenschritt Lactid (cyclischer Diester, Ringöffnungspolymerisation mit Zinn(II)-octoat als Katalysator, 180°C, 2 Stunden). Ziel-Molekulargewicht: Mw ≥ 100.000 g/mol (für mechanische Festigkeit).

**PHA-Route:** Alternativ wird die Glucose mit Cupriavidus necator (Stamm H16) zu Polyhydroxybutyrat (PHB, ein PHA-Typ) fermentiert. PHB akkumuliert als intrazellulärer Speicherstoff bei Stickstoff-Limitation und Kohlenstoffüberschuss. Fermentationsbedingungen: 30°C, pH 7,0, aerob (Belüftung 1 vvm), 2-Phasen-Fermentation (Wachstumsphase 24h mit N-Quelle, Akkumulationsphase 48h ohne N-Quelle). PHB-Gehalt in der Biomasse: Ziel ≥ 60 Prozent (w/w). Extraktion: Zellaufschluss durch Hochdruckhomogenisation, PHB-Isolierung durch Chloroform-Extraktion (Labormaßstab) oder wässrige Enzymlyse (Pilotmaßstab, umweltfreundlicher).

### 2.4 Compoundierung und Materialprüfung

Die hergestellten Biopolymere (PLA und PHB) werden auf einem Doppelschneckenextruder (Thermo Fisher Process 11, gleichläufig, L/D = 40) compoundiert (Blending PLA/PHB 80:20 zur Verbesserung der Schlagzähigkeit, Zugabe von Talkum 5 Prozent als Nukleierungsmittel). Die Granulate werden zu Prüfkörpern (Zugstab Typ 1A nach DIN EN ISO 527, Schlagbiegeprüfkörper nach DIN EN ISO 179) spritzgegossen (Arburg Allrounder 270S, Werkzeugtemperatur 30°C, Massetemperatur 190°C). Materialprüfung nach DIN-Normen: Zugfestigkeit und E-Modul (DIN EN ISO 527, Zwick Z020), Schlagzähigkeit Charpy (DIN EN ISO 179, Zwick HIT5.5P), Wärmeformbeständigkeit HDT (DIN EN ISO 75, Zwick HDT/VICAT), Bioabbaubarkeit (DIN EN 13432, Kompostierungsversuch 90 Tage bei 58°C, CO₂-Entwicklung ≥ 90 Prozent). Zielwerte: Zugfestigkeit ≥ 45 MPa (Vergleich: PE-HD 25 MPa, PP 35 MPa), E-Modul ≥ 3.000 MPa, Charpy Schlagzähigkeit ≥ 15 kJ/m², HDT ≥ 55°C.

## 3. Pilotanlage

Die Pilotanlage (Durchsatz 500 kg Lignocellulose-Substrat pro Tag) wird in der Technikumshalle des Instituts für Bioverfahrenstechnik aufgebaut. Die Hauptkomponenten sind: Zerkleinerer (Hammermühle, 50 kg/h, Partikelgröße < 5 mm), Steam-Explosion-Reaktor (200 Liter Nutzvolumen, 220°C/25 bar, Edelstahl V4A, Sicherheitseinrichtung: Berstscheibe, Druckentlastung in Auffangtank), Hydrolyse-Reaktor (500 Liter Rührkessel, temperiert, pH-geregelt), Fermentationsreaktor (500 Liter, temperiert, belüftet, sterilisierbar), Aufarbeitungseinheit (Filtration, Destillation, Kristallisation für Milchsäure) und Extruder (Doppelschnecke, Durchsatz 10 kg/h). Die Pilotanlage wird 5 Produktionskampagnen à 2 Wochen durchführen (Gesamtdurchsatz: 5 × 10 × 500 kg = 25.000 kg Substrat). Die Investitionskosten für die Pilotanlage betragen 380.000 Euro (Eigenanteil TU Musterstadt: 120.000 Euro aus Infrastrukturmitteln).

## 4. Lebenszyklusanalyse

Die vergleichende LCA (ISO 14040/14044, Cradle-to-Gate) wird für folgende Szenarien durchgeführt: PLA aus Lignocellulose (dieses Projekt), PLA aus Maisstärke (konventionell, NatureWorks Ingeo), PE-HD aus Erdöl (petrochemisch, Referenz) und PHB aus Lignocellulose (dieses Projekt). Funktionelle Einheit: 1 kg Kunststoffgranulat. Wirkungskategorien: GWP (kg CO₂-eq), kumulierter Energieaufwand (MJ), Landnutzung (m²a), Wasserverbrauch (m³). Hypothese: PLA aus Lignocellulose spart gegenüber Mais-PLA 30 Prozent Landnutzung (kein Ackerland benötigt, nur Reststoffe) und gegenüber PE-HD 50 Prozent CO₂-Emissionen (biogener Kohlenstoff, niedrigerer Prozessenergiebedarf).

## 5. Arbeitspakete und Zeitplan (30 Monate)

AP 1 (Monat 1–8): Aufschluss-Optimierung (Steam Explosion vs. Organosolv, DoE-Versuchsplanung). AP 2 (Monat 6–14): Enzymatische Hydrolyse (Enzym-Screening, Fed-Batch-Optimierung). AP 3 (Monat 10–18): Fermentation (LA und PHB, Batch und Fed-Batch). AP 4 (Monat 14–22): Pilotanlage (Aufbau, Inbetriebnahme, 5 Kampagnen). AP 5 (Monat 18–26): Compoundierung und Materialprüfung. AP 6 (Monat 20–28): LCA und Wirtschaftlichkeitsanalyse. AP 7 (Monat 26–30): Publikation und Verwertung. Personal: 1 Postdoc Bioverfahrenstechnik, 1 Doktorand/in Polymerchemie, 1 Techniker/in Pilotanlage, studentische Hilfskräfte. Industriepartner: BASF SE (assoziiert, Bereitstellung von Vergleichsmaterialien und Compounding-Expertise). Gesamtkosten: 890.000 Euro.

## Zusammenfassung in einfacher Sprache

Die meisten Kunststoffe werden aus Erdoel hergestellt. In diesem Projekt wird erforscht, wie man Kunststoffe stattdessen aus Pflanzenresten wie Stroh oder Holzabfaellen herstellen kann, die nicht als Nahrungsmittel gebraucht werden. Die Pflanzenreste werden zunaechst aufgespalten, dann wandeln Bakterien die gewonnenen Zucker in Bausteine fuer Biokunststoffe um. Das Verfahren soll vom Labor auf eine groessere Versuchsanlage uebertragen werden, die 500 Kilogramm Rohmaterial pro Tag verarbeiten kann. Am Ende werden die neuen Biokunststoffe getestet, ob sie genauso stabil sind wie herkoemmliche Kunststoffe.

Musterstadt, den 05.02.2026

_Prof. Dr.-Ing. Christina Polymer, TU Musterstadt_`,
};
