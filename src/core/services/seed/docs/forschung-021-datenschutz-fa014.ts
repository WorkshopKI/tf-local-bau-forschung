import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-056',
  filename: 'Datenschutz_FA014.md',
  format: 'md',
  tags: ['Datenschutz', 'KI', 'DSGVO', 'Verwaltung'],
  created: '2026-03-04T10:00:00Z',
  vorgangId: 'FA-2026-014',
  markdown: `---
titel: Datenschutzkonzept Verwaltungsautomation mit Sprachmodellen FA-2026-014
aktenzeichen: FA-2026-014
datum: 2026-03-04
ersteller: Kommunaler Datenschutzbeauftragter, Stadt Musterstadt
---

# Datenschutzkonzept — Verwaltungsautomation FA-2026-014

## 1. Datenschutzrechtlicher Rahmen

Das Projekt FA-2026-014 entwickelt ein RAG-System (Retrieval-Augmented Generation), das kommunale Sachbearbeiter bei der Prüfung von Bauanträgen und der Erstellung von Genehmigungsbescheiden unterstützt. Die Verarbeitung personenbezogener Daten ist dabei unvermeidbar: Bauanträge enthalten den Namen und die Adresse des Bauherrn, Grundstücksdaten (die über das Grundbuch einer Person zugeordnet werden können), Angaben zum Entwurfsverfasser (Architekten-Daten) und bauliche Details, die Rückschlüsse auf die wirtschaftliche Situation des Bauherrn ermöglichen (Gebäudegröße, Ausstattungsstandard). Die Rechtsgrundlage für die Verarbeitung im Rahmen des Genehmigungsverfahrens ist Art. 6 Abs. 1 lit. e DSGVO in Verbindung mit §69 BauO NRW (Erfüllung einer Aufgabe im öffentlichen Interesse).

Die Besonderheit des Projekts liegt in der Verwendung von Antragsdaten als Trainingsdaten für das Sprachmodell (Fine-Tuning) und als Wissensbasis für den RAG-Retriever. Die datenschutzrechtlichen Herausforderungen betreffen: die Verwendung personenbezogener Antragsdaten als Trainingsdaten (Zweckänderung nach Art. 6 Abs. 4 DSGVO), die Speicherung von Antragsdaten in der Vektor-Datenbank (ChromaDB) als Embeddings (stellt die Vektorisierung eine Verarbeitung personenbezogener Daten dar?), die Generierung von Bescheid-Entwürfen durch das LLM (können personenbezogene Daten aus den Trainingsdaten in den generierten Text durchsickern — sogenannte Memorisierung?) und die Transparenzpflicht gegenüber den Antragstellern (Art. 13/14 DSGVO — müssen Bauantragsteller darüber informiert werden, dass ein KI-System an der Bescheiderstellung beteiligt ist?).

## 2. Anonymisierung der Trainingsdaten

### 2.1 Anonymisierungsverfahren

Die 500 Musterbescheide, die für das Fine-Tuning des LLM verwendet werden, müssen vor der Verwendung anonymisiert werden. Die Anonymisierung muss nach dem Stand der Technik irreversibel sein (Art. 26 Erwägungsgrund 26 DSGVO — anonymisierte Daten sind keine personenbezogenen Daten und fallen nicht unter die DSGVO). Das Anonymisierungsprotokoll umfasst: Personennamen werden durch generische Platzhalter ersetzt (z.B. Herr Mustermann statt des echten Namens, wobei die Platzhalter konsistent innerhalb eines Dokuments verwendet werden). Adressen werden durch fiktive Adressen ersetzt (z.B. Musterstraße 1, 48149 Musterstadt). Grundstücksbezeichnungen werden durch fiktive Bezeichnungen ersetzt (z.B. Flurstück 999/1, Gemarkung Musterstadt). Telefonnummern, E-Mail-Adressen und Bankverbindungen werden vollständig entfernt. Datumsangaben werden um einen zufälligen Offset (±30 Tage) verschoben. Spezifische Gebäudemerkmale, die in Kombination mit dem Standort eine Re-Identifizierung ermöglichen könnten (z.B. ein einmaliges Denkmal mit exakter Beschreibung), werden generalisiert.

Die Anonymisierung wird manuell durchgeführt (automatische Named Entity Recognition ist für Verwaltungstexte nicht ausreichend zuverlässig — Genauigkeit der NER für Adressen in Fließtext: ca. 85 Prozent, Fehlerrate zu hoch für eine irreversible Anonymisierung). Jedes anonymisierte Dokument wird von einer zweiten Person geprüft (Vier-Augen-Prinzip). Die Original-Bescheide verbleiben in der Verwaltungsakte und werden nicht auf den GPU-Server übertragen.

### 2.2 Bewertung: Vektorisierung als Verarbeitung

Die Vektorisierung von Textchunks (Umwandlung in 768-dimensionale Embeddings mittels E5-large-v2) ist eine Verarbeitung personenbezogener Daten im Sinne von Art. 4 Nr. 2 DSGVO, wenn die Eingabetexte personenbezogene Daten enthalten. Die Embeddings selbst sind nicht direkt lesbar (kein Klartext), aber theoretisch können bei bestimmten Angriffsszenarien (Embedding-Inversion-Angriffe, Morris et al. 2023, Text Embeddings Reveal Almost As Much As Text) Teile des Originaltexts aus den Embeddings rekonstruiert werden. Aus datenschutzrechtlicher Vorsicht wird daher angenommen, dass Embeddings personenbezogener Texte ebenfalls personenbezogene Daten sind. Konsequenz: Die Wissensbasis (ChromaDB mit Embeddings der Rechtstexte und anonymisierten Musterbescheide) enthält keine personenbezogenen Daten, da die Eingabetexte anonymisiert sind. Die Embeddings von aktuellen Bauanträgen (die im RAG-Retrieval verwendet werden) enthalten personenbezogene Daten und unterliegen der DSGVO. Diese Embeddings werden nach Abschluss des Genehmigungsverfahrens gelöscht (Löschfrist: 30 Tage nach Unanfechtbarkeit des Bescheids).

## 3. On-Premise-Deployment und Datensicherheit

### 3.1 Technische Maßnahmen

Der GPU-Server (2 × NVIDIA A100) und der Applikationsserver werden im Rechenzentrum der Stadtverwaltung Musterstadt betrieben. Das Rechenzentrum ist nach BSI-IT-Grundschutz zertifiziert (Zertifikat Nr. BSI-GS-2024-0812, gültig bis 2027). Technische Sicherheitsmaßnahmen: Verschlüsselung: Festplattenverschlüssung LUKS (AES-256) auf allen Servern. Netzwerkisolation: Die GPU-Server haben keinen Internetzugang; die Kommunikation erfolgt ausschließlich über das kommunale Intranet (VLAN 42, Firewall-Regel: nur eingehender HTTPS-Verkehr vom Applikationsserver, kein ausgehender Verkehr). Zugriffskontrolle: Rollenbasierte Zugriffskontrolle (RBAC) über Active Directory. 3 Rollen: Administrator (Systemwartung, kein Zugriff auf Antragsdaten), Sachbearbeiter (Zugriff auf RAG-System mit eigenem Login, Sichtbarkeit nur der eigenen Anträge), Datenschutzbeauftragter (Audit-Lesezugriff auf Protokolle). Multi-Faktor-Authentifizierung (MFA) für alle Fernzugriffe (VPN + Token). Logging: Alle Zugriffe auf das RAG-System werden mit Zeitstempel, Benutzer-ID und Art der Aktion (Anfrage, Bescheid-Generierung, Export) in einem Audit-Log protokolliert (unveränderbar, WORM-Speicher, Aufbewahrung 3 Jahre).

### 3.2 Organisatorische Maßnahmen

Verarbeitungsverzeichnis nach Art. 30 DSGVO: Ein Eintrag für die KI-gestützte Bescheiderstellung wird in das Verarbeitungsverzeichnis der Stadtverwaltung aufgenommen. Auftragsverarbeitung: Die TU Musterstadt (Projektpartner, Entwicklung des RAG-Systems) erhält keinen Zugang zu personenbezogenen Antragsdaten. Die Entwicklung und das Fine-Tuning erfolgen ausschließlich auf anonymisierten Daten. Die Installation und Wartung des Systems auf den kommunalen Servern erfolgt durch die kommunale IT-Abteilung (kein Fernzugriff der TU). Schulung: Alle Sachbearbeiter, die das RAG-System nutzen, erhalten eine Datenschutzschulung (2 Stunden, Themen: personenbezogene Daten im KI-System, Prüfpflicht des Sachbearbeiters, Umgang mit fehlerhaften Ausgaben, Meldepflicht bei Datenschutzverletzungen).

## 4. Art. 22 DSGVO — Automatisierte Einzelentscheidung

### 4.1 Einordnung

Art. 22 Abs. 1 DSGVO: Die betroffene Person hat das Recht, nicht einer ausschließlich auf einer automatisierten Verarbeitung — einschließlich Profiling — beruhenden Entscheidung unterworfen zu werden, die ihr gegenüber rechtliche Wirkung entfaltet. Eine Baugenehmigung oder -ablehnung ist eine Entscheidung mit rechtlicher Wirkung. Wenn das RAG-System den Bescheid ohne menschliche Überprüfung erstellt und versendet, läge eine automatisierte Einzelentscheidung vor, die nach Art. 22 DSGVO grundsätzlich verboten ist (Ausnahmen: Art. 22 Abs. 2 — ausdrückliche Einwilligung, Vertragserfüllung, gesetzliche Ermächtigung).

### 4.2 Abgrenzung: Decision Support vs. Decision Making

Das RAG-System ist als Decision-Support-System konzipiert: Es generiert einen Bescheid-Entwurf, den der Sachbearbeiter prüft, ggf. ändert und abzeichnet. Die finale Entscheidung (Genehmigung/Ablehnung) trifft der Sachbearbeiter — nicht das System. Damit liegt keine automatisierte Einzelentscheidung nach Art. 22 DSGVO vor, sofern folgende Bedingungen eingehalten werden: Der Sachbearbeiter hat tatsächlich die Möglichkeit, den Entwurf zu ändern (kein reiner Bestätigungsknopf — das System darf den Sachbearbeiter nicht in eine Bestätigungsroutine drängen, in der er Entwürfe routinemäßig abzeichnet ohne inhaltliche Prüfung). Der Sachbearbeiter ist fachlich in der Lage, den Entwurf zu beurteilen (Qualifikation nach §69 BauO NRW). Die Entscheidungsgründe sind für den Sachbearbeiter nachvollziehbar (Quellennachweis im generierten Text, keine Black-Box-Entscheidung). Maßnahme: Im Workflow des RAG-Systems wird eine Pflicht-Prüfungsbestätigung eingebaut: Der Sachbearbeiter muss vor der Freigabe eines Bescheids eine Checkliste abhaken (Rechtsgrundlage geprüft, Auflagen geprüft, Begründung geprüft) und seine elektronische Signatur leisten. Die Checkliste wird im Audit-Trail dokumentiert.

## 5. Transparenzpflicht

### 5.1 Information der Antragsteller

Nach Art. 13 DSGVO müssen die betroffenen Personen (Bauantragsteller) über die Verarbeitung ihrer Daten informiert werden. Die bestehende Datenschutzerklärung der Bauaufsicht (auf dem Antragsformular und der Website) wird um folgenden Absatz ergänzt: Die Stadtverwaltung Musterstadt setzt zur Unterstützung der Sachbearbeitung ein KI-basiertes Assistenzsystem ein. Das System erzeugt Bescheid-Entwürfe auf Basis der geltenden Rechtsvorschriften. Jeder Bescheid wird von einem qualifizierten Sachbearbeiter inhaltlich geprüft und verantwortet. Es findet keine automatisierte Entscheidungsfindung im Sinne des Art. 22 DSGVO statt. Ihre personenbezogenen Daten werden ausschließlich auf kommunalen Servern verarbeitet und nicht an Dritte weitergegeben.

### 5.2 Keine Kennzeichnungspflicht im Bescheid

Nach aktueller Rechtslage (Stand März 2026) besteht keine Pflicht, im Bescheid selbst kenntlich zu machen, dass ein KI-System an der Erstellung beteiligt war. Die EU AI Act (Verordnung (EU) 2024/1689, in Kraft seit 02.08.2024, Anwendungsbeginn der meisten Vorschriften 02.08.2026) sieht in Art. 50 eine Transparenzpflicht für KI-Systeme vor, die jedoch primär auf Anbieter-Pflichten abzielt (Information über die KI-Eigenschaft des Systems). Die kommunale Verwaltung als Nutzer des KI-Systems muss sicherstellen, dass die KI-Nutzung in der Datenschutzerklärung offengelegt wird — eine Kennzeichnung im einzelnen Bescheid ist nach aktuellem Stand nicht erforderlich, wird aber als Good Practice empfohlen.

## 6. Löschpflichten und Audit-Trail

Die Löschfristen für personenbezogene Daten im RAG-System sind: Aktuelle Antragsdaten (Embeddings, Rohtexte im Workflow): Löschung 30 Tage nach Unanfechtbarkeit des Bescheids (1 Monat + Widerspruchsfrist 1 Monat = 2 Monate nach Bescheidzustellung). Audit-Trail (Zugriffsprotokoll, Prüfungsbestätigungen): Aufbewahrung 3 Jahre (Nachweispflicht der Verwaltung). Fine-Tuning-Daten (anonymisiert): Keine Löschpflicht (keine personenbezogenen Daten). Wissensbasis (Rechtstexte, anonymisierte Musterbescheide): Keine Löschpflicht, Aktualisierung bei Rechtsänderungen. Die Löschung wird automatisiert über einen Cronjob auf dem Applikationsserver durchgeführt (wöchentlicher Lauf, Löschprotokoll im Audit-Trail).

## Zusammenfassung in einfacher Sprache

Dieses Datenschutzkonzept beschreibt, wie das KI-System fuer Bauantraege mit persoenlichen Daten umgeht. Bauantraege enthalten Namen, Adressen und Grundstuecksdaten, die geschuetzt werden muessen. Fuer das Training der KI werden alle persoenlichen Angaben aus den Uebungstexten entfernt. Das gesamte System laeuft nur auf den Computern der Stadtverwaltung und hat keinen Internetzugang. Die KI erstellt nur Entwuerfe, die endgueltige Entscheidung trifft immer ein Sachbearbeiter. Alle Zugriffe werden aufgezeichnet, und Antragsdaten werden nach Abschluss des Verfahrens geloescht.

Musterstadt, den 04.03.2026

_Kommunaler Datenschutzbeauftragter, Stadt Musterstadt_`,
};
