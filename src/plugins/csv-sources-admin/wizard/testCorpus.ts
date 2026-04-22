// Test-Korpus inline als TS-Konstanten — file://-tauglich, kein fetch.
// Phase 1b Spec: test-korpus/bauforschung-v2/
// Phase 1c: Big-Korpus via Runtime-Generator (kein Bundle-Overhead).

import { generateBigStammdaten, generateBigDeskriptoren } from './bigCorpusGenerator';

export interface TestCorpusEntry {
  id: string;
  filename: string;
  label: string;
  hint: string;
  csv?: string;
  /** Lazy-Generator für große Korpora (erst bei Klick erzeugen). */
  generate?: () => string;
  size?: 'small' | 'big' | 'de';
  /** Default 'UTF-8'. 'windows-1252' erzeugt Latin-1-Byte-Blob statt UTF-8-Text. */
  encoding?: 'UTF-8' | 'windows-1252';
  /** Default ','. Wird nur für Blob-Generierung (Zeichen-Ersetzung) relevant, da csv-Inhalt den Separator ja bereits enthält. */
  separator?: ';' | ',';
}

const STAMMDATEN_MINI = `AKZ_LFD,PROJ_KURZ,TITEL,ANTRAGSTELLER,STATUS_FLG,VB_NR,BEW_DAT,EXPORT_TS
FKZ-2023-0001,SMART-CITY,Urbane Infrastruktur-Studie,Müller GmbH,bewilligt,VB-2023-042,2023-03-15,2026-04-19T03:00:00
FKZ-2023-0002,SMART-CITY,Sensoren für Smart City,Huber AG,bewilligt,VB-2023-042,2023-03-15,2026-04-19T03:00:00
FKZ-2023-0003,GREEN-MOBILITY,Elektromobilität Ländlicher Raum,Schmidt KG,in_pruefung,,2023-05-20,2026-04-19T03:00:00
FKZ-2023-0004,ENERGY-PLUS,Plusenergie-Siedlung Nord,Bau-Kollektiv eG,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00
FKZ-2023-0005,ENERGY-PLUS,Wärmepumpen-Quartiersnetz,Stadtwerke Süd,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00
FKZ-2023-0006,ENERGY-PLUS,Energiemanagement-Platform,TechNova AG,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00
FKZ-2023-0007,KLIMA-BAU,Nachhaltige Baustoffe Forschung,ÖkoBau GmbH,abgelehnt,,2023-07-02,2026-04-19T03:00:00
FKZ-2023-0008,ZUKUNFT-WOHNEN,Modulare Wohnbausysteme,Fertigbau Nord GmbH,bewilligt,,2023-08-14,2026-04-19T03:00:00
FKZ-2023-0009,DIGITAL-PLAN,BIM-Integration Stadtplanung,Planwerk GmbH,in_pruefung,,2023-09-05,2026-04-19T03:00:00
FKZ-2023-0010,RESILIENCE-NET,Resiliente Infrastrukturen,Netzwerk-Institut,bewilligt,,2023-10-01,2026-04-19T03:00:00
FKZ-2024-0001,URBAN-GREEN,Dachbegrünungen Groß-Siedlung,Grünbau AG,bewilligt,,2024-01-12,2026-04-19T03:00:00
FKZ-2024-0002,WATER-SMART,Regenwassermanagement Urban,Hydro Consulting,bewilligt,,2024-02-20,2026-04-19T03:00:00
FKZ-2024-0003,MOB-FUTURE,Mobilitätshubs Mittelstadt,Mobility Labs,in_pruefung,,2024-03-15,2026-04-19T03:00:00
FKZ-2024-0004,HEAT-PUMP-PRO,Wärmepumpen-Retrofit Bestand,Klima-Service GmbH,bewilligt,,2024-04-10,2026-04-19T03:00:00
FKZ-2024-0005,GRID-FLEX,Flexibles Verteilnetz,Netzwerk-Institut,bewilligt,,2024-05-08,2026-04-19T03:00:00
FKZ-2024-0006,AGRI-VOLT,Agri-Photovoltaik Pilotanlage,AgriTech eG,in_pruefung,,2024-06-18,2026-04-19T03:00:00
FKZ-2024-0007,CIRCLE-BUILD,Kreislaufwirtschaft Bausektor,Öko-Institut,bewilligt,,2024-07-22,2026-04-19T03:00:00
FKZ-2024-0008,LOW-CARBON,Low-Carbon Zement-Forschung,Materialwissenschaft Labor,bewilligt,,2024-08-30,2026-04-19T03:00:00
FKZ-2024-0009,PEDESTRIAN-CITY,Fußgängerfreundliche Stadt,Stadtplanung Süd,in_pruefung,,2024-09-12,2026-04-19T03:00:00
FKZ-2024-0010,SOLAR-FACADE,Solarfassaden Neubau,FassadenTech AG,bewilligt,,2024-10-05,2026-04-19T03:00:00
`;

