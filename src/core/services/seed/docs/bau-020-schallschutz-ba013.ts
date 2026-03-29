import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-020',
  filename: 'Schallschutz_BA013.md',
  format: 'md',
  tags: ['Schallschutz', 'Gastronomie', 'Lärm'],
  created: '2026-02-15T10:00:00Z',
  vorgangId: 'BA-2026-013',
  markdown: `---
titel: Schallschutzgutachten Gastronomie Hauptstraße 67
aktenzeichen: BA-2026-013
datum: 2026-02-15
ersteller: Akustik-Ingenieurbüro Dr. Schröder
---

# Schallschutzgutachten — Gastronomie Hauptstraße 67

## 1. Aufgabenstellung und Rechtsgrundlagen

Im Rahmen der Nutzungsänderung des Erdgeschosses Hauptstraße 67 vom Ladengeschäft zum Gastronomiebetrieb (80 Plätze, davon 25 Außenplätze) wurde ein schalltechnisches Gutachten beauftragt. Das Gutachten untersucht die Lärmeinwirkung der Gastronomie auf die Nachbarschaft (Immissionsschutz) und den Schallschutz zwischen der Gaststätte im Erdgeschoss und den darüber liegenden Wohnungen (Bauakustik). Die Rechtsgrundlagen sind: TA Lärm (Technische Anleitung zum Schutz gegen Lärm) für die Bewertung der Gewerbelärmimmissionen, DIN 4109:2018 für den bauakustischen Schallschutz zwischen verschiedenen Nutzungseinheiten und die VDI-Richtlinie 2058 Blatt 1 für die Beurteilung von Arbeitslärm in der Nachbarschaft.

Das Gebäude liegt in einem Mischgebiet (MI) nach Bebauungsplan. Die Immissionsrichtwerte der TA Lärm für Mischgebiete betragen tags (6:00–22:00 Uhr) 60 dB(A) und nachts (22:00–6:00 Uhr) 45 dB(A). Die kurzzeitigen Geräuschspitzen dürfen die Richtwerte tags um 30 dB und nachts um 20 dB nicht überschreiten. Die Betriebszeiten der Gaststätte sind: Montag bis Samstag 11:00–24:00 Uhr, Sonntag 10:00–22:00 Uhr. Die Außengastronomie soll bis 22:00 Uhr betrieben werden.

## 2. Immissionsprognose Außengastronomie

### 2.1 Schallquellenanalyse

Die Außengastronomie mit 25 Sitzplätzen erzeugt folgende Schallquellen: Sprechschall der Gäste (Kommunikationspegel in gehobener Lautstärke, typisch für Außengastronomie): Schallleistungspegel je Person LWA = 72 dB(A) (nach VDI 2081, Tabelle A4 für erhöhte Sprechlautstärke). Bei 25 gleichzeitig sprechenden Personen (worst case): LWA,ges = 72 + 10 × lg(25) = 72 + 14 = 86 dB(A). Zusätzliche Quellen: Geschirr- und Besteckklappern (+3 dB Zuschlag), gelegentliches Lachen (+2 dB), Bedienung (+1 dB). Gesamtschallleistungspegel der Außengastronomie: LWA,ges = 92 dB(A).

### 2.2 Immissionsberechnung

Der nächstgelegene maßgebliche Immissionsort (IO 1) ist das Fenster der Wohnung im 1. Obergeschoss Hauptstraße 69 (Nachbargebäude), Abstand zum Mittelpunkt der Außengastronomie: 8 m horizontal, 4 m vertikal, Schrägabstand r = 8,9 m. Schallausbreitungsberechnung nach DIN ISO 9613-2 (Freifeldausbreitung, keine Abschirmung): Beurteilungspegel am IO 1: Lr = LWA - 10 × lg(2π × r²) + DΩ - Adiv = 92 - 10 × lg(2π × 79) - 0 = 92 - 27 = 65 dB(A). Der Halbkugelanteil DΩ = 0 dB (keine reflektierende Fläche in unmittelbarer Nähe der Quelle — die Schallquelle strahlt halbkugelförmig ab, da sie auf dem Boden liegt). Die Richtungskorrektur durch die Fassadenreflexion am IO wird mit +3 dB berücksichtigt: Lr = 65 + 3 = 68 dB(A).

Tags (bis 22:00 Uhr): Beurteilungspegel 68 dB(A) > Richtwert 60 dB(A) — Überschreitung um 8 dB. Nachts (ab 22:00 Uhr): Bei Weiterbetrieb mit halber Gästeanzahl (12 Personen) und reduzierter Lautstärke (normale Unterhaltung, LWA je Person = 65 dB(A)): Lr,nachts = 65 + 10 × lg(12) - 27 + 3 = 65 + 10,8 - 27 + 3 = 51,8 dB(A) > 45 dB(A) — Überschreitung um 6,8 dB.

### 2.3 Notwendige Maßnahmen

Die Richtwertüberschreitungen erfordern folgende Maßnahmen: (1) Betriebszeitbeschränkung der Außengastronomie bis 22:00 Uhr (Nachtbetrieb ausgeschlossen). (2) Reduzierung der Sitzplatzanzahl auf 15 Plätze (Reduktion um -2,2 dB). (3) Schallabsorbierende Bepflanzung als Abschirmung: Eine 1,50 m hohe begrünte Stellwand (Pflanzgefäße mit Immergrün-Hecke, akustisch wirksame Seite mit Mineralwolle-Absorber hinter perforiertem Blech, Einfügungsdämpfung De = 8 dB) wird zwischen der Außengastronomie und dem Nachbargebäude aufgestellt. (4) Reduzierter Beurteilungspegel nach Maßnahmen: Lr,tags = 68 - 2,2 - 8 = 57,8 dB(A) < 60 dB(A). Der Tagrichtwert wird nun eingehalten.

## 3. Küchenabluft — Lärmimmission

Die Küchenabluftanlage (Volumenstrom 2.500 m³/h) erzeugt am Austritt auf dem Dach einen Schallleistungspegel von LWA = 75 dB(A) (Herstellerangabe, einschließlich Schalldämpfer im Kanalverlauf). Der Schallweg vom Dach zum nächsten Immissionsort (IO 2: Dachfenster Wohnung 3. OG Hauptstraße 69, Abstand 12 m) ergibt: Lr = 75 - 10 × lg(2π × 144) = 75 - 29,6 = 45,4 dB(A). Tags: 45,4 dB(A) < 60 dB(A) — kein Problem. Nachts (bei Betrieb bis 24:00 Uhr): 45,4 dB(A) > 45 dB(A) — Grenzwertüberschreitung um 0,4 dB. Maßnahme: Einbau eines zusätzlichen Rohrschalldämpfers (Kulissendämpfer, Einfügungsdämpfung De = 10 dB im Frequenzbereich 250–2000 Hz) vor dem Dachaustritt. Reduzierter Schallleistungspegel: LWA = 65 dB(A), resultierender Beurteilungspegel: 35,4 dB(A) < 45 dB(A). Nachweis erfüllt.

## 4. Bauakustischer Schallschutz Gaststätte/Wohnung

### 4.1 Musikbeschränkung im Innenraum

Die Gaststätte plant eine Hintergrundmusik-Beschallung (keine Live-Musik, keine Tanzveranstaltungen). Die maximale Musiklautstärke im Gastraum wird auf LA = 80 dB(A) begrenzt (Festlegung im Betriebskonzept, kontrolliert durch einen Schallpegelbegrenzer am Verstärker). Die Decke zum 1. OG (Stahlbetondecke d = 20 cm, R'w = 56 dB mit schwimmendem Estrich der Wohnung darüber) muss den Musikpegel auf den zulässigen Innenpegel in der Wohnung reduzieren. Zulässiger Innenpegel nachts (TA Lärm, Nr. 6.2): LA = 25 dB(A) (schutzbedürftige Räume, Nachtzeit). Erforderliche Schalldämmung: R'w,erf = LA,Quelle - LA,zul + 10 × lg(S/A) = 80 - 25 + 10 × lg(120/25) = 55 + 6,8 = 61,8 dB. Vorhandene Schalldämmung: R'w = 56 dB < 61,8 dB. Die vorhandene Decke reicht bei 80 dB(A) Musiklautstärke nicht aus.

### 4.2 Maßnahmen Deckenschalldämmung

Zur Verbesserung der Schalldämmung der Decke wird in der Gaststätte eine abgehängte Unterdecke eingebaut: Federschienen, Hohlraum 150 mm mit Mineralwolle 80 mm, 2 × 12,5 mm GK. Verbesserung: ΔRw = +10 dB. Neue Schalldämmung: R'w = 56 + 10 = 66 dB > 61,8 dB. Nachweis erfüllt. Alternativ Begrenzung der Musiklautstärke auf LA = 72 dB(A): R'w,erf = 72 - 25 + 6,8 = 53,8 dB < 56 dB — würde ohne bauliche Maßnahmen ausreichen. Empfehlung: Kombination aus abgehängter Decke UND Begrenzung auf 80 dB(A), um auch für Bass-lastige Musik (tieffrequenter Bereich unter 125 Hz, wo die Schalldämmung schlechter ist) ausreichenden Schutz zu bieten.

### 4.3 Trittschalldämmung

Der Betrieb einer Gaststätte erzeugt erhöhten Trittschall (Stuhlrücken, Laufen auf hartem Boden, Barhocker). Die Bestandsdecke hat einen Norm-Trittschallpegel von L'n,w = 58 dB (Stahlbeton 20 cm mit schwimmendem Estrich der Wohnung darüber). Der zulässige Trittschallpegel nach DIN 4109 für die Übertragung von gewerblich genutzten Räumen in Wohnungen beträgt L'n,w ≤ 46 dB. Maßnahme: In der Gaststätte wird ein zusätzlicher elastischer Bodenbelag (Linoleum 4 mm auf Korkment-Unterlage 6 mm) verlegt, der die Trittschallanregung um ΔLw = 14 dB mindert. Resultierender Norm-Trittschallpegel: L'n,w = 58 - 14 = 44 dB ≤ 46 dB. Nachweis erfüllt.

## 5. Zusammenfassung und Auflagen

Das Schallschutzgutachten ergibt, dass der Gastronomiebetrieb unter folgenden Auflagen genehmigungsfähig ist: (1) Außengastronomie maximal 15 Plätze, Betrieb bis 22:00 Uhr. (2) Schallabsorbierende Stellwand zwischen Außengastronomie und Nachbargebäude. (3) Zusätzlicher Schalldämpfer in der Küchenabluftleitung vor Dachaustritt. (4) Abgehängte Akustikdecke in der Gaststätte zur Verbesserung der Deckenschalldämmung. (5) Musiklautstärke im Innenraum begrenzt auf LA = 80 dB(A) durch Schallpegelbegrenzer. (6) Elastischer Bodenbelag in der gesamten Gaststätte. Eine messtechnische Überprüfung der Auflagen nach Inbetriebnahme (innerhalb von 3 Monaten) wird empfohlen.

Musterstadt, den 15.02.2026

_Dr.-Ing. Helmut Schröder, Akustik-Ingenieurbüro_`,
};
