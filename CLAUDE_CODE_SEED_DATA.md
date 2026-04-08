# Prompt: Synthetische Testdaten für Embedding-Suche generieren

```
Lies CLAUDE.md.

Erstelle ein Seed-Script und einen Admin-Button der realistische deutsche Testdaten
für Bau- und Forschungsanträge generiert. Die Daten dienen zum Testen der
Hybrid-Suche (Keyword + Vektor-Embedding). GPU-Laptop wird für die Indexierung genutzt.

WICHTIG: Die Dokument-Texte müssen LANG und REALISTISCH sein (800–2000 Wörter),
damit das Chunking (200 Wörter, 50 Overlap) sinnvoll greift und die
Embedding-Suche semantische Matches finden kann.

═══════════════════════════════════════════════════
TEIL 1: Seed-Funktion
═══════════════════════════════════════════════════

Erstelle src/core/services/seed/seed-data.ts

Die Funktion seedTestData(storage: StorageService) soll:
1. Prüfen ob schon Seed-Daten existieren (Key 'seed-complete' in IDB)
2. Wenn ja: return (nicht doppelt seeden)
3. Wenn nein: Alle Daten erzeugen, in IDB schreiben, 'seed-complete' = true setzen
4. Return: { vorgaenge: number, dokumente: number, artefakte: number }

═══════════════════════════════════════════════════
TEIL 2: VORGÄNGE — 24 Bauanträge + 16 Forschungsanträge = 40 Vorgänge
═══════════════════════════════════════════════════

Jeder Vorgang wird via storage.saveVorgang() gespeichert (nutzt IDB + Sync-Queue).

### 24 Bauanträge

Jeder braucht: id (BA-2026-001 bis 024), title, status, priority, assignee,
created (verschiedene Daten in 2026), modified, deadline (manche), tags, notes.
Nutze VERSCHIEDENE Status, Prioritäten und Sachbearbeiter für Realismus.

| # | Titel | Status | Priorität | Tags | Notizen (2-4 Sätze) |
|---|---|---|---|---|---|
| 001 | Neubau Einfamilienhaus, Ahornweg 15 | genehmigt | normal | Neubau, EFH, Wohngebiet | Alle Unterlagen vollständig. Genehmigung erteilt am 15.02.2026. Auflagen zum Regenwassermanagement beachten. |
| 002 | Neubau Mehrfamilienhaus, Lindenstraße 42 | in_pruefung | hoch | Neubau, MFH, Verdichtung | Statik-Gutachten liegt vor. Brandschutzkonzept in Prüfung bei Feuerwehr. 12 Wohneinheiten auf 4 Geschossen. |
| 003 | Anbau Wintergarten, Buchenring 7 | genehmigt | niedrig | Anbau, Wintergarten | Grenzabstand eingehalten. Nachbar hat zugestimmt. Unbedenklich. |
| 004 | Dachgeschossausbau, Kastanienallee 23 | nachforderung | normal | Ausbau, Dachgeschoss, Statik | Tragwerksnachweis fehlt. Nachforderung an Bauherrn versendet am 10.03.2026. Frist: 10.04.2026. |
| 005 | Nutzungsänderung Scheune zu Wohnraum, Dorfstraße 8 | in_bearbeitung | hoch | Nutzungsänderung, Denkmal, Umbau | Denkmalschutzrechtliche Stellungnahme angefordert. Bestandsgebäude von 1890. Heizkonzept offen. |
| 006 | Abbruch Altbestand + Neubau, Industrieweg 3 | in_pruefung | dringend | Abbruch, Neubau, Gewerbe, Altlasten | Altlastengutachten zeigt Bodenbelastung mit PAK. Sanierungskonzept erforderlich vor Baubeginn. |
| 007 | Carport mit Gründach, Rosenweg 19 | genehmigt | niedrig | Carport, Gründach | Verfahrensfrei nach §63. Informationsschreiben an Bauherrn versandt. |
| 008 | Gewerbehalle mit Bürotrakt, Gewerbepark Süd 12 | in_bearbeitung | hoch | Gewerbe, Neubau, Erschließung | Erschließungsvertrag mit Gemeinde in Verhandlung. B-Plan-Änderung erforderlich für GRZ-Überschreitung. |
| 009 | Solardachanlage auf Bestandsgebäude, Marktplatz 5 | genehmigt | normal | Solar, Denkmal, Energie | Denkmalschutzrechtliche Genehmigung erteilt unter Auflagen. Nur dachintegrierte Module zulässig. |
| 010 | Tiefgarage unter Wohnanlage, Parkstraße 30 | in_pruefung | dringend | Tiefgarage, Statik, Grundwasser | Hydrogeologisches Gutachten zeigt hohen Grundwasserspiegel. Weiße Wanne erforderlich. Kosten steigen erheblich. |
| 011 | Aufstockung Bestandsgebäude, Schulstraße 14 | nachforderung | hoch | Aufstockung, Statik, Wohnraum | Bestandsstatik tragfähig laut Gutachten. Schallschutznachweis für die neue Nutzungseinheit fehlt noch. |
| 012 | Kindertagesstätte Neubau, Am Stadtpark 1 | in_bearbeitung | dringend | Kita, Neubau, Sozial | Förderantrag beim Land gestellt. Raumprogramm mit Jugendamt abgestimmt. Barrierefreiheit nach DIN 18040 sicherstellen. |
| 013 | Umbau Ladengeschäft zu Gastronomie, Hauptstraße 67 | in_pruefung | normal | Umbau, Gastronomie, Nutzungsänderung | Lüftungskonzept vorgelegt. Stellungnahme Gesundheitsamt steht aus. Lärmschutzgutachten wegen Außengastronomie erforderlich. |
| 014 | Wohnhaus mit Einliegerwohnung, Feldweg 4 | genehmigt | niedrig | Neubau, EFH, Einlieger | Standard-Wohngebiet. Alle Nachweise vollständig. KfW-55-Standard. |
| 015 | Rückbau und Entsiegelung, Bahnhofstraße 22 | in_bearbeitung | normal | Rückbau, Entsiegelung, Ökologie | Entsiegelungskonzept positiv bewertet. Ausgleichsfläche im Bebauungsplan festgesetzt. |
| 016 | Mehrfamilienhaus mit Quartiersgarage, Neue Mitte 8 | in_pruefung | hoch | MFH, Quartiersgarage, Mobilität | Mobilitätskonzept mit reduziertem Stellplatzschlüssel. Carsharing-Stellplätze vorgesehen. |
| 017 | Tiny House Siedlung, Obstgartenweg 3 | nachforderung | normal | Tiny House, Sondergebiet, Innovation | B-Plan sieht keine Tiny Houses vor. Befreiungsantrag gestellt. Erschließung über Sammelleitung geplant. |
| 018 | Seniorenwohnanlage mit Tagespflege, Kirchplatz 11 | in_bearbeitung | hoch | Senioren, Pflege, Barrierefreiheit | Abstimmung mit Sozialbehörde läuft. Förderantrag beim Pflegefonds eingereicht. 24 Wohneinheiten plus Gemeinschaftsräume. |
| 019 | Photovoltaik-Freiflächenanlage, Flur 7 Gemarkung Ost | in_pruefung | normal | PV, Freifläche, Energie, Landwirtschaft | Naturschutzrechtliche Prüfung wegen Feldlerchenvorkommen. Agri-PV Konzept als Alternative geprüft. |
| 020 | Hochwasserschutzmauer, Uferpromenade | in_bearbeitung | dringend | Hochwasser, Infrastruktur, Schutz | Hydraulisches Gutachten zeigt HQ100-Risiko. Eilbedürfnis wegen bevorstehender Schneeschmelze. Fördermittel bewilligt. |
| 021 | Sanierung Fachwerkhaus, Altstadt 9 | nachforderung | normal | Sanierung, Fachwerk, Denkmal | Befund Holzschutzgutachten steht aus. Hausschwammbefall vermutet. Denkmalschutz fordert Originalsubstanz-Erhalt. |
| 022 | Neubau Arztpraxis mit Labor, Gesundheitszentrum 2 | in_pruefung | hoch | Neubau, Gewerbe, Medizin, Labor | Hygienekonzept nach RKI-Richtlinien erforderlich. Laborabwasser-Vorbehandlung klären mit Umweltamt. |
| 023 | Erweiterung Grundschule um 4 Klassenräume, Schulberg 5 | in_bearbeitung | dringend | Erweiterung, Schule, Sozial | Interimscontainer bereits aufgestellt. Permanentbau soll bis Sommer 2027 stehen. Lärmschutz während Bauphase beachten. |
| 024 | Bau Radschnellweg-Brücke, Flussquerung Km 2.4 | in_pruefung | hoch | Brücke, Infrastruktur, Mobilität, Radverkehr | Statik für Leichtbaubrücke (Stahl-Holz-Hybrid) geprüft. Umweltverträglichkeitsprüfung abgeschlossen. Eingriffs-Ausgleich über Uferrenaturierung. |

### 16 Forschungsanträge

Nutze ForschungsVorgang mit den Zusatzfeldern: foerderprogramm, foerdersumme, laufzeit,
projektleiter, institution, forschungsgebiet.

| # | Titel | Status | Förderprogramm | Summe | Gebiet |
|---|---|---|---|---|---|
| 001 | KI-gestützte Schadenserkennung an Brückenbauwerken mittels Drohneninspektion | bewilligt | BMBF Zukunft Bau | 480.000 | Künstliche Intelligenz |
| 002 | Perowskit-Tandemsolarzellen der dritten Generation für Gebäudeintegration | in_begutachtung | DFG Sachbeihilfe | 320.000 | Energieforschung |
| 003 | mRNA-basierte Therapieansätze bei chronisch-entzündlichen Darmerkrankungen | eingereicht | BMBF Gesundheitsforschung | 750.000 | Medizin |
| 004 | Selbstheilende Betone mit mikroverkapselten Reparaturagentien | bewilligt | DFG Schwerpunktprogramm | 290.000 | Materialwissenschaft |
| 005 | Langzeitmonitoring urbaner Biodiversität mittels eDNA-Metabarcoding | in_begutachtung | BfN F+E-Vorhaben | 185.000 | Umweltwissenschaft |
| 006 | Autonome Mikromobilität: Letzte-Meile-Logistik mit Lieferrobotern | nachbesserung | BMWK Reallabore | 420.000 | Mobilität |
| 007 | Adaptive Lernplattform mit lernpfadbasierter Personalisierung | eingereicht | BMBF Digitale Bildung | 210.000 | Bildungsforschung |
| 008 | Fehlertolerante Quantenalgorithmen für kombinatorische Optimierungsprobleme | in_begutachtung | DFG Exzellenzcluster | 680.000 | Quantencomputing |
| 009 | Nachhaltige Lithium-Rückgewinnung aus Altbatterien durch Bioleaching | bewilligt | EU Horizon Europe | 520.000 | Kreislaufwirtschaft |
| 010 | Psychosoziale Resilienzfaktoren bei Langzeitarbeitslosen — eine Längsschnittstudie | eingereicht | DFG Sachbeihilfe | 195.000 | Sozialforschung |
| 011 | Digitale Zwillinge für prädiktive Instandhaltung kommunaler Wassernetze | in_begutachtung | BMBF Smart Cities | 390.000 | Infrastruktur |
| 012 | Stammzellbasierte Knorpelregeneration bei Arthrose des Kniegelenks | nachbesserung | BMBF Gesundheitsforschung | 610.000 | Medizin |
| 013 | Agrivoltaik: Optimierung der Nutzpflanzenproduktion unter Solarmodulen | bewilligt | BMEL Innovationsprogramm | 340.000 | Agrarforschung |
| 014 | Sprachmodell-gestützte Verwaltungsautomation für kommunale Genehmigungsverfahren | eingereicht | BMI Verwaltungsmodernisierung | 280.000 | Verwaltungsinformatik |
| 015 | Klimaadaptive Stadtplanung: Hitzeinseln und Schwammstadt-Konzepte | in_begutachtung | BMUV Klimaanpassung | 450.000 | Stadtplanung |
| 016 | Biokunststoffe aus Lignocellulose: Skalierung vom Labor zur Pilotanlage | bewilligt | BMWK Industrielle Forschung | 870.000 | Materialwissenschaft |

═══════════════════════════════════════════════════
TEIL 3: DOKUMENTE — 60 Dokumente mit langen Texten
═══════════════════════════════════════════════════

Jedes Dokument wird via useDokumenteStore.add() oder direkt in IDB gespeichert
als { id, filename, format: 'md', markdown, tags, created, vorgangId }.

Der BatchIndexer liest doc:* Keys aus IDB. Jedes Dokument MUSS als `doc:{id}` Key
gespeichert werden mit dem Feld `markdown` das den Text enthält.

### Grundregel für die Texte

JEDER Text muss 800–2000 Wörter lang sein. Nutze realistisches Behördendeutsch
für Bauanträge und wissenschaftliches Deutsch für Forschungsanträge.

Die Texte MÜSSEN semantisch reichhaltig sein — nicht nur Platzhalter!
Das Embedding-Modell (all-MiniLM-L6-v2) muss in den Texten Konzepte erkennen
die über einfache Keyword-Matches hinausgehen.

### 35 Bauantrags-Dokumente

Verteile die Dokumente auf die 24 Bauanträge (manche haben mehrere):

FORMBLÄTTER (6 Stück, je 800-1000 Wörter):
- Bauantragsformular_BA001.md — Vollständig ausgefülltes Formular für Neubau EFH
  Enthält: Bauherr, Grundstück (Flurstück, Gemarkung, Fläche), Gebäudeklasse,
  Nutzungsart, Geschosse, Wohnfläche, umbauter Raum, Stellplätze, Baubeschreibung,
  Entwässerung, Erschließung, Unterschriften
- Bauantragsformular_BA002.md — Mehrfamilienhaus Lindenstraße
- Bauantragsformular_BA008.md — Gewerbehalle Gewerbepark
- Bauantragsformular_BA012.md — Kindertagesstätte
- Bauantragsformular_BA018.md — Seniorenwohnanlage
- Bauantragsformular_BA024.md — Radschnellweg-Brücke

STATIK/TRAGWERK GUTACHTEN (6 Stück, je 1000-1500 Wörter):
- Statik_Tragwerk_BA002.md — Tragwerksplanung MFH: Gründung, Decken, Stützen,
  Aussteifung, Lastannahmen nach DIN EN 1991, Bemessung der Stahlbetonbauteile,
  Erdbebennachweis Zone 1
- Statik_Tragwerk_BA004.md — Tragfähigkeitsnachweis Bestandsdach für Ausbau,
  Holzbalkendecke Bemessung, Verstärkungsmaßnahmen
- Statik_Tragwerk_BA010.md — Tiefgarage: Deckenplatte, Stützweiten,
  Durchstanzen, Wasserdruckbelastung weiße Wanne
- Statik_Tragwerk_BA011.md — Aufstockung: Lastabtragung Bestandswände,
  Fundamentverstärkung, Holzrahmenbauweise Aufbau
- Statik_Tragwerk_BA016.md — Quartiersgarage: Fertigteilbau, Spannbetondecken,
  Fahrzeugrampen
- Statik_Tragwerk_BA024.md — Brückentragwerk: Stahl-Holz-Verbund, Schwingungsnachweis,
  Ermüdungsnachweis Radverkehr

BRANDSCHUTZ (5 Stück, je 1000-1500 Wörter):
- Brandschutz_BA002.md — Brandschutzkonzept MFH: Feuerwiderstandsklassen,
  Rettungswege, Rauchabzugsanlagen, Feuerwehrzufahrt, Löschwasserversorgung,
  notwendige Treppen und Flure, Brandwände zwischen Nutzungseinheiten
- Brandschutz_BA006.md — Gewerbehau mit Altlasten: Brandschutz bei kontaminierten
  Böden, Explosionsschutz bei PAK, Brandmeldeanlage
- Brandschutz_BA012.md — Kita: Besondere Anforderungen für Versammlungsstätte
  für Kinder, Evakuierungskonzept, Fluchtwegbreiten für Kleinkinder
- Brandschutz_BA013.md — Gastronomie: Fettabscheider, Küchenlüftung,
  Brandschutzklappen, Fluchtweg durch Verkaufsräume
- Brandschutz_BA018.md — Seniorenwohnanlage: Räumungskonzept für mobilitäts-
  eingeschränkte Personen, Hausalarmanlage, Brandmeldeanlage mit Aufschaltung

SCHALLSCHUTZ (3 Stück, je 800-1200 Wörter):
- Schallschutz_BA002.md — MFH: Luft- und Trittschalldämmung, DIN 4109,
  Außenlärmbelastung Straßenverkehr, Schallschutzfenster SSK3
- Schallschutz_BA011.md — Aufstockung: Flankenschallübertragung zum Bestand,
  Entkopplung der neuen Decke
- Schallschutz_BA013.md — Gastronomie: Musiklärm, Küchenlärm, Außengastronomie,
  Immissionsrichtwerte TA Lärm

ENERGIENACHWEIS (4 Stück, je 800-1200 Wörter):
- Energienachweis_BA001.md — EFH KfW-55: Wärmebrückenberechnung, U-Werte
  Außenwand/Dach/Bodenplatte, Heizlast nach DIN 12831, Anlagentechnik Wärmepumpe,
  Primärenergiebedarf, sommerlicher Wärmeschutz
- Energienachweis_BA002.md — MFH: Zentrale Wärmeversorgung, Fernwärmeanschluss,
  Lüftungskonzept mit Wärmerückgewinnung
- Energienachweis_BA009.md — Solardach Bestandsgebäude: Ertragsprognose,
  Eigenverbrauchsquote, Einspeisevergütung, Amortisation
- Energienachweis_BA014.md — EFH mit Einliegerwohnung: Getrennte Energiebilanzen,
  Wärmepumpe Split, PV-Anlage mit Speicher

STELLUNGNAHMEN (5 Stück, je 800-1200 Wörter):
- Stellungnahme_Nachbar_BA002.md — Einspruch Nachbar wegen Verschattung,
  Besonungsstudie, Abstandsflächen-Berechnung
- Stellungnahme_Denkmalschutz_BA005.md — Stellungnahme untere Denkmalschutzbehörde
  zur Nutzungsänderung Scheune, Substanzerhalt, Materialvorgaben
- Stellungnahme_Denkmalschutz_BA021.md — Befund Fachwerk: Gefährdungsanalyse,
  Restaurierungsempfehlung, Hausschwamm-Verdacht
- Stellungnahme_Umwelt_BA019.md — Naturschutzrechtliche Bewertung PV-Freifläche:
  Feldlerchen-Brutrevier, Vermeidungs- und Ausgleichsmaßnahmen
- Stellungnahme_Wasserbehörde_BA020.md — Hydraulische Stellungnahme Hochwasserschutz:
  Abflussberechnung, Retentionsraumverlust, Kompensationsmaßnahmen

GUTACHTEN SPEZIAL (4 Stück, je 1000-1500 Wörter):
- Altlastengutachten_BA006.md — Historische Erkundung, Bodenproben, PAK-Belastung,
  Sanierungsvarianten (Auskofferung vs. Einkapselung), Kosten
- Hydrogeologie_BA010.md — Grundwasserverhältnisse, Pumpversuch, Bemessung
  Grundwasserhaltung Baugrube, Auswirkungen auf Nachbargebäude
- Mobilitaetskonzept_BA016.md — Reduzierter Stellplatzschlüssel, Carsharing,
  Fahrradabstellanlage, ÖPNV-Anbindung, Quartiersgarage-Bewirtschaftung
- Artenschutz_BA019.md — Artenschutzrechtlicher Fachbeitrag: Kartierung,
  Brutvögel, Fledermäuse, Reptilien, CEF-Maßnahmen

NACHFORDERUNGSSCHREIBEN (2 Stück, je 800-1000 Wörter):
- Nachforderung_BA004.md — Formelles Schreiben: Fehlende Unterlagen auflisten,
  Rechtliche Grundlage, Fristsetzung, Rechtsfolgenbelehrung
- Nachforderung_BA017.md — Tiny House: Fehlender Befreiungsantrag,
  Erschließungsnachweis, Entwässerungskonzept

### 25 Forschungs-Dokumente

PROJEKTBESCHREIBUNGEN (10 Stück, je 1200-2000 Wörter):
- Projekt_FA001.md — KI-Schadenserkennung Brücken: Problemstellung, Stand der Forschung,
  Methodik (CNN auf Drohnenbilder, Transfer Learning, Segmentierung),
  Arbeitspakete, Meilensteine, erwartete Ergebnisse
- Projekt_FA002.md — Perowskit-Solarzellen: Degradationsmechanismen,
  Tandem-Architektur, Encapsulation, Skalierung Rolle-zu-Rolle
- Projekt_FA003.md — mRNA Darmerkrankungen: Pathophysiologie Morbus Crohn/Colitis,
  Lipid-Nanopartikel Targeting, präklinische Modelle, klinische Translation
- Projekt_FA005.md — Urbane Biodiversität eDNA: Probennahme Stadtgewässer,
  Metabarcoding-Pipeline, Referenzdatenbanken, Monitoring-Dashboard
- Projekt_FA008.md — Quantenalgorithmen: QAOA vs VQE, Fehlerkorrekturcodes,
  Surface Codes, Benchmarking auf IBM/Google Hardware
- Projekt_FA009.md — Lithium-Bioleaching: Acidithiobacillus, Bioreaktoren,
  Prozessparameter, Rückgewinnungsraten, Wirtschaftlichkeitsanalyse
- Projekt_FA011.md — Digitale Zwillinge Wassernetze: Sensornetzwerk,
  hydraulische Modellierung, Machine Learning Leckage-Erkennung
- Projekt_FA013.md — Agrivoltaik: Verschattungssimulation, Ertragsverluste Weizen/Kartoffel,
  Mikroklima-Messungen, ökonomische Gesamtbilanz
- Projekt_FA014.md — Verwaltungsautomation Sprachmodelle: Retrieval-Augmented Generation,
  Rechtssichere Textgenerierung, Datenschutz kommunaler Daten, Evaluierung
- Projekt_FA016.md — Biokunststoffe Lignocellulose: Aufschlussverfahren,
  enzymatische Hydrolyse, Polymerisation, Materialprüfung, Pilotanlage 500kg/d

GUTACHTEN / REVIEWS (8 Stück, je 1000-1500 Wörter):
- Review_FA001.md — Fachgutachten: Stärken (innovativer Ansatz), Schwächen
  (Trainingsdaten begrenzt), Empfehlung zur Förderung unter Auflagen
- Review_FA003.md — Ethikvotum-Stellungnahme: Tierschutzrechtliche Bewertung
  präklinischer Modelle, GLP-Konformität, Risiko-Nutzen-Abwägung
- Review_FA006.md — Gutachten Nachbesserung: Sicherheitskonzept Lieferroboter
  unzureichend, Haftungsfragen ungeklärt, Datenschutz Kamerasysteme
- Review_FA008.md — Peer Review Quantenalgorithmen: Vergleich mit klassischen
  Solvern, Qubit-Overhead realistisch?, Reproduzierbarkeit
- Review_FA010.md — Methodische Stellungnahme Längsschnittstudie: Stichprobengröße,
  Dropout-Rate, Konfundierungsvariablen, Empfehlung Panel-Design
- Review_FA012.md — Gutachten Stammzell-Therapie: Regulatorischer Pfad ATMP,
  GMP-Herstellung, Sicherheitsprofil, Phase-I-Design
- Review_FA015.md — Fachgutachten Klimaadaptive Stadtplanung: Modellvalidierung,
  Hitze-Hotspot-Kartierung, Umsetzbarkeit Schwammstadt
- Review_FA016.md — Technisches Gutachten Biokunststoffe: Scale-up-Risiken,
  Materialperformance vs. Petrochemie, LCA-Methodik

ETHIK / DATENSCHUTZ / COMPLIANCE (5 Stück, je 800-1200 Wörter):
- Ethik_FA003.md — Ethikantrag: Tierschutzprotokoll, 3R-Prinzip (Replace, Reduce,
  Refine), Versuchstierbedarf, Endpunktkriterien, Schmerzbelastungseinschätzung
- Ethik_FA010.md — Datenschutzfolgenabschätzung: Personenbezogene Daten
  Langzeitarbeitsloser, Pseudonymisierung, Aufbewahrungsfristen, Löschkonzept
- Datenschutz_FA014.md — Datenschutzkonzept Verwaltungsautomation: Kommunale
  Antragsdaten als Trainingsdaten, Anonymisierung, On-Premise-Deployment,
  Rechte Betroffener, Art. 22 DSGVO automatisierte Entscheidungen
- Compliance_FA009.md — Umweltrechtliche Bewertung Bioleaching: Abfallrecht,
  Gefahrstoffverordnung, Genehmigungsbedarf Bioreaktoren, Arbeitsschutz
- Compliance_FA011.md — IT-Sicherheitskonzept Digitale Zwillinge: Kritische
  Infrastruktur Wasserversorgung, BSI-Anforderungen, Zugriffskonzept

ZWISCHENBERICHTE (2 Stück, je 1000-1500 Wörter):
- Zwischenbericht_FA001.md — 12-Monats-Bericht KI-Brückeninspektion:
  Datensatz aufgebaut (50.000 Bilder), Modellgenauigkeit 94%, Feldtest an
  3 Brücken, Personalaufwand vs. Drohneninspektion
- Zwischenbericht_FA004.md — Selbstheilende Betone: Mikrokapsel-Synthese
  optimiert, Rissüberbrückung bis 0.3mm nachgewiesen, Dauerhaftigkeitstest läuft

═══════════════════════════════════════════════════
TEIL 4: ARTEFAKTE — 10 generierte Schreiben
═══════════════════════════════════════════════════

Speichere als artifact:{id} in IDB.

5 Bauantrags-Artefakte:
- Nachforderungsschreiben BA004 (Tragwerksnachweis fehlt)
- Genehmigungsbescheid BA001 (mit Auflagen)
- Email an Feuerwehr BA002 (Brandschutzkonzept zur Prüfung)
- Stellungnahme-Anforderung BA005 (Denkmalschutz)
- Anhörungsschreiben BA006 (Altlasten-Sanierungspflicht)

5 Forschungs-Artefakte:
- Bewilligungsbescheid FA001 (mit Mittelfreigabe-Bedingungen)
- Nachbesserungsaufforderung FA006 (Sicherheitskonzept)
- Gutachteranfrage FA008 (Zweitgutachten Quantenalgorithmen)
- Zwischen-Bewertung FA004 (positiv, Verlängerung empfohlen)
- Projektskizze-Feedback FA007 (Überarbeitung vor Vollantrag)

Je 400-800 Wörter, formelles Deutsch.

═══════════════════════════════════════════════════
TEIL 5: ADMIN-BUTTON
═══════════════════════════════════════════════════

Erweitere src/plugins/admin/IndexManager.tsx:

Neuer Abschnitt über dem Indexierungs-Bereich:
SectionHeader "Testdaten"
- Info-Text: "Erzeugt 40 Vorgänge, 60 Dokumente und 10 Artefakte mit realistischem Inhalt."
- [Testdaten generieren] Button (Secondary)
- Loading-State: "Erzeuge Testdaten... (X/110)"
- Erfolg: "✓ 40 Vorgänge, 60 Dokumente, 10 Artefakte erzeugt"
- Wenn schon geseeded: Button deaktiviert, Text "Testdaten bereits vorhanden"
- [Testdaten löschen] Button (Danger) — löscht alle vorgang:*, doc:*, artifact:* Keys
  und setzt 'seed-complete' auf false

═══════════════════════════════════════════════════
TEIL 6: SEMANTISCHE TEST-QUERIES
═══════════════════════════════════════════════════

Erstelle tests/SEARCH_TEST_QUERIES.md mit Queries die NACH dem Indexieren getestet
werden sollen. Diese Queries testen ob semantische Suche funktioniert:

| Query | Erwartete Top-Ergebnisse | Test-Typ |
|---|---|---|
| "Brandschutz" | Brandschutz_*.md | Keyword (einfach) |
| "Feuerwiderstand Rettungswege" | Brandschutz_*.md | Keyword + Semantik |
| "Wie evakuiert man Kleinkinder?" | Brandschutz_BA012.md (Kita) | Rein semantisch |
| "Gebäude Energie sparen" | Energienachweis_*.md | Semantisch (Paraphrase) |
| "Wärmedämmung Außenwand" | Energienachweis_BA001.md | Fachbegriff |
| "Nachbar klagt wegen Schatten" | Stellungnahme_Nachbar_BA002.md | Umgangssprache |
| "altes Haus renovieren" | Stellungnahme_Denkmalschutz_*.md, Sanierung_BA021 | Umgangssprache |
| "Gift im Boden" | Altlastengutachten_BA006.md | Umgangssprache → Fachtext |
| "Grundwasser Baugrube" | Hydrogeologie_BA010.md | Fachlich |
| "Künstliche Intelligenz Infrastruktur" | Projekt_FA001.md, Projekt_FA011.md | Semantisch |
| "Tierversuche Ethik" | Ethik_FA003.md | Semantisch |
| "Datenschutz bei KI" | Datenschutz_FA014.md | Semantisch |
| "Brücke für Fahrräder" | Statik_BA024.md, Vorgang BA024 | Umgangssprache |
| "Batterie Recycling" | Projekt_FA009.md | Synonym (Altbatterien/Recycling) |
| "Senioren Wohnung barrierefrei" | Vorgang BA018, Brandschutz_BA018.md | Kombination |

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. App starten → Admin-Plugin öffnen
2. [Testdaten generieren] klicken → Fortschritt beobachten
3. Dashboard: Zeigt 40 Vorgänge mit verschiedenen Status
4. Bauanträge-Liste: 24 Einträge mit verschiedenen Tags und Status
5. Forschungs-Liste: 16 Einträge
6. Dokumente-Plugin: 60 Dokumente sichtbar
7. Admin → [Index erstellen] → Batch-Indexer läuft über alle 60 Dokumente
   → Chunking + Embedding (GPU-Laptop: WebGPU modus, ~5 Min für ~200 Chunks)
8. Suche-Plugin: Teste mindestens 5 Queries aus der Test-Tabelle
9. Prüfe: Keyword-Suche findet exakte Matches, Hybrid-Suche findet semantische Matches
10. Console: Keine Errors

Committe: "feat: synthetic test data generator with 40 cases, 60 docs, 10 artifacts for search testing"
```