// Stammdaten + 5 Branche-Spalten — für den vertikal-merged Label-XLS-Testfall (branche.xlsx).
// Jede Zeile hat Einsen (1) in BRANCHE_X wenn der Antrag dieser Branche zugeordnet ist, sonst leer.
const STAMMDATEN_BRANCHE_MINI = `AKZ_LFD,PROJ_KURZ,TITEL,ANTRAGSTELLER,STATUS_FLG,VB_NR,BEW_DAT,EXPORT_TS,BRANCHE_1,BRANCHE_2,BRANCHE_3,BRANCHE_4,BRANCHE_5
FKZ-2023-0001,SMART-CITY,Urbane Infrastruktur-Studie,Müller GmbH,bewilligt,VB-2023-042,2023-03-15,2026-04-19T03:00:00,1,,,,1
FKZ-2023-0002,SMART-CITY,Sensoren für Smart City,Huber AG,bewilligt,VB-2023-042,2023-03-15,2026-04-19T03:00:00,,,1,,
FKZ-2023-0003,GREEN-MOBILITY,Elektromobilität Ländlicher Raum,Schmidt KG,in_pruefung,,2023-05-20,2026-04-19T03:00:00,,1,,,
FKZ-2023-0004,ENERGY-PLUS,Plusenergie-Siedlung Nord,Bau-Kollektiv eG,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00,1,,,1,
FKZ-2023-0005,ENERGY-PLUS,Wärmepumpen-Quartiersnetz,Stadtwerke Süd,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00,1,1,,,
FKZ-2023-0006,ENERGY-PLUS,Energiemanagement-Platform,TechNova AG,bewilligt,VB-2023-077,2023-06-10,2026-04-19T03:00:00,,,1,,
FKZ-2023-0007,KLIMA-BAU,Nachhaltige Baustoffe Forschung,ÖkoBau GmbH,abgelehnt,,2023-07-02,2026-04-19T03:00:00,1,,,,1
FKZ-2023-0008,ZUKUNFT-WOHNEN,Modulare Wohnbausysteme,Fertigbau Nord GmbH,bewilligt,,2023-08-14,2026-04-19T03:00:00,1,1,,,
FKZ-2023-0009,DIGITAL-PLAN,BIM-Integration Stadtplanung,Planwerk GmbH,in_pruefung,,2023-09-05,2026-04-19T03:00:00,,,1,,
FKZ-2023-0010,RESILIENCE-NET,Resiliente Infrastrukturen,Netzwerk-Institut,bewilligt,,2023-10-01,2026-04-19T03:00:00,,,,1,1
`;

const PROJEKTZUSAMMENFASSUNG_MINI = `PROJ_KURZ,ZUSAMMENFASSUNG,THEMA_URBAN,THEMA_ENERGIE,DESKRIPTOR_NEU
SMART-CITY,Das Vorhaben untersucht urbane Sensornetzwerke für Luftqualität und Verkehrsfluss.,ja,nein,nein
GREEN-MOBILITY,Ladeinfrastruktur-Studie für ländliche Regionen mit Fokus auf Lastmanagement.,nein,ja,ja
ENERGY-PLUS,Quartierskonzept für Plusenergie-Siedlung mit integriertem Wärmepumpennetz.,ja,ja,nein
KLIMA-BAU,Forschung zu CO2-armen Baustoffen und Recycling-Beton.,nein,nein,ja
ZUKUNFT-WOHNEN,Modulare Wohnbauweise zur schnellen Nachverdichtung in Ballungsräumen.,ja,nein,nein
DIGITAL-PLAN,BIM-Workflows für kommunale Planungsämter.,ja,nein,ja
RESILIENCE-NET,Analyse kritischer Infrastrukturen hinsichtlich Klimarisiken.,nein,ja,nein
URBAN-GREEN,Studie zur Kühlwirkung von Dachbegrünung in dichter Bebauung.,ja,nein,nein
WATER-SMART,Dezentrale Regenwasser-Nutzungskonzepte für Quartiere.,ja,nein,ja
MOB-FUTURE,Mobilitätshubs als Knotenpunkt für ÖPNV und Sharing-Angebote.,ja,nein,nein
HEAT-PUMP-PRO,Retrofit-Methodik für Wärmepumpen in Altbauten.,nein,ja,nein
GRID-FLEX,Netzplanungs-Tools für volatile Einspeisung.,nein,ja,ja
AGRI-VOLT,Agri-PV-Pilotanlage mit Koexistenz von Ackerbau und Solarstrom.,nein,ja,ja
CIRCLE-BUILD,Ressourcenkreisläufe für Abbruch-Materialien.,nein,nein,ja
LOW-CARBON,Zementalternativen mit reduzierter CO2-Bilanz.,nein,nein,ja
`;

