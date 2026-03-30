import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-014',
  filename: 'Brandschutz_BA006.md',
  format: 'md',
  tags: ['Brandschutz', 'Altlasten'],
  created: '2026-02-06T10:00:00Z',
  vorgangId: 'BA-2026-006',
  markdown: `---
titel: Brandschutzkonzept Abbruch und Neubau Industrieweg 3
aktenzeichen: BA-2026-006
datum: 2026-02-06
ersteller: Brandschutz-Ingenieure Müller + Schmidt PartG
---

# Brandschutzkonzept — Abbruch und Neubau Industrieweg 3

## 1. Besondere Gefährdungslage

Das Grundstück Industrieweg 3 wurde von 1920 bis 1985 als Teerverarbeitungsbetrieb genutzt und ist mit polyzyklischen aromatischen Kohlenwasserstoffen (PAK) kontaminiert. Gemäß dem Altlastengutachten (Büro EnviroConsult, Bericht EC-2025-312) liegen die PAK-Konzentrationen im Boden bei bis zu 82 mg/kg (Prüfwert BBodSchV für Gewerbe: 20 mg/kg). Während der Abbruch- und Sanierungsarbeiten besteht eine erhöhte Brand- und Explosionsgefahr durch ausgasende flüchtige Kontaminanten, insbesondere Naphthalin (Dampfdruck 7,2 Pa bei 20°C, Flammpunkt 80°C). Das Brandschutzkonzept berücksichtigt daher drei Phasen: (1) Abbruch der kontaminierten Bestandsgebäude, (2) Bodensanierung mit Auskofferung, (3) Neubau einer Gewerbehalle mit Bürotrakt.

Die Risikoanalyse nach TRGS 720/721 ergibt für die Sanierungsphase folgende Einstufung: Die Bodensanierungsfläche wird als Zone 2 nach ATEX (gelegentliches Auftreten einer explosionsfähigen Atmosphäre, Dauer unter 10 h/Jahr) eingestuft. Außerhalb der Baugrubenumzäunung (Abstand > 5 m) ist keine Zone-Einstufung erforderlich. Die Maßnahmen des Explosionsschutzdokuments nach §6 GefStoffV werden separat erarbeitet und hier im Brandschutzkonzept referenziert.

## 2. Brandschutzmaßnahmen Abbruchphase

### 2.1 Organisatorische Maßnahmen

Vor Beginn der Abbrucharbeiten wird eine Brandschutzordnung nach DIN 14096, Teile A, B und C erstellt, die die Besonderheiten der kontaminierten Baustelle berücksichtigt. Alle auf der Baustelle tätigen Personen erhalten eine Unterweisung über die Brandgefahren durch PAK-kontaminierte Materialien, die Lage und Bedienung der Feuerlöscheinrichtungen und das Verhalten im Brandfall. Die Unterweisung wird in deutscher und polnischer Sprache durchgeführt (Hauptsprachen der Abbruchmannschaft). Ein Sicherheitskoordinator (SiGeKo) nach BaustellV überwacht die Einhaltung der Brandschutzmaßnahmen während der gesamten Abbruchphase.

### 2.2 Technische Maßnahmen Abbruch

Gasmessgeräte (PID — Photoionisationsdetektor) werden an 4 Stellen der Baugrube installiert und überwachen kontinuierlich die Konzentration flüchtiger organischer Verbindungen (VOC). Alarmschwellen: Voralarm bei 10 Prozent der unteren Explosionsgrenze (UEG), Hauptalarm bei 25 Prozent UEG mit automatischer Abschaltung aller Zündquellen und Evakuierung. Feuerlöscher (12 kg ABC-Pulver) sind in Abständen von maximal 20 m aufgestellt (insgesamt 16 Stück). Zusätzlich steht ein Schaumfeuerlöscher auf fahrbarem Gestell (50 l AFFF-Schaum) am Baugrubenrand. Heißarbeiten (Schneidbrenner, Winkelschleifer, Schweißen) an kontaminierten Stahlbauteilen dürfen nur nach vorheriger Freimessung der umgebenden Luft und mit gestellter Brandwache (Löschposten) durchgeführt werden. Die Brandwache muss nach Beendigung der Heißarbeiten weitere 2 Stunden anwesend sein. Löschdecken (nach DIN EN 1869) befinden sich an allen Arbeitsstellen mit Heißarbeiten.

## 3. Brandschutzmaßnahmen Sanierungsphase

### 3.1 Bodensanierung

Die Auskofferung des kontaminierten Bodens (geschätztes Volumen 2.800 m³, Tiefe bis 3 m) erzeugt bei warmem Wetter verstärkt PAK-Emissionen. Maßnahmen: Die Auskofferung wird bevorzugt in den kühleren Monaten (Oktober bis März) durchgeführt, um die Ausgasung zu minimieren. Eine Einhausung der Baugrube mit staubdichten Planen und Absauganlage (Aktivkohlefilter) reduziert die Emissionen in die Umgebung. Die Absauganlage ist explosionsgeschützt (ATEX-Kategorie 3G). Die Transportfahrzeuge für kontaminierten Boden werden mit abgedeckten Mulden betrieben. Eine Reifenwaschanlage verhindert die Verschleppung von Kontaminanten auf öffentliche Straßen.

### 3.2 Grundwasser-Monitoring

Während der Sanierung wird das Grundwasser an 4 Messstellen monatlich auf PAK, BTEX und Schwermetalle untersucht. Bei Überschreitung der Geringfügigkeitsschwellenwerte (GFS nach LAWA) wird die Sanierung unterbrochen und das Konzept angepasst. Der Brandschutz des Grundwasser-Monitorings erfordert keine besonderen Maßnahmen, da die Messstellen keine Zündquellen darstellen.

## 4. Brandschutzkonzept Neubau

### 4.1 Gebäudeklassifizierung

Der Neubau umfasst eine eingeschossige Produktionshalle (720 m², lichte Höhe 8 m) mit einem zweigeschossigen Büroanbau (256 m²). Gebäudeklasse 3 nach BauO NRW. Die Halle wird als Industriebau nach IndBauRL (Industriebaurichtlinie) eingestuft. Der Bürotrakt fällt unter die allgemeinen Anforderungen der BauO NRW für Gebäudeklasse 3.

### 4.2 Brandabschnittsbildung

Die Brandwand zwischen Produktionshalle und Bürotrakt ist in der Feuerwiderstandsklasse REI 90-M (Mauerwerk d = 24 cm KS 20-2.0, beidseitig verputzt) ausgeführt und wird 30 cm über die Dachhaut geführt, um eine Brandübertragung über das Dach zu verhindern. Die Verbindungstür zwischen Halle und Büro ist eine Brandschutztür T30-RS (Stahl, selbstschließend, Rauchschutz). Die Brandwand bildet die Grenze zwischen zwei unabhängigen Brandabschnitten: Halle (720 m²) und Büro (256 m²). Die zulässige Brandabschnittsfläche nach IndBauRL beträgt 1.800 m² für eingeschossige Industriebauten ohne Sprinkleranlage — die Halle mit 720 m² liegt deutlich darunter.

### 4.3 Tragkonstruktion Brandschutz

Die Stahlstützen der Halle (HEB 300, S355) werden mit einer F30-Bekleidung versehen. Gewählt wird eine Spritzputz-Beschichtung auf Vermiculite-Basis (Promat PROMAPAINT-SC4, Dicke 12 mm, geprüft nach DIN EN 13381-8). Die F30-Anforderung ergibt sich aus der Sicherheitskonzeption der IndBauRL Tabelle 1 (eingeschossig, kein Brandbekämpfungsabschnitt > 1.800 m², keine besonderen Gefahren). Die Stahlbetonbauteile des Bürotrakts (Wände, Decken, Stützen) erfüllen F90 durch die vorhandene Betonüberdeckung und Querschnittsabmessungen nach DIN EN 1992-1-2.

### 4.4 Automatische Brandmeldeanlage

Die gesamte Gewerbehalle wird mit einer automatischen Brandmeldeanlage Kategorie 1 (Vollschutz) nach DIN 14675 ausgestattet. In der Halle kommen lineare Wärmemelder (Sensorkabel unter der Hallendecke) und optische Rauchmelder (Ansaugrauchmelder VESDA in den Dachlichtbändern) zum Einsatz. Punktförmige Rauchmelder sind in der 8 m hohen Halle nicht geeignet, da die Rauchverdünnung zu Detektionsversagen führen würde. Im Bürotrakt und in den Nebenräumen werden konventionelle optisch-thermische Melder installiert. Die BMA wird auf die Feuerwehr-Einsatzzentrale aufgeschaltet. FBF, FAT und FSD befinden sich am Haupteingang des Bürotrakts.

### 4.5 Sprinkleranlage Lagerbereich

Der Lagerbereich in der Halle (180 m², Lagerhöhe bis 4 m) erhält eine automatische Sprinkleranlage nach VdS CEA 4001 (Nassanlage, Gefahrengruppe OH2, Beaufschlagungsdichte 5 mm/min). Die Sprinkleranlage schützt den Bereich mit erhöhter Brandlast (Verpackungsmaterial, Kunststoffteile, Holzpaletten) und begrenzt einen Brand auf die Entstehungsfläche. Die Wasserversorgung erfolgt über den Hausanschluss mit einer Druckerhöhungspumpe (Fördermenge 600 l/min bei 5 bar). Ein Sprinklertank (8 m³ oberirdisch) gewährleistet eine Überbrückungszeit von 13 Minuten bis zum Eintreffen der Feuerwehr.

### 4.6 Rauch- und Wärmeabzugsanlage

Die Halle erhält eine natürliche Rauch- und Wärmeabzugsanlage (NRWA) über die Lichtbänder im Dach. Die aerodynamisch wirksame Rauchabzugsfläche beträgt 3 Prozent der Hallengrundfläche (720 × 0,03 = 21,6 m²). Gewählt: 6 RWA-Klappen à 3,80 m² in den Lichtbändern, pneumatische Auslösung über Rauchmelder und Handauslösung an den Ausgangstüren. Die Zuluft wird über automatisch öffnende Wandklappen in der Nordfassade (je 3,00 m² × 4 Stück = 12 m²) sichergestellt. Das Zuluft-zu-Abluft-Verhältnis beträgt 1:1,8, was eine effektive rauchfreie Schicht von mindestens 2,50 m über dem Hallenboden gewährleistet (berechnet nach DIN 18232-2).

## 5. Rettungswege und Feuerwehrzufahrt

Die Halle hat 3 Ausgänge ins Freie (Tor Ost 4,00 × 4,50 m, Tür Süd 1,20 m, Tür Nord 1,20 m). Die maximale Rettungsweglänge beträgt 30 m (zulässig 35 m ohne Sprinkler, 70 m mit Sprinkler — hier nicht relevant, da unter 35 m). Der Bürotrakt hat 2 Ausgänge (Haupteingang West und Nebenausgang über die Verbindung zur Halle). Die Rettungswegkennzeichnung erfolgt mit lang nachleuchtenden Schildern nach DIN ISO 7010 und einer Sicherheitsbeleuchtung nach DIN EN 1838 (1 Lux auf dem Fluchtweg, Einschaltzeit < 0,5 Sekunden).

Die Feuerwehrzufahrt erfolgt über die Zufahrt Gewerbepark Süd (Breite 5,50 m, Kurvenradius 10,50 m). Die Aufstellfläche für die Drehleiter befindet sich auf dem befestigten Parkplatz vor dem Bürotrakt (Tragfähigkeit > 16 t/Achse). Hydranten: 1 Überflurhydrant DN 100 an der Zufahrt (Entfernung 40 m), 1 Unterflurhydrant DN 150 an der Erschließungsstraße (Entfernung 120 m). Löschwassermenge: 1.600 l/min über 2 Stunden (Gewerbebetrieb, nach DVGW W 405).

## Zusammenfassung in einfacher Sprache

Dieses Brandschutzkonzept behandelt den Abriss eines alten Fabrikgelaendes am Industrieweg 3 und den anschliessenden Neubau einer Gewerbehalle mit Buero. Der Boden ist mit Schadstoffen aus einer frueheren Teerverarbeitung belastet, was waehrend der Sanierung eine erhoehte Brand- und Explosionsgefahr bedeutet. Deshalb werden Gasmessgeraete aufgestellt, die die Luft staendig ueberwachen und bei Gefahr sofort Alarm schlagen. Im neuen Gebaeude sind Halle und Buero durch eine feuerfeste Wand getrennt, und die Halle bekommt Rauchabzuege im Dach sowie eine Brandmeldeanlage. Ein Lagerbereich wird zusaetzlich durch eine automatische Sprinkleranlage geschuetzt.

Musterstadt, den 06.02.2026

_Dipl.-Ing. Sabine Müller, Brandschutz-Ingenieurin (VBI)_`,
};
