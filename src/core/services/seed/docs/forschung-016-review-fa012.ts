import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-051',
  filename: 'Review_FA012.md',
  format: 'md',
  tags: ['Review', 'Stammzellen', 'ATMP'],
  created: '2026-03-10T10:00:00Z',
  vorgangId: 'FA-2026-012',
  markdown: `---
titel: Gutachten FA-2026-012 Stammzellbasierte Knorpelregeneration
aktenzeichen: FA-2026-012
datum: 2026-03-10
gutachter: Prof. Dr. med. Andreas Zelltherapie, Paul-Ehrlich-Institut (anonymisiert)
---

# Gutachten — FA-2026-012 Stammzellbasierte Knorpelregeneration

## 1. Regulatorischer Rahmen

Das Projekt FA-2026-012 plant die Entwicklung eines Zelltherapeutikums auf Basis mesenchymaler Stammzellen (MSC) aus Knochenmark für die Knorpelregeneration bei Gelenkarthrose. Das Produkt fällt als somatisches Zelltherapeutikum unter die Kategorie der Advanced Therapy Medicinal Products (ATMP) gemäß Verordnung (EG) Nr. 1394/2007. Der regulatorische Pfad für die klinische Entwicklung führt über das Paul-Ehrlich-Institut (PEI) als zuständige Bundesoberbehörde für die Genehmigung klinischer Prüfungen mit ATMP (§4b AMG). Die Herstellungserlaubnis nach §13 AMG für die GMP-konforme Produktion der MSC muss vor Beginn der klinischen Prüfung vorliegen.

Der Antragsteller (Prof. Dr. med. Stefan Knorpel, Klinik für Orthopädie, Universitätsklinikum Musterstadt) hat korrekt identifiziert, dass eine zentrale Zulassung über die EMA (European Medicines Agency) erforderlich ist, da ATMP in der EU ausschließlich zentral zugelassen werden können. Für die präklinische Phase (Gegenstand dieses Förderantrags) und die Phase-I-Studie ist jedoch zunächst die nationale Genehmigung durch das PEI ausreichend. Das vorliegende Gutachten bewertet die wissenschaftliche Qualität des Antrags und die regulatorische Eignung des vorgelegten GMP-Protokolls.

## 2. Bewertung des GMP-Protokolls

### 2.1 Zellgewinnung und -expansion

Das GMP-Protokoll beschreibt die Gewinnung von MSC aus Knochenmark-Aspirat (Beckenkammpunktion unter Lokalanästhesie, 20 ml Aspirat) und die Expansion in Zellkultur (α-MEM + 10 Prozent humanem Thrombozytenlysat, Passage 1–4, Verdoppelungszeit 48–72 Stunden). Die geplante Zelldosis beträgt 10⁷ MSC/ml in 5 ml Hyaluronsäure-Gel (Gesamtdosis: 5 × 10⁷ Zellen je Injektion, intraartikulär).

Kritik: Das GMP-Protokoll weist folgende Mängel auf, die vor einer IND-Einreichung behoben werden müssen:

**(1) Zellcharakterisierung nach ISCT-Kriterien unvollständig:** Die International Society for Cellular Therapy (ISCT, Dominici et al. 2006) definiert MSC über 3 Minimalkriterien: Adhärenz an Plastik unter Standardkulturbedingungen (erfüllt), Expression von CD73, CD90 und CD105 (≥ 95 Prozent, gemessen per Durchflusszytometrie) bei gleichzeitiger Abwesenheit von CD45, CD34, CD14, CD19 und HLA-DR (≤ 2 Prozent) und In-vitro-Differenzierungsfähigkeit in Adipozyten, Osteoblasten und Chondrozyten. Das vorgelegte Protokoll beschreibt die Oberflächenmarker-Analyse, erwähnt aber nicht die negativen Marker (CD45, CD34 etc.) und die Differenzierungstests. Diese müssen als Freigabekriterien im Batch Record aufgenommen werden.

**(2) Freigabekriterien unvollständig:** Das Protokoll definiert Freigabekriterien für Viabilität (≥ 90 Prozent, Trypanblau-Ausschluss) und Zellzahl (5 × 10⁷ ± 10 Prozent). Es fehlen jedoch: Sterilität (14-Tage-Sterilitätstest nach Ph. Eur. 2.6.1 — muss VOR der Freigabe abgeschlossen sein, was bei frischen Zellprodukten eine logistische Herausforderung darstellt; alternativ: Schnellsterilitätstest BacT/ALERT mit 7-Tage-Kultur plus Gram-Färbung als Soforttest), Endotoxin (Limulus-Amöbozyten-Lysat-Test, LAL, Grenzwert ≤ 5 EU/ml nach Ph. Eur. 2.6.14), Mykoplasma (PCR oder Zellkultur-basierter Test nach Ph. Eur. 2.6.7, Ergebnis VOR Freigabe erforderlich) und Karyotyp (mindestens alle 5 Chargen, Nachweis eines normalen diploiden Karyotyps — Ausschluss chromosomaler Aberrationen nach langer Kulturzeit).

**(3) Stabilitätsdaten fehlen:** Für kryokonservierte Zellen (geplant: Einfrieren in CryoStor CS10 bei -150°C in der Gasphase von flüssigem Stickstoff) müssen Stabilitätsdaten vorgelegt werden: Viabilität und Funktionalität nach 1, 3, 6 und 12 Monaten Lagerung. Im Antrag werden keine Stabilitätsdaten genannt — dies ist für die IND-Einreichung ein zwingender Bestandteil der CMC-Sektion (Chemistry, Manufacturing and Controls).

### 2.2 GMP-Herstellung

Die GMP-konforme Herstellung erfordert einen Reinraum der Klasse B (Operationsbereich) mit Klasse-A-Laminar-Flow-Werkbank (Isolator oder offene LAF-Bank). Das Universitätsklinikum Musterstadt verfügt über ein GMP-Reinraumlabor mit Herstellungserlaubnis nach §13 AMG für autologe Zelltherapeutika (Erlaubnis-Nr. DE-NW-GMP-2024-0042, gültig bis 2029). Die Kapazität des Reinraums (2 Herstellungsplätze, maximal 10 Chargen/Monat) ist für die geplante Phase-I-Studie (18 Patienten, je 1 Charge) ausreichend. Die Qualitätssicherung (QS) und die Qualitätskontrolle (QC) sind organisatorisch getrennt (QS: Frau Dr. Qualität, QC: externes Labor AnalytikZentrum Musterstadt) — dies entspricht den GMP-Anforderungen.

## 3. Sicherheitsprofil

### 3.1 Tumorigenitätsrisiko

MSC können nach langer Kulturzeit (> 20 Populationsverdopplungen, typischerweise Passage 6–8) chromosomale Aberrationen entwickeln und ein tumorigenes Potential erlangen. Das vorgelegte Protokoll begrenzt die Expansion auf Passage 4 (ca. 12–16 Populationsverdopplungen), was das Tumorigenitätsrisiko deutlich reduziert. Dennoch sind präklinische Tumorigenitätstests erforderlich: Weichteil-Sarkogen-Assay in immundefizienten Mäusen (Nacktmäuse, nu/nu, subkutane Injektion von 10⁷ MSC, Beobachtung 6 Monate auf Tumorbildung). Karyotypisierung der Chargen aus der GMP-Produktion (G-Banding, mindestens 20 Metaphasen, Nachweis normaler diploider Chromosomenzahl 46,XX oder 46,XY). Die Tumorigenitätstests sind im Antrag erwähnt, aber nicht als Abbruchkriterium für die klinische Entwicklung definiert — bei positivem Tumorigenitätstest (Tumorbildung in Nacktmäusen oder klonale Chromosomenaberration) muss die klinische Prüfung gestoppt werden.

### 3.2 Immunogenität

Obwohl MSC als immunprivilegiert gelten (niedrige Expression von MHC-I, Fehlen von MHC-II und kostimulatorischen Molekülen), können sie nach Differenzierung in Chondrozyten MHC-Moleküle hochregulieren und eine Immunantwort auslösen. Für autologe MSC (Spender = Empfänger) ist dies kein Problem, für allogene MSC (Spender ≠ Empfänger) jedoch ein erhebliches Sicherheitsrisiko. Der Antrag plant zunächst autologe MSC — dies ist der sicherere Ansatz, schränkt aber die Skalierbarkeit ein (jeder Patient benötigt eine individuelle Charge). Die Kommission empfiehlt, die allogene Strategie als Perspektive zu diskutieren, aber für die Phase-I-Studie am autologen Ansatz festzuhalten.

## 4. Phase-I-Design

Das geplante Phase-I-Design ist ein Open-Label, Dosis-Eskalations-Design (3+3): 3 Dosisstufen (5 × 10⁶, 5 × 10⁷, 5 × 10⁸ Zellen je Injektion), 3 Patienten je Dosisstufe (plus 3 bei Dose-Limiting Toxicity, DLT), Gesamtzahl 9–18 Patienten. Einschlusskriterien: Alter 40–70 Jahre, symptomatische Gonarthrose Kellgren-Lawrence Grad II–III, VAS-Schmerzscore ≥ 5/10, Therapieversagen konservativer Maßnahmen über 6 Monate. Ausschlusskriterien: Rheumatoide Arthritis, Immunsuppression, aktive Infektion, Schwangerschaft, BMI > 40.

Primärer Endpunkt: Sicherheit und Verträglichkeit (Adverse Events, Serious Adverse Events, DLT innerhalb von 28 Tagen nach Injektion). DLT-Definition: Grad-3-Gelenkentzündung (nach CTCAE v5.0), Infektion des Gelenks, systemische Reaktion (Fieber > 39°C über 48 Stunden). Sekundäre Endpunkte: WOMAC-Score (Western Ontario and McMaster Universities Arthritis Index, Schmerz, Steifigkeit, Funktion), MRT-Beurteilung des Knorpelstatus (MOCART-Score), Biomarker (IL-6, CRP, Aggrecan-Fragmente im Synovialfluid). Follow-up: 12 Monate. Das Design ist für eine Phase-I-Studie angemessen und entspricht den regulatorischen Anforderungen.

## 5. Empfehlung

Der Antrag wird zur **Förderung unter Auflagen** empfohlen. Auflagen: (1) Vervollständigung der ISCT-Charakterisierung und der Freigabekriterien im GMP-Protokoll. (2) Vorlage von Stabilitätsdaten für kryokonservierte MSC (mindestens 3 Monate vor IND-Einreichung). (3) Durchführung des Tumorigenitätstests in Nacktmäusen mit Definition des Abbruchkriteriums. (4) Abstimmung mit der FDA zusätzlich zum PEI (der Antragsteller plant eine spätere multizentrische Phase-II in den USA — eine frühe FDA-Abstimmung im Pre-IND Meeting kann den regulatorischen Pfad erheblich beschleunigen und Doppelarbeit vermeiden).

Gesamtnote: **1,7 (sehr gut bis gut)**. Empfehlung: **Förderung mit Auflagen.**

_Prof. Dr. med. Andreas Zelltherapie (anonymisiert), Gutachter_`,
};