const STATUS_AKTIVE_MINI = `AKZ_LFD,STATUS_FLG,BEARBEITER,FRIST_NEU
FKZ-2023-0003,in_bearbeitung,Maria Weber,2026-06-01
FKZ-2023-0009,in_bearbeitung,Thomas Klein,2026-05-20
FKZ-2024-0003,in_bearbeitung,Maria Weber,2026-07-15
FKZ-2024-0006,in_bearbeitung,Stefan Ott,2026-08-30
FKZ-2024-0009,in_bearbeitung,Lisa Brandt,2026-09-10
FKZ-2023-0001,bewilligt,Heinrich Groß,
FKZ-2023-0004,bewilligt,Heinrich Groß,
FKZ-2024-0010,bewilligt,Lisa Brandt,
`;

// DE-Varianten: Semikolon-getrennt, Inhalte mit vielen Umlauten/ß/€ für echten Windows-1252-Test.
const STAMMDATEN_MINI_DE = `AKZ_LFD;PROJ_KURZ;TITEL;ANTRAGSTELLER;STATUS_FLG;VB_NR;BEW_DAT;FOERDERSUMME
FKZ-2023-0001;SMART-CITY;Städtische Infrastruktur-Prüfung;Müller GmbH;bewilligt;VB-2023-042;2023-03-15;250000 €
FKZ-2023-0002;SMART-CITY;Sensoren für Großstädte;Huber AG;bewilligt;VB-2023-042;2023-03-15;180000 €
FKZ-2023-0003;GREEN-MOBILITY;Elektromobilität ländlicher Raum;Schmidt KG;in_pruefung;;2023-05-20;95000 €
FKZ-2023-0004;ENERGY-PLUS;Plusenergie-Siedlung Nord;Bau-Kollektiv eG;bewilligt;VB-2023-077;2023-06-10;420000 €
FKZ-2023-0005;ENERGY-PLUS;Wärmepumpen-Quartiersnetz;Stadtwerke Süd;bewilligt;VB-2023-077;2023-06-10;310000 €
FKZ-2023-0007;KLIMA-BAU;Nachhaltige Baustoffe für Außenfassaden;ÖkoBau GmbH;abgelehnt;;2023-07-02;0 €
FKZ-2023-0008;ZUKUNFT-WOHNEN;Modulare Wohnbausysteme mit Fördermittel;Fertigbau Nord GmbH;bewilligt;;2023-08-14;275000 €
FKZ-2024-0001;URBAN-GREEN;Dachbegrünung Großsiedlung;Grünbau AG;bewilligt;;2024-01-12;145000 €
FKZ-2024-0004;HEAT-PUMP-PRO;Wärmepumpen-Retrofit im Bestand;Klima-Service GmbH;bewilligt;;2024-04-10;210000 €
FKZ-2024-0007;CIRCLE-BUILD;Kreislaufwirtschaft für den Bausektor;Öko-Institut;bewilligt;;2024-07-22;320000 €
`;

