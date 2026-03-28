import type { Artifact } from '@/core/types/vorgang';

const art = (id: string, type: Artifact['type'], filename: string, vorgangId: string, content: string, created = '2026-03-15T10:00:00Z'): Artifact => ({
  id, type, filename, content, created, author: 'System', tags: [], vorgangId,
});

export const artefakteData: Artifact[] = [
  art('seed-art-001', 'nachforderung', 'nachforderung_BA004.md', 'BA-2026-004',
    `# Nachforderung zum Bauantrag BA-2026-004

**Dachgeschossausbau, Kastanienallee 23**

Sehr geehrter Herr Meier,

im Rahmen der Prüfung Ihres Bauantrags BA-2026-004 (Dachgeschossausbau, Kastanienallee 23) wurden folgende fehlende Unterlagen festgestellt:

1. **Tragwerksnachweis** gemäß §10 BauPrüfVO — Der statische Nachweis für die Tragfähigkeit der bestehenden Holzbalkendecke unter der zusätzlichen Belastung durch den Dachgeschossausbau fehlt. Bitte reichen Sie eine Tragwerksberechnung nach DIN EN 1995 (Holzbau) ein, die die Lastumleitung über die Bestandskonstruktion nachweist.

2. **Wärmeschutznachweis** nach GEG §50 — Der energetische Nachweis für die Erweiterung der beheizten Nutzfläche ist erforderlich. Insbesondere sind die U-Werte der Dachschrägen, Drempel und Gaubenwangen darzulegen.

3. **Entwässerungsplan** — Die Dachentwässerung muss an das geänderte Dachprofil angepasst werden. Ein aktualisierter Entwässerungsplan mit Berechnung der Regenspende ist vorzulegen.

Bitte reichen Sie die genannten Unterlagen bis zum **10.04.2026** ein. Nach fruchtlosem Ablauf der Frist ist mit einer Ablehnung des Bauantrags zu rechnen.

Rechtsgrundlage: §72 Abs. 1 BauO NRW i.V.m. §68 Abs. 2 BauO NRW.

Mit freundlichen Grüßen
Bauamt Musterstadt`),

  art('seed-art-002', 'bewilligung', 'genehmigung_BA001.md', 'BA-2026-001',
    `# Baugenehmigung — BA-2026-001

**Neubau Einfamilienhaus, Ahornweg 15**

Der oben bezeichnete Bauantrag wird hiermit gemäß §75 BauO NRW **genehmigt**.

## Auflagen

1. Die Regenwasserversickerung ist gemäß dem vorgelegten Entwässerungskonzept über eine Rigole auf dem Grundstück sicherzustellen. Eine Einleitung in die Kanalisation ist nicht zulässig.
2. Die Firsthöhe darf 9,50 m über Geländeoberfläche nicht überschreiten.
3. Vor Baubeginn ist die Absteckung des Gebäudes durch einen öffentlich bestellten Vermessungsingenieur vornehmen zu lassen und dem Bauamt anzuzeigen.
4. Die Bauausführung hat den anerkannten Regeln der Technik zu entsprechen, insbesondere den einschlägigen DIN-Normen.

## Hinweise

- Diese Genehmigung erlischt, wenn nicht innerhalb von drei Jahren nach Erteilung mit der Bauausführung begonnen wird.
- Die Anzeige des Baubeginns hat mindestens eine Woche vor Baubeginn schriftlich zu erfolgen.

Musterstadt, den 15.02.2026
Bauamt — Abteilung Baugenehmigung`),

  art('seed-art-003', 'email', 'email_feuerwehr_BA002.md', 'BA-2026-002',
    `Betreff: Brandschutzkonzept zur Prüfung — BA-2026-002, MFH Lindenstraße 42

Sehr geehrte Damen und Herren der Brandschutzdienststelle,

hiermit übersenden wir Ihnen das Brandschutzkonzept zum Bauantrag BA-2026-002 (Neubau Mehrfamilienhaus, Lindenstraße 42, 12 WE, Gebäudeklasse 4) zur brandschutztechnischen Stellungnahme.

Das Konzept umfasst: Feuerwiderstandsklassen der tragenden Bauteile, Rettungswegekonzept mit zwei baulichen Rettungswegen, Löschwasserversorgung über Hydrant DN 100 in 80m Entfernung, sowie die Feuerwehrzufahrt über die Lindenstraße.

Wir bitten um Stellungnahme bis zum 15.04.2026. Für Rückfragen steht Ihnen Herr Müller unter 0251-12345-67 zur Verfügung.

Mit freundlichen Grüßen
Bauamt Musterstadt — Sachbearbeiter Müller`),

  art('seed-art-004', 'nachforderung', 'stellungnahme_anforderung_BA005.md', 'BA-2026-005',
    `Betreff: Anforderung denkmalschutzrechtliche Stellungnahme — BA-2026-005

Sehr geehrte Damen und Herren der unteren Denkmalschutzbehörde,

wir bitten um Ihre Stellungnahme zum Bauantrag BA-2026-005 (Nutzungsänderung Scheune zu Wohnraum, Dorfstraße 8). Das Bestandsgebäude ist als Baudenkmal in die Denkmalliste eingetragen (Listennummer DM-1890-042).

Der Bauherr beabsichtigt die Umnutzung der landwirtschaftlichen Scheune (Baujahr ca. 1890) zu zwei Wohneinheiten. Geplant sind der Einbau von Gauben, neue Fensteröffnungen in der Südfassade sowie eine Innendämmung. Die historische Fachwerkkonstruktion soll erhalten und sichtbar bleiben.

Wir bitten insbesondere um Bewertung der geplanten Fensteröffnungen hinsichtlich des Erscheinungsbildes der Kulturlandschaft sowie um Vorgaben zur materialgerechten Ausführung der Innendämmung.

Stellungnahme erbeten bis: 30.04.2026

Mit freundlichen Grüßen
Bauamt Musterstadt`),

  art('seed-art-005', 'email', 'anhoerung_BA006.md', 'BA-2026-006',
    `Betreff: Anhörung zur Altlasten-Sanierungspflicht — BA-2026-006

Sehr geehrte Grundstückseigentümergemeinschaft Industrieweg 3,

im Rahmen der Prüfung Ihres Bauantrags BA-2026-006 (Abbruch Altbestand und Neubau) wurde eine erhebliche Bodenbelastung mit polyzyklischen aromatischen Kohlenwasserstoffen (PAK) festgestellt. Die Werte überschreiten die Prüfwerte der BBodSchV für den Wirkungspfad Boden-Mensch erheblich.

Gemäß §4 Abs. 3 BBodSchG sind Sie als Grundstückseigentümer zur Sanierung verpflichtet. Vor Erteilung einer Baugenehmigung ist ein Sanierungsplan vorzulegen, der von der zuständigen Bodenschutzbehörde genehmigt werden muss.

Wir geben Ihnen hiermit Gelegenheit zur Stellungnahme gemäß §28 VwVfG. Frist: 14 Tage ab Zugang dieses Schreibens.

Bauamt Musterstadt — Umweltabteilung`),

  art('seed-art-006', 'bewilligung', 'bewilligung_FA001.md', 'FA-2026-001',
    `# Bewilligungsbescheid — FA-2026-001

**KI-gestützte Schadenserkennung an Brückenbauwerken mittels Drohneninspektion**

Sehr geehrter Herr Prof. Dr. Bergmann,

Ihr Forschungsantrag FA-2026-001 wird hiermit bewilligt. Die Förderung erfolgt im Rahmen des BMBF-Programms "Zukunft Bau" mit einer Gesamtfördersumme von **480.000 EUR** für den Zeitraum 01.04.2026 bis 31.03.2029.

## Mittelfreigabe
- Jahr 1: 180.000 EUR (Personal + Drohnenhardware)
- Jahr 2: 160.000 EUR (Feldversuche + Datenverarbeitung)
- Jahr 3: 140.000 EUR (Validierung + Transfer)

## Auflagen
1. Zwischenbericht nach 12 Monaten mit Nachweis der Modellgenauigkeit >90%
2. Mindestens 3 Feldtests an realen Brückenbauwerken
3. Open-Access-Publikation der Kernergebnisse
4. Datensatz der annotierten Brückenbilder dem BMBF-Repositorium zur Verfügung stellen

Förderkennzeichen: ZB-2026-KI-BRK-001

Bundesministerium für Bildung und Forschung`),

  art('seed-art-007', 'nachforderung', 'nachbesserung_FA006.md', 'FA-2026-006',
    `Betreff: Nachbesserungsaufforderung — FA-2026-006 Autonome Mikromobilität

Sehr geehrter Herr Prof. Dr. Richter,

die Begutachtung Ihres Forschungsantrags FA-2026-006 hat ergeben, dass folgende Punkte überarbeitet werden müssen:

1. **Sicherheitskonzept**: Das vorgelegte Konzept für die Lieferroboter im öffentlichen Raum ist unzureichend. Insbesondere fehlen Notfall-Stoppszenarien und ein Konzept für den Mischverkehr mit Fußgängern und Radfahrern.
2. **Haftungsfragen**: Die rechtliche Einordnung autonomer Lieferroboter nach StVO ist ungeklärt. Ein juristisches Gutachten zur Haftungsverteilung ist beizufügen.
3. **Datenschutz**: Die Kamerasysteme der Roboter erfassen den öffentlichen Raum. Eine Datenschutzfolgenabschätzung nach Art. 35 DSGVO ist erforderlich.

Frist zur Nachbesserung: 6 Wochen ab Zugang.

BMWK — Referat Reallabore`),

  art('seed-art-008', 'email', 'gutachteranfrage_FA008.md', 'FA-2026-008',
    `Betreff: Anfrage Zweitgutachten — FA-2026-008 Fehlertolerante Quantenalgorithmen

Sehr geehrte Frau Prof. Dr. Müller-Schröder,

wir bitten Sie um die Erstellung eines Zweitgutachtens zum Forschungsantrag FA-2026-008 "Fehlertolerante Quantenalgorithmen für kombinatorische Optimierungsprobleme" (Antragsteller: Prof. Dr. Quantum, LMU München).

Der Antrag adressiert die Implementierung von QAOA- und VQE-Algorithmen mit Surface-Code-Fehlerkorrektur. Das Erstgutachten bewertet den Ansatz als vielversprechend, empfiehlt jedoch eine vertiefte Prüfung der Qubit-Overhead-Abschätzungen und der Reproduzierbarkeit auf aktueller Hardware.

Honorar: 800 EUR. Frist: 4 Wochen.

DFG — Fachkollegium Informatik`),

  art('seed-art-009', 'pruefbericht', 'zwischenbewertung_FA004.md', 'FA-2026-004',
    `# Zwischen-Bewertung — FA-2026-004 Selbstheilende Betone

**Bewertung nach 12 Monaten Projektlaufzeit**

## Zusammenfassung
Das Projekt zeigt sehr gute Fortschritte. Die Syntheseoptimierung der Mikrokapseln (Melamin-Harnstoff-Formaldehyd-Schale mit Methylmethacrylat-Kern) wurde erfolgreich abgeschlossen. Die Rissüberbrückung konnte bis zu einer Rissbreite von 0,3 mm nachgewiesen werden.

## Bewertung der Arbeitspakete
- AP1 Kapsel-Synthese: ✓ Abgeschlossen, Zielgröße 50-100µm erreicht
- AP2 Mischungsentwurf: ✓ Abgeschlossen, optimaler Kapselgehalt 5 Vol.-%
- AP3 Rissüberbrückung: ✓ In Arbeit, 0,3mm nachgewiesen, Ziel 0,5mm
- AP4 Dauerhaftigkeit: ◐ Laufend, Frost-Tau-Wechsel Versuch gestartet

## Empfehlung
**Verlängerung um 12 Monate empfohlen** bei unverändertem Budget.

DFG — Schwerpunktprogramm Materialforschung`, '2026-03-20T10:00:00Z'),

  art('seed-art-010', 'email', 'skizze_feedback_FA007.md', 'FA-2026-007',
    `Betreff: Feedback Projektskizze — FA-2026-007 Adaptive Lernplattform

Sehr geehrter Herr Dr. Lehmann,

vielen Dank für die Einreichung Ihrer Projektskizze "Adaptive Lernplattform mit lernpfadbasierter Personalisierung".

Die Gutachtergruppe hat Ihre Skizze bewertet und empfiehlt die Einreichung eines Vollantrags unter Berücksichtigung folgender Hinweise:

1. Der Innovationsgehalt gegenüber bestehenden Systemen (z.B. Knewton, DreamBox) sollte klarer herausgearbeitet werden.
2. Die Evaluation sollte eine randomisierte kontrollierte Studie (RCT) mit mindestens 500 Lernenden umfassen.
3. Die geplante KI-Komponente (Reinforcement Learning für Lernpfadoptimierung) bedarf einer detaillierteren technischen Beschreibung.
4. Ein Datenschutzkonzept für die Verarbeitung von Lernverlaufsdaten Minderjähriger ist beizufügen.

Frist Vollantrag: 30.06.2026

BMBF — Referat Digitale Bildung`, '2026-03-22T10:00:00Z'),
];
