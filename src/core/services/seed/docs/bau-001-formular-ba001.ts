import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-001',
  filename: 'Bauantragsformular_BA001.md',
  format: 'md',
  tags: ['Formular', 'EFH'],
  created: '2026-01-20T10:00:00Z',
  vorgangId: 'BA-2026-001',
  markdown: `---
titel: Bauantrag Neubau Einfamilienhaus
aktenzeichen: BA-2026-001
datum: 2026-01-20
---

# Bauantrag — Neubau Einfamilienhaus, Ahornweg 15

## 1. Bauherr und Grundstück

**Bauherr:** Familie Schneider, vertreten durch Dipl.-Ing. Thomas Schneider
**Anschrift:** Ahornweg 15, 48149 Musterstadt
**Grundstück:** Gemarkung Musterstadt, Flur 12, Flurstück 347/2
**Grundstücksfläche:** 620 m² (laut Katasterauszug vom 15.12.2025)
**Bebauungsplan:** BP Nr. 247 "Ahornweg-Süd", rechtskräftig seit 14.03.2019
**Baugebiet:** Allgemeines Wohngebiet (WA) gemäß §4 BauNVO
**Gebäudeklasse:** 1 nach §2 Abs. 3 BauO NRW (freistehendes Wohngebäude, Höhe ≤7m)

Das Grundstück ist voll erschlossen. Der Anschluss an die öffentliche Kanalisation (Mischwassersystem) besteht über den Revisionsschacht am Ahornweg. Die Trinkwasserleitung DN 32 ist im Gehweg verlegt. Die Stromversorgung erfolgt über einen Erdkabelanschluss der Stadtwerke Musterstadt. Gasanschluss ist vorhanden, wird jedoch nicht genutzt (Wärmepumpenheizung geplant). Der Glasfaseranschluss FTTH wurde im Zuge der Erschließung des Baugebiets 2020 verlegt.

## 2. Baubeschreibung

### 2.1 Gebäudeform und Abmessungen
Geplant ist ein zweigeschossiges Einfamilienhaus mit Satteldach in Massivbauweise. Die Dachneigung beträgt 38° mit einer Firsthöhe von 9,20 m über der Geländeoberfläche (zulässig: 9,50 m laut Bebauungsplan). Das Gebäude hat einen rechteckigen Grundriss von 10,50 m × 8,40 m. Die Traufhöhe liegt bei 5,80 m. Ein eingeschossiger Erker an der Südseite (2,40 m × 1,80 m) erweitert den Wohnbereich. Die Bruttogrundfläche beträgt 176 m², die Wohnfläche nach Wohnflächenverordnung 165 m². Der umbaute Raum beläuft sich auf 680 m³.

### 2.2 Raumaufteilung
Im Erdgeschoss befinden sich: Eingangsbereich mit Garderobe (8 m²), offener Wohn- und Essbereich (42 m²), Küche (14 m²), Gäste-WC (4 m²), Hauswirtschaftsraum mit Wärmepumpen-Inneneinheit und Pufferspeicher (10 m²), sowie ein Arbeitszimmer (12 m²). Das Obergeschoss umfasst: Hauptschlafzimmer mit Ankleide (22 m²), zwei Kinderzimmer (je 14 m²), ein Familienbad (10 m²) und ein Duschbad (6 m²). Die Geschosshöhe beträgt 2,75 m (licht 2,50 m).

### 2.3 Konstruktion
Die Außenwände bestehen aus Kalksandstein-Plansteinmauerwerk (KS-PE 20-2.0, d=17,5 cm) mit einem Wärmedämmverbundsystem (WDVS) aus Mineralwolle (MW 035, d=180 mm), mineralischem Oberputz. Die Innenwände sind als KS-Planstein d=11,5 cm ausgeführt, tragende Innenwände d=17,5 cm. Die Geschossdecke ist eine Stahlbetonflachdecke d=20 cm (C25/30, B500B). Die Gründung erfolgt auf einer Stahlbeton-Bodenplatte d=25 cm mit Frostschürze (Frosttiefe 80 cm) auf kapillarbrechender Kiesschicht d=20 cm. Die Abdichtung gegen Bodenfeuchte erfolgt mit bituminöser Dickbeschichtung und HDPE-Noppenbahn.

Das Dachtragwerk ist ein Sparrendach mit Kehlbalken. Sparren 8/20 cm im Abstand von 75 cm. Kehlbalken 8/16 cm. First- und Fußpfetten auf gemauerten Drempeln. Die Dacheindeckung besteht aus Betondachsteinen (anthrazit), mit Unterspannbahn (diffusionsoffen, sd ≤ 0,3 m).

## 3. Haustechnik

### 3.1 Heizung und Warmwasser
Die Beheizung erfolgt über eine Luft-Wasser-Wärmepumpe (Monoblock-Außenaufstellung, Heizleistung 8 kW bei A2/W35, Jahresarbeitszahl JAZ = 3,8). Die Wärmeverteilung erfolgt ausschließlich über Fußbodenheizung in allen Räumen. Der Pufferspeicher fasst 500 Liter und dient der hydraulischen Entkopplung. Zur Warmwasserbereitung ist eine thermische Solaranlage vorgesehen: 2 Flachkollektoren à 3 m² (gesamt 6 m² Aperturfläche) auf der Süddachfläche. Der bivalente Warmwasserspeicher fasst 300 Liter. Der solare Deckungsgrad für Warmwasser beträgt ca. 60%.

### 3.2 Lüftung
Das Lüftungskonzept nach DIN 1946-6 sieht eine ventilatorgestützte Lüftung zum Feuchteschutz vor. In Küche und Bädern sind Einzelraumventilatoren mit Feuchtesteuerung installiert. Die Zuluftversorgung erfolgt über Fensterfalzlüfter in den Aufenthaltsräumen.

### 3.3 Elektroinstallation
Vorbereitung für eine Photovoltaikanlage (Leerrohre vom Dach bis zum Zählerplatz). Wallbox-Vorbereitung in der Garage (Starkstromanschluss 3×32A). Smart-Home-Vorbereitung mit KNX-Leerrohren zu allen Schalterpunkten.

## 4. Entwässerung

Das Schmutzwasser wird über den bestehenden Kanalanschluss am Ahornweg in das Mischwassersystem eingeleitet. Rückstauebene: Oberkante Straße Ahornweg (= 132,40 m ü. NHN). Alle Entwässerungsgegenstände im Erdgeschoss liegen über der Rückstauebene. Das Regenwasser wird vollständig auf dem Grundstück versickert. Dazu wird eine Rigole aus Kunststoff-Sickertunneln mit einem Speichervolumen von 4,2 m³ im Vorgarten eingebaut. Die Versickerungsrate wurde mittels Infiltrationstest zu kf = 1,5 × 10⁻⁵ m/s bestimmt. Die Bemessung der Rigole erfolgte nach DWA-A 138 für ein 5-jährliches Regenereignis (r₅,₁₅ = 180 l/(s·ha)). Eine Drosseleinleitung in den Kanal ist nicht vorgesehen.

## 5. Stellplatznachweis und Abstandsflächen

Gemäß Stellplatzsatzung der Gemeinde Musterstadt sind für ein Einfamilienhaus 2 PKW-Stellplätze nachzuweisen. Es werden bereitgestellt: 1 überdachter Stellplatz (Carport, Holzkonstruktion 6,00 × 3,20 m) und 1 offener Stellplatz auf dem Grundstück (Zufahrt befestigt mit Ökopflaster). Ein Fahrradabstellplatz für 4 Fahrräder ist im Carport integriert.

Die Abstandsflächen gemäß §6 BauO NRW betragen 0,4 × H = 0,4 × 9,20 m = 3,68 m. Zur Nordgrenze beträgt der Abstand 4,50 m, zur Südgrenze 5,20 m, zur Ostgrenze 4,10 m. Alle Abstandsflächen liegen vollständig auf dem eigenen Grundstück. Die zulässige Grundflächenzahl (GRZ) von 0,35 wird mit 0,29 eingehalten. Die zulässige Geschossflächenzahl (GFZ) von 0,70 wird mit 0,53 eingehalten.

## 6. Unterschriften und Erklärungen

Der Entwurfsverfasser erklärt, dass die Bauvorlagen vollständig und richtig sind und den öffentlich-rechtlichen Vorschriften entsprechen. Der Bauherr bestätigt, dass er Eigentümer des Grundstücks ist und die Zustimmung aller grundbuchlich Berechtigten vorliegt.

Musterstadt, den 20.01.2026

_Unterschrift Bauherr_ — _Unterschrift Entwurfsverfasser_`,
};
