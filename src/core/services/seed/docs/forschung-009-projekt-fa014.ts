import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-044',
  filename: 'Projekt_FA014.md',
  format: 'md',
  tags: ['LLM', 'Verwaltung', 'RAG'],
  created: '2026-02-01T10:00:00Z',
  vorgangId: 'FA-2026-014',
  markdown: `---
titel: Verwaltungsautomation mit Sprachmodellen — RAG-System für kommunale Genehmigungsverfahren
aktenzeichen: FA-2026-014
datum: 2026-02-01
antragsteller: Prof. Dr.-Ing. Tobias Algorithmus, Lehrstuhl für Angewandte Informatik, TU Musterstadt
---

# Verwaltungsautomation mit Sprachmodellen

## 1. Ausgangslage und Motivation

Kommunale Verwaltungen in Deutschland bearbeiten jährlich Millionen von Genehmigungsverfahren: Baugenehmigungen, Gewerbeanmeldungen, Gaststättenkonzessionen, Sondernutzungserlaubnisse, Umweltgenehmigungen und zahlreiche weitere Verwaltungsakte. Allein im Bereich der Baugenehmigungen werden jährlich ca. 220.000 Anträge gestellt (Destatis 2024), deren Bearbeitungsdauer durchschnittlich 8–12 Wochen beträgt — deutlich über der gesetzlichen Frist von 3 Monaten (§75 VwGO). Die Hauptursachen für die langen Bearbeitungszeiten sind: Personalmangel (die kommunalen Bauaufsichtsämter haben bundesweit ca. 15 Prozent unbesetzte Stellen), die Komplexität der Rechtslage (Zusammenspiel von BauO, BauGB, BauNVO, GEG, DIN-Normen und kommunaler Satzung), die manuelle Prüfung umfangreicher Bauvorlagen (Formulare, Pläne, Nachweise — ein durchschnittlicher Bauantrag umfasst 50–100 Seiten) und die textlastige Bescheiderstellung (Begründung, Auflagen, Rechtsbelehrung — typisch 8–15 Seiten).

Large Language Models (LLM) haben seit 2022 eine Leistungsfähigkeit erreicht, die eine sinnvolle Unterstützung bei textbasierten Verwaltungsaufgaben ermöglicht. Insbesondere Retrieval-Augmented Generation (RAG) — die Kombination eines LLM mit einer externen Wissensbasis — erlaubt die Generierung faktenbasierter, quellengestützter Texte, die über das Trainingswissen des Modells hinausgehen. Das vorliegende Projekt entwickelt ein RAG-System, das Sachbearbeiter bei der Prüfung von Bauanträgen und der Erstellung von Genehmigungsbescheiden unterstützt.

## 2. Technischer Ansatz

### 2.1 RAG-Architektur

Das System besteht aus vier Komponenten: (1) Wissensbasis — ein Vektorstore (ChromaDB, Open Source), der die kommunalen Rechtsnormen, Verwaltungsvorschriften und Musterbescheide als semantische Embeddings (768-dimensionale Vektoren, Modell: E5-large-v2) speichert. Die Wissensbasis umfasst: BauO NRW (vollständig), BauGB und BauNVO (vollständig), kommunale Satzungen der Pilotkommune (Bebauungspläne, Stellplatzsatzung, Gestaltungssatzung), GEG 2024 und zugehörige DIN-Normen (relevante Auszüge), Musterbescheide (200 anonymisierte Baugenehmigungen der letzten 5 Jahre), Verwaltungsvorschriften und Erlasse (Runderlass des MBWSV NRW, technische Baubestimmungen). Gesamtumfang: ca. 12.000 Textseiten, segmentiert in 45.000 Chunks à 500 Tokens mit 100 Token Overlap.

(2) Retriever — bei einer Anfrage (z.B. Prüfung der Abstandsflächen eines konkreten Bauantrags) werden die relevantesten Chunks aus der Wissensbasis über semantische Ähnlichkeitssuche (Cosine Similarity, Top-k = 10) abgerufen. Zusätzlich wird ein BM25-Retriever für exakte Stichwortsuche (Paragraphen-Nummern, DIN-Bezeichnungen) eingesetzt. Die Ergebnisse beider Retriever werden über Reciprocal Rank Fusion (RRF) kombiniert, um sowohl semantisch ähnliche als auch exakt passende Dokumente zu finden.

(3) LLM-Generator — ein lokal betriebenes Open-Source-Sprachmodell (Llama 3.1 70B, quantisiert auf 4-bit GPTQ, Inferenz auf 2 × NVIDIA A100 80GB) generiert den Antworttext unter Berücksichtigung der abgerufenen Kontextdokumente. Das Modell wird über LoRA-Fine-Tuning (Low-Rank Adaptation, Rank 16, Alpha 32) auf 500 annotierte Verwaltungstexte (Bescheide, Stellungnahmen, Nachforderungsschreiben) fein-getuned, um den Sprachstil und die Fachterminologie der Verwaltung zu erlernen. Die Inferenzparameter sind: Temperature 0,3 (niedrig für deterministische, sachliche Ausgabe), Top-p 0,9, max. Tokenlänge 4.096.

(4) Quellennachweis — jede generierte Aussage wird mit der Quellenangabe des zugrundeliegenden Chunks versehen (Paragraphen-Referenz, Seitenzahl, Dokumentname). Der Sachbearbeiter kann die Quelle mit einem Klick aufrufen und die Richtigkeit der generierten Aussage verifizieren. Dieses Transparenzmerkmal ist für die rechtssichere Verwendung im Verwaltungsverfahren unerlässlich.

### 2.2 On-Premise-Deployment

Das gesamte System wird ausschließlich auf kommunalen Servern betrieben (On-Premise). Es findet kein Datentransfer in die Cloud oder an Drittanbieter statt. Die Serverinfrastruktur umfasst: 1 GPU-Server (Dell PowerEdge R750xa, 2 × NVIDIA A100 80GB, 512 GB RAM, 8 TB NVMe SSD) für die LLM-Inferenz, 1 Applikationsserver (Dell PowerEdge R650, 64 Core, 256 GB RAM) für die RAG-Pipeline, Retriever und Web-Frontend, 1 Datenbankserver (Dell PowerEdge R450, 32 Core, 128 GB RAM, 16 TB RAID-10) für ChromaDB und die Antragsakte. Die Server stehen im Rechenzentrum der Stadtverwaltung Musterstadt (BSI-Grundschutz zertifiziert, redundante Stromversorgung, Zutrittskontrolle). Die Netzanbindung erfolgt ausschließlich über das kommunale Intranet, kein Internetzugang der GPU-Server.

### 2.3 Datenschutz nach Art. 22 DSGVO

Art. 22 DSGVO regelt das Recht auf menschliche Überprüfung bei automatisierten Einzelentscheidungen: Betroffene haben das Recht, nicht einer ausschließlich auf einer automatisierten Verarbeitung beruhenden Entscheidung unterworfen zu werden, die ihnen gegenüber rechtliche Wirkung entfaltet. Das RAG-System ist daher ausdrücklich als Unterstützungssystem (Decision Support) konzipiert, nicht als Entscheidungssystem. Der Sachbearbeiter prüft den generierten Bescheid-Entwurf, kann Änderungen vornehmen und zeichnet den Bescheid persönlich ab. Die KI-Generierung wird im Bescheid nicht kenntlich gemacht (keine Pflicht nach aktueller Rechtslage), aber im internen Verwaltungsvorgang dokumentiert (Audit-Trail: Zeitstempel, Modellversion, verwendete Quellen, Bearbeitungsschritte des Sachbearbeiters).

## 3. Evaluierung

### 3.1 Qualitätsmetriken

Die Qualität des RAG-Systems wird anhand folgender Metriken bewertet: Juristische Korrektheit — 100 generierte Bescheid-Entwürfe werden von 3 erfahrenen Sachbearbeitern und 1 Verwaltungsjuristen auf inhaltliche Richtigkeit geprüft (Bewertung: korrekt, teilweise korrekt, inkorrekt; Zielwert: > 90 Prozent korrekt). Halluzinationsrate — der Anteil der generierten Aussagen, die nicht durch die Quelldokumente gestützt werden (manuelle Prüfung einer Stichprobe von 500 Aussagen; Zielwert: < 5 Prozent Halluzination). Vollständigkeit — werden alle relevanten Prüfpunkte eines Bauantrags vom System erkannt? (Vergleich mit einer Checkliste von 42 Prüfpunkten nach BauO NRW; Zielwert: > 95 Prozent Abdeckung). Sprachqualität — Lesbarkeit und Verwaltungsstil der generierten Texte (Bewertung durch 10 Sachbearbeiter auf einer 5-stufigen Likert-Skala; Zielwert: Mittelwert ≥ 4,0).

### 3.2 Vergleich mit manueller Bearbeitung

In einem kontrollierten Experiment bearbeiten 10 Sachbearbeiter je 5 Bauanträge (a) manuell (ohne KI-Unterstützung) und (b) mit KI-Unterstützung (RAG-System generiert Bescheid-Entwurf, Sachbearbeiter prüft und korrigiert). Die Vergleichsmetriken sind: Bearbeitungszeit (Stunden je Antrag, Zeitmessung durch die Software), Fehlerrate (Anzahl rechtlicher und formaler Fehler je Bescheid, geprüft durch Verwaltungsjuristen), Sachbearbeiter-Zufriedenheit (Fragebogen nach System Usability Scale, SUS). Hypothese: Die KI-Unterstützung reduziert die Bearbeitungszeit um 40–60 Prozent bei gleicher oder besserer Fehlerrate. Das Experiment wird als Cross-Over-Design durchgeführt (jeder Sachbearbeiter bearbeitet sowohl manuell als auch KI-unterstützt, Reihenfolge randomisiert), um individuelle Leistungsunterschiede auszugleichen.

## 4. Fine-Tuning auf Verwaltungstexte

### 4.1 Trainingsdaten

Das Fine-Tuning-Dataset umfasst 500 annotierte Beispiele: 200 Baugenehmigungsbescheide (anonymisiert, mit Quellenreferenzen annotiert), 100 Ablehnungsbescheide mit Begründung, 100 Nachforderungsschreiben und 100 Stellungnahmen (Brandschutz, Denkmalschutz, Naturschutz). Die Anonymisierung erfolgt nach einem standardisierten Protokoll: Personennamen → "Herr/Frau [Nachname]", Adressen → "[Straße] [Nr.], [PLZ] [Ort]", Grundstücksbezeichnungen → "Flurstück [Nr.], Gemarkung [Name]". Die Anonymisierung wird manuell durchgeführt und von einem zweiten Bearbeiter geprüft (Vier-Augen-Prinzip). Die annotierten Texte werden im JSONL-Format gespeichert (System-Prompt, User-Prompt mit Antragsdaten, Assistant-Response mit Bescheidtext).

### 4.2 LoRA-Training

Das LoRA-Fine-Tuning wird auf dem lokalen GPU-Server durchgeführt (kein Cloud-Upload der Trainingsdaten). Hyperparameter: LoRA Rank r = 16, Alpha α = 32, Dropout 0,05, Learning Rate 2 × 10⁻⁴ (Cosine Scheduler), Batch Size 4 (Gradient Accumulation 8), 3 Epochen, Evaluierung alle 50 Schritte auf einem Validierungsset (10 Prozent). Das Fine-Tuning dauert ca. 12 Stunden auf 2 × A100. Das resultierende LoRA-Adapter-Modell (ca. 500 MB) wird versioniert gespeichert und kann bei neuen Trainingsdaten (z.B. neue Bescheide, Gesetzesänderungen) inkrementell nachtrainiert werden.

## 5. Arbeitspakete und Zeitplan (24 Monate)

AP 1 (Monat 1–6): Wissensbasis aufbauen (Digitalisierung und Chunking der Rechtstexte, Embedding-Generierung, ChromaDB-Setup). AP 2 (Monat 4–10): RAG-Pipeline (Retriever, LLM-Integration, Quellennachweis, Web-Frontend). AP 3 (Monat 8–14): Fine-Tuning (Datenaufbereitung, LoRA-Training, Validierung). AP 4 (Monat 12–18): Evaluierung (Juristische Prüfung, Halluzinationstest, Vergleichsexperiment). AP 5 (Monat 16–22): Pilotbetrieb bei der Bauaufsicht Musterstadt (3 Sachbearbeiter, 6 Monate). AP 6 (Monat 20–24): Publikation, Handlungsempfehlungen, Open-Source-Veröffentlichung des RAG-Frameworks (ohne Trainingsdaten, aus Datenschutzgründen). Personal: 1 Postdoc NLP/ML, 1 Doktorand/in Verwaltungsinformatik, 1 Verwaltungsjurist/in (50 Prozent). Kooperation: Bauaufsicht Musterstadt (Praxispartner), Kommunales Rechenzentrum (Server-Hosting). Gesamtkosten: 620.000 Euro.

## 6. Erwartete Ergebnisse und gesellschaftlicher Impact

Das Projekt wird ein praxiserprobtes RAG-System für kommunale Genehmigungsverfahren liefern, das die Bearbeitungszeit von Bauanträgen um 40–60 Prozent reduziert und den Sachbearbeitern die repetitiven Textarbeit abnimmt, sodass sie sich auf die fachliche Prüfung konzentrieren können. Die juristische Korrektheit der generierten Bescheide wird ≥ 90 Prozent betragen, die Halluzinationsrate < 5 Prozent. Das System ist Open Source (MIT-Lizenz für das RAG-Framework) und kann von anderen Kommunen übernommen werden — die Anpassung auf andere Rechtsgebiete (Gaststättenrecht, Gewerberecht) erfordert lediglich den Austausch der Wissensbasis und ein neues Fine-Tuning. Der gesellschaftliche Impact ist erheblich: Schnellere Baugenehmigungen entlasten Bauherren und die Bauwirtschaft, reduzieren die Wartezeiten und senken die bürokratischen Kosten.

## Zusammenfassung in einfacher Sprache

Bauantraege dauern in Deutschland oft viel zu lange, weil die Verwaltung ueberlastet ist und jeder Antrag viele Seiten umfasst. Dieses Projekt entwickelt ein KI-System, das Sachbearbeitern bei der Pruefung von Bauantraegen hilft und automatisch Entwuerfe fuer Genehmigungsbescheide erstellt. Das System kennt alle wichtigen Gesetze und Vorschriften und kann die passenden Paragraphen heraussuchen. Der Sachbearbeiter bleibt aber immer verantwortlich und prueft alles, bevor ein Bescheid verschickt wird. Alle Daten bleiben auf den Computern der Stadtverwaltung und werden nicht ins Internet uebertragen.

Musterstadt, den 01.02.2026

_Prof. Dr.-Ing. Tobias Algorithmus, TU Musterstadt_`,
};
