import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-055',
  filename: 'Ethik_FA010.md',
  format: 'md',
  tags: ['Datenschutz', 'DSFA', 'Pseudonymisierung'],
  created: '2026-03-02T10:00:00Z',
  vorgangId: 'FA-2026-010',
  markdown: `---
titel: Datenschutzfolgenabschätzung FA-2026-010 Resilienz-Studie Langzeitarbeitslose
aktenzeichen: FA-2026-010
datum: 2026-03-02
ersteller: Datenschutzbeauftragte der Universität Musterstadt, Dr. jur. Petra Datenschutz
---

# Datenschutzfolgenabschätzung — FA-2026-010 Resilienz-Studie

## 1. Beschreibung der Verarbeitung

Die Längsschnittstudie FA-2026-010 erhebt über 5 Jahre personenbezogene Daten von 300 Langzeitarbeitslosen in 4 Erhebungswellen (Baseline, 12, 24, 60 Monate). Die erhobenen Daten umfassen: Soziodemographische Daten (Alter, Geschlecht, Familienstand, Bildung, Migrationshintergrund, Wohnsituation, Haushaltseinkommen), psychometrische Daten (Resilienzskala RS-13, Kohärenzgefühl SOC-13, Selbstwirksamkeit SWE, Depression PHQ-9, soziale Unterstützung F-SozU), Gesundheitsdaten (selbstberichteter Gesundheitszustand, chronische Erkrankungen, Medikamenteneinnahme, Arztbesuche in den letzten 12 Monaten), Erwerbsbiographie (Dauer der Arbeitslosigkeit, bisherige Beschäftigungsverhältnisse, Maßnahmen der Arbeitsvermittlung, aktuelle Bewerbungsaktivitäten) und qualitative Daten (offene Fragen zu Bewältigungsstrategien, subjektivem Wohlbefinden, Zukunftsperspektiven).

Die Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) in Verbindung mit Art. 9 Abs. 2 lit. a DSGVO (ausdrückliche Einwilligung für besondere Kategorien personenbezogener Daten — Gesundheitsdaten). Die Einwilligung wird in schriftlicher Form eingeholt (Einwilligungserklärung auf separatem Formblatt, unterschrieben und datiert, Kopie für den Teilnehmer). Die Freiwilligkeit der Einwilligung wird durch folgende Maßnahmen sichergestellt: Die Rekrutierung erfolgt über das Jobcenter, aber die Teilnahme hat keinen Einfluss auf die Leistungen nach SGB II (kein Sanktionsmechanismus bei Nichtteilnahme), die Einwilligung kann jederzeit ohne Angabe von Gründen widerrufen werden (Art. 7 Abs. 3 DSGVO), der Widerruf führt zur Löschung aller personenbezogenen Daten des Teilnehmers und es wird kein Druck durch die Jobcenter-Mitarbeiter ausgeübt (die Rekrutierung erfolgt durch Informationsschreiben, nicht durch persönliche Ansprache im Beratungsgespräch).

## 2. Erforderlichkeit der DSFA

Eine DSFA nach Art. 35 DSGVO ist erforderlich, da folgende Kriterien der Positivliste der DSK (Datenschutzkonferenz, BfDI) erfüllt sind: Verarbeitung besonderer Kategorien personenbezogener Daten (Gesundheitsdaten, Art. 9 DSGVO), Verarbeitung von Daten schutzbedürftiger Personen (vulnerable Gruppe: Langzeitarbeitslose, die in einem Abhängigkeitsverhältnis zum Jobcenter stehen), systematische Erhebung über einen langen Zeitraum (5 Jahre, 4 Wellen, Panel-Design mit Verknüpfung der Daten über die Zeit) und Profiling-ähnliche Verarbeitung (die psychometrischen Skalen erstellen ein Profil der psychischen Gesundheit und der Bewältigungsressourcen der Teilnehmer). Bei Erfüllung von 2 oder mehr Kriterien ist eine DSFA zwingend vorgeschrieben.

## 3. Risikobewertung

### 3.1 Identifizierte Risiken

**Risiko 1 — Re-Identifizierung pseudonymisierter Daten:** Die Forschungsdaten werden pseudonymisiert (Zuordnungstabelle Pseudonym ↔ Klarnamen beim Datentreuhänder). Die Kombination aus seltenen Merkmalen (z.B. männlich, 55 Jahre, Migrationshintergrund Syrien, Wohnort Stadtteil X, arbeitslos seit 4 Jahren) könnte eine Re-Identifizierung ermöglichen, insbesondere in kleineren Jobcenter-Bezirken. Einstufung: hohes Risiko. Maßnahme: k-Anonymität mit k ≥ 5 für alle quasi-identifizierenden Merkmale (Alter in 5-Jahres-Klassen, Nationalität in Großgruppen, Stadtteil nur auf Stadtbezirksebene). Restrisiko: niedrig.

**Risiko 2 — Stigmatisierung durch Forschungsergebnisse:** Die Veröffentlichung der Ergebnisse könnte Langzeitarbeitslose als Gruppe stigmatisieren (z.B. wenn die Studie einen hohen Anteil psychischer Erkrankungen zeigt). Einstufung: mittleres Risiko. Maßnahme: Die Publikationsstrategie wird mit dem Beirat der Studie (bestehend aus Betroffenen-Vertretern, Sozialverband, Jobcenter) abgestimmt. Ergebnisse werden in ihrem Kontext dargestellt (strukturelle Ursachen der Langzeitarbeitslosigkeit, nicht individuelle Defizite). Restrisiko: niedrig.

**Risiko 3 — Datenverlust oder unbefugter Zugriff:** Personenbezogene Daten auf Papierfragebögen (Transport vom Jobcenter zur Universität), digitale Daten auf dem Forschungsserver. Einstufung: mittleres Risiko. Maßnahme: Papierfragebögen werden in verschlossenen Transportboxen befördert und nach Digitalisierung vernichtet (Crosscut-Aktenvernichter, DIN 66399 Sicherheitsstufe P-4). Digitale Daten: verschlüsselte Festplatten (AES-256), Zugriffskontrolle (rollenbasiert, nur PI und Studienmitarbeiter), Forschungsserver im Hochschulnetz (keine Cloud), Backup verschlüsselt auf separatem Server. Restrisiko: niedrig.

**Risiko 4 — Unfreiwillige Offenlegung im Jobcenter-Kontext:** Teilnehmer könnten befürchten, dass ihre Antworten an das Jobcenter weitergegeben werden und Sanktionen nach sich ziehen (z.B. wenn sie angeben, dass sie sich nicht aktiv bewerben). Einstufung: hohes Risiko (für die Datenqualität und das Vertrauen der Teilnehmer). Maßnahme: Strikte organisatorische Trennung zwischen Forschungsteam und Jobcenter. Die Jobcenter-Mitarbeiter haben keinen Zugang zu den Forschungsdaten. Die Einwilligungserklärung enthält eine explizite Zusicherung, dass keine Daten an das Jobcenter weitergegeben werden. Die Rekrutierung erfolgt durch ein Informationsschreiben, das per Post an die Teilnehmer gesendet wird (nicht im Beratungsgespräch übergeben). Restrisiko: niedrig.

## 4. Pseudonymisierungskonzept

### 4.1 Datentreuhänder

Die Zuordnungstabelle (Pseudonym-Code ↔ Klarnamen mit Kontaktdaten) wird beim Datentreuhänder — dem Rechenzentrum der Universität Musterstadt (HRZ, organisatorisch unabhängig vom Forschungsteam) — in einem zugriffsbeschränkten Safe-Verzeichnis gespeichert (verschlüsselt, AES-256, Zugriff nur durch den Datentreuhänder persönlich, 4-Augen-Prinzip bei Zugriff). Die Forschungsdaten beim PI (Principal Investigator) enthalten ausschließlich die Pseudonym-Codes (8-stelliger alphanumerischer Code, zufällig generiert, keine Rückschlussmöglichkeit auf die Person).

### 4.2 Verknüpfung über die Wellen

Die Verknüpfung der Daten über die 4 Erhebungswellen erfolgt über den Pseudonym-Code. Der Datentreuhänder stellt dem Forschungsteam auf Anfrage (per Formblatt, Unterschrift PI) die Kontaktdaten der Teilnehmer für die nächste Erhebungswelle zur Verfügung (Adressliste für den Fragebogenversand). Die Kontaktdaten werden nach dem Versand der Fragebögen und der Eingangsbestätigung der Rückantworten wieder beim PI gelöscht.

## 5. Aufbewahrung und Löschung

### 5.1 Aufbewahrungsfristen

Die Forschungsdaten (pseudonymisiert) werden für 10 Jahre nach Projektabschluss aufbewahrt (DFG-Leitlinien zur Sicherung guter wissenschaftlicher Praxis, Leitlinie 17: Forschungsdaten sind für mindestens 10 Jahre aufzubewahren). Die Zuordnungstabelle wird 3 Jahre nach Projektabschluss gelöscht (Zeitpunkt der letzten Publikation + 1 Jahr für eventuelle Rückfragen der Peer-Reviewer). Nach Löschung der Zuordnungstabelle sind die Forschungsdaten anonymisiert (kein Personenbezug mehr herstellbar) und unterliegen nicht mehr der DSGVO.

### 5.2 Löschkonzept

Die Löschung der Zuordnungstabelle erfolgt durch den Datentreuhänder (3-faches Überschreiben nach BSI-Empfehlung, Löschprotokoll mit Datum und Unterschrift). Die Löschung der Kontaktdaten beim PI erfolgt nach jeder Erhebungswelle (7 Tage nach Eingang der letzten Rückantwort). Die Löschung der Papierfragebögen erfolgt nach Digitalisierung und Qualitätskontrolle (Crosscut-Vernichtung, Protokoll). Die Löschung der digitalen Forschungsdaten erfolgt 10 Jahre nach Projektabschluss (Überschreiben der verschlüsselten Festplatte, Zertifikat des HRZ).

## 6. Rechte der Betroffenen

Die Teilnehmer haben folgende Rechte nach DSGVO, die in der Einwilligungserklärung und im Informationsschreiben verständlich erläutert werden: Auskunftsrecht (Art. 15) — Anfrage per E-Mail oder Brief an den PI, Antwort innerhalb von 4 Wochen. Recht auf Berichtigung (Art. 16) — bei fehlerhaften Daten. Recht auf Löschung (Art. 17) — der Teilnehmer kann jederzeit die Löschung aller seiner Daten verlangen; die Löschung erfolgt innerhalb von 2 Wochen, der Datentreuhänder löscht den Zuordnungseintrag. Recht auf Einschränkung der Verarbeitung (Art. 18). Recht auf Datenportabilität (Art. 20) — die Daten werden auf Anfrage im maschinenlesbaren Format (CSV) bereitgestellt. Widerrufsrecht (Art. 7 Abs. 3) — der Widerruf der Einwilligung ist jederzeit möglich und führt zur Löschung aller Daten; die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt. Beschwerderecht bei der Aufsichtsbehörde (Art. 77) — Landesbeauftragte für Datenschutz und Informationsfreiheit NRW, Postfach 200444, 40102 Düsseldorf.

## 7. Ergebnis der DSFA

Die identifizierten Risiken können durch die beschriebenen technischen und organisatorischen Maßnahmen auf ein akzeptables Restrisiko reduziert werden. Eine Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO ist nicht erforderlich, da keine hohen Restrisiken verbleiben. Die DSFA wird vor Beginn der Datenerhebung abgeschlossen und dem Datenschutzbeauftragten der Universität zur Freigabe vorgelegt.

Musterstadt, den 02.03.2026

_Dr. jur. Petra Datenschutz, Datenschutzbeauftragte der Universität Musterstadt_`,
};