const PROJEKTZUSAMMENFASSUNG_MINI_DE = `PROJ_KURZ;ZUSAMMENFASSUNG;THEMA_URBAN;THEMA_ENERGIE
SMART-CITY;Das Vorhaben prüft städtische Sensornetzwerke für Luftqualität und Verkehrsfluss in Ballungsräumen.;ja;nein
GREEN-MOBILITY;Ladeinfrastruktur-Studie für ländliche Regionen mit Fokus auf Lastmanagement und Ausgleich über Tageszeiten.;nein;ja
ENERGY-PLUS;Quartierskonzept für Plusenergie-Siedlung mit integriertem Wärmepumpennetz und saisonalem Erdspeicher.;ja;ja
KLIMA-BAU;Forschung zu CO2-armen Baustoffen und Recycling-Beton für öffentliche Gebäude.;nein;nein
ZUKUNFT-WOHNEN;Modulare Wohnbauweise zur schnellen Nachverdichtung in Ballungsräumen mit hohem Flächenbedarf.;ja;nein
URBAN-GREEN;Studie zur Kühlwirkung von Dachbegrünung in dichter städtischer Bebauung an heißen Sommertagen.;ja;nein
HEAT-PUMP-PRO;Retrofit-Methodik für Wärmepumpen in Altbauten mit schlechter Dämmung — Feldversuch.;nein;ja
CIRCLE-BUILD;Ressourcenkreisläufe für Abbruchmaterialien und Wiederverwendung im Hochbau.;nein;nein
`;

const STATUS_AKTIVE_MINI_DE = `AKZ_LFD;STATUS_FLG;BEARBEITER;FRIST_NEU
FKZ-2023-0003;in_bearbeitung;Maria Weber;2026-06-01
FKZ-2023-0009;in_bearbeitung;Thomas Klein;2026-05-20
FKZ-2024-0003;in_bearbeitung;Stefan Ott;2026-07-15
FKZ-2024-0006;in_bearbeitung;Günter Müller;2026-08-30
FKZ-2024-0009;in_bearbeitung;Lisa Brandt;2026-09-10
FKZ-2023-0001;bewilligt;Heinrich Groß;
FKZ-2023-0004;bewilligt;Heinrich Groß;
`;

