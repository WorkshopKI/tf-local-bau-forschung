import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-018',
  filename: 'Schallschutz_BA002.md',
  format: 'md',
  tags: ['Schallschutz', 'MFH'],
  created: '2026-02-04T10:00:00Z',
  vorgangId: 'BA-2026-002',
  markdown: `---
titel: Schallschutznachweis Mehrfamilienhaus Lindenstraße 42
aktenzeichen: BA-2026-002
datum: 2026-02-04
ersteller: Akustik-Ingenieurbüro Dr. Schröder
---

# Schallschutznachweis — MFH Lindenstraße 42

## 1. Anforderungen und Schutzziele

Der Schallschutznachweis wird nach DIN 4109:2018 (Schallschutz im Hochbau) geführt. Zusätzlich wird der erhöhte Schallschutz nach VDI 4100:2012, Schallschutzstufe II (SSt II) angestrebt, der den heutigen Komforterwartungen im Geschosswohnungsbau entspricht und vom Bauherrn als Qualitätsmerkmal gefordert wird. Die Schallschutzstufe II geht über die Mindestanforderungen der DIN 4109 hinaus und bietet den Bewohnern einen deutlich wahrnehmbaren Schutz vor Nachbargeräuschen — normale Gespräche in der Nachbarwohnung sind nicht mehr verständlich, laute Musik wird nur noch als Hintergrundsummen wahrgenommen.

Das Gebäude liegt an der Lindenstraße mit einem Verkehrsaufkommen von DTV 8.500 Kfz/d (Schwerverkehrsanteil 5 Prozent) und wird dem Lärmpegelbereich IV nach DIN 4109, Tabelle 7 zugeordnet (maßgeblicher Außenlärmpegel tags La = 66–70 dB(A)). Die lärmsensiblen Räume (Schlafzimmer, Wohnzimmer) liegen zur Hofseite (Süden und Osten), während die weniger lärmempfindlichen Räume (Küche, Bad, Flur) zur Straßenseite (Norden) orientiert sind — eine schallschutztechnisch günstige Grundrissanordnung.

## 2. Luftschalldämmung

### 2.1 Wohnungstrennwände

Anforderung DIN 4109: R'w ≥ 53 dB (Mindestanforderung). Anforderung VDI 4100 SSt II: R'w ≥ 56 dB. Die Wohnungstrennwände bestehen aus Kalksandstein-Mauerwerk KS 20-2.0, d = 24 cm (flächenbezogene Masse m' = 432 kg/m²), beidseitig verputzt (Kalkzementputz, 15 mm). Bewertetes Schalldämm-Maß der Wand (Laborwert nach DIN EN ISO 140-3): Rw = 62 dB. Der Korrekturwert für die Flankenübertragung nach dem vereinfachten Verfahren der DIN 4109 Beiblatt 1 beträgt KL = -3 dB (schwere Flanken: Stahlbetondecke 22 cm, KS-Außenwand 20 cm mit WDVS). Resultierendes bewertetes Bau-Schalldämm-Maß: R'w = Rw - KL = 62 - 3 = 59 dB. Der Nachweis R'w = 59 dB ≥ 56 dB (SSt II) ist erfüllt. Die schwere Bauweise der Wohnungstrennwände bietet einen hohen Schallschutz auch im tieffrequenten Bereich (unter 200 Hz), wo leichte Konstruktionen häufig Schwächen zeigen.

Zusätzlich wird auf der Empfangsseite (Schlafzimmer) eine Vorsatzschale montiert: CW-Profil 50 mm, Mineralwolle 40 mm, GK 12,5 mm. Die Vorsatzschale verbessert das Schalldämm-Maß um ΔRw = +8 dB (frequenzabhängig, besonders wirksam oberhalb 500 Hz). Die resultierende Schalldämmung mit Vorsatzschale: R'w = 67 dB. Dieser Wert übertrifft selbst die VDI 4100 SSt III (≥ 59 dB) und bietet den Bewohnern einen exzellenten Schallschutz.

### 2.2 Wohnungstrenndecken (Luftschalldämmung)

Anforderung DIN 4109: R'w ≥ 54 dB. Anforderung VDI 4100 SSt II: R'w ≥ 57 dB. Die Stahlbetonflachdecke d = 22 cm (m' = 550 kg/m²) erbringt einen Laborwert von Rw = 60 dB. Mit Flankenübertragungskorrektur KL = -2 dB: R'w = 58 dB ≥ 57 dB (SSt II). Der Nachweis ist erfüllt. Der schwimmende Estrich (siehe Trittschallabschnitt) verbessert die Luftschalldämmung der Decke zusätzlich um ΔRw = +4 dB, sodass der tatsächliche Wert bei R'w ≈ 62 dB liegt.

### 2.3 Außenbauteile (Straßenlärm)

Für den Lärmpegelbereich IV beträgt das erforderliche resultierende Schalldämm-Maß der Außenfassade R'w,res ≥ 40 dB (DIN 4109, Tabelle 8, Aufenthaltsräume). Die Außenwand (KS 20-2.0 mit WDVS 200 mm Mineralwolle) erreicht R'w = 52 dB — der Schallschutz wird durch die Wand nicht begrenzt, sondern durch die Fenster. Die Fenster zur Straßenseite erhalten Schallschutzglas der Schallschutzklasse 3 (SSK 3) nach VDI 2719: Rw = 37 dB (Aufbau: 8 mm Float / 16 mm SZR Argon / 6 mm Float-Lam, asymmetrischer Scheibenaufbau). Die Fensterrahmen sind als Kunststoff-Mehrkammerprofile mit umlaufender Dreifachdichtung ausgeführt. Der Fensterflächenanteil an der Straßenfassade beträgt 30 Prozent. Resultierendes Schalldämm-Maß der Gesamtfassade nach Mischungsregel: R'w,res = -10 × lg(0,70 × 10^(-52/10) + 0,30 × 10^(-37/10)) = 41,2 dB ≥ 40 dB. Nachweis erfüllt.

Für Schlafräume zur Straßenseite (2 Stück im 1. OG) werden Fenster der SSK 4 (Rw = 42 dB) eingesetzt, um auch nachts einen ausreichenden Innenpegel von < 30 dB(A) zu gewährleisten (DIN 4109, Tabelle 8, Nachtanforderung für Schlafräume im Lärmpegelbereich IV).

## 3. Trittschalldämmung

### 3.1 Wohnungstrenndecken

Anforderung DIN 4109: L'n,w ≤ 53 dB. Anforderung VDI 4100 SSt II: L'n,w ≤ 46 dB. Der Fußbodenaufbau besteht aus (von oben nach unten): Parkett 15 mm auf Trennlage, Zementestrich CT-C30-F5 d = 55 mm, PE-Folie als Gleitlage, Trittschalldämmung Mineralwolle (Steinwolle, dynamische Steifigkeit s' ≤ 10 MN/m³) d = 30 mm, Stahlbetondecke d = 22 cm. Der Norm-Trittschallpegel der Rohdecke beträgt Ln,w,eq = 76 dB (Stahlbeton 22 cm). Die Trittschallminderung des schwimmenden Estrichs: ΔLw = 33 dB (berechnet nach DIN EN 12354-2 mit dem Massegesetz für schwimmende Estriche: Estrichmasse 132 kg/m², Dämmung s' = 10 MN/m³). Bewerteter Norm-Trittschallpegel im Bau: L'n,w = Ln,w,eq - ΔLw + K = 76 - 33 + 0 = 43 dB ≤ 46 dB (SSt II). Der Nachweis ist erfüllt. Der Korrekturwert K für die Flankenübertragung beträgt hier 0 dB, da die Flanken (schwere KS-Wände und Stahlbetondecken) keine relevante Trittschallübertragung erwarten lassen.

### 3.2 Treppenhaus

Die Treppenpodeste und Treppenläufe sind als Stahlbeton-Fertigteile auf elastischen Auflagern (Sylomer-Pads, Farbe grün, statische Steifigkeit 8 N/mm²) vom Treppenhausbau entkoppelt. Die Trittschallminderung durch die elastischen Lager beträgt ΔLw = 22 dB. Der resultierende Norm-Trittschallpegel in der angrenzenden Wohnung beträgt L'n,w = 48 dB (Anforderung DIN 4109 für Treppen: L'n,w ≤ 53 dB, SSt II: ≤ 46 dB). Der SSt-II-Wert wird um 2 dB überschritten — als Kompensation wird die Auflagerkonstruktion optimiert: dickere Elastomerpads (20 mm statt 12 mm) reduzieren den Trittschallpegel um weitere 4 dB auf L'n,w = 44 dB ≤ 46 dB.

## 4. Haustechnische Anlagen

### 4.1 Aufzugsanlage

Der Aufzugsschacht ist als separate Stahlbetonkonstruktion (Wände d = 20 cm) vom übrigen Tragwerk akustisch entkoppelt. Die Aufzugsführungsschienen werden über Elastomerpuffer an den Schachtwänden befestigt (Körperschallentkopplung). Der Antriebsmotor (maschinenraumloser Aufzug, Antrieb im Schachtkopf) steht auf einem schwimmend gelagerten Stahlrahmen (Federschwingungsdämpfer, Eigenfrequenz 8 Hz). Der maximal zulässige Schalldruckpegel haustechnischer Anlagen in schutzbedürftigen Räumen beträgt nach VDI 4100 SSt II: LAF,max ≤ 27 dB(A). Die Prognose für den Aufzugsbetrieb in der ungünstigsten Wohnung (direkt neben dem Schacht, 2. OG): LAF,max = 24 dB(A). Der Nachweis ist erfüllt.

### 4.2 Lüftungsanlage

Die zentrale Lüftungsanlage erzeugt Geräusche durch den Ventilator und durch Strömungsgeräusche in den Kanälen. Schalldämpfer (Kulissenschalldämpfer, Einfügungsdämpfung De = 25 dB im Frequenzbereich 250–2000 Hz) werden in der Zuluft- und Abluftleitung jeder Wohnung eingebaut. Die Kanaldurchführungen durch die Wohnungstrennwände und -decken erhalten Telefonie-Schalldämpfer (Einfügungsdämpfung ≥ 30 dB, DnEw ≥ 52 dB), um die Sprachübertragung zwischen den Wohnungen über das Kanalsystem zu verhindern. Der maximale Schalldruckpegel der Lüftungsanlage in den Wohnräumen beträgt bei Normalbetrieb (Grundlüftung): LA = 22 dB(A), bei Intensivlüftung: LA = 28 dB(A) ≤ 30 dB(A) (Anforderung DIN 4109 für haustechnische Anlagen in Wohnräumen). Alle Rohrleitungen (Heizung, Wasser, Abwasser) werden an den Durchführungsstellen durch Brandabschnitte mit elastischen Manschetten entkoppelt.

## 5. Zusammenfassung der Nachweise

| Bauteil | Anforderung DIN 4109 | Anforderung VDI SSt II | Erreicht | Auslastung |
|---------|---------------------|----------------------|----------|-----------|
| Wohnungstrennwand | R'w ≥ 53 dB | R'w ≥ 56 dB | 59 dB | SSt II erfüllt |
| Wohnungstrenndecke Luft | R'w ≥ 54 dB | R'w ≥ 57 dB | 58 dB | SSt II erfüllt |
| Wohnungstrenndecke Tritt | L'n,w ≤ 53 dB | L'n,w ≤ 46 dB | 43 dB | SSt II erfüllt |
| Außenfassade Straße | R'w,res ≥ 40 dB | — | 41,2 dB | DIN erfüllt |
| Treppe | L'n,w ≤ 53 dB | L'n,w ≤ 46 dB | 44 dB | SSt II erfüllt |
| Aufzug | LAF,max ≤ 30 dB(A) | LAF,max ≤ 27 dB(A) | 24 dB(A) | SSt II erfüllt |
| Lüftung | LA ≤ 30 dB(A) | LA ≤ 27 dB(A) | 22/28 dB(A) | SSt II erfüllt |

Alle Nachweise der DIN 4109 und der VDI 4100 Schallschutzstufe II sind erfüllt. Empfehlung: Eine bauakustische Messung nach DIN EN ISO 16283 nach Fertigstellung wird zur Qualitätssicherung empfohlen, um die rechnerischen Prognosen messtechnisch zu bestätigen und eventuelle Ausführungsmängel (z.B. steife Verbindungen beim schwimmenden Estrich, nicht fachgerecht eingebaute Fenster) frühzeitig zu erkennen.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten prueft, ob das neue Mehrfamilienhaus in der Lindenstrasse 42 seine Bewohner gut genug vor Laerm schuetzt. Es wurde untersucht, wie viel Laerm von einer Wohnung zur naechsten dringt — sowohl Geraeusche durch die Waende und Decken als auch Schritte und Tritte von oben. Ausserdem wurde geprueft, ob der Strassenlaerm ausreichend durch die Fenster und Waende abgehalten wird. Das Ergebnis zeigt, dass alle Anforderungen an den Laermschutz erfuellt und sogar uebertroffen werden — die Bewohner koennen also mit einer ruhigen Wohnung rechnen. Auch der Aufzug und die Lueftungsanlage sind so geplant, dass sie in den Wohnungen kaum hoerbar sein werden.

Musterstadt, den 04.02.2026

_Dr.-Ing. Helmut Schröder, Akustik-Ingenieurbüro_`,
};
