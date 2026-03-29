import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-047',
  filename: 'Review_FA003.md',
  format: 'md',
  tags: ['Review', 'Ethik', 'Tierversuch'],
  created: '2026-02-25T10:00:00Z',
  vorgangId: 'FA-2026-003',
  markdown: `---
titel: Ethikvotum zum Förderantrag FA-2026-003 mRNA-Therapie bei chronisch-entzündlichen Darmerkrankungen
aktenzeichen: FA-2026-003
datum: 2026-02-25
gutachter: Tierschutzkommission der Universität Musterstadt
---

# Ethikvotum — FA-2026-003 mRNA-Therapie CED

## 1. Antragsprüfung

Die Tierschutzkommission der Universität Musterstadt hat den Tierversuchsantrag zum Projekt FA-2026-003 (mRNA-basierte Therapie bei chronisch-entzündlichen Darmerkrankungen) gemäß §15 TierSchG und der EU-Richtlinie 2010/63/EU geprüft. Der Antrag wurde von Prof. Dr. med. Katharina Immunstein eingereicht und umfasst zwei Tiermodelle: das DSS-Kolitis-Modell (akute Kolitis, induziert durch Dextran-Sodium-Sulfat im Trinkwasser) und das IL-10-Knockout-Mausmodell (spontane chronische Kolitis). Die geplante Gesamtzahl der Versuchstiere beträgt 144 Mäuse (C57BL/6J, weiblich, 8–10 Wochen alt bei Versuchsbeginn, Bezug: Charles River Laboratories, Sulzfeld).

## 2. Tierschutzrechtliche Bewertung

### 2.1 Schweregrad-Einschätzung

Das DSS-Kolitis-Modell wird als **mittel** belastend eingestuft (Schweregrad nach Artikel 15 EU-RL 2010/63/EU: moderate). Die Belastung umfasst: Gewichtsverlust von 10–20 Prozent des Körpergewichts über 7 Tage (durch Durchfall und Nahrungsverweigerung), blutigen Stuhl (ab Tag 4–5 der DSS-Gabe), reduzierte Aktivität und erhöhte Schmerzempfindlichkeit (viszeraler Schmerz durch Darmentzündung). Der Disease Activity Index (DAI) erreicht typischerweise Werte von 6–10 auf einer Skala von 0–12. Die erwartete Mortalität ohne Behandlung beträgt 5–10 Prozent bei der verwendeten DSS-Konzentration (3 Prozent). Mit den geplanten Endpunktkriterien (Abbruch bei DAI > 12, Gewichtsverlust > 20 Prozent, Blut im Stuhl Score 4 über 2 Tage, oder klinische Zeichen schwerer Dehydratation) wird die Mortalität auf < 2 Prozent reduziert.

Das IL-10-Knockout-Modell entwickelt spontan eine chronische Kolitis ab dem Alter von 10–12 Wochen, die in Schwere und Verlauf dem Morbus Crohn ähnelt. Die Belastung ist ebenfalls als **mittel** einzustufen, da die Tiere chronischen Durchfall, Gewichtsverlust und abdominale Beschwerden entwickeln, die über Wochen anhalten können. Die Tiere werden engmaschig überwacht (tägliches Scoring), um unnötiges Leiden zu vermeiden.

### 2.2 Humane Endpunkte

Die Abbruchkriterien (humane Endpunkte) sind klar definiert und entsprechen den Empfehlungen der GV-SOLAS (Gesellschaft für Versuchstierkunde): Gewichtsverlust > 20 Prozent des Ausgangsgewichts, DAI-Score > 12 über 24 Stunden (persistent), Rektaler Prolaps (irreversibel, sofortige Euthanasie), Selbstverstümmelungsverhalten oder anhaltende Apathie (keine Reaktion auf Berührung), Körpertemperatur < 33°C (Hypothermie als Zeichen terminaler Dekompensation). Die Euthanasie erfolgt durch CO₂-Inhalation in steigender Konzentration gefolgt von Genickbruch als Bestätigungsmethode (nach AVMA Guidelines for the Euthanasia of Animals, 2020 Edition). Die Schmerzbehandlung während des Versuchs umfasst: Metamizol im Trinkwasser (200 mg/kg/d, ab DAI ≥ 6) und Buprenorphin s.c. (0,05 mg/kg, alle 12 Stunden) bei Anzeichen starker Schmerzen (Pressen, Zähneknirschen, gewölbter Rücken). Die Tierschutzkommission begrüßt den proaktiven Schmerzmanagement-Ansatz.

## 3. 3R-Bewertung

### 3.1 Replace (Ersetzen)

Die Antragstellerin hat eine umfangreiche Alternativmethoden-Recherche durchgeführt (Dokumentation: 12 Seiten, Literaturrecherche in PubMed, ALTEX-Datenbank und Norecopa). Intestinale Organoide (Mini-Darm-Kulturen aus Stammzellen) werden im Projekt für die In-vitro-Vorscreenings der LNP-Formulierungen eingesetzt — die 3 besten Formulierungen aus dem In-vitro-Screening gehen in den Tierversuch, die restlichen Kandidaten werden ohne Tierversuch eliminiert. Das Organoid-Modell kann jedoch den Tierversuch nicht vollständig ersetzen, da es die systemische Immunantwort, die Darmbarrierefunktion im Gesamtorganismus und die Pharmakokinetik der oral verabreichten LNP nicht abbildet. Die Kommission stimmt zu, dass ein vollständiger Ersatz des Tierversuchs zum aktuellen Zeitpunkt nicht möglich ist, und bewertet die Nutzung von Organoiden als Vorstufe positiv.

### 3.2 Reduce (Reduzieren)

Die Gruppengröße wurde mit G*Power 3.1 berechnet (t-Test, zweiseitig, Effektstärke d = 1,2 basierend auf Vorversuchen mit dem DSS-Modell im Labor der Antragstellerin, α = 0,05, Power 1-β = 0,80). Ergebnis: n = 12 pro Gruppe. Bei 6 Gruppen (DSS-Modell): 72 Tiere. Beim IL-10-KO-Modell: ebenfalls 6 Gruppen à 12 = 72 Tiere. Gesamt: 144 Tiere. Die Kommission prüft die Fallzahlberechnung und bestätigt, dass n = 12 pro Gruppe angemessen ist — eine kleinere Gruppengröße würde die Power unter 0,80 senken und das Risiko eines falsch-negativen Ergebnisses erhöhen (Typ-II-Fehler), was im schlimmsten Fall einen zweiten Tierversuch mit mehr Tieren erfordern würde.

Zusätzlich plant die Antragstellerin ein sequentielles Design: Nach den ersten 24 Tieren (Pilotstudie) wird eine Interimsanalyse durchgeführt. Bei klarer Wirksamkeit (p < 0,001) oder klarer Unwirksamkeit (keine Tendenz in Richtung des Behandlungseffekts) wird der Versuch vorzeitig beendet und die restlichen Tiere nicht eingesetzt. Dieses adaptive Design kann die Tierzahl im Idealfall um 30–50 Prozent reduzieren und wird von der Kommission ausdrücklich befürwortet.

### 3.3 Refine (Verfeinern)

Die Verfeinerungsmaßnahmen umfassen: Einzel- oder Paarhaltung in IVC-Käfigen (Individually Ventilated Cages, Tecniplast GM500) mit Nestmaterial (Nestlets), Tunnel und Häuschen (Environmental Enrichment nach EU-RL 2010/63/EU Anhang III). Handling durch geschulte Tierpfleger (Tunnel-Handling statt Schwanzgriff, stressreduziert nach Hurst & West 2010). Tägliches Scoring mit dem Maus-Grimace-Scale (MGS) zusätzlich zum DAI — die MGS erfasst Schmerzen anhand der Gesichtsmimik der Maus (Orbital Tightening, Nose Bulge, Cheek Bulge, Ear Position, Whisker Change) und ermöglicht eine frühzeitigere Schmerzintervention als klinische Scores allein. Isoflurananästhesie (2–3 Prozent in O₂) bei allen invasiven Prozeduren (orale Gavage, Blutentnahme retrobulbär, Koloskopie). Aufwachphase auf Wärmeplatte (37°C) mit Überwachung bis zur vollständigen Wiederherstellung der Mobilität.

## 4. GLP-Konformität

Die präklinischen Studien werden GLP-konform (Good Laboratory Practice nach EU-Richtlinie 2004/10/EG und OECD-Grundsätze der GLP) durchgeführt. Dies ist für die spätere IND-Einreichung (Investigational New Drug) bei der EMA/BfArM unerlässlich. Die GLP-Konformität umfasst: Studienplan (Study Plan) mit detaillierter Beschreibung aller Prozeduren, Qualitätssicherungseinheit (QAU) des Tierversuchszentrums prüft die Einhaltung des Studienplans und die Datenintegrität, standardisierte Arbeitsanweisungen (SOPs) für alle Prozeduren (Dosierung, Scoring, Probennahme, Euthanasie, Organentnahme), Audit-Trail für alle Rohdaten (elektronisches Laborbuch, eLab Journal, mit Zeitstempel und Bearbeiterkennung) und Archivierung der Studienmaterialien (Gewebeproben, Histologie-Schnitte, Rohdaten) für mindestens 15 Jahre.

## 5. Empfehlung

Die Tierschutzkommission empfiehlt die **Genehmigung des Tierversuchsantrags** mit folgenden Auflagen: (1) Durchführung der Interimsanalyse nach 24 Tieren — bei eindeutigem Ergebnis vorzeitiger Abbruch und Einsparung der restlichen Tiere. (2) Erweiterung des Scorings um den Maus-Grimace-Scale (MGS) ab Tag 1 (im Antrag erst ab Tag 3 vorgesehen — die Kommission hält einen früheren Beginn für sinnvoll). (3) Dokumentation aller unerwarteten Todesfälle und Abbrüche mit Obduktionsbericht innerhalb von 48 Stunden. (4) Jährlicher Zwischenbericht an die Tierschutzkommission mit Angabe der tatsächlich verwendeten Tierzahl, der Schweregrad-Verteilung und der aufgetretenen humanen Endpunkte.

Die Genehmigung nach §8 TierSchG ist durch die zuständige Behörde (LANUV NRW, Recklinghausen) zu erteilen. Die Tierschutzkommission unterstützt den Antrag mit einer positiven Stellungnahme.

Musterstadt, den 25.02.2026

_Prof. Dr. med. vet. Hans Tierschutz, Vorsitzender der Tierschutzkommission_`,
};