// 40 Zeilen mit 4 Unterprogrammen: 4711 (15), 4712 (12), 4713 (8), 4714 (5).
const STAMMDATEN_MIT_UP = `AKZ_LFD,PROJ_KURZ,TITEL,ANTRAGSTELLER,STATUS_FLG,VB_NR,BEW_DAT,FM_NUMMER
UP-2017-0001,URBAN-CLIMA,Mikroklima Mess-Stationen,Klimawerk GmbH,bewilligt,,2017-03-15,4711
UP-2017-0002,CARBON-CEM,Low-Carbon-Zement Studie,Materiallabor,bewilligt,,2017-04-20,4711
UP-2017-0003,RAIN-GARDEN,Regen-Gärten Pilotquartier,Grünplan KG,bewilligt,,2017-05-11,4711
UP-2017-0004,FLOOD-MAP,Überschwemmungskarten BW,GeoTech AG,abgelehnt,,2017-06-02,4711
UP-2017-0005,ENERGY-FLUX,Energiemonitor Siedlung,Kommunalwerk,bewilligt,,2017-08-18,4711
UP-2018-0001,CLIMA-RENT,Klimarisikobewertung,Schadenkalkül,bewilligt,,2018-02-03,4711
UP-2018-0002,BIO-FACADE,Bio-Fassadenbegrünung,Grünbau AG,bewilligt,,2018-04-14,4711
UP-2018-0003,RAIN-USE,Regenwassernutzung Klima,Hydro Consulting,in_pruefung,,2018-06-25,4711
UP-2018-0004,HEAT-ISL,Hitzeinseln Kartierung,Stadtplanung Süd,bewilligt,,2018-09-12,4711
UP-2019-0001,ADAPT-NORTH,Anpassung Küstenregionen,Meereslabor Nord,bewilligt,,2019-02-08,4711
UP-2019-0002,GREEN-COOL,Grüne Dächer Kühleffekt,Dachfabrik GmbH,bewilligt,,2019-03-28,4711
UP-2019-0003,STORM-PROOF,Sturmfeste Infrastruktur,BauTech Süd,abgelehnt,,2019-05-22,4711
UP-2019-0004,CO2-BETON,CO2-Beton Alternativen,Öko-Institut,bewilligt,,2019-08-07,4711
UP-2019-0005,CLIMA-DATA,Klimadaten-Plattform,Datenlabor GmbH,bewilligt,,2019-10-19,4711
UP-2019-0006,ADAPT-SCHOOL,Schulgebäude-Anpassung,Bildungsbau,bewilligt,,2019-11-30,4711
UP-2020-0001,PV-ROOF-PRO,Photovoltaik Retrofit,Solar-Pro GmbH,bewilligt,VB-2020-001,2020-02-14,4712
UP-2020-0002,PV-ROOF-PRO2,Modulintegration Dach,Fraunhofer-Kollektiv,bewilligt,VB-2020-001,2020-02-14,4712
UP-2020-0003,HEAT-PUMP-H,Wärmepumpe Hochbau,Klima-Service,bewilligt,,2020-04-03,4712
UP-2020-0004,GRID-STORE,Netzspeicher-Pilot,Stadtwerke Mitte,bewilligt,,2020-06-18,4712
UP-2020-0005,WIND-COM,Kommunal-Windkraft,Windkraft-Plan,in_pruefung,,2020-08-22,4712
UP-2021-0001,ENERGY-MIX,Energiemixszenarien,Zukunftsinstitut,bewilligt,,2021-01-11,4712
UP-2021-0002,H2-PILOT,Wasserstoff-Pilotanlage,H2-Labor Süd,bewilligt,,2021-03-20,4712
UP-2021-0003,BATT-SEC,Zweitnutzung Batterien,RecycleTech,bewilligt,,2021-05-05,4712
UP-2022-0001,SOLAR-COM,Solargemeinschaften,BürgerEnergie,bewilligt,,2022-02-28,4712
UP-2022-0002,HEAT-GRID,Fernwärme Quartier,Wärmenetz-Labor,bewilligt,,2022-04-15,4712
UP-2023-0001,EFFIC-HOME,Effizienzhaus Bestand,Sanierung Plus,bewilligt,,2023-03-10,4712
UP-2023-0002,POWER-FLEX,Lastflex Gewerbe,NetzFlex GmbH,in_pruefung,,2023-05-20,4712
UP-2021-0101,E-BIKE-LINK,Radschnellwege-Studie,Mobility Labs,bewilligt,,2021-07-10,4713
UP-2021-0102,MOB-HUB-LAN,Mobilitätsknoten Land,Ländliche Mobil,bewilligt,VB-2021-042,2021-09-15,4713
UP-2021-0103,MOB-HUB-LAN2,Mikromobil Integration,SharingTech,bewilligt,VB-2021-042,2021-09-15,4713
UP-2022-0101,SHARED-EV,Shared-EV-Flotten,Carsharing Plus,bewilligt,,2022-03-25,4713
UP-2022-0102,BUS-PRIOR,Bus-Priorisierung,Verkehrsplan,bewilligt,,2022-06-14,4713
UP-2023-0101,RAIL-REG,Regional-Bahn Ausbau,Bahnforschung,in_pruefung,,2023-04-08,4713
UP-2023-0102,AIR-QUAL-MOB,Luftqualität Verkehr,Umwelt-Monitor,bewilligt,,2023-08-19,4713
UP-2024-0101,AUTO-MINI,Autonome Mikro-Shuttles,RoboMobility,bewilligt,,2024-01-30,4713
UP-2023-0201,BIM-CIVIC,BIM Kommunalverwaltung,Planwerk Digital,bewilligt,,2023-02-12,4714
UP-2023-0202,AI-PERMIT,KI-Genehmigungsassistent,KI-Labor Süd,in_pruefung,,2023-05-18,4714
UP-2024-0201,DIGI-TWIN,Digitaler Stadt-Zwilling,Smart-City Labs,bewilligt,,2024-03-04,4714
UP-2024-0202,OPEN-DATA,Open-Data-Portal Bau,OpenGov Institut,bewilligt,,2024-06-22,4714
UP-2024-0203,IOT-BUILD,IoT-Gebäude-Monitoring,IoT-Connect,bewilligt,,2024-09-11,4714
`;

