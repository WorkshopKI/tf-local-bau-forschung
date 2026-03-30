import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-023',
  filename: 'Energienachweis_BA009.md',
  format: 'md',
  tags: ['Energie', 'Solar', 'Ertrag'],
  created: '2026-02-08T10:00:00Z',
  vorgangId: 'BA-2026-009',
  markdown: `---
titel: Ertragsprognose und Energienachweis Solardachanlage Marktplatz 5
aktenzeichen: BA-2026-009
datum: 2026-02-08
ersteller: Energieberatung Grünwald GmbH
---

# Ertragsprognose Solardachanlage — Marktplatz 5

## 1. Anlagenbeschreibung und Standort

Die geplante Photovoltaikanlage wird auf dem Satteldach des Wohn- und Geschäftshauses Marktplatz 5 installiert. Das Gebäude ist denkmalgeschützt (Listennummer DM-1925-018), weshalb die Denkmalschutzbehörde besondere Auflagen an die Gestaltung der PV-Anlage stellt (siehe Abschnitt 6). Die Dachfläche hat eine Neigung von 30° und eine Ausrichtung nach Süd-Südwest (Azimut -15° gegenüber Süd). Die nutzbare Dachfläche auf der Süd-Südwest-Seite beträgt 68 m² nach Abzug von Dachfenstern, Schornstein und Mindestabständen zu den Dachrändern (50 cm allseitig nach VDE 0100-712).

Die Anlage besteht aus 20 Modulen vom Typ LONGi Hi-MO 6 Explorer (monokristallin, 430 Wp je Modul, Modulwirkungsgrad 22,0 Prozent, Abmessungen 1.722 × 1.134 × 30 mm, Gewicht 21,5 kg). Die Gesamtleistung beträgt **8,6 kWp**. Die Module werden als Indach-System (Dachintegriert) montiert, wobei sie die vorhandenen Dachziegel in der Modulfläche ersetzen — von außen fügen sie sich als dunkelgraue Fläche in die Dachhaut ein und sind weniger auffällig als aufgeständerte Module. Das Indach-System (Hersteller: Solrif) verwendet Klemmrahmen aus schwarz eloxiertem Aluminium mit integrierter Regenableitung.

Der Standort Musterstadt liegt auf 52° nördlicher Breite bei einer mittleren jährlichen Globalstrahlung von 1.050 kWh/(m²a) auf die horizontale Fläche (Wert aus dem DWD-Strahlungsatlas). Auf die geneigte Modulfläche (30° Neigung, Azimut -15°) beträgt die jährliche Einstrahlung 1.180 kWh/(m²a) — ein Zugewinn von 12 Prozent gegenüber der Horizontalen, der durch die optimale Neigung für den Standort entsteht.

## 2. Ertragsprognose

### 2.1 Simulationsergebnisse

Die Ertragssimulation wurde mit der Software PVsyst 7.4 durchgeführt unter Verwendung der Meteonorm-8.1-Wetterdaten für den Standort Musterstadt (TMY — Typical Meteorological Year). Die wichtigsten Simulationsparameter: Modultemperaturkoeffizient -0,34 Prozent/K, Degradation 0,4 Prozent/Jahr (Herstellergarantie: max. 0,45 Prozent/Jahr über 30 Jahre), Kabelverluste 1,5 Prozent, Wechselrichter-Wirkungsgrad 97,8 Prozent (Huawei SUN2000-8KTL-M1, Euro-eta 97,4 Prozent), Mismatch-Verluste 1,0 Prozent, Verschmutzungsverluste 3,0 Prozent (Standort Stadt, moderate Luftverschmutzung), Schneeverluste 1,5 Prozent (Dachneigung 30° ermöglicht Schneeabrutschen bei den meisten Schneefällen).

Simulierter Jahresertrag im ersten Betriebsjahr: **8.340 kWh/a**. Spezifischer Ertrag: **970 kWh/kWp**. Performance Ratio (PR): 82,2 Prozent. Der PR-Wert liegt im erwarteten Bereich für Indach-Anlagen (typisch 80–85 Prozent, etwas niedriger als Aufdach wegen schlechterer Hinterlüftung und dadurch höherer Modultemperaturen, was den Wirkungsgrad um 1–2 Prozent reduziert).

### 2.2 Monatliche Ertragsverteilung

| Monat | Einstrahlung [kWh/m²] | Ertrag [kWh] | PR [%] |
|-------|----------------------|-------------|--------|
| Januar | 28 | 185 | 76,8 |
| Februar | 45 | 325 | 84,0 |
| März | 82 | 610 | 86,5 |
| April | 118 | 870 | 85,7 |
| Mai | 142 | 1.020 | 83,5 |
| Juni | 148 | 1.045 | 82,1 |
| Juli | 145 | 1.010 | 81,0 |
| August | 122 | 870 | 82,9 |
| September | 88 | 660 | 87,2 |
| Oktober | 55 | 405 | 85,6 |
| November | 30 | 200 | 77,6 |
| Dezember | 22 | 140 | 74,0 |
| **Gesamt** | **1.025** | **8.340** | **82,2** |

Die Abweichung der Einstrahlung auf die Modulfläche (1.025 kWh/m²) von der horizontalen Globalstrahlung (1.050 kWh/m²) erklärt sich durch den nicht ganz optimalen Azimut (-15°) und die Verschattung durch den Schornstein in den Nachmittagsstunden (Dezember bis Februar, Verschattungsverlust 4 Prozent).

## 3. Eigenverbrauch und Wirtschaftlichkeit

### 3.1 Eigenverbrauchsanalyse

Der jährliche Stromverbrauch des Gebäudes (4 Wohneinheiten + 1 Gewerbeeinheit EG) beträgt 18.000 kWh/a (Schätzung auf Basis der Verbrauchswerte der letzten 3 Jahre). Ohne Batteriespeicher ergibt die Eigenverbrauchssimulation (Lastprofil H0 für Wohnungen, G0 für Gewerbe, 15-Minuten-Zeitschritte): Eigenverbrauchsquote 32 Prozent, Autarkiegrad 15 Prozent. Der geringe Eigenverbrauch resultiert aus der zeitlichen Diskrepanz zwischen PV-Erzeugung (Mittagsspitze) und Verbrauch (Morgen- und Abendspitze). Mit einem Batteriespeicher (10 kWh nutzbare Kapazität, Hersteller BYD HVS 10.2, Lade-/Entladewirkungsgrad 95 Prozent): Eigenverbrauchsquote 58 Prozent, Autarkiegrad 27 Prozent. Der Speicher verschiebt den überschüssigen Mittagsstrom in die Abendstunden und erhöht den wirtschaftlichen Nutzen der Anlage erheblich.

### 3.2 Wirtschaftlichkeitsberechnung

Investitionskosten: PV-Anlage 8,6 kWp Indach-System (Module, Wechselrichter, Montage, Anschluss): 16.800 Euro (1.953 Euro/kWp — Indach ist teurer als Aufdach wegen der Dachintegration). Batteriespeicher 10 kWh: 7.500 Euro (750 Euro/kWh). Elektriker, Zähler, Inbetriebnahme: 1.800 Euro. Gesamtinvestition: **26.100 Euro**. Jährliche Erträge: Eigenverbrauch 4.837 kWh × 0,36 Euro/kWh (vermiedener Strombezugspreis 2026, inkl. Netzentgelte und Umlagen) = 1.741 Euro. Einspeisung 3.503 kWh × 0,082 Euro/kWh (EEG-Einspeisevergütung Teileinspeisung, Inbetriebnahme 2026) = 287 Euro. Gesamtertrag: 2.028 Euro/a. Jährliche Kosten: Versicherung 80 Euro, Wartung 120 Euro, Speicherersatz nach 15 Jahren (anteilig 500 Euro/a). Netto-Ertrag: 1.328 Euro/a. Einfache Amortisation: 26.100 / 1.328 = **19,6 Jahre** (ohne Strompreissteigerung). Bei einer angenommenen Strompreissteigerung von 3 Prozent/Jahr reduziert sich die dynamische Amortisation auf **14,2 Jahre**.

## 4. Statik und Dachlast

Die zusätzliche Dachlast durch die PV-Module beträgt: 20 Module × 21,5 kg = 430 kg, Montagesystem (Klemmrahmen, Bleche): 180 kg, Gesamt: 610 kg auf 68 m² = 9,0 kg/m² = 0,09 kN/m². Die vorhandene Dachkonstruktion (Sparren 8/20 cm, Abstand 75 cm, Fichte C24) wurde im Rahmen des Bauantrags BA-2026-009 statisch nachgerechnet. Die bestehende Dachlast (Betondachsteine 43 kg/m² + Lattung 5 kg/m²) wird durch das Indach-System teilweise ersetzt (Dachsteine im Modulbereich entfallen: -43 kg/m², Module + System: +9 kg/m²). Die Netto-Lastveränderung beträgt **-34 kg/m²** — das Dach wird durch die PV-Anlage sogar leichter. Der statische Nachweis ist unkritisch.

## 5. Blitzschutz und Zählerkonzept

### 5.1 Blitzschutz

Das Gebäude verfügt über eine bestehende Blitzschutzanlage (Klasse III nach DIN EN 62305). Die PV-Anlage wird in das bestehende Blitzschutzkonzept integriert: Die Modulrahmen werden über die Montageunterkonstruktion und einen Potentialausgleichsleiter (Cu 16 mm²) an die bestehende Blitzschutz-Erdungsanlage angeschlossen. Der Wechselrichter enthält einen integrierten Überspannungsschutz Typ II (DC- und AC-seitig). Ein zusätzlicher Überspannungsableiter Typ I wird am Dachdurchführungspunkt der DC-Leitung installiert, um bei einem direkten Blitzeinschlag in die Fangeinrichtung den Wechselrichter zu schützen. Die Blitzschutzanlage wird nach der Installation der PV-Anlage durch einen Blitzschutz-Fachbetrieb geprüft und das Prüfprotokoll aktualisiert.

### 5.2 Zählerkonzept

Das Zählerkonzept sieht eine Überschusseinspeisung nach EEG vor. Am Netzanschlusspunkt wird ein Zweirichtungszähler installiert, der den Bezug und die Einspeisung getrennt erfasst. Der Batteriespeicher wird über einen DC-gekoppelten Hybridwechselrichter (Huawei SUN2000-8KTL-M1 mit LUNA2000-10-S0 Batterie) betrieben. Die Kaskadenmessung nach VDE-AR-N 4105 ermöglicht die exakte Zuordnung von Eigenverbrauch und Einspeisung. Die Anmeldung beim Netzbetreiber und die Eintragung im Marktstammdatenregister (MaStR) werden vor Inbetriebnahme durchgeführt.

## 6. Denkmalschutz-Auflagen

Die untere Denkmalschutzbehörde hat folgende Auflagen für die PV-Installation erteilt (Bescheid vom 20.12.2025, Az. DS-2025-0892): (1) Ausschließlich Indach-Montage, keine aufgeständerten Module. (2) Modulfarbe durchgängig dunkelgrau oder schwarz, keine sichtbaren Zellzwischenräume (Vollflächenmodule). (3) Modulrahmen schwarz eloxiert, keine silbernen Rahmen. (4) Keine Module auf der straßenseitigen Dachfläche (nur Süd-Südwest-Seite zum Innenhof). (5) Kabelführung und Wechselrichter im Gebäudeinneren, keine sichtbaren Installationen an der Fassade. Alle Auflagen werden durch die gewählte Anlagenkonfiguration erfüllt.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten beschreibt eine geplante Solaranlage auf dem Dach des Gebaeudes am Marktplatz 5, das unter Denkmalschutz steht. Die Anlage besteht aus 20 Solarmodulen mit einer Leistung von 8,6 kWp und soll im Jahr etwa 8.340 kWh Strom erzeugen. Zusammen mit einem Batteriespeicher kann mehr als die Haelfte des erzeugten Stroms direkt im Haus verbraucht werden. Weil das Gebaeude denkmalgeschuetzt ist, werden die Module in die Dachflaeche eingebaut statt aufgestaendert, und sie sind nur von der Hofseite aus sichtbar. Die Anlage rechnet sich nach etwa 14 Jahren.

Musterstadt, den 08.02.2026

_Dipl.-Ing. (FH) Karl Grünwald, Energieberater (dena)_`,
};
