import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-029',
  filename: 'Stellungnahme_Wasserbehoerde_BA020.md',
  format: 'md',
  tags: ['Stellungnahme', 'Hochwasser', 'Hydraulik'],
  created: '2026-03-08T10:00:00Z',
  vorgangId: 'BA-2026-020',
  markdown: `---
titel: Hydraulische Stellungnahme Hochwasserschutzmauer Uferpromenade
aktenzeichen: BA-2026-020
datum: 2026-03-08
ersteller: Untere Wasserbehörde Kreis Musterland
---

# Hydraulische Stellungnahme — Hochwasserschutzmauer Uferpromenade

## 1. Vorhaben und wasserwirtschaftlicher Kontext

Die Stadt Musterstadt plant die Errichtung einer Hochwasserschutzmauer entlang der Uferpromenade am linken Ufer der Muster (Gewässer II. Ordnung, Einzugsgebiet 185 km², mittlerer Abfluss MQ = 4,8 m³/s). Die Schutzmauer soll den innerstädtischen Bereich zwischen Flusskilometer 12,4 und 13,2 (Länge 800 m) vor einem HQ100-Hochwasserereignis schützen. Im bestehenden Zustand liegt die Oberkante der Uferpromenade bei 127,80 m ü. NHN, der berechnete HQ100-Wasserstand beträgt 128,40 m ü. NHN — bei einem HQ100 wird die Promenade um 60 cm überflutet und das Wasser dringt in die angrenzende Altstadt-Bebauung ein. Die letzte vergleichbare Überschwemmung ereignete sich im Januar 2024 und verursachte Schäden von 4,2 Millionen Euro an 38 Gebäuden.

Die geplante Schutzmauer (Stahlbeton C30/37, Wanddicke 40 cm, Gründung auf Bohrpfählen DN 600) hat eine Oberkante von 129,20 m ü. NHN, das entspricht einem Freibord von 80 cm über dem HQ100-Wasserstand. Die Mauer wird mit einer Natursteinverblendung (Sandstein, passend zur historischen Ufermauer) gestaltet und erhält 4 Durchlasstore für den Zugang zur Uferpromenade, die bei Hochwasser hydraulisch geschlossen werden (Schließzeit: 15 Minuten nach Warnung durch die Hochwasserzentrale). Die untere Wasserbehörde nimmt zu den hydraulischen Auswirkungen des Bauwerks auf das Gewässer Stellung.

## 2. Hydraulische Modellierung

### 2.1 Modellbeschreibung

Die hydraulische Berechnung wurde mit dem 2D-Modell Hydro_AS-2D (Version 5.2) durchgeführt. Das Modellgebiet umfasst einen 3 km langen Flussabschnitt (Flusskilometer 11,0 bis 14,0) mit dem bebauten Vorland beidseitig der Muster. Die Geländedaten basieren auf einem LiDAR-Höhenmodell (DGM1, Auflösung 1 m × 1 m) und dem Gewässerprofil aus der hydromorphologischen Vermessung 2024 (64 Querprofile, Abstand 50 m). Das Berechnungsgitter hat eine Auflösung von 2 m im Flussschlauch und 5 m im Vorland (92.000 Berechnungselemente). Die Rauheitsbeiwerte nach Manning-Strickler wurden kalibriert: Flussschlauch kSt = 28 m^(1/3)/s (Kies-Sohle mit Bewuchs), Vorland Wiese kSt = 18, Vorland bebaut kSt = 8, Uferpromenade kSt = 45 (Pflaster).

### 2.2 HQ100-Abfluss

Der HQ100-Abfluss wurde aus der Extremwertstatistik der Pegeldaten Musterstadt (Datenreihe 1951–2025, 74 vollständige Jahre) nach dem Verfahren der Allgemeinen Extremwertverteilung (GEV) bestimmt: **HQ100 = 285 m³/s** (90-Prozent-Konfidenzintervall: 248–328 m³/s). Der Scheitelwasserstand am Standort der Schutzmauer beträgt im Ist-Zustand (ohne Mauer): **128,40 m ü. NHN** (Wassertiefe im Flussschlauch: 3,20 m, Fließgeschwindigkeit: 2,1 m/s, Abflussquerschnitt Fluss: 68 m², Abflussquerschnitt Vorland links: 52 m², Gesamtabflussbreite: 85 m).

### 2.3 Auswirkung der Schutzmauer

Die Schutzmauer reduziert den Abflussquerschnitt im linken Vorland auf Null (das Wasser kann nicht mehr über die Promenade in die Altstadt fließen). Der gesamte HQ100-Abfluss muss durch den verbleibenden Flussschlauch und das rechte Vorland abgeführt werden. Die 2D-Simulation zeigt folgende Auswirkungen:

Wasserspiegelaufstau am Standort der Mauer: +22 cm (von 128,40 auf 128,62 m ü. NHN). Der Aufstau resultiert aus der Einengung des Abflussquerschnitts — das Wasser staut sich vor der Mauer und der Wasserspiegel steigt, bis die verbleibende Durchflussfläche den gesamten Abfluss aufnehmen kann. Der Aufstau klingt flussabwärts über eine Strecke von 400 m auf Null ab und wirkt sich flussaufwärts über 600 m aus (maximaler Aufstau am Oberstrom der Mauer: +18 cm).

Auswirkung auf das rechte Ufer: Der Wasserstand am rechten Ufer steigt um +15 cm (von 128,30 auf 128,45 m ü. NHN). Das rechte Vorland (Grünfläche, Sportplatz) wird um 5 cm tiefer überschwemmt als im Ist-Zustand. Die Fließgeschwindigkeit im Flussschlauch erhöht sich um 12 Prozent (von 2,10 auf 2,35 m/s). Die erhöhte Fließgeschwindigkeit kann zu verstärkter Sohlenerosion und Ufererosion unterhalb der Mauer führen.

### 2.4 Retentionsraumverlust

Durch die Schutzmauer geht Retentionsraum (Überschwemmungsgebiet) auf dem linken Vorland verloren. Der Retentionsraumverlust wird als Differenz der Wasservolumina im Vorland zwischen Ist-Zustand und Plan-Zustand bei HQ100 berechnet: Volumen Ist (linkes Vorland überflutet): 1.200 m³ (800 m Länge × 25 m mittlere Breite × 0,06 m mittlere Wassertiefe). Volumen Plan (kein Überflutung links): 0 m³. **Retentionsraumverlust: 1.200 m³**. Gemäß §77 WHG (Erhaltung von Überschwemmungsgebieten) und §78a WHG (Genehmigung von Anlagen in Überschwemmungsgebieten) muss der Retentionsraumverlust kompensiert werden.

## 3. Kompensationsmaßnahmen

### 3.1 Flutmulde flussabwärts

Als Kompensation für den Retentionsraumverlust wird eine Flutmulde 200 m flussabwärts des Mauer-Endes auf dem linken Vorland angelegt (Flurstück 721/3, im Eigentum der Stadt Musterstadt). Die Flutmulde hat folgende Abmessungen: Länge 120 m, Breite 20 m, Tiefe 0,40 m unter Geländeoberkante, Böschungsneigung 1:5. Das Speichervolumen beträgt **960 m³** (berechnet als prismatischer Trog). Bei HQ100 füllt sich die Mulde über eine seitliche Überströmschwelle (Oberkante 127,90 m ü. NHN, Breite 15 m) und nimmt zusätzlich 240 m³ durch die ansteigende Überflutungshöhe auf. Gesamtkompensationsvolumen: 960 + 240 = **1.200 m³** — der Retentionsraumverlust wird vollständig kompensiert.

### 3.2 Erosionsschutz

Zur Vermeidung der durch die erhöhte Fließgeschwindigkeit verursachten Erosion werden folgende Maßnahmen am Mauer-Ende (flussabwärts) vorgesehen: Kolkschutz aus Wasserbausteinen (Steinklasse CP90/250 nach TLW, Schichtdicke 50 cm) auf einer Länge von 20 m flussabwärts des Mauer-Endes. Ufersicherung am rechten Ufer gegenüber der Mauer: Vegetative Ufersicherung mit Weidenspreitlagen und Faschinen (auf 200 m Länge), um die Erosion durch die erhöhte Schleppspannung zu begrenzen.

### 3.3 Fischpassierbarkeit

Die Mauer verändert die Uferstruktur im linken Vorland und eliminiert die flache Übergangszone zwischen Land und Wasser (Litoralzone), die als Laich- und Jungfischhabitat für Fließgewässerarten wie Bachforelle, Äsche und Elritze wichtig ist. Als Kompensation wird am Fuß der Mauer ein naturnahes Ufergestaltungselement eingebaut: eine vorgelagerte Steinschüttung mit Buhnen-artigem Charakter (5 Einzelbuhnen aus Wasserbausteinen, Länge je 3 m, Abstand 30 m), die strömungsberuhigte Zonen und Kiessubstrat als Laichhabitat schaffen.

## 4. Strömungsgeschwindigkeiten und Kolkgefahr

Die 2D-Simulation zeigt, dass die Fließgeschwindigkeit am Mauer-Ende (stromabwärts) lokal auf 2,8 m/s ansteigt (Ist-Zustand: 1,9 m/s). Die kritische Erosionsgeschwindigkeit der Flusssohle (mittlerer Korndurchmesser d50 = 35 mm, Kies) beträgt nach der Shields-Kurve: vc = 1,5 m/s (bei Wassertiefe 3 m). Die Fließgeschwindigkeit von 2,8 m/s übersteigt die kritische Geschwindigkeit deutlich — ohne Kolkschutz ist mit einer Kolktiefe von 1,0–1,5 m am Mauer-Ende zu rechnen (Berechnung nach der Breusers-Methode: zs = 0,75 × (v/vc - 1) × d_Sohle = 0,75 × (2,8/1,5 - 1) × 3 = 1,95 m — konservativ, tatsächlich durch die 3D-Strömung und die Korngrößenverteilung reduziert auf geschätzt 1,0–1,5 m). Der oben beschriebene Kolkschutz (Wasserbausteine CP90/250, d = 50 cm) ist für Geschwindigkeiten bis 3,5 m/s stabil und verhindert die Kolkbildung.

## 5. Bewertung und Auflagen

Die untere Wasserbehörde befürwortet das Hochwasserschutzbauwerk unter folgenden Auflagen: (1) Herstellung der Flutmulde vor Baubeginn der Mauer (Retentionsraumkompensation). (2) Kolkschutz am Mauer-Ende gemäß Abschnitt 3.2. (3) Ufersicherung rechtes Ufer auf 200 m Länge. (4) Naturnahes Ufergestaltungselement am Mauerfuß. (5) Wasserrechtliche Genehmigung nach §68 WHG ist erforderlich (Gewässerausbau). (6) Bauzeit außerhalb der Laichzeit der Bachforelle (Oktober bis Januar vermeiden, bevorzugt Juni bis September). (7) Monitoring der Sohlenerosion und des Kolkschutzes über 5 Jahre nach Fertigstellung (jährliche Vermessung der Gewässersohle im Bereich 200 m ober- und unterhalb der Mauer).

Die wasserrechtliche Genehmigung kann erteilt werden, wenn alle genannten Auflagen in die Genehmigungsunterlagen aufgenommen werden. Die Hochwasserschutzmauer erhöht den Schutz der Altstadt-Bebauung von einem HQ10 (bestehender Zustand, Schutz nur bis 127,80 m ü. NHN) auf ein HQ100 und ist daher im öffentlichen Interesse.

## Zusammenfassung in einfacher Sprache

Die Wasserbehoerde hat geprueft, wie sich die geplante Hochwasserschutzmauer an der Uferpromenade auf den Fluss auswirkt. Die Mauer soll die Altstadt vor einem Jahrhunderthochwasser schuetzen. Das Problem: Wenn das Wasser nicht mehr ueber die Promenade in die Altstadt fliessen kann, steigt der Wasserstand im Fluss um etwa 22 Zentimeter an, und das gegenueberliegende Ufer wird etwas staerker ueberschwemmt. Als Ausgleich wird flussabwaerts eine Flutmulde angelegt, die das fehlende Rueckhaltevolumen ersetzt. Die Behoerde befuerwortet das Bauwerk, wenn diese und weitere Schutzmassnahmen umgesetzt werden.

Musterstadt, den 08.03.2026

_Dipl.-Ing. Michael Strömung, Untere Wasserbehörde Kreis Musterland_`,
};
