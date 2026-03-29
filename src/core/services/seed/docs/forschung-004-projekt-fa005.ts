import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-039',
  filename: 'Projekt_FA005.md',
  format: 'md',
  tags: ['eDNA', 'Biodiversität', 'Monitoring'],
  created: '2026-01-18T10:00:00Z',
  vorgangId: 'FA-2026-005',
  markdown: `---
titel: Urbane Biodiversität mittels eDNA-Metabarcoding — Standardisierte Erfassung aquatischer Artengemeinschaften in Stadtgewässern
aktenzeichen: FA-2026-005
datum: 2026-01-18
antragsteller: Prof. Dr. rer. nat. Felix Genpool, Institut für Ökologie und Evolution, Universität Musterstadt
---

# Urbane Biodiversität mittels eDNA-Metabarcoding

## 1. Hintergrund und Forschungsbedarf

Städtische Gewässer — Teiche, Bäche, Kanäle und Regenrückhaltebecken — sind Hotspots urbaner Biodiversität, aber gleichzeitig einem enormen Nutzungsdruck ausgesetzt. Die Kenntnis der aquatischen Artengemeinschaften ist Voraussetzung für ein evidenzbasiertes Naturschutzmanagement, doch die konventionelle Erfassung durch Experten (Elektrobefischung, Makrozoobenthos-Beprobung, Amphibien-Kartierung) ist personal- und zeitintensiv, erfordert Spezialistenwissen für verschiedene Artengruppen und erzeugt bei seltenen Arten häufig unvollständige Datensätze.

Environmental DNA (eDNA) bietet einen revolutionären Ansatz: Jedes Lebewesen gibt DNA-Spuren an seine Umgebung ab — über Hautschuppen, Kot, Urin, Schleim oder verwesendes Gewebe. Diese DNA-Fragmente sind im Wasser für 1–14 Tage nachweisbar (je nach Temperatur, UV-Strahlung und pH-Wert) und können mittels Metabarcoding — der gleichzeitigen Amplifikation und Sequenzierung artspezifischer DNA-Regionen — identifiziert werden. Eine einzige Wasserprobe von 1 Liter kann Hunderte von Arten gleichzeitig erfassen, von Fischen über Amphibien und Insektenlarven bis zu Pilzen und Algen. Die Methode ist nicht-invasiv (keine Tiere werden gefangen oder gestört), hochempfindlich (Nachweis von Arten mit geringer Dichte, die bei konventioneller Kartierung übersehen werden) und standardisierbar (gleiche Protokolle an verschiedenen Standorten und zu verschiedenen Zeiten).

## 2. Projektziele

Das Projekt verfolgt drei Hauptziele: (1) Etablierung einer standardisierten eDNA-Metabarcoding-Pipeline für urbane Gewässer, die von kommunalen Umweltämtern ohne Spezialkenntnisse in Molekularbiologie eingesetzt werden kann (Probennahme als Feldprotokoll, Laboranalyse über einen zertifizierten Dienstleister, Datenauswertung über ein webbasiertes Dashboard). (2) Durchführung einer flächendeckenden Biodiversitätserfassung an 50 Standorten in 5 deutschen Großstädten (Musterstadt, Dortmund, Hannover, Leipzig, Freiburg) über 12 Monate (monatliche Beprobung), um saisonale Dynamiken und stadtklimatische Einflüsse auf die aquatische Biodiversität zu erfassen. (3) Vergleich der eDNA-Ergebnisse mit konventionellen Kartierungsmethoden an 10 Referenzstandorten, um die Übereinstimmung, Sensitivität und Spezifität der eDNA-Methode zu quantifizieren.

## 3. Methodik

### 3.1 Probennahme

An jedem der 50 Standorte werden monatlich 3 Wasserproben à 1 Liter entnommen (Triplikat für statistische Absicherung). Die Probennahme folgt einem standardisierten Protokoll: Probennahme mit sterilen Einweg-Plastikflaschen, Entnahme an 3 Stellen des Gewässers (Ufer, Mitte, Zufluss) und Mischung, Transport in Kühlbox (4°C) innerhalb von 6 Stunden ins Labor, Filtration über Glasfaser-Filter (GF/F, Porengröße 0,7 µm, Whatman) mit einer Vakuum-Filtrationseinheit (Gesamtvolumen 3 Liter je Standort, aufgeteilt auf 3 Filter als Triplikat). Die Filter werden in Lysepuffer (Qiagen DNeasy Blood & Tissue Kit) überführt und bei -20°C gelagert bis zur DNA-Extraktion. Jeder Probennahme-Durchgang wird von einer Negativkontrolle (steriles Wasser, gleiche Prozedur) begleitet, um Kontaminationen zu detektieren.

### 3.2 DNA-Extraktion und PCR-Amplifikation

Die DNA-Extraktion erfolgt mit dem Qiagen DNeasy Blood & Tissue Kit nach einem modifizierten Protokoll für eDNA (verlängerte Proteinase-K-Verdauung 12 Stunden, doppelte Elution mit 100 µl Puffer AE). Die Konzentration und Reinheit der extrahierten DNA wird mit einem NanoDrop 2000 (A260/A280 ≥ 1,7) und einem Qubit 4 Fluorometer quantifiziert. Die PCR-Amplifikation verwendet 3 Primer-Sets für verschiedene taxonomische Gruppen: COI (Cytochrom-c-Oxidase Untereinheit I) mit den Primern mlCOIintF/jgHCO2198 (Leray et al. 2013) für Makro-Invertebraten (Insektenlarven, Krebstiere, Schnecken), 12S (mitochondriales 12S rRNA-Gen) mit den Primern 12SV5-F/12SV5-R (Riaz et al. 2011) für Vertebraten (Fische, Amphibien) und ITS2 (Internal Transcribed Spacer 2) mit den Primern fITS7/ITS4 (Ihrmark et al. 2012) für Pilze. Jedes Primer-Set enthält Illumina-Adapter-Sequenzen (overhang) für die direkte Library-Präparation nach der PCR.

### 3.3 Sequenzierung und Bioinformatik

Die PCR-Produkte werden über eine Indexierungs-PCR (Nextera XT Index Kit, 96 Index-Kombinationen) mit eindeutigen Barcodes versehen und auf einem Illumina MiSeq (2 × 300 bp Paired-End, V3-Chemie) sequenziert. Die erwartete Sequenziertiefe beträgt 50.000 Reads pro Probe und Marker (insgesamt: 50 Standorte × 12 Monate × 3 Replikate × 3 Marker = 5.400 Bibliotheken, aufgeteilt auf 15 MiSeq-Läufe). Die bioinformatische Auswertung verwendet die DADA2-Pipeline (Callahan et al. 2016, Nature Methods) für die Fehlerkorrektur und ASV-Generierung (Amplicon Sequence Variants), gefolgt von der taxonomischen Zuordnung gegen die BOLD-Referenzdatenbank (Barcode of Life Data System, > 14 Millionen Referenzsequenzen) für COI und 12S, sowie die UNITE-Datenbank für ITS2. Die taxonomische Zuordnung erfolgt mit einem Bayes'schen Klassifikator (RDP Classifier, Konfidenz ≥ 0,80 für Artniveau, ≥ 0,95 für Gattungsniveau).

### 3.4 Referenz-Kartierung

An 10 der 50 Standorte (2 je Stadt) wird parallel zur eDNA-Beprobung eine konventionelle Kartierung durchgeführt: Elektrobefischung (Fische, nach DIN EN 14011), Makrozoobenthos-Beprobung (nach AQEM-Methode, Surber-Sampler), Amphibien-Kartierung (Sichtbeobachtung, Keschern, Rufkartierung), Pilz-Fruchtbody-Kartierung (visuell, an 3 Terminen). Der Vergleich eDNA vs. konventionell wird über folgende Metriken bewertet: Artübereinstimmung (Jaccard-Index), Sensitivität der eDNA (Anteil der konventionell nachgewiesenen Arten, die auch per eDNA gefunden werden), Spezifität (Anteil der eDNA-Nachweise, die konventionell bestätigt werden können) und Zusatzarten (Arten, die nur per eDNA nachgewiesen werden, nicht konventionell).

## 4. Monitoring-Dashboard

### 4.1 Web-Anwendung

Ein zentrales Projektergebnis ist das eDNA-Monitoring-Dashboard — eine webbasierte Anwendung (React-Frontend, Python/FastAPI-Backend, PostgreSQL-Datenbank), die kommunalen Umweltämtern die Visualisierung und Analyse der Biodiversitätsdaten ermöglicht. Funktionen: Interaktive Karte der Probennahme-Standorte mit Artenlistenfilter, Zeitreihen-Darstellung der Artenzahl und Diversitätsindizes (Shannon-Index, Simpson-Index) je Standort, Vergleichsansicht zwischen Standorten und Städten, Automatische Erkennung von Rote-Liste-Arten und Neobiota (invasive Arten), Alert-System bei Erstnachweis invasiver Arten (z.B. Signalkrebs, Schwarzmundgrundel), Export der Daten als CSV und Artenlisten als PDF-Bericht für die kommunale Berichtspflicht.

### 4.2 Datenmanagement

Die Sequenzdaten werden im European Nucleotide Archive (ENA) archiviert (Open Access). Die Artenlisten und Standortdaten werden über GBIF (Global Biodiversity Information Facility) veröffentlicht. Das Dashboard-Backend implementiert die FAIR-Prinzipien (Findable, Accessible, Interoperable, Reusable). Die Probennahme-Metadaten folgen dem MIxS-Standard (Minimum Information about any (x) Sequence, Genomic Standards Consortium).

## 5. Arbeitspakete und Personal

AP 1 (Monat 1–6): Protokollentwicklung und Pilotierung (10 Standorte, Musterstadt). AP 2 (Monat 4–18): Flächendeckende Beprobung (50 Standorte, 5 Städte, monatlich). AP 3 (Monat 6–20): Laboranalyse (DNA-Extraktion, PCR, Sequenzierung). AP 4 (Monat 12–24): Bioinformatik und Datenanalyse. AP 5 (Monat 8–24): Referenz-Kartierung an 10 Standorten. AP 6 (Monat 12–30): Dashboard-Entwicklung. AP 7 (Monat 24–36): Publikation und Verwertung.

Personal: 1 Postdoc Molekulare Ökologie (TV-L E14, 100 Prozent), 1 Doktorand/in Bioinformatik (TV-L E13, 100 Prozent), 1 Softwareentwickler/in Dashboard (TV-L E13, 50 Prozent), 2 studentische Hilfskräfte (Feldarbeit, Laborassistenz). Kooperationspartner: 5 kommunale Umweltämter (Probennahme-Unterstützung, Kartierungsdaten), Sequenzierplattform CeBiTec Bielefeld (MiSeq-Kapazität). Gesamtkosten: 850.000 Euro (36 Monate).

## 6. Erwartete Ergebnisse und gesellschaftlicher Nutzen

Das Projekt wird die erste flächendeckende, standardisierte eDNA-basierte Biodiversitätserfassung urbaner Gewässer in Deutschland liefern. Erwartete wissenschaftliche Ergebnisse: Artenliste von geschätzt 500–800 Arten (Fische, Amphibien, Invertebraten, Pilze) aus 50 Stadtgewässern, saisonale Dynamiken der Artengemeinschaften und deren Korrelation mit Wassertemperatur, Nährstoffgehalt und Versiegelungsgrad im Einzugsgebiet, Nachweis invasiver Arten in Echtzeit und Validierungsdaten für die behördliche Anerkennung der eDNA-Methode im Gewässermonitoring nach EU-Wasserrahmenrichtlinie. Der gesellschaftliche Nutzen liegt in der Bereitstellung eines kosteneffizienten Monitoring-Tools (geschätzte Kosten: 150 Euro je Probe inklusive Laboranalyse, verglichen mit 2.000–5.000 Euro für eine konventionelle Komplettkartierung), das die Kommunen in die Lage versetzt, ihre Gewässer-Biodiversität regelmäßig zu überwachen und Maßnahmen des Naturschutzes evidenzbasiert zu priorisieren.

Musterstadt, den 18.01.2026

_Prof. Dr. rer. nat. Felix Genpool, Universität Musterstadt_`,
};
