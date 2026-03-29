import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-038',
  filename: 'Projekt_FA003.md',
  format: 'md',
  tags: ['mRNA', 'Medizin', 'Immunologie'],
  created: '2026-01-15T10:00:00Z',
  vorgangId: 'FA-2026-003',
  markdown: `---
titel: mRNA-basierte Therapie bei chronisch-entzündlichen Darmerkrankungen
aktenzeichen: FA-2026-003
datum: 2026-01-15
antragsteller: Prof. Dr. med. Katharina Immunstein, Institut für Translationale Immunologie, Universitätsklinikum Musterstadt
---

# mRNA-basierte Therapie bei chronisch-entzündlichen Darmerkrankungen

## 1. Medizinische Problemstellung

Chronisch-entzündliche Darmerkrankungen (CED), insbesondere Morbus Crohn und Colitis ulcerosa, betreffen weltweit über 6,8 Millionen Menschen, in Deutschland sind es mehr als 400.000 Patienten (Prävalenz 480 pro 100.000 Einwohner, Tendenz steigend). Die Erkrankungen sind durch eine chronische, schubweise verlaufende Entzündung der Darmmukosa gekennzeichnet, die zu Bauchschmerzen, blutigen Durchfällen, Gewichtsverlust und bei Morbus Crohn zu Fisteln und Stenosen führt. Die Pathophysiologie ist multifaktoriell: Eine genetische Prädisposition (über 240 Risikogene identifiziert, darunter NOD2, ATG16L1 und IL23R) führt in Kombination mit Umweltfaktoren (Dysbiose des Darmmikrobioms, westliche Ernährung, Rauchen) zu einer überschießenden Immunantwort gegen die kommensale Darmflora. Zentrale Mediatoren der Entzündung sind pro-inflammatorische Zytokine: TNF-α, IL-12/23, IL-6 und Interferon-γ, die von aktivierten Makrophagen, dendritischen Zellen und T-Zellen in der Lamina propria sezerniert werden.

Die aktuelle Standardtherapie umfasst: 5-Aminosalicylsäure (Mesalazin) für leichte Schübe, Kortikoide (Prednisolon, Budesonid) für mittlere Schübe, Immunsuppressiva (Azathioprin, Methotrexat) zur Remissionserhaltung und Biologika (Anti-TNF: Infliximab, Adalimumab; Anti-Integrin: Vedolizumab; Anti-IL-12/23: Ustekinumab) für therapierefraktäre Verläufe. Trotz dieser Optionen zeigen 30–40 Prozent der Patienten ein primäres Nichtansprechen auf Biologika, weitere 20–30 Prozent entwickeln sekundäre Resistenz (Antikörperbildung gegen das Biologikum). Die klinische Remissionsrate unter optimaler Biologika-Therapie beträgt nur 40–60 Prozent — ein erheblicher Anteil der Patienten bleibt unzureichend behandelt. Die Kosten der Biologika-Therapie belaufen sich auf 15.000–30.000 Euro pro Patient und Jahr und stellen eine zunehmende Belastung für das Gesundheitssystem dar.

## 2. Innovativer Therapieansatz: mRNA-Lipid-Nanopartikel

### 2.1 Konzept

Der in diesem Projekt verfolgte Ansatz nutzt mRNA-beladene Lipid-Nanopartikel (LNP) zur gezielten Expression von anti-inflammatorischen Zytokinen in der entzündeten Darmmukosa. Im Gegensatz zu rekombinant hergestellten Proteintherapeutika (Biologika), die systemisch verabreicht werden und im gesamten Körper wirken, ermöglicht der mRNA-LNP-Ansatz eine lokale, transiente Zytokinexpression direkt am Entzündungsort. Die Vorteile sind: Lokale Wirkung — die mRNA wird von den Zellen der Darmmukosa aufgenommen und translatiert, das Zytokin wirkt parakrin im Entzündungsherd, systemische Nebenwirkungen (Immunsuppression, Infektionsrisiko) werden minimiert. Transiente Expression — die mRNA wird innerhalb von 24–72 Stunden abgebaut, die Zytokinproduktion ist selbstlimitierend und dosisabhängig steuerbar. Kein Risiko der Genomintegration — mRNA wird im Zytoplasma translatiert und gelangt nicht in den Zellkern. Schnelle Produktion — mRNA kann innerhalb von Wochen synthetisiert werden (Beispiel: COVID-19-Impfstoffe), neue Sequenzen können ohne aufwändige Zellkultursysteme hergestellt werden.

### 2.2 Zielproteine

Das Projekt fokussiert auf zwei anti-inflammatorische Zytokine: Interleukin-10 (IL-10) — das wichtigste immunsuppressive Zytokin, das Makrophagen und dendritische Zellen deaktiviert und die Produktion pro-inflammatorischer Zytokine hemmt. Klinische Studien mit rekombinantem IL-10 (Tenovil, Schering-Plough) zeigten moderate Wirksamkeit bei CED, scheiterten aber an systemischen Nebenwirkungen (Anämie, Thrombozytopenie) und kurzer Halbwertszeit (2–4 Stunden). Transforming Growth Factor-β (TGF-β) — fördert die Differenzierung regulatorischer T-Zellen (Tregs) und die Geweberegeneration der Darmmukosa. TGF-β ist ein potenter Immunsuppressor, der bei systemischer Gabe jedoch fibrotische Nebenwirkungen hervorruft — ein weiterer Grund für den lokalen Ansatz.

### 2.3 LNP-Formulierung mit Colon-Targeting

Die LNP-Formulierung wird für die orale Gabe optimiert und mit einem Colon-Targeting-System versehen: Die LNP bestehen aus einer ionisierbaren Lipidkomponente (MC3 oder proprietäre Alternative), DSPC (Phospholipid), Cholesterol und PEG-Lipid (Standardformulierung analog zu Onpattro/BNT162b2). Die LNP werden in eine enterische Beschichtung (Eudragit S100, pH-Schwellenwert 7,0) eingebettet, die im Magen und Dünndarm stabil ist und sich erst im terminalen Ileum und Colon auflöst (pH 7,0–7,4). Die Oberfläche der LNP wird zusätzlich mit Mannose-Liganden funktionalisiert, die selektiv an Mannose-Rezeptoren (CD206) auf intestinalen Makrophagen binden und die zelluläre Aufnahme der LNP in die Zielzellen (CX3CR1⁺-Makrophagen in der Lamina propria) um den Faktor 5–10 steigern (basierend auf In-vitro-Daten mit Mannose-funktionalisierten LNP an THP-1-Makrophagen, publiziert von unserer Gruppe in ACS Nano 2024).

## 3. Präklinische Studien

### 3.1 Tiermodell: DSS-Kolitis

Das DSS-Kolitis-Modell (Dextran-Sodium-Sulfat) in C57BL/6 Mäusen ist das am besten etablierte Modell für Colitis ulcerosa. DSS (3 Prozent, Mr 40 kDa, MP Biomedicals) wird über 7 Tage im Trinkwasser verabreicht und verursacht eine akute Kolitis mit Gewichtsverlust, blutigem Stuhl, Kryptenabszessen und Mukosaschädigung. Primäre Endpunkte: Disease Activity Index (DAI, Scoring: Gewichtsverlust 0–4, Stuhlkonsistenz 0–4, Blut im Stuhl 0–4, maximal 12 Punkte), histologischer Score (Mukosaschädigung nach Dieleman 0–40 Punkte), Zytokinprofil in der Mukosa (IL-10, TGF-β, TNF-α, IL-6, IL-17A per Multiplex-ELISA). Sekundäre Endpunkte: Colonlänge (Verkürzung als Entzündungsmaß), Gewichtsveränderung (tägliche Wägung), Überlebensrate.

### 3.2 Studiendesign

Die Studie umfasst 6 Gruppen à 12 Mäuse (n = 72 gesamt, plus 48 Kontrollmäuse): Gruppe 1 (Negativkontrolle): Wasser statt DSS. Gruppe 2 (Positivkontrolle): DSS + Vehikel (leere LNP in enterischer Kapsel). Gruppe 3: DSS + IL-10-mRNA-LNP niedrige Dosis (0,1 mg/kg, oral, Tag 1, 3, 5). Gruppe 4: DSS + IL-10-mRNA-LNP hohe Dosis (0,5 mg/kg). Gruppe 5: DSS + TGF-β-mRNA-LNP (0,5 mg/kg). Gruppe 6: DSS + IL-10/TGF-β-Kombination (je 0,25 mg/kg). Die Auswertung erfolgt an Tag 8 (Opferung, histologische Analyse, Zytokinquantifizierung) und an Tag 21 (Erholungsphase, Bewertung der Mukosal Heilung).

### 3.3 IL-10-Knockout-Modell

Ergänzend wird das IL-10⁻/⁻-Knockout-Mausmodell verwendet, das eine spontane chronische Kolitis entwickelt (ähnlich Morbus Crohn). In diesem Modell wird die Wirksamkeit der TGF-β-mRNA-LNP ohne den konfundierenden Effekt von endogenem IL-10 untersucht. Die Behandlung beginnt im Alter von 8 Wochen (vor Symptombeginn, präventiv) und 16 Wochen (nach Symptombeginn, therapeutisch). Endpunkte: DAI, Histologie, T-Zell-Phänotypisierung (Treg-Anteil in der Lamina propria per Durchflusszytometrie: CD4⁺/CD25⁺/FoxP3⁺).

## 4. Sicherheitsbewertung und regulatorischer Pfad

### 4.1 Toxikologie

Die präklinische Toxikologie umfasst: Akute Toxizität (Einmalgabe, 10-fache therapeutische Dosis, Maus, 14 Tage Beobachtung), Repeat-Dose-Toxizität (tägliche Gabe über 28 Tage, Maus und Ratte, klinische Chemie, Hämatologie, Histopathologie aller Organe), Lokale Verträglichkeit (Reizung der Darmmukosa nach chronischer oraler Gabe, histologische Bewertung), Immunogenität (Anti-PEG-Antikörper, da PEG-Lipid eine bekannte Immunogenitätsfrage aufwirft — Messung per ELISA nach 4 Wochen Therapie). Die Toxikologiestudien werden GLP-konform (Good Laboratory Practice nach EU-Richtlinie 2004/10/EG) durchgeführt, um die Daten direkt für die IND-Einreichung verwenden zu können.

### 4.2 Translation in die Klinik

Der regulatorische Pfad für eine Phase-I-Studie ist: Ethikvotum (positive Stellungnahme der zuständigen Ethikkommission liegt als Anlage bei, Az. EK-2026-012), Genehmigung durch das Bundesinstitut für Arzneimittel und Medizinprodukte (BfArM) als klinische Prüfung nach §40 AMG, EudraCT-Registrierung und clinicaltrials.gov-Registrierung. Das Phase-I-Design: Open-label, Dosis-Eskalation (3+3 Design), 3 Dosisstufen (0,1, 0,3, 1,0 mg/kg oral, einmal wöchentlich über 8 Wochen), 18 Patienten mit aktiver Colitis ulcerosa (Mayo-Score 6–12) und Therapieversagen auf mindestens ein Biologikum. Primärer Endpunkt: Sicherheit und Verträglichkeit (adverse Events, Laborparameter). Sekundärer Endpunkt: Klinisches Ansprechen (Mayo-Score-Reduktion ≥ 3 Punkte). Die Phase-I-Studie wird am Universitätsklinikum Musterstadt durchgeführt (Principal Investigator: Prof. Dr. med. Katharina Immunstein).

## 5. Arbeitspakete und Zeitplan (36 Monate)

AP 1 (Monat 1–8): LNP-Formulierung — Optimierung der Mannose-Funktionalisierung, enterische Beschichtung, In-vitro-Charakterisierung (Partikelgröße, Zetapotential, Encapsulation Efficiency, Mannose-Bindungsassay an THP-1-Makrophagen). AP 2 (Monat 6–18): DSS-Kolitis-Studie — Tierversuch nach Ethikvotum, histologische Auswertung, Zytokinprofil. AP 3 (Monat 12–24): IL-10-KO-Studie — Präventive und therapeutische Behandlung, T-Zell-Phänotypisierung. AP 4 (Monat 18–30): Toxikologie — GLP-Studien (akut, subchronisch, Immunogenität). AP 5 (Monat 24–36): IND-Vorbereitung — Regulatory Package, CMC-Dokumentation, Investigator's Brochure, Phase-I-Protokoll. Personalkosten (2 Postdocs, 1 Doktorand/in, 1 MTA): 680.000 Euro. Sachmittel (mRNA-Synthese, LNP-Herstellung, Tierversuche, GLP-Studien, Analytik): 420.000 Euro. Gesamtkosten: 1.100.000 Euro.

Musterstadt, den 15.01.2026

_Prof. Dr. med. Katharina Immunstein, Universitätsklinikum Musterstadt_`,
};
