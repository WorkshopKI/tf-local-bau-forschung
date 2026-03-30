import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-052',
  filename: 'Review_FA015.md',
  format: 'md',
  tags: ['Review', 'Klima', 'Stadtplanung'],
  created: '2026-03-12T10:00:00Z',
  vorgangId: 'FA-2026-015',
  markdown: `---
titel: Fachgutachten FA-2026-015 Klimaadaptive Stadtplanung — Hitze- und Überflutungsvorsorge
aktenzeichen: FA-2026-015
datum: 2026-03-12
gutachter: Prof. Dr.-Ing. Carla Klimaschutz, TU Dresden (anonymisiert)
---

# Fachgutachten — FA-2026-015 Klimaadaptive Stadtplanung

## 1. Zusammenfassung

Das Projekt FA-2026-015 kombiniert stadtklimatische Modellierung (Hitze-Hotspot-Kartierung) mit konkreten Schwammstadt-Maßnahmen (Rigolen, Baumrigolen, entsiegelte Flächen, Dachbegrünung) in zwei Pilotquartieren der Stadt Musterstadt. Der Ansatz, Klimamodellierung und bauliche Umsetzung in einem Projekt zu vereinen, ist praxisorientiert und hebt sich positiv von rein akademischen Klimamodellierungsprojekten ab. Das Konsortium aus Stadtklimatologen (Universität Musterstadt), Landschaftsarchitekten (Büro FreiRaum GmbH) und dem Stadtplanungsamt Musterstadt gewährleistet die Umsetzbarkeit der Ergebnisse. Die Gesamtbewertung ist positiv mit einigen Verbesserungsvorschlägen.

## 2. Stärken

### 2.1 Methodik Hitze-Hotspot-Kartierung

Die Kombination aus Satelliten-Thermalbildern (Landsat 8/9, thermisches Infrarotband 10,6–11,2 µm, Auflösung 100 m) und hochaufgelöster stadtklimatischer Modellierung (ENVI-met V5, Auflösung 2 m × 2 m) ist methodisch fundiert. Die Satellitendaten liefern die großräumige Verteilung der Oberflächentemperatur (Land Surface Temperature, LST) für das gesamte Stadtgebiet, während ENVI-met die mikroklimatischen Effekte (Gebäudeverschattung, Verdunstungskühlung durch Vegetation, Windkanalisierung) auf Quartiersebene auflöst. Der geplante Workflow — Satellit identifiziert Hotspots → ENVI-met simuliert die Hotspots hochaufgelöst → Maßnahmenplanung basierend auf den Simulationsergebnissen — ist logisch und effizient.

Die Wahl von ENVI-met als Simulationswerkzeug ist angemessen: ENVI-met ist das weltweit am häufigsten verwendete Mikroklimamodell für urbane Anwendungen (> 3.000 Publikationen seit 2000), berechnet den Energiehaushalt von Oberflächen, die Verdunstung von Vegetation (über das ACASA-Vegetationsmodell), die turbulente Wärmemischung in der Stadtgrenzschicht und den physiologisch äquivalenten Temperatur-Index PET (Predicted Mean Vote und Universal Thermal Climate Index für die humane Bewertung). Die geplante Modellgebietsgröße (500 m × 500 m je Pilotquartier, Auflösung 2 m, 62.500 Gitterzellen) ist mit aktueller Hardware (Rechenzeit ca. 48 Stunden je Simulation auf einem 16-Kern-Rechner) realisierbar.

### 2.2 Schwammstadt-Maßnahmenkatalog

Der Maßnahmenkatalog umfasst eine gute Mischung aus erprobten und innovativen Schwammstadt-Elementen: Baumrigolen (Kombination aus Straßenbaum und unterirdischem Speicher, Speichervolumen 4 m³ je Baum, Verdunstungskühlung durch den Baum + Regenwasserretention in der Rigole), offene Versickerungsmulden in Grünflächen (Speicher 150 l/m², Versickerung über 24 Stunden), Dachbegrünung (extensiv, 10 cm Substrat, Retentionsvolumen 45 l/m² bei Starkregen) und Entsiegelung von Parkplätzen (Rasengittersteine statt Asphalt, Versickerungsrate 270 l/(s·ha)). Die Maßnahmen werden nicht nur geplant, sondern im Pilotquartier tatsächlich umgesetzt (Kooperation mit dem Tiefbauamt, Budget: 500.000 Euro aus dem Städtebauförderprogramm Klimaanpassung im urbanen Raum) — ein wichtiger Unterschied zu vielen Forschungsprojekten, die nur Empfehlungen auf Papier liefern.

## 3. Schwächen und Verbesserungsvorschläge

### 3.1 ENVI-met Validierung

Die ENVI-met-Simulationen werden im Antrag als Stand der Technik dargestellt, aber eine Validierung der Simulationsergebnisse mit Vor-Ort-Messstationen fehlt im Konzept. ENVI-met hat bekannte Limitationen: die Strahlungsberechnung ist für hohe Gebäudedichten (Aspect Ratio > 2) ungenau, die Windfeld-Berechnung (RANS-Modell) unterschätzt die Turbulenz in Straßenschluchten und die Verdunstungsberechnung überschätzt die Kühlleistung von Bäumen bei Trockenheit (da das Standard-Bodenmodell die Wasserverfügbarkeit vereinfacht). Empfehlung: Installation von mindestens 5 mobilen Klimamessstationen (Temperatur, Feuchte, Wind, Strahlung, PET) in jedem Pilotquartier für mindestens eine Sommerperiode (Juni–August) vor und nach der Maßnahmenumsetzung. Die Messdaten dienen (a) der Kalibrierung der ENVI-met-Eingabeparameter (Albedo der Oberflächen, LAI der Bäume, Bodenwassergehalt) und (b) der Validierung der Simulationsergebnisse (Vergleich simulierte vs. gemessene PET an den Messstationsstandorten, Zielwert: RMSE < 2°C PET).

### 3.2 Sozioökonomische Vulnerabilitätsanalyse

Die Hitze-Hotspot-Kartierung identifiziert die physisch heißesten Orte, berücksichtigt aber nicht die soziale Vulnerabilität der betroffenen Bevölkerung. Hitzetote und hitzebedingte Krankenhauseinweisungen korrelieren nicht nur mit der Temperatur, sondern auch mit dem Alter (> 75 Jahre: 5-fach erhöhtes Risiko), dem Einkommen (einkommensschwache Haushalte haben seltener Klimaanlagen und wohnen häufiger in schlecht gedämmten Gebäuden), der Wohnsituation (Dachgeschosswohnungen ohne Verschattung: Innentemperaturen > 35°C bei Hitzewellen) und dem Migrationshintergrund (eingeschränkter Zugang zu Informationen über Hitzewarnsysteme). Empfehlung: Verschneidung der Hitze-Hotspot-Karte mit soziodemographischen Daten (Zensus 2022, kleinräumig auf Stadtteilebene) zu einer Hitze-Vulnerabilitätskarte (Heat Vulnerability Index, HVI). Der HVI priorisiert Maßnahmen dort, wo hohe Hitzebelastung und hohe soziale Vulnerabilität zusammentreffen — das ist aus Sicht der Umweltgerechtigkeit (Environmental Justice) geboten und erhöht die politische Wirkung der Projektergebnisse.

### 3.3 Kosten-Nutzen-Analyse

Der Antrag beschreibt die Kosten der Schwammstadt-Maßnahmen (500.000 Euro Baukosten), quantifiziert aber den Nutzen nicht monetär. Für kommunale Entscheidungsträger (Stadträte, Kämmerer) ist eine Kosten-Nutzen-Analyse (KNA) entscheidend: Vermiedene Überflutungsschäden (Starkregen-Schäden in Musterstadt 2023: 2,8 Millionen Euro auf 4 Starkregenereignisse), vermiedene Gesundheitskosten (hitzebedingte Krankenhauseinweisungen, Arbeitsausfälle, Sterblichkeit — monetarisiert nach dem Value of a Statistical Life, VSL), Wertsteigerung der Immobilien im Quartier (Studien zeigen 3–8 Prozent Wertsteigerung bei Begrünung und Entsiegelung) und ökosystemare Dienstleistungen (CO₂-Bindung durch Bäume, Biodiversitätsförderung, Erholungswert). Empfehlung: Durchführung einer vereinfachten KNA nach dem Leitfaden des Umweltbundesamtes Ökonomische Bewertung von Klimaanpassungsmaßnahmen (UBA 2023), um die Wirtschaftlichkeit der Maßnahmen nachzuweisen und die Übertragbarkeit auf andere Kommunen zu stärken.

### 3.4 Praxispartner

Das Konsortium ist gut aufgestellt, aber es fehlen Wohnungsbaugesellschaften als Partner. Die Dachbegrünung von Bestandsgebäuden — eine der wirksamsten Einzelmaßnahmen — kann nur mit Kooperation der Gebäudeeigentümer umgesetzt werden. Empfehlung: Einbindung der kommunalen Wohnungsbaugesellschaft (WBG Musterstadt, 8.000 Wohneinheiten im Stadtgebiet) als assoziierter Partner, um die Dachbegrünung auf mindestens 5 Bestandsgebäuden im Pilotquartier zu realisieren.

## 4. Empfehlung

Der Antrag wird als **förderwürdig** bewertet. Die genannten Verbesserungsvorschläge (ENVI-met-Validierung mit Messstationen, sozioökonomische Vulnerabilitätsanalyse, Kosten-Nutzen-Analyse, Einbindung Wohnungsbaugesellschaft) sollten in den überarbeiteten Antrag aufgenommen werden. Das Projekt hat großes Potential, einen Beitrag zur praktischen Klimaanpassung in deutschen Kommunen zu leisten und als Blaupause für andere Städte zu dienen.

Gesamtnote: **1,7 (sehr gut bis gut)**. Empfehlung: **Förderung.**

## Zusammenfassung in einfacher Sprache

Eine Gutachterin hat den Antrag zur klimaangepassten Stadtplanung bewertet. Das Projekt will in zwei Stadtvierteln von Musterstadt Hitze-Brennpunkte mit Computermodellen finden und dann konkrete Gegenmassnahmen umsetzen, wie zum Beispiel Baeume pflanzen, Flaechen entsiegeln und Daecher begruenen. Die Gutachterin haelt den Ansatz fuer sehr gut, weil er Forschung und praktische Umsetzung verbindet. Sie empfiehlt aber, die Computerberechnungen mit echten Temperaturmessungen zu ueberpruefen und auch zu beruecksichtigen, in welchen Vierteln besonders viele gefaehrdete Menschen leben. Der Antrag wird mit der Note 1,7 zur Foerderung empfohlen.

_Prof. Dr.-Ing. Carla Klimaschutz, TU Dresden_`,
};
