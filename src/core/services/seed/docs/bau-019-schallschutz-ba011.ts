import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-019',
  filename: 'Schallschutz_BA011.md',
  format: 'md',
  tags: ['Schallschutz', 'Aufstockung'],
  created: '2026-02-09T10:00:00Z',
  vorgangId: 'BA-2026-011',
  markdown: `---
titel: Schallschutznachweis Aufstockung Schulstraße 14
aktenzeichen: BA-2026-011
datum: 2026-02-09
ersteller: Akustik-Ingenieurbüro Dr. Schröder
---

# Schallschutznachweis — Aufstockung Schulstraße 14

## 1. Besondere Herausforderung Bestand-Aufstockung

Die schalltechnische Hauptherausforderung bei der Aufstockung eines Bestandsgebäudes liegt in der Trennfuge zwischen dem bestehenden Obergeschoss und dem neuen Aufstockungsgeschoss. An dieser Schnittstelle treffen zwei grundverschiedene Konstruktionssysteme aufeinander: der schwere Massivbau des Bestands (Mauerwerk 36,5 cm Vollziegel, Stahlbetondecken d = 16 cm) und der leichte Holzrahmenbau der Aufstockung (Ständer 60/200 mm, BSP-Decke 180 mm). Diese Materialkombination erzeugt spezifische schalltechnische Probleme: Die Flankenübertragung über die gemeinsame Trennebene (Bestandsdecke/Aufstockungsschwelle) kann den Luft- und Trittschallschutz erheblich verschlechtern, wenn die Anschlussdetails nicht sorgfältig geplant werden. Die schweren Bestandswände leiten Körperschall gut weiter, während die leichten Holzwände der Aufstockung Schall leicht abstrahlen — eine ungünstige Kombination für die Flankenübertragung.

Der Schallschutznachweis wird nach DIN 4109:2018 geführt. Die Anforderungen für Wohnungstrennbauteile (Decke zwischen Bestandswohnung und Aufstockungswohnung): Luftschalldämmung R'w ≥ 54 dB, Trittschalldämmung L'n,w ≤ 53 dB. Zusätzlich wird der erhöhte Schallschutz nach VDI 4100 SSt II angestrebt (R'w ≥ 57 dB, L'n,w ≤ 46 dB), um den Mietern beider Wohnungen einen gleichwertigen Schallschutz zu bieten.

## 2. Elastische Entkopplung der Trennfuge

### 2.1 Schwellenauflagerung

Die Holzrahmen-Schwellhölzer der Aufstockung (KVH C24, 60 × 120 mm) werden nicht direkt auf die Bestandsdecke aufgelegt, sondern über eine Elastomerlage entkoppelt. Gewählt wird ein EPDM-Elastomerstreifen (Sylodyn NF, Breite 120 mm, Dicke 12,5 mm, dynamische Steifigkeit s' = 15 MN/m³). Die Elastomerlage unterbricht die direkte Körperschallübertragung zwischen dem Massivbau und dem Holzrahmenbau. Die Federung der Schwelle auf dem Elastomer bewirkt eine Tiefpassfilterung des Körperschalls mit einer Resonanzfrequenz von f0 = (1/2π) × √(s'/m') = (1/2π) × √(15 × 10⁶ / 85) = 67 Hz (bei einer Flächenmasse der Aufstockungswand m' = 85 kg/m²). Oberhalb von √2 × f0 = 95 Hz beginnt die Entkopplung wirksam zu werden. Die Verbesserung der bewerteten Norm-Trittschallpegel-Differenz beträgt ΔLw = 8 dB (messtechnisch bestätigt an Referenzobjekten des Elastomerherstellers).

### 2.2 Flankenschallübertragung

Die Flankenübertragung über den Anschluss Bestandsaußenwand / Aufstockungswand wird berechnet nach DIN EN ISO 12354-1, Anhang E (Stoßstellendämmmaß). Der Koppelparameter Kij für die Verbindung schwer/leicht (Mauerwerk/Holzrahmen) wird aus der Massenverhältnistabelle entnommen: Kij = 10 × lg(m'1/m'2) + 3 = 10 × lg(650/85) + 3 = 11,8 dB. Die Flanken-Schalldämmung Rij,w = Kij + Ri,w/2 + Rj,w/2 = 11,8 + 55/2 + 42/2 = 60,3 dB. Dieser Wert ist ausreichend hoch, um die Gesamtschalldämmung nicht wesentlich zu verschlechtern.

Die kritische Flankenübertragung ist der Pfad: Trittschall auf BSP-Decke → Holzrahmen-Wand → Bestandsdecke → Bestandsraum (vertikale Flankenübertragung). Hier wird die Entkopplung durch das Elastomer besonders wirksam, da es den Hauptübertragungspfad unterbricht. Die rechnerische Flanken-Trittschallpegel-Differenz beträgt Lnij,w = 62 dB — der Flankenweg ist damit ausreichend entkoppelt.

## 3. Abgehängte Decke im Bestandsobergeschoss

Die Bestandsdecke über dem 2. OG (Holzbalkendecke 12/22 cm mit Lehmschlag-Einschub) bietet im Bestand einen Luftschallschutz von nur R'w ≈ 48 dB und einen Trittschallpegel von L'n,w ≈ 62 dB — beides weit unterhalb der Mindestanforderungen. Zur Verbesserung wird auf der Unterseite der Bestandsdecke eine abgehängte Decke montiert. Aufbau (von oben nach unten): Bestandsdecke (Holzbalken, Lehmeinschub), Abhängung mit Federschienen (Knauf Nonius-CD-System, statische Durchbiegung unter Eigenlast 8 mm, Abhängehöhe 100 mm), Hohlraum mit Mineralwolle-Einlage (60 mm, WLG 035), 2 × 12,5 mm Gipskartonplatten (GKF, feuchtebeständig).

Die Verbesserung durch die Federschienen-Unterdecke: ΔRw = +12 dB (Luftschalldämmung), ΔLw = -15 dB (Trittschallminderung). Die Federschienen bewirken eine schwingungstechnische Entkopplung der GK-Platte von der Bestandsdecke. Die Resonanzfrequenz des Masse-Feder-Systems (GK-Platte / Luftpolster+Mineralwolle / Federschiene) beträgt f0 = 12 Hz — weit unterhalb des hörbaren Bereichs, sodass die Entkopplung über das gesamte Hörfrequenzspektrum wirksam ist.

Resultierender Schallschutz der Trenndecke (Bestandsdecke + abgehängte Decke + Trittschalldämmung der Aufstockung): Luftschalldämmung R'w = 48 + 12 + 4 = 64 dB (unter Berücksichtigung der energetischen Addition: R'w = 60 dB). Trittschalldämmung: L'n,w = 62 - 15 - 18 = 29 dB (unter Berücksichtigung der Flankenübertragung: L'n,w = 38 dB). Beide Werte erfüllen die VDI 4100 SSt II deutlich.

## 4. Trittschalldämmung der Aufstockungsdecke

### 4.1 Deckenaufbau

Die BSP-Decke der Aufstockung (5-lagig, d = 180 mm, GL24h) hat einen Norm-Trittschallpegel von Ln,w,eq = 78 dB (Laborwert, ohne Fußbodenaufbau). Der Fußbodenaufbau besteht aus: Parkett 15 mm, Trockenestrich Fermacell 2 × 10 mm, Trittschalldämmung Holzfaser-Trittschallplatte (dynamische Steifigkeit s' = 8 MN/m³) d = 40 mm. Die Trittschallminderung des Trockenestrich-Systems: ΔLw = 22 dB (berechnet nach DIN EN 12354-2). Norm-Trittschallpegel im Bau: L'n,w = 78 - 22 + 4 (Flanken) = 60 dB. Dieser Wert gilt für die Abstrahlung in die darunterliegende Aufstockungswohnung (gleiche Wohnung, nur relevant bei zweigeschossiger Aufstockung, hier nicht der Fall) oder bei einem eventuellen späteren Ausbau des Dachraums.

### 4.2 Trittschall in die Bestandswohnung

Für den Trittschall von der Aufstockung in die Bestandswohnung darunter ist der Gesamtaufbau maßgebend: BSP-Decke + Elastomerauflager + Bestandsdecke + abgehängte Decke. Der rechnerische Norm-Trittschallpegel in der Bestandswohnung beträgt L'n,w = 38 dB (siehe Abschnitt 3). Die Flankenübertragung über die Bestandswände ist durch die Elastomer-Entkopplung der Schwellen hinreichend gemindert.

## 5. Außenlärm und Schallschutz der Holzrahmenwand

Die Aufstockung liegt in einem Gebiet mit mäßiger Lärmbelastung (Lärmpegelbereich II, maßgeblicher Außenlärmpegel La = 56–60 dB(A), da die oberen Geschosse weniger Straßenlärm erhalten als das Erdgeschoss). Erforderliches resultierendes Schalldämm-Maß der Außenfassade: R'w,res ≥ 30 dB. Die Holzrahmen-Außenwand (Lärchenfassade, Hinterlüftung, MDF, Ständer mit Zellulosedämmung, OSB, Installationsebene, 2×GK) erreicht R'w = 48 dB (Laborwert, geprüft nach DIN EN ISO 140-3). Die Fenster (Dreifachverglasung, Uw = 0,95 W/(m²K)) erreichen Rw = 35 dB. Bei einem Fensterflächenanteil von 25 Prozent: R'w,res = -10 × lg(0,75 × 10^(-48/10) + 0,25 × 10^(-35/10)) = 39,5 dB ≥ 30 dB. Nachweis mit großer Reserve erfüllt.

## 6. Empfehlungen für die Bauausführung

Die schalltechnische Qualität der Aufstockung steht und fällt mit der Sorgfalt der Bauausführung, insbesondere bei den folgenden Details: (1) Die Elastomerstreifen unter den Schwellen dürfen nicht durch Mörtelbrücken oder vergessene Schrauben kurzgeschlossen werden — jeder starre Kontakt zwischen Holzrahmen und Bestandsdecke reduziert die Entkopplung drastisch. (2) Die Federschienen der abgehängten Decke müssen frei schwingen können — keine Schrauben durch die Federschiene in die Bestandsdecke neben den vorgesehenen Abhängepunkten. (3) Der schwimmende Estrich darf keinen Kontakt zu den aufgehenden Wänden haben — Randdämmstreifen bis Oberkante Fertigfußboden. (4) Die Installationen (Heizung, Wasser) der Aufstockung müssen von den Bestandsinstallationen schalltechnisch getrennt geführt werden — keine gemeinsamen Schächte ohne Entkopplung. Eine baubegleitende akustische Qualitätssicherung durch einen Akustiker wird dringend empfohlen.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten untersucht den Laermschutz bei einer Aufstockung in der Schulstrasse 14, wo auf ein bestehendes Massivhaus ein neues Stockwerk in Holzbauweise aufgesetzt wird. Die groesste Herausforderung ist, dass die Bewohner im alten Teil und im neuen Holzbau-Stockwerk sich gegenseitig nicht hoeren sollen. Dafuer werden spezielle Gummipuffer zwischen Alt- und Neubau eingebaut, die Schwingungen und Geraeusche abfangen. Zusaetzlich wird unter der alten Decke eine abgehaengte Decke mit Federschienen montiert, die den Laermschutz deutlich verbessert. Alle Laermschutz-Anforderungen werden damit sicher eingehalten.

Musterstadt, den 09.02.2026

_Dr.-Ing. Helmut Schröder, Akustik-Ingenieurbüro_`,
};
