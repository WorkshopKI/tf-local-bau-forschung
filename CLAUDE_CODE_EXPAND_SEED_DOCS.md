# Prompt: Seed-Dokumente auf 800–2000 Wörter erweitern

```
Lies CLAUDE.md.

Die synthetischen Testdaten in src/core/services/seed/ haben zu kurze Dokumenttexte.
Aktuell: ~70–110 Wörter pro Dokument. Gebraucht: 800–2000 Wörter pro Dokument.

Der Batch-Indexer chunked Texte in 200-Wort-Blöcke mit 50 Wort Overlap.
Bei 100-Wort-Dokumenten entsteht nur 1 Chunk — das reicht nicht für
semantische Suche. Wir brauchen 4–10 Chunks pro Dokument.

WICHTIG: Das Embedding-Modell (all-MiniLM-L6-v2) wird auf semantische
Ähnlichkeit getestet. Die Texte MÜSSEN inhaltlich reichhaltig sein:
- Fachbegriffe UND Umgangssprache-Äquivalente (z.B. "Feuerwiderstandsklasse" 
  UND "feuerfeste Wände" im selben Dokument)
- Querverweise zwischen Themengebieten (Brandschutz erwähnt Statik,
  Energienachweis erwähnt Schallschutz)
- Konkrete Zahlen, Normen, Maße (DIN-Nummern, kN/m², dB-Werte)
- Amtsdeutsch für Bauanträge, Wissenschaftsdeutsch für Forschung

═══════════════════════════════════════════════════
VORGEHEN
═══════════════════════════════════════════════════

Die Dateien werden zu groß für 300 Zeilen pro Datei wenn 15-25 Dokumente
mit 800-2000 Wörtern drin sind. Daher: JEDES Dokument in eine eigene Datei.

Neue Struktur:
  src/core/services/seed/docs/
    bau-001-formular-ba001.ts
    bau-002-formular-ba002.ts
    bau-003-formular-ba008.ts
    ...
    forschung-001-projekt-fa001.ts
    forschung-002-projekt-fa002.ts
    ...

Jede Datei exportiert EIN Document-Objekt:
  import type { Document } from '@/plugins/dokumente/store';
  export const doc: Document = {
    id: 'seed-doc-XXX',
    filename: '...',
    format: 'md',
    markdown: `...langer Text...`,
    tags: [...],
    created: '2026-...',
    vorgangId: '...',
  };

Dann dokumente-data.ts sammelt alle:
  import { doc as doc001 } from './docs/bau-001-formular-ba001';
  import { doc as doc002 } from './docs/bau-002-formular-ba002';
  ...
  export const allDokumente: Document[] = [doc001, doc002, ...];

Lösche die alten Dateien:
  dokumente-bau-1.ts
  dokumente-bau-2.ts
  dokumente-forschung.ts

═══════════════════════════════════════════════════
TEXTANFORDERUNGEN PRO DOKUMENT
═══════════════════════════════════════════════════

Jeder Text MUSS:
- Zwischen 800 und 2000 Wörter lang sein
- Realistisches deutsches Fach-Markdown sein (Überschriften, Listen, Absätze)
- Inhaltlich korrekte Fachbegriffe verwenden
- YAML-artigen Frontmatter-Header haben (Titel, Datum, Aktenzeichen)
- Mindestens 3 Markdown-Überschriften (##) enthalten

═══════════════════════════════════════════════════
DIE 60 DOKUMENTE (Inhaltsvorgaben)
═══════════════════════════════════════════════════

Behalte die gleichen IDs, Dateinamen, Tags und Vorgang-Zuordnungen wie bisher.
Erweitere NUR den markdown-Text. Hier die Inhaltsvorgaben pro Dokument:

### FORMBLÄTTER (6 Stück, je 800-1000 Wörter)

DOC seed-doc-001 Bauantragsformular_BA001.md (EFH Ahornweg):
Vollständiges Formular. Bauherr-Daten, Grundstücksdaten (Flurstück, Gemarkung,
Kataster), Gebäudeklasse 1, Baubeschreibung (Massivbau, Satteldach 38°,
165m² Wohnfläche, 680m³ umbauter Raum), Konstruktion (KS-Mauerwerk, WDVS
180mm, Stahlbeton-Bodenplatte), Haustechnik (Luft-Wasser-WP, Solar-TWW,
Fußbodenheizung), Entwässerung (Schmutzwasser Kanal, Regenwasser Rigole),
Stellplatznachweis (2 PKW, 1 Carport), Abstandsflächen §6 BauO, GRZ/GFZ
Berechnung, Unterschriften. Verwende konkrete Maße und Normen.

DOC seed-doc-002 Bauantragsformular_BA002.md (MFH Lindenstraße):
4-geschossig + Staffel, 12 WE, Tiefgarage 18 Stellplätze, Klinker-VHF,
Fernwärme, zentrale Lüftung WRG 85%, Dachbegrünung extensiv,
Regenwasserretention mit gedrosselter Einleitung, Fahrradabstellanlage,
Müllraum, Barrierefreiheit DIN 18040-2, Aufzug.

DOC seed-doc-003 Bauantragsformular_BA008.md (Gewerbehalle):
Produktionshalle Stützenraster 15x24m, lichte Höhe 8m, Stahlrahmen mit
Sandwichpaneelen, Büroanbau 2-geschossig 240m², Kranbahnanlage 10t,
Industrieestrich, LKW-Laderampe, Erschließung Kanalanschluss DN300.

DOC seed-doc-004 Bauantragsformular_BA012.md (Kita):
6 Gruppen, 90 Kinder, eingeschossig Holzrahmenbau, Gründach mit
Spielbereich, Barrierefreiheit DIN 18040-1, Außenspielanlage 1400m²,
kindgerechte Sanitäranlagen, BMA Kategorie 1, Evakuierungskonzept.

DOC seed-doc-005 Bauantragsformular_BA018.md (Seniorenwohnanlage):
24 WE + Gemeinschaftsräume + Tagespflege, 3-geschossig, Aufzüge DIN EN 81,
Barrierefreiheit komplett, Notrufanlage, Pflegebad, Gemeinschaftsküche.

DOC seed-doc-006 Bauantragsformular_BA024.md (Radschnellweg-Brücke):
Spannweite 42m, Nutzbreite 4,50m, Stahl-Holz-Verbund, Geländer 1,30m,
Beleuchtung, Entwässerung, Widerlager Stahlbeton, UVP-Ergebnis.

### STATIK/TRAGWERK (6 Stück, je 1200-1800 Wörter)

DOC seed-doc-007 Statik_Tragwerk_BA002.md (MFH):
Eurocode 2 komplett. Lastannahmen (Eigengewicht, Nutzlast Kat A, Schnee
Zone 2a, Wind Zone 2). Gründung (Flachgründung, σzul 250kN/m²,
Streifenfundamente, WU-Beton Tiefgarage). Decken (Flachdecken d=22cm,
Durchstanznachweis mit Dübelleisten, Schwingungsnachweis). Stützen
(Normalkraftbemessung, Knicklänge). Erdbeben Zone 1. Aussteifungskonzept
über Kerne und Wandscheiben. Bewehrungsskizzen beschreiben.

DOC seed-doc-008 Statik_Tragwerk_BA004.md (Dachausbau):
Bestandsaufnahme Holzdach 1965. Pfettendach, Sparren 10/16, Holzbalkendecke
12/22. Nachrechnung EC5. Biegetragfähigkeit 87%, Durchbiegung L/280.
Verstärkungsmaßnahmen: BSH-Aufdopplung, Vollgewindeschrauben. Gauben-Wechsel.
Lastpfad bis Fundament nachweisen.

DOC seed-doc-009 Statik_Tragwerk_BA010.md (Tiefgarage):
2-geschossig WU-Beton. Stützenraster 8,10x5,40m. Deckenplatte d=28cm
Flachdecke mit Stützenkopfverstärkung. Bodenplatte d=35cm. Wasserdruckhöhe
3,80m, Auftriebsnachweis γ=1,25. Durchstanzen. Rissbreitennachweis
WU-Konstruktion.

DOC seed-doc-010 Statik_Tragwerk_BA011.md (Aufstockung):
Bestandsanalyse MW 36,5cm Vollziegel. Holzrahmenbau-Aufstockung.
Gewichtsersparnis 60% vs Massivbau. Nachweis Bestandswände EC6.
Ausnutzung 78%. Fundamentverstärkung Unterfangung.

DOC seed-doc-011 Statik_Tragwerk_BA016.md (Quartiersgarage):
4-geschossig Fertigteilbau. Spannbetonhohlplatten auf Unterzügen.
Stützen 40x40 C50/60. Windverband. Fahrzeuglast DIN EN 1991-1-1.
Anpralllasten. Dauerhaftigkeit XD3/XC4 Tausalz. OS8 Beschichtung.

DOC seed-doc-012 Statik_Tragwerk_BA024.md (Brücke):
Stahl-Holz-Verbund HEB400 + GL28h. Spannweite 42m.
Schwingungsnachweis f1=2,8Hz, Beschleunigungsnachweis amax=0,42m/s².
Ermüdungsnachweis Schweißnähte K80. Lager und Dehnfugen.
Korrosionsschutz Stahlbau.

### BRANDSCHUTZ (5 Stück, je 1200-1800 Wörter)

DOC seed-doc-013 Brandschutz_BA002.md (MFH):
GK4 komplett. REI90 tragende Bauteile. Rettungswegekonzept (2 Treppenräume,
28m Lauflänge, 2. RW über Anleitern). Löschwasser (Hydrant, Wandhydrant,
800l/min). BMA Kat 2. Rauchmelder DIN 14676. Feuerwehrzufahrt DIN 14090.
Brandwände zwischen Nutzungseinheiten. Installationsschächte.

DOC seed-doc-014 Brandschutz_BA006.md (Altlasten):
PAK-Kontamination + Brandschutz. Ex-Zone 2 Bodensanierung. Gasmesstechnik.
Neubau: Stahlbau F30, Brandwand Büro/Halle, BMA Kat 1, Sprinkler VdS CEA
4001, RWA 3% Grundfläche.

DOC seed-doc-015 Brandschutz_BA012.md (Kita):
Versammlungsstätte Kinder! Evakuierung Kleinkinder (Krippenwagen,
max 25m zu Notausgängen). Ebenerdige Ausgänge. Panikbeschlag DIN EN 1125.
Flurbreite 1,80m. Sammelplatz. Vierteljährliche Übungen.
BMA Kat 1, Hausalarm 75dB. Löschdecken.

DOC seed-doc-016 Brandschutz_BA013.md (Gastronomie):
Küche Fettabscheider DIN EN 1825, Lüftung F90 Brandschutzklappen,
Abluftkanal L90. Fluchtweg durch Gastraum max 25m.
Außengastronomie Feuerwehrzufahrt 3,50m.

DOC seed-doc-017 Brandschutz_BA018.md (Seniorenwohnanlage):
Horizontale Evakuierung in Nachbarabschnitt. Brandwand je Geschoss.
Rauchschutztüren T30-RS. Aufzug Feuerwehrbetrieb. Evakuierungsstühle.
Pieper-Alarmierung Personal vor Hausalarm. BMA Kat 1.

### SCHALLSCHUTZ (3 Stück, je 1000-1400 Wörter)

DOC seed-doc-018 Schallschutz_BA002.md (MFH):
DIN 4109 + VDI 4100 SSt II. Wohnungstrennwände R'w≥56dB (erreicht 59dB KS+Vorsatz).
Trittschall L'n,w≤46dB (erreicht 43dB schwimmender Estrich).
Außenlärm LP IV, Schallschutzfenster SSK3 R'w=37dB.
Haustechnische Anlagen Schallschutz. Aufzugsschacht entkoppelt.

DOC seed-doc-019 Schallschutz_BA011.md (Aufstockung):
Flankenschall Bestand/Aufstockung. Elastomerlager Schwellen.
Abgehängte Decke Federschienen 2x12,5 GK. BSP-Decke mit Trittschalldämmung.
Berechnung Flankenübertragung.

DOC seed-doc-020 Schallschutz_BA013.md (Gastronomie):
TA Lärm Mischgebiet tags 60/nachts 45 dB(A).
Außengastronomie 62dB(A) → 48dB(A) am IO → 3dB Überschreitung.
Maßnahmen: Betriebszeit 22h, Schallabsorption, Küchenlüftung Schalldämpfer.

### ENERGIENACHWEIS (4 Stück, je 1000-1400 Wörter)

DOC seed-doc-021 Energienachweis_BA001.md (EFH KfW-55):
GEG 2024. U-Werte alle Bauteile (Wand 0,18, Dach 0,14, Boden 0,22,
Fenster Uw 0,95). Heizlast DIN 12831: 6,2kW. Wärmepumpe JAZ 3,8.
Solar-TWW 6m². Primärenergie 32 vs 40 kWh/(m²a). Sommerlicher Wärmeschutz
Raffstores. Lüftungskonzept. Energieausweis-Daten.

DOC seed-doc-022 Energienachweis_BA002.md (MFH Fernwärme):
Fernwärme fp=0,5. Zentrale Lüftung WRG 85%. Klinkerfassade VHF U=0,16.
Gründach U=0,12. Primärenergie 28 kWh/(m²a). DIN 1946-6 Lüftungskonzept.

DOC seed-doc-023 Energienachweis_BA009.md (Solar Bestand):
Ertragsprognose PV 8,5kWp auf Satteldach Süd. Eigenverbrauch 35%.
Einspeisevergütung. Amortisation 12 Jahre. Statik Dachlast.
Blitzschutz-Anpassung. Zählerkonzept.

DOC seed-doc-024 Energienachweis_BA014.md (EFH + Einlieger):
Getrennte Energiebilanzen Hauptwohnung/Einlieger. WP Split 2 Innengeräte.
PV 9,8kWp mit 10kWh Speicher. Autarkie 62%.

### STELLUNGNAHMEN (5 Stück, je 1000-1400 Wörter)

DOC seed-doc-025 Stellungnahme_Nachbar_BA002.md:
Einspruch wegen Verschattung. Besonungsstudie DIN EN 17037 (2h am 21.3.).
Abstandsflächen-Berechnung H=0,4×Wandhöhe. 3D-Verschattungssimulation.
Ergebnis: Besonnung Nachbar Südfenster 3,2h → Einspruch unbegründet.

DOC seed-doc-026 Stellungnahme_Denkmalschutz_BA005.md:
Scheune 1890, Bruchsteinmauerwerk, Dachstuhl Eiche. Materialvorgaben:
Kalkputz (kein Zement!), Biberschwanz-Dachziegel, Sprossenfenster Holz.
Substanzerhalt vor Komfort. Heizkonzept: Wandtemperierung statt Heizkörper.

DOC seed-doc-027 Stellungnahme_Denkmalschutz_BA021.md:
Fachwerk 18. Jh, Hausschwamm-Verdacht. Holzschutzgutachten angefordert.
Befundöffnungen an 12 Stellen. Restaurierungsempfehlung: Auswechslung
befallener Hölzer, Schwammsanierung, Schwellenaustausch. Kosten-Prognose.

DOC seed-doc-028 Stellungnahme_Umwelt_BA019.md:
PV-Freifläche Feldlerchen-Brutrevier. Kartierung März-Juni.
3 Brutpaare nachgewiesen. Vermeidungsmaßnahmen: Bauzeit außerhalb Brutperiode.
Ausgleich: 3 Lerchenfenster auf Ackerfläche. CEF-Maßnahmen.

DOC seed-doc-029 Stellungnahme_Wasserbehörde_BA020.md:
Hochwasserschutzmauer. HQ100-Abfluss 285 m³/s. Retentionsraumverlust
durch Mauer: 1.200 m³. Kompensation: Rückverlegung Deichlinie 200m flussabwärts.
Hydraulisches Modell 2D. Strömungsgeschwindigkeiten. Kolkschutz.

### GUTACHTEN SPEZIAL (4 Stück, je 1200-1800 Wörter)

DOC seed-doc-030 Altlastengutachten_BA006.md:
Historische Erkundung (Tankstelle 1960-1990). Bodenproben 14 RKS bis 5m.
PAK-Belastung 82mg/kg (Prüfwert BBodSchV: 20mg/kg). BTEX unterhalb PW.
Sanierungsvarianten: Auskofferung (380.000€) vs. Einkapselung (210.000€) vs.
In-situ-Behandlung (450.000€). Empfehlung Auskofferung wegen Neubau.
Entsorgungsnachweis. Grundwasser-Monitoring 2 Jahre.

DOC seed-doc-031 Hydrogeologie_BA010.md:
4 Grundwassermessstellen. Pumpversuch 72h. kf-Wert 2,5×10⁻⁴ m/s (Kies).
GW-Stand 1,80m u. GOK. Baugrube 5,60m tief. Grundwasserhaltung:
Brunnenreihe 8 Brunnen, Fördermenge 12 l/s. Einleitgenehmigung Vorfluter.
Setzungsprognose Nachbarbebauung (max 8mm). Monitoring-Konzept.

DOC seed-doc-032 Mobilitaetskonzept_BA016.md:
Quartiersgarage 120 Stellplätze, reduzierter Schlüssel 0,6 statt 1,0.
Carsharing 4 Stellplätze (2 E-Fahrzeuge). Bike-Sharing Station.
Fahrradabstellanlage 240 Plätze (Doppelstockparker). Lastenrad-Verleih.
ÖPNV-Anbindung (Bus 5min, Tram 12min). Mobilitäts-App. Stellplatz-
Bewirtschaftung. Monitoring jährlich, Nachsteuerung nach 3 Jahren.

DOC seed-doc-033 Artenschutz_BA019.md:
Artenschutzrechtlicher Fachbeitrag PV-Freifläche 3,5ha.
Kartierung Brutvögel (18 Arten, davon 3 Rote Liste). Fledermäuse
(Großes Mausohr Transferflug). Reptilien (Zauneidechse 2 Individuen).
Verbotstatbestände §44 BNatSchG. CEF: Lerchenfenster, Eidechsen-Habitat,
Fledermauskästen. Bauzeitbeschränkung März-August.

### NACHFORDERUNGEN (2 Stück, je 800-1000 Wörter)

DOC seed-doc-034 Nachforderung_BA004.md:
Formelles Schreiben. Fehlende Unterlagen: Tragwerksnachweis Bestandsdach,
Wärmeschutznachweis DG-Ausbau, Entwässerungsplan. Rechtsgrundlage §68 BauO.
Frist 4 Wochen. Rechtsfolgenbelehrung (Antrag gilt als zurückgenommen).

DOC seed-doc-035 Nachforderung_BA017.md:
Tiny House: B-Plan-Befreiungsantrag fehlt (§31 BauGB Begründung),
Erschließungsnachweis (Trinkwasser, Abwasser, Strom),
Entwässerungskonzept (Sammelleitung), Stellplatznachweis.

### FORSCHUNG: PROJEKTBESCHREIBUNGEN (10 Stück, je 1500-2000 Wörter)

DOC seed-doc-036 Projekt_FA001.md (KI Brückeninspektion):
Problemstellung (230.000 Brücken in DE, Inspektionsstau). Stand der Forschung
(CNN, YOLO, Transfer Learning). Methodik: Drohnenaufnahmen → Segmentierung →
Schadensklassifizierung (Risse, Abplatzungen, Bewehrungskorrosion).
Datensatz: 50.000 annotierte Bilder. Arbeitspakete (6 AP, 24 Monate).
Personalplanung. Meilensteine. Erwartete Ergebnisse: Inspektionszeit -70%.

DOC seed-doc-037 Projekt_FA002.md (Perowskit-Solar):
Degradationsmechanismen Perowskit (Feuchtigkeit, UV, Temperatur).
Tandem CIGSe/Perowskit Architektur. Encapsulation Strategien.
Rolle-zu-Rolle Skalierung. Wirkungsgrad-Ziel: 28% (Labor → 22% Modul).
Gebäudeintegration (BIPV) Fassade und Dach.

DOC seed-doc-038 Projekt_FA003.md (mRNA Darmerkrankungen):
Pathophysiologie Morbus Crohn + Colitis ulcerosa. Aktuelle Therapien
(Biologika, Immunsuppressiva) und Limitationen. mRNA-Ansatz:
Lipid-Nanopartikel mit Colon-Targeting. Tiermodell DSS-Kolitis.
Präklinische Endpoints. Translation Phase I Design. Ethik.

DOC seed-doc-039 Projekt_FA005.md (Urbane Biodiversität eDNA):
eDNA Metabarcoding Methodik. Probennahme Stadtgewässer (12 Standorte,
monatlich). DNA-Extraktion, PCR-Amplifikation, Illumina-Sequenzierung.
Bioinformatik-Pipeline (DADA2, Taxonomie-Assignment). Referenzdatenbanken.
Monitoring-Dashboard (Web-App). Vergleich mit klassischer Kartierung.

DOC seed-doc-040 Projekt_FA008.md (Quantenalgorithmen):
QAOA vs VQE für kombinatorische Optimierung (TSP, MaxCut, Job Shop).
Fehlerkorrektur Surface Codes. Benchmarking IBM Eagle 127 Qubits.
Noise-Modell. Qubit-Overhead Analyse. Vergleich mit klassischen Solvern
(Gurobi, CPLEX). Quantenvorteil-Schwelle bestimmen.

DOC seed-doc-041 Projekt_FA009.md (Lithium Bioleaching):
Acidithiobacillus ferrooxidans Bioleaching-Prozess. Altbatterien-Aufbereitung
(Zerkleinerung, Schwarzpulver-Gewinnung). Bioreaktoren 50L → 500L Pilotanlage.
Prozessparameter (pH, Temperatur, Feststoffgehalt). Rückgewinnungsraten Li, Co, Ni.
Vergleich mit pyrometallurgischem Verfahren. LCA. Wirtschaftlichkeit.

DOC seed-doc-042 Projekt_FA011.md (Digitale Zwillinge Wassernetze):
Sensornetzwerk 200 Drucksensoren + 50 Durchflussmesser.
Hydraulisches Modell (EPANET-basiert). Machine Learning Leckage-Erkennung
(LSTM Anomalie-Detection). Digitaler Zwilling Echtzeit-Simulation.
Prädiktive Instandhaltung: Rohrbruch-Wahrscheinlichkeit. Dashboard.

DOC seed-doc-043 Projekt_FA013.md (Agrivoltaik):
PV-Module in 5m Höhe über Ackerland. Verschattungssimulation (PVsyst).
Ertragsmessung Weizen (12 Parzellen, 3 Jahre). Mikroklimatologie
(Bodenfeuchte, Temperatur, PAR). Ökonomische Gesamtbilanz: Strom + Ernte.
Gesellschaftliche Akzeptanz (Befragung 200 Landwirte).

DOC seed-doc-044 Projekt_FA014.md (Verwaltungsautomation Sprachmodelle):
RAG-Architektur für kommunale Genehmigungsverfahren. Fine-Tuning auf
Verwaltungstexte. Datenschutz: On-Premise, keine Cloud, Art. 22 DSGVO.
Evaluierung: Juristisch korrekte Bescheide? Halluzinationsrate?
Vergleich mit manueller Bearbeitung (Bearbeitungszeit, Fehlerquote).

DOC seed-doc-045 Projekt_FA016.md (Biokunststoffe Lignocellulose):
Aufschlussverfahren Holzreste (Organosolv, Steam Explosion). Enzymatische
Hydrolyse (Cellulase-Cocktail). Polymerisation PLA/PHA.
Materialprüfung (Zugfestigkeit, E-Modul, Schlagzähigkeit, Abbaubarkeit).
Pilotanlage 500kg/d. LCA vs. Petrochemie.

### FORSCHUNG: GUTACHTEN/REVIEWS (8 Stück, je 1000-1500 Wörter)

DOC seed-doc-046 Review_FA001.md (KI Brücken):
Stärken (innovativ, Praxisrelevanz), Schwächen (Datensatz einseitig,
nur Stahlbetonbrücken), Empfehlung Förderung unter Auflagen
(Erweiterung auf Stahl- und Holzbrücken).

DOC seed-doc-047 Review_FA003.md (mRNA Ethikvotum):
Tierschutzrechtliche Bewertung DSS-Kolitis-Modell Maus.
Schweregradeinschätzung: mittel. Anzahl Versuchstiere 120. 
GLP-Konformität. 3R Prinzip Bewertung. Empfehlung: Genehmigung mit Auflagen.

DOC seed-doc-048 Review_FA006.md (Lieferroboter Nachbesserung):
Sicherheitskonzept unzureichend (Fußgänger-Kollision, Bordstein,
Kreuzungen). Haftungsfragen §7 StVG. Datenschutz Kameras DSGVO.
Nachbesserungsbedarf: Safety Case, Versicherungsnachweis, DPIA.

DOC seed-doc-049 Review_FA008.md (Quantenalgorithmen Peer Review):
Vergleich Quanten vs. klassisch methodisch korrekt? Reproduzierbarkeit:
Code verfügbar? Hardware-Zugang? Qubit-Overhead realistisch für 2026?
Empfehlung: Major Revision, mehr Praxis-Benchmarks.

DOC seed-doc-050 Review_FA010.md (Längsschnittstudie):
Stichprobengröße n=300 → Power-Analyse. Dropout über 5 Jahre: 40% realistisch?
Konfundierung Arbeitsmarkt-Konjunktur. Panel-Attrition.
Empfehlung: Oversampling, Mixed-Methods ergänzen.

DOC seed-doc-051 Review_FA012.md (Stammzell-Therapie):
ATMP regulatorischer Pfad PEI. GMP-Herstellung Cleanroom B.
Sicherheitsprofil: Tumorigenitäts-Risiko. Phase-I-Design 3+3.
Empfehlung: Förderung, aber FDA-Abstimmung zusätzlich.

DOC seed-doc-052 Review_FA015.md (Klimaadaptive Stadtplanung):
Hitze-Modellierung ENVI-met validiert? Schwammstadt-Maßnahmen
(Rigolen, Baumrigolen, Versickerungsmulden). Umsetzbarkeit in
Bestandsquartieren. Empfehlung: Mehr Praxispartner einbinden.

DOC seed-doc-053 Review_FA016.md (Biokunststoffe):
Scale-up-Risiken Lab→Pilot (Enzym-Kosten, Kontamination).
Materialperformance vs. PE/PP. LCA-Methodik: Systemgrenzen?
Empfehlung: Förderung, Industriepartner einbinden.

### FORSCHUNG: ETHIK/DATENSCHUTZ/COMPLIANCE (5 Stück, je 1000-1400 Wörter)

DOC seed-doc-054 Ethik_FA003.md (Tierversuch):
3R-Prinzip detailliert. Versuchstierbedarf 120 Mäuse C57BL/6.
Schmerzbelastung mittel (Score 2). Endpunkte: Gewichtsverlust >20%,
Blut im Stuhl Score 4. Abbruchkriterien. Alternativmethoden-Recherche.
Organoid-Modelle als Ergänzung.

DOC seed-doc-055 Ethik_FA010.md (Datenschutz Langzeitarbeitslose):
DSFA nach Art. 35 DSGVO. Besondere Kategorien personenbezogener Daten
(Gesundheit, ethnische Herkunft). Pseudonymisierung durch Treuhänder.
Aufbewahrung 10 Jahre. Löschkonzept. Einwilligungsprozess.
Rechte der Betroffenen (Auskunft, Löschung, Widerruf).

DOC seed-doc-056 Datenschutz_FA014.md (Verwaltungsautomation):
Kommunale Antragsdaten als Trainingsdaten. Anonymisierung vs. Pseudonymisierung.
On-Premise Deployment (kein Cloud-Upload). Art. 22 DSGVO: Recht auf
menschliche Überprüfung bei automatisierten Bescheiden. Löschpflichten.
Audit-Trail. Zugriffskontrolle rollenbasiert.

DOC seed-doc-057 Compliance_FA009.md (Bioleaching Umweltrecht):
Abfallrecht: Altbatterien als gefährlicher Abfall. Gefahrstoffverordnung:
Umgang mit Schwefelsäure, Schwermetall-Lösungen. BImSchG-Genehmigung
Bioreaktor. Arbeitsschutz: PSA, Notduschen, Augenspülstation.
Abwassereinleitung: Grenzwerte Schwermetalle.

DOC seed-doc-058 Compliance_FA011.md (IT-Sicherheit Wassernetze):
KRITIS-Verordnung Wasserversorgung. BSI IT-Grundschutz.
Zugriffskontrolle: Zwei-Faktor, VPN. Netzwerksegmentierung OT/IT.
Patch-Management Sensornetzwerk. Incident Response Plan.
Penetrationstest jährlich. Backup-Strategie.

### FORSCHUNG: ZWISCHENBERICHTE (2 Stück, je 1200-1600 Wörter)

DOC seed-doc-059 Zwischenbericht_FA001.md (KI Brücken 12 Monate):
Datensatz: 50.000 Bilder, 5 Schadensklassen, annotiert (3 Annotatoren,
Cohen's Kappa 0,82). Modell: ResNet-50 fine-tuned, Accuracy 94%,
mAP 0,89. Feldtest 3 Brücken (A7-Autobahnbrücke, Fußgängerbrücke,
Eisenbahnüberführung). Zeitersparnis vs. manuelle Inspektion 68%.
Fehldetektionsrate 3%. Nächste Schritte: Erweiterung Stahlbrücken.

DOC seed-doc-060 Zwischenbericht_FA004.md (Selbstheilende Betone):
Mikrokapsel-Synthese: Urea-Formaldehyd Hülle, Epoxid-Kernmaterial.
Kapselgröße 100-200µm. Druckfestigkeit mit 3% Kapselzugabe: -8% (akzeptabel).
Rissüberbrückung: Bis 0,3mm nachgewiesen (Kapillar-Saugversuch).
Dauerhaftigkeitstest: Frost-Tau-Wechsel 150 Zyklen laufend.
Nächstes Ziel: Bakterielle Kapseln (Bacillus-Sporen + Calciumlactat).

═══════════════════════════════════════════════════
VORGEHEN FÜR CLAUDE CODE
═══════════════════════════════════════════════════

1. Erstelle src/core/services/seed/docs/ Verzeichnis
2. Für JEDES der 60 Dokumente:
   - Erstelle eine eigene .ts Datei
   - Schreibe den VOLLEN Text (800-2000 Wörter) als Markdown
   - Der Text MUSS realistisches Fachdeutsch sein, nicht Platzhalter
   - Verwende die Inhaltsvorgaben oben als Leitfaden — nicht als Grenze
   - Füge Details hinzu: konkrete Normen, Berechnungsergebnisse, Maße,
     Empfehlungen, Schlussfolgerungen
3. Aktualisiere dokumente-data.ts als Sammel-Import
4. Lösche die alten Dateien (dokumente-bau-1.ts, dokumente-bau-2.ts, dokumente-forschung.ts)
5. Prüfe: npm run build:single muss durchlaufen
6. Prüfe: Gesamte Wortanzahl aller Dokumente sollte >50.000 Wörter sein

HINWEIS: Das sind VIELE Dateien. Arbeite systematisch:
- Erst alle Bau-Formblätter (6 Dateien)
- Dann Statik (6)
- Dann Brandschutz (5)
- usw.
Committe nach jeder Gruppe.

Final commit: "feat: expand seed documents to 800-2000 words for embedding search testing"
```
