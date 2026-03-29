import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-054',
  filename: 'Ethik_FA003.md',
  format: 'md',
  tags: ['Ethik', 'Tierschutz', '3R'],
  created: '2026-02-28T10:00:00Z',
  vorgangId: 'FA-2026-003',
  markdown: `---
titel: Tierschutzprotokoll FA-2026-003 mRNA-Therapie — Detailliertes 3R-Konzept
aktenzeichen: FA-2026-003
datum: 2026-02-28
ersteller: Dr. med. vet. Maria Tierwohl, Tierschutzbeauftragte Universitätsklinikum Musterstadt
---

# Tierschutzprotokoll — FA-2026-003 mRNA-Therapie CED

## 1. Versuchstierbedarf und Gruppeneinteilung

### 1.1 Gesamtbedarf

Der Gesamtbedarf an Versuchstieren für das Projekt FA-2026-003 beträgt **144 Mäuse** (Stamm C57BL/6J, weiblich, Alter 8–10 Wochen bei Versuchsbeginn, Körpergewicht 18–22 g, Bezugsquelle Charles River Laboratories, Sulzfeld, SPF-Status: Specific Pathogen Free). Die Wahl weiblicher Mäuse folgt der Literaturempfehlung für das DSS-Kolitis-Modell (männliche C57BL/6 zeigen eine höhere Mortalität und größere Varianz im DAI-Score, Melgar et al. 2005, Inflamm Bowel Dis 11: 481). Die Tiere werden mindestens 7 Tage vor Versuchsbeginn akklimatisiert (Haltung in der Versuchstierhaltung des Universitätsklinikums, Raum T3.14, Haltungsgenehmigung nach §11 TierSchG, Az. VT-2024-0089).

### 1.2 Gruppeneinteilung DSS-Modell (72 Tiere)

Gruppe 1 (n = 12): Negativkontrolle — normales Trinkwasser (kein DSS), Vehikel (leere LNP in enterischer Kapsel, oral, Tag 1, 3, 5). Gruppe 2 (n = 12): Positivkontrolle — 3 Prozent DSS im Trinkwasser über 7 Tage, Vehikel (leere LNP). Gruppe 3 (n = 12): DSS + IL-10-mRNA-LNP niedrige Dosis (0,1 mg/kg KG, oral, Tag 1, 3, 5). Gruppe 4 (n = 12): DSS + IL-10-mRNA-LNP hohe Dosis (0,5 mg/kg KG, oral, Tag 1, 3, 5). Gruppe 5 (n = 12): DSS + TGF-β-mRNA-LNP (0,5 mg/kg KG, oral, Tag 1, 3, 5). Gruppe 6 (n = 12): DSS + IL-10/TGF-β-Kombination (je 0,25 mg/kg, oral, Tag 1, 3, 5). Randomisierung: Die Tiere werden nach Ankunft gewogen und nach Körpergewicht stratifiziert randomisiert (computergenerierte Zufallsliste, Software Research Randomizer) den 6 Gruppen zugewiesen, sodass das mittlere Körpergewicht in allen Gruppen gleich ist (Toleranz: ±0,5 g). Die Käfigzuteilung (4 Tiere/Käfig, 3 Käfige/Gruppe) erfolgt ebenfalls randomisiert.

### 1.3 Gruppeneinteilung IL-10-KO-Modell (72 Tiere)

B6.129P2-Il10^tm1Cgn/J-Mäuse (IL-10-Knockout, Jackson Laboratory, Stock Nr. 002251), weiblich, 8 Wochen bei Versuchsbeginn. Gleiche 6 Gruppen wie beim DSS-Modell (ohne DSS-Gabe, da die Kolitis spontan entsteht). Behandlungsbeginn: Gruppe A (präventiv) — Behandlung ab Woche 8 (vor Symptombeginn), Gruppe B (therapeutisch) — Behandlung ab Woche 16 (nach Symptombeginn, DAI ≥ 4). Endpunkt: Woche 24 (16 Wochen nach Behandlungsbeginn bei Gruppe A, 8 Wochen nach Behandlungsbeginn bei Gruppe B).

## 2. 3R-Konzept im Detail

### 2.1 Replace — Ersatz von Tierversuchen

Die In-vitro-Vorstudien nutzen intestinale Organoide (Mini-Darm-Kulturen), die aus Krypten des Dünndarms von C57BL/6-Mäusen isoliert und in Matrigel-Kultur expandiert werden (Protokoll nach Sato et al. 2009, Nature 459: 262). Die Organoide bilden die Darmepithelarchitektur mit Krypten-Villus-Struktur, sekretorischen Zellen (Goblet-Zellen, Paneth-Zellen) und Stammzellnische nach und ermöglichen die Testung der LNP-Aufnahme (Fluoreszenz-markierte LNP, Konfokalmikroskopie), der mRNA-Translation (IL-10-ELISA im Kulturüberstand nach 24h) und der Zytotoxizität (LDH-Assay, Viabilität > 90 Prozent als Freigabekriterium).

Von den initial 12 LNP-Formulierungskandidaten (Variation der Lipidkomposition, Mannose-Dichte, mRNA-Beladung) werden die 3 besten Kandidaten anhand der Organoid-Ergebnisse (höchste IL-10-Expression bei niedrigster Zytotoxizität) für den Tierversuch ausgewählt. Damit werden 9 von 12 Formulierungen ohne Tierversuch eliminiert — eine Reduktion des Tierbedarfs um 75 Prozent gegenüber einem Ansatz, der alle 12 Formulierungen in vivo testet.

Warum ein vollständiger Ersatz des Tierversuchs nicht möglich ist: Die Organoide bilden das Immunsystem des Darms nicht ab (keine Makrophagen, keine T-Zellen, keine Lamina propria). Die zentrale Frage des Projekts — ob die mRNA-LNP die intestinalen Makrophagen in vivo erreichen und dort anti-inflammatorische Zytokine produzieren, die die Kolitis abschwächen — kann nur im Tiermodell beantwortet werden. Die Pharmakokinetik der oral verabreichten LNP (Magenpassage, enterische Beschichtung, Mukusbarriere, zelluläre Aufnahme) ist im Organoid-Modell nicht abbildbar. Die systemische Sicherheit (Organtoxizität, Immunogenität) erfordert den Gesamtorganismus.

### 2.2 Reduce — Reduktion der Tierzahl

Die Fallzahlberechnung wurde mit G*Power 3.1.9.7 durchgeführt: Test: unabhängiger t-Test (zweiseitig), Vergleich Behandlungsgruppe vs. Positivkontrolle. Effektstärke: Cohen's d = 1,2 (basierend auf Vorversuchen im Labor: mittlerer DAI-Score Positivkontrolle = 8,5 ± 2,0, erwarteter DAI-Score Behandlung = 5,5 ± 2,5, Differenz 3,0, gepoolte SD 2,25, d = 3,0/2,25 = 1,33, konservativ auf 1,2 reduziert). Signifikanzniveau: α = 0,05 (zweiseitig). Power: 1 - β = 0,80. Ergebnis: **n = 12 pro Gruppe** (exakter Wert: n = 11,8, aufgerundet auf 12).

**Sequentielles Design (Interimsanalyse):** Nach Abschluss der ersten 24 Tiere (4 pro Gruppe, Pilotphase) wird eine Interimsanalyse durchgeführt. Abbruchkriterien: (a) Wenn die Behandlung statistisch signifikant wirksam ist (p < 0,001, adjustiert für multiples Testen nach O'Brien-Fleming-Grenze), wird der Versuch vorzeitig beendet — Einsparung 48 Tiere. (b) Wenn kein Trend zur Wirksamkeit erkennbar ist (Behandlungs-DAI ≥ Kontroll-DAI), wird die Formulierung verworfen und die verbleibenden Tiere nicht eingesetzt — Einsparung 48 Tiere. (c) Bei intermediärem Ergebnis (Trend, aber nicht signifikant) wird der Versuch mit voller Gruppengröße fortgesetzt. Die erwartete Tiereinsparung durch das sequentielle Design beträgt 30–50 Prozent.

### 2.3 Refine — Verfeinerung der Versuchsdurchführung

**Haltungsbedingungen:** IVC-Käfige (Tecniplast GM500, 501 cm² Bodenfläche, 4 Mäuse/Käfig), Einstreu (Lignocel Select Fine, autoklaviert), Nestmaterial (2 Nestlets pro Käfig, Anlin), Versteckmöglichkeit (roter Kunststoff-Tunnel, Tecniplast Mouse Tunnel, rot-transparent — Mäuse nehmen Rottöne nicht wahr und empfinden den Tunnel als dunkel), Nagematerial (Holzstäbchen, Sizzle-Nest). Temperatur 21 ± 1°C, Luftfeuchtigkeit 55 ± 10 Prozent, 12h/12h Hell-Dunkel-Zyklus (Licht 7:00–19:00). Futter: Altromin 1324 Standarddiät, ad libitum. Wasser: autoklaviertes Leitungswasser in Nippeltränken, ad libitum (mit oder ohne 3 Prozent DSS je nach Gruppe).

**Handling:** Tunnel-Handling nach dem Protokoll von Hurst & West (2010, Nature Methods 7: 825). Alle Mitarbeiter wurden vor Versuchsbeginn im Tunnel-Handling geschult (2-stündiger Workshop, praktische Übung an Übungstieren). Das Tunnel-Handling reduziert Angst und Stress der Mäuse gegenüber dem konventionellen Schwanzgriff nachweislich (reduziertes Defäkieren, erhöhte Explorationsaktivität, niedrigere Corticosteron-Spiegel im Blut).

**Schmerzmanagement:** Prophylaktisch: Metamizol (Novalgin, 200 mg/kg KG/d) im Trinkwasser ab Tag 3 der DSS-Gabe (Zeitpunkt des erwarteten Schmerzbeginns). Therapeutisch: Buprenorphin (Temgesic, 0,05 mg/kg KG, s.c.) alle 12 Stunden bei Anzeichen von Schmerzen (Grimace-Scale-Score ≥ 1, gekrümmte Haltung, reduzierte Nestbauaktivität). Wärmematte (37°C) im Käfig bei Anzeichen von Hypothermie (< 35°C rektal). Flüssigkeitssubstitution (0,5 ml NaCl 0,9 Prozent, s.c.) bei Dehydratation (Hautturgor-Test positiv, eingefallene Augen).

**Tägliches Scoring:** Jedes Tier wird täglich zwischen 8:00 und 10:00 Uhr von einer geschulten MTA gewogen und nach folgendem Score bewertet: Gewichtsverlust (0 = kein, 1 = 1–5 Prozent, 2 = 5–10 Prozent, 3 = 10–20 Prozent, 4 = > 20 Prozent), Stuhlkonsistenz (0 = normal, 1 = weich, 2 = sehr weich, 3 = Durchfall, 4 = blutiger Durchfall), Allgemeinzustand (0 = normal, 1 = leicht reduziert, 2 = deutlich reduziert, 3 = stark reduziert, 4 = moribund). Gesamt-DAI = Summe (0–12). Zusätzlich: Maus-Grimace-Scale (MGS, Langford et al. 2010, Nature Methods 7: 447) mit 5 Action Units (Orbital Tightening, Nose Bulge, Cheek Bulge, Ear Position, Whisker Change), Score 0–2 je Unit, Gesamt 0–10.

**Humane Endpunkte (sofortige Euthanasie bei):** DAI ≥ 12 über 24 Stunden, Gewichtsverlust > 20 Prozent des Ausgangsgewichts, Rektaler Prolaps, Körpertemperatur < 33°C, selbstverletzendes Verhalten oder vollständige Apathie (keine Reaktion auf sanftes Berühren). Euthanasie-Methode: CO₂-Inhalation (langsam ansteigend, 20 Prozent Kammervolumen/min, nach AVMA 2020) gefolgt von zervikaler Dislokation als Bestätigungsmethode. Alle Euthanasien werden im Tierschutzprotokoll mit Zeitpunkt, Tier-ID, Grund und Befund dokumentiert.

## 3. Versuchsdurchführung im Detail

### 3.1 Zeitlicher Ablauf DSS-Modell

Tag -7 bis Tag 0: Akklimatisierung, Baseline-Gewichtsmessung, Randomisierung. Tag 0: Beginn DSS (3 Prozent im Trinkwasser, Gruppen 2–6). Tag 1, 3, 5: Orale Gavage (Metallkanüle 20G, gebogen, atraumatisch, Volumen 200 µl) mit LNP-Formulierung oder Vehikel. Die Gavage wird unter leichter Isofluran-Narkose (2 Prozent in O₂, Induktion 30 Sekunden, Gavage während der Narkose, Aufwachzeit 30 Sekunden) durchgeführt, um den Stress der Prozedur zu minimieren und das Aspirationsrisiko zu reduzieren. Tag 0–8: Tägliches Scoring (Gewicht, DAI, MGS). Tag 7: Ende DSS-Gabe (Umstellung auf normales Trinkwasser). Tag 8: Euthanasie der Hälfte jeder Gruppe (n = 6) für die akute Analyse (Histologie, Zytokinprofil, FACS). Tag 21: Euthanasie der verbleibenden Tiere (n = 6/Gruppe) für die Erholungsanalyse (Mukosaheilung, Narbenbildung, Restinflammation).

### 3.2 Probengewinnung nach Euthanasie

Das gesamte Kolon wird entnommen und die Länge gemessen (verkürzte Colonlänge ist ein Entzündungsmaß). Das distale Drittel wird in 4 Segmente geteilt: Segment 1 (1 cm) — Histologie (Fixierung in 4 Prozent PFA, Einbettung in Paraffin, H&E-Färbung, Scoring nach Dieleman 0–40), Segment 2 (1 cm) — Multiplex-Zytokin-ELISA (Homogenisation in RIPA-Puffer, Messung IL-10, TGF-β, TNF-α, IL-6, IL-17A, IFN-γ per Meso Scale Discovery V-PLEX), Segment 3 (1 cm) — Durchflusszytometrie (Einzelzellsuspension durch enzymatischen Verdau mit Kollagenase/DNAse, Phänotypisierung der Lamina-propria-Lymphozyten: CD4⁺CD25⁺FoxP3⁺ Tregs, CD4⁺RORγt⁺ Th17, CD11b⁺F4/80⁺ Makrophagen), Segment 4 — Kryokonservierung (-80°C) als Reserve.

## 4. Genehmigungsverfahren

Der Tierversuchsantrag wird bei der zuständigen Behörde (LANUV NRW, Recklinghausen) gemäß §8 TierSchG eingereicht. Der Antrag enthält: Versuchsvorhaben-Beschreibung (dieses Protokoll), 3R-Dokumentation (Replace-Analyse, Reduce-Fallzahlberechnung, Refine-Maßnahmen), Qualifikationsnachweis der Versuchsleiterin (§9 TierSchG — Sachkundenachweis FELASA B, Versuchsleiterin Prof. Dr. med. Immunstein, FELASA-D-Kurs 2022), positive Stellungnahme der Tierschutzkommission (siehe separates Ethikvotum FA-2026-003). Die Genehmigung wird vor Beginn der Tierversuche eingeholt (geschätzte Bearbeitungszeit: 6–8 Wochen).

Musterstadt, den 28.02.2026

_Dr. med. vet. Maria Tierwohl, Tierschutzbeauftragte_`,
};
