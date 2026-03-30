import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-050',
  filename: 'Review_FA010.md',
  format: 'md',
  tags: ['Review', 'Methodik', 'Sozialforschung'],
  created: '2026-03-08T10:00:00Z',
  vorgangId: 'FA-2026-010',
  markdown: `---
titel: Methodische Stellungnahme FA-2026-010 Psychosoziale Resilienzfaktoren bei Langzeitarbeitslosen
aktenzeichen: FA-2026-010
datum: 2026-03-08
gutachter: Prof. Dr. phil. Elisabeth Methode, Institut für Empirische Sozialforschung, Universität Köln
---

# Methodische Stellungnahme — FA-2026-010 Resilienzfaktoren

## 1. Studiendesign und Forschungsfrage

Die geplante Längsschnittstudie untersucht psychosoziale Resilienzfaktoren bei Langzeitarbeitslosen (definiert als Arbeitslosigkeitsdauer > 12 Monate) über einen Zeitraum von 5 Jahren mit 4 Erhebungswellen (Baseline, 12 Monate, 24 Monate, 60 Monate). Die zentrale Forschungsfrage lautet: Welche psychosozialen Faktoren (Selbstwirksamkeit, soziale Unterstützung, Kohärenzgefühl, Bewältigungsstrategien) prognostizieren die psychische Gesundheit und die Arbeitsmarktreintegration von Langzeitarbeitslosen im Zeitverlauf? Das Studiendesign ist ein prospektives Panel-Design mit Rekrutierung über 8 Jobcenter in NRW (Gelegenheitsstichprobe, stratifiziert nach Alter, Geschlecht und Migrationshintergrund). Die geplante Stichprobengröße beträgt N = 300 zu Baseline.

Die Forschungsfrage ist hochrelevant: Langzeitarbeitslosigkeit betrifft in Deutschland 860.000 Personen (Bundesagentur für Arbeit, Dezember 2025) und ist mit erhöhtem Risiko für Depression (Odds Ratio 2,5–3,0 nach Metaanalyse Paul & Moser 2009), Suizidalität, kardiovaskuläre Erkrankungen und soziale Isolation assoziiert. Trotz intensiver Forschung zur Beziehung zwischen Arbeitslosigkeit und Gesundheit gibt es erstaunlich wenige Längsschnittstudien, die protektive Faktoren (Resilienz) über einen Zeitraum von mehr als 2 Jahren untersuchen. Die meisten Studien sind Querschnittsdesigns, die keine kausalen Aussagen ermöglichen.

## 2. Stichprobe und Power-Analyse

### 2.1 Stichprobengröße

Die geplante Stichprobengröße von N = 300 ist die kritischste methodische Schwäche des Antrags. Für ein Panel-Design über 5 Jahre mit 4 Messzeitpunkten ist eine erhebliche Panel-Attrition (Verlust von Teilnehmern) zu erwarten. Die Attritionsrate in vergleichbaren Studien mit vulnerablen Populationen beträgt: 15–20 Prozent zwischen Welle 1 und 2 (12 Monate), kumulative Attrition 30–40 Prozent nach 2 Jahren und kumulative Attrition 40–55 Prozent nach 5 Jahren. Bei einer konservativen Schätzung von 50 Prozent Attrition über 5 Jahre verbleiben nur N = 150 Teilnehmer in der finalen Welle. Die Power-Analyse für die geplanten Mehrebenen-Regressionsmodelle (Random-Intercept, Random-Slope für Zeit) ergibt bei N = 150 (finale Welle), 4 Messzeitpunkten, einer erwarteten Effektstärke von f² = 0,10 (kleiner bis mittlerer Effekt, realistisch für psychosoziale Interventionsforschung) und α = 0,05: Power = 0,72 — unter dem konventionellen Schwellenwert von 0,80. Die Studie wäre damit bei 50 Prozent Attrition statistisch underpowered.

**Empfehlung:** Oversampling auf N = 500 zu Baseline, um bei 50 Prozent Attrition noch N = 250 in der finalen Welle zu haben (Power = 0,91). Alternativ: Reduktion der Studiendauer auf 3 Jahre (3 Messzeitpunkte, geringere Attrition von 30 Prozent, N = 210 in der finalen Welle — Power = 0,84). Die Kosten des Oversamplings (zusätzliche Rekrutierung, Fragebogenversand, Dateneingabe) sind moderat und im Verhältnis zu den Gesamtkosten des 5-Jahres-Projekts vertretbar.

### 2.2 Attritions-Analyse

Der Antrag adressiert die Attritions-Problematik nicht ausreichend. Panel-Attrition ist bei Langzeitarbeitslosen besonders hoch und nicht zufällig (MNAR — Missing Not At Random): Personen, die eine Arbeit finden (positive Selektion), und Personen, die in eine psychische Krise geraten oder wohnungslos werden (negative Selektion), haben eine höhere Wahrscheinlichkeit, aus der Studie auszuscheiden. Beide Selektionsmechanismen verzerren die Schätzer der Resilienzfaktoren erheblich. Die Empfehlung ist eine systematische Attritions-Analyse (Vergleich der Aussteiger mit den Verbleibenden auf alle Baseline-Variablen) und die Anwendung von Selektionsmodellen (Heckman-Korrektur oder Pattern-Mixture-Modelle nach Little 1993), um den Attritions-Bias zu quantifizieren und zu korrigieren.

## 3. Konfundierungsvariablen

### 3.1 Individuelle Konfunder

Der Antrag kontrolliert für Alter, Geschlecht und Bildungsniveau, aber folgende potentielle Konfunder fehlen im Modell: Migrationshintergrund und Sprachkompetenz — Langzeitarbeitslose mit Migrationshintergrund haben systematisch andere Resilienzressourcen (erweiterte Familiennetzwerke, aber eingeschränkter Zugang zu institutioneller Unterstützung). Vorerkrankungen (psychisch und somatisch) — eine Depression vor der Arbeitslosigkeit ist ein starker Prädiktor für den weiteren Verlauf und muss als Kovariate kontrolliert werden, nicht als Outcome verwechselt werden. Wohnsituation (allein lebend vs. Familie) — soziale Unterstützung im Haushalt ist ein zentraler Resilienzfaktor und muss erhoben, nicht nur durch allgemeine Skalen gemessen werden. Schuldenbelastung — finanzielle Probleme sind ein massiver Stressor bei Langzeitarbeitslosen und können den Effekt psychosozialer Resilienzfaktoren überlagern.

### 3.2 Kontextuelle Konfunder

Die regionale Arbeitsmarktlage ist der wichtigste kontextuelle Konfunder: Ein Langzeitarbeitsloser in München (Arbeitslosenquote 3,2 Prozent) hat objektiv bessere Reintegrationschancen als einer in Gelsenkirchen (11,8 Prozent), unabhängig von individuellen Resilienzfaktoren. Der Antrag rekrutiert über 8 Jobcenter in NRW, kontrolliert aber nicht für die lokale Arbeitslosenquote im Mehrebenenmodell. Empfehlung: Aufnahme der regionalen Arbeitslosenquote (quartalsweise, Bundesagentur für Arbeit) als Level-2-Variable im Mehrebenenmodell.

Konjunkturelle Schwankungen über den 5-Jahres-Zeitraum können den Zusammenhang zwischen Resilienz und Reintegration erheblich beeinflussen: In einem wirtschaftlichen Abschwung sinken die Reintegrationschancen für alle Teilnehmer, unabhängig von individuellen Faktoren. Der Antrag muss die konjunkturelle Lage als zeitvariierende Kovariate (z.B. BIP-Wachstumsrate oder Arbeitslosenquote NRW je Erhebungswelle) in das Modell aufnehmen.

## 4. Messinstrumente

Die gewählten Messinstrumente sind weitgehend angemessen: RS-13 (Resilienzskala, Leppert et al. 2008, 13 Items, Cronbach's α = 0,91), SOC-13 (Sense of Coherence, Antonovsky 1987, deutsche Version Schumacher et al. 2000, 13 Items, α = 0,85), PHQ-9 (Patient Health Questionnaire, Kroenke et al. 2001, 9 Items, α = 0,89 — Screening-Instrument für Depression, validiert für die Allgemeinbevölkerung), F-SozU K-14 (Fragebogen zur Sozialen Unterstützung, Fydrich et al. 2009, 14 Items, α = 0,94) und SWE (Allgemeine Selbstwirksamkeitserwartung, Schwarzer & Jerusalem 1995, 10 Items, α = 0,88). Alle Instrumente sind validiert, normiert und für die Zielpopulation geeignet.

Kritik: Es fehlt ein Instrument zur Erfassung der Bewältigungsstrategien (Coping), die im Antrag als zentrale Variable genannt werden. Empfehlung: Aufnahme des Brief COPE (Carver 1997, deutsche Version Knoll et al. 2005, 28 Items, 14 Coping-Strategien) oder des CERQ (Cognitive Emotion Regulation Questionnaire, Garnefski & Kraaij 2006, 36 Items). Die Gesamtlänge des Fragebogens (aktuell ca. 60 Items, Bearbeitungszeit 15 Minuten) sollte 100 Items (25 Minuten) nicht überschreiten, um die Teilnahmebereitschaft nicht zu gefährden — bei der Zielpopulation (Langzeitarbeitslose, oft niedrige Bildung, geringe Motivation für Befragungen) ist Kürze entscheidend.

## 5. Empfehlung und Zusammenfassung

Der Antrag adressiert eine wichtige Forschungslücke mit einem methodisch grundsätzlich soliden Längsschnittdesign. Die methodischen Mängel sind behebbar und betreffen primär die Stichprobengröße (Oversampling empfohlen), die Attritions-Analyse (MNAR-Modelle erforderlich), die Konfundierungskontrolle (regionale Arbeitsmarktlage und Konjunktur als Kovariaten) und die fehlende Coping-Messung.

Empfehlung: **Minor Revision** mit Überarbeitung der Power-Analyse (Oversampling auf N = 500 oder Reduktion auf 3-Jahres-Design), Ergänzung des Analysekonzepts um Attritions-Modelle und kontextuelle Kovariaten, Aufnahme eines Coping-Instruments in den Fragebogen. Ergänzend wird empfohlen, eine qualitative Teilstudie (Mixed-Methods-Ansatz: Leitfadeninterviews mit 30 Teilnehmern zu Baseline und nach 24 Monaten) zu integrieren, um die quantitativen Befunde durch Fallstudien zu vertiefen und die subjektive Perspektive der Betroffenen einzufangen.

Gesamtnote: **2,0 (gut)**. Empfehlung: **Minor Revision**, danach Förderempfehlung.

## Zusammenfassung in einfacher Sprache

Eine Gutachterin hat den Antrag zur Langzeitstudie ueber Langzeitarbeitslose geprueft. Die Studie soll herausfinden, welche persoenlichen und sozialen Faktoren Menschen helfen, trotz langer Arbeitslosigkeit psychisch gesund zu bleiben. Die Gutachterin findet das Thema sehr wichtig, sieht aber ein Hauptproblem: Die geplante Teilnehmerzahl von 300 ist zu klein, weil ueber fuenf Jahre vermutlich die Haelfte der Befragten aus der Studie ausscheidet. Sie empfiehlt, mit 500 Teilnehmern zu starten. Ausserdem sollen die oertliche Arbeitsmarktlage und die wirtschaftliche Entwicklung als Einflussfaktoren beruecksichtigt werden.

_Prof. Dr. phil. Elisabeth Methode, Universität Köln_`,
};