export const TEST_CORPUS: TestCorpusEntry[] = [
  {
    id: 'stammdaten-mini',
    filename: 'stammdaten-mini.csv',
    label: 'Stammdaten (Master)',
    hint: '20 Zeilen · join_key=aktenzeichen · empfohlen als Master',
    csv: STAMMDATEN_MINI,
    size: 'small',
  },
  {
    id: 'stammdaten-branche-mini',
    filename: 'stammdaten-branche-mini.csv',
    label: 'Stammdaten + Branche (für Label-Hierarchie-Test)',
    hint: '10 Zeilen · Stammdaten + BRANCHE_1..5 Flag-Spalten · zu labels-stammdaten-branche.xlsx',
    csv: STAMMDATEN_BRANCHE_MINI,
    size: 'small',
  },
  {
    id: 'projektzusammenfassung-mini',
    filename: 'projektzusammenfassung-mini.csv',
    label: 'Projekt-Zusammenfassung',
    hint: '15 Zeilen · join_key=akronym · Priority ~30',
    csv: PROJEKTZUSAMMENFASSUNG_MINI,
    size: 'small',
  },
  {
    id: 'status-aktive-mini',
    filename: 'status-aktive-mini.csv',
    label: 'Aktive Status',
    hint: '8 Zeilen · join_key=aktenzeichen · Priority ~70',
    csv: STATUS_AKTIVE_MINI,
    size: 'small',
  },
  {
    id: 'stammdaten-mit-up',
    filename: 'stammdaten-mit-up.csv',
    label: 'Stammdaten mit Unterprogrammen (40, 4 UPs)',
    hint: '40 Zeilen mit FM_NUMMER-Spalte · 4 Unterprogramme (4711/4712/4713/4714) · Master-Kandidat',
    csv: STAMMDATEN_MIT_UP,
    size: 'small',
  },
  {
    id: 'stammdaten-mini-de',
    filename: 'stammdaten-mini-de.csv',
    label: 'Stammdaten (DE-Format)',
    hint: 'Windows-1252, Semikolon, Umlaute + € — realistisches DE-Export-Format',
    csv: STAMMDATEN_MINI_DE,
    size: 'de',
    encoding: 'windows-1252',
    separator: ';',
  },
  {
    id: 'projektzusammenfassung-mini-de',
    filename: 'projektzusammenfassung-mini-de.csv',
    label: 'Projekt-Zusammenfassung (DE-Format)',
    hint: 'Windows-1252, Semikolon, längere Umlaut-Sätze',
    csv: PROJEKTZUSAMMENFASSUNG_MINI_DE,
    size: 'de',
    encoding: 'windows-1252',
    separator: ';',
  },
  {
    id: 'status-aktive-mini-de',
    filename: 'status-aktive-mini-de.csv',
    label: 'Aktive Status (DE-Format)',
    hint: 'Windows-1252, Semikolon, Bearbeiter-Umlaute',
    csv: STATUS_AKTIVE_MINI_DE,
    size: 'de',
    encoding: 'windows-1252',
    separator: ';',
  },
  {
    id: 'stammdaten-big',
    filename: 'stammdaten-big.csv',
    label: 'Big Korpus (5000)',
    hint: '5000 Zeilen · synthetisch · Performance-Test · Master-Kandidat',
    generate: () => generateBigStammdaten(5000),
    size: 'big',
  },
  {
    id: 'deskriptoren-big',
    filename: 'deskriptoren-big.csv',
    label: 'Big Deskriptoren (3000)',
    hint: '3000 Zeilen · join_key=akronym · meist nein-Werte für Boolean-Deskriptoren',
    generate: () => generateBigDeskriptoren(3000),
    size: 'big',
  },
];

export function testCorpusBlob(entry: TestCorpusEntry): Blob {
  const content = entry.csv ?? entry.generate?.() ?? '';
  if (entry.encoding === 'windows-1252') {
    const bytes = encodeAsLatin1(content);
    return new Blob([bytes.buffer as ArrayBuffer], { type: 'text/csv; charset=windows-1252' });
  }
  return new Blob([content], { type: 'text/csv' });
}

/**
 * Kodiert einen String als Windows-1252-Bytes.
 * Deckt ASCII (0x00–0x7F) direkt sowie deutsche Umlaute und €/£ via Lookup ab.
 * Unbekannte Codepoints werden durch '?' (0x3F) ersetzt.
 */
function encodeAsLatin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80) {
      bytes[i] = cp;
    } else if (cp <= 0xff) {
      // Latin-1-Supplement deckt direkt ä/ö/ü/ß/Ä/Ö/Ü und viele Westeuropäische Zeichen
      bytes[i] = cp;
    } else if (cp === 0x20ac) {
      bytes[i] = 0x80; // €
    } else if (cp === 0x201a) {
      bytes[i] = 0x82;
    } else if (cp === 0x201e) {
      bytes[i] = 0x84;
    } else if (cp === 0x2013) {
      bytes[i] = 0x96;
    } else if (cp === 0x2014) {
      bytes[i] = 0x97;
    } else {
      bytes[i] = 0x3f; // '?'
    }
  }
  return bytes;
}
