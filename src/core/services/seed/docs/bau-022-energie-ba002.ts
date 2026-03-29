import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-022',
  filename: 'Energienachweis_BA002.md',
  format: 'md',
  tags: ['Energie', 'MFH', 'Fernwärme'],
  created: '2026-02-03T10:00:00Z',
  vorgangId: 'BA-2026-002',
  markdown: `---
titel: Energetischer Nachweis MFH Lindenstraße 42
aktenzeichen: BA-2026-002
datum: 2026-02-03
ersteller: Energieberatung Grünwald GmbH
---

# Energetischer Nachweis — MFH Lindenstraße 42

## 1. Gebäudedaten und Nachweisgrundlagen

Der energetische Nachweis wird nach GEG 2024 in Verbindung mit DIN V 18599 (alle Teile) geführt. Das viergeschossige Mehrfamilienhaus mit Staffelgeschoss hat eine beheizte Nutzfläche AN = 1.710 m² (12 Wohneinheiten, Gesamtwohnfläche 1.280 m² plus Erschließungsflächen). Das beheizte Gebäudevolumen Ve = 5.340 m³. Die thermische Gebäudehülle umfasst: Außenwände 1.240 m² (Klinkerfassade VHF), Flachdach/Gründach 580 m², Bodenplatte Tiefgarage (unbeheizt, Decke über TG als Hüllfläche) 580 m², Fenster und Fenstertüren 380 m², Eingangstüren 12 m². Das A/V-Verhältnis beträgt 0,52 m⁻¹.

Die Wärmeversorgung erfolgt über den Fernwärmeanschluss der Stadtwerke Musterstadt. Der zertifizierte Primärenergiefaktor der Fernwärme beträgt fp = 0,50 (KWK-Anteil > 70 Prozent, Bescheinigung der Stadtwerke vom 15.01.2026). Dieser niedrige Primärenergiefaktor ist ein wesentlicher Vorteil des Fernwärmeanschlusses und ermöglicht die Einhaltung ambitionierter Energiestandards trotz konventioneller Wärmeverteilung. Im Vergleich hätte eine Erdgas-Heizung (fp = 1,1) den Primärenergiebedarf mehr als verdoppelt.

## 2. Wärmeschutz der Gebäudehülle

### 2.1 Außenwand — Vorgehängte hinterlüftete Klinkerfassade

Wandaufbau (von außen nach innen): Klinkerriemchen 20 mm auf Aluminium-Unterkonstruktion, Hinterlüftungsebene 40 mm (thermisch nicht wirksam), Mineralfaserdämmung WLG 032 d = 200 mm (λ = 0,032 W/(mK)), Stahlbetonwand d = 200 mm, Kalkgipsputz 15 mm. Die Hinterlüftung wird rechnerisch als Außenluftschicht behandelt (Rse = 0,13 m²K/W nach DIN EN ISO 6946 für belüftete Luftschichten). U-Wert: **U = 0,16 W/(m²K)**. Der GEG-Referenzwert von 0,28 W/(m²K) wird um 43 Prozent unterschritten. Die hochwertige Mineralfaserdämmung mit WLG 032 (statt Standard WLG 035) ermöglicht diese niedrigen U-Werte bei moderater Dämmstärke, was die Wanddicke und damit den Flächenverlust reduziert.

### 2.2 Flachdach — Gründach

Dachaufbau (von oben nach unten): Extensivbegrünung Substrat 100 mm, Filtervlies, Drainagematte 50 mm, Wurzelschutzbahn, Dachabdichtung 2-lagig Bitumen, Gefälledämmung EPS 035 d = 200–280 mm (mittlere Dicke 240 mm), Dampfsperre, Stahlbetondecke d = 22 cm. U-Wert (mittlere Dämmstärke 240 mm): **U = 0,12 W/(m²K)**. GEG-Referenzwert 0,20 W/(m²K) — Unterschreitung um 40 Prozent. Die Gründachsubstratschicht hat einen zusätzlichen Wärmedämmeffekt (λ ≈ 0,50 W/(mK), äquivalent zu ca. 3 mm Normaldämmung — vernachlässigbar), trägt aber erheblich zum sommerlichen Wärmeschutz bei (Verdunstungskühlung, thermische Masse).

### 2.3 Decke über Tiefgarage

Die Tiefgarage ist unbeheizt und liegt unterhalb der thermischen Gebäudehülle. Die Decke über der Tiefgarage (Stahlbetonflachdecke d = 28 cm) erhält eine Wärmedämmung auf der Unterseite: Mineralwolle-Lamellen d = 120 mm (WLG 035), mit Stahlblechverkleidung als Brandsicherung (nichtbrennbar, Klasse A1). U-Wert: **U = 0,26 W/(m²K)**. Temperaturkorrekturfaktor fx = 0,50 (unbeheizte Tiefgarage, nach DIN V 18599-2 Tabelle 3). Effektiver U-Wert: Ueff = U × fx = 0,13 W/(m²K).

### 2.4 Fenster

Kunststoff-Aluminium-Verbundprofile (Bautiefe 86 mm, 7 Kammern, thermisch getrennt) mit Dreifach-Isolierverglasung: Ug = 0,50 W/(m²K), g-Wert = 0,50 (selektive Beschichtung für reduzierten Wärmeeintrag im Sommer bei hoher Lichttransmission τv = 0,72). Rahmen-U-Wert Uf = 1,00 W/(m²K). Thermisch optimierter Abstandhalter (warme Kante): Ψg = 0,034 W/(mK). Gesamt-U-Wert Fenster (Referenzgröße 1,55 m × 1,48 m): **Uw = 0,90 W/(m²K)**. GEG-Referenzwert 1,30 W/(m²K) — Unterschreitung um 31 Prozent.

## 3. Lüftungskonzept

### 3.1 Bedarfsermittlung nach DIN 1946-6

Das Lüftungskonzept nach DIN 1946-6 ergibt für die 12 Wohneinheiten unterschiedliche Lüftungsbedarfe je nach Größe: 2-Zimmer-Wohnungen (55 m²): V̇FL = 40 m³/h, 3-Zimmer-Wohnungen (80 m²): V̇FL = 55 m³/h, 4-Zimmer-Wohnungen (110 m²): V̇FL = 75 m³/h. Da das Gebäude eine sehr dichte Gebäudehülle hat (Zielwert n50 = 0,60 h⁻¹, gemessen nach DIN EN ISO 9972), kann die Lüftung zum Feuchteschutz nicht über natürliche Infiltration sichergestellt werden — eine mechanische Lüftung ist nach GEG zwingend erforderlich.

### 3.2 Zentrale Lüftungsanlage mit WRG

Jede Wohneinheit erhält ein zentrales Wohnungslüftungsgerät (Hersteller: Zehnder ComfoAir Q350) mit Wärmerückgewinnung. Der Wärmerückgewinnungsgrad nach DIN EN 308 beträgt η = 85 Prozent (zertifiziert nach DIBt-Richtlinie für Lüftungsgeräte). Der effektive Wärmerückgewinnungsgrad unter Berücksichtigung des Hilfsenergieanteils (Ventilatoren, SFP = 0,35 Wh/m³) beträgt ηWRG,eff = 82 Prozent. Die Lüftungsgeräte sind in Installationsschächten der Bäder untergebracht und über ein Kanalnetz mit allen Räumen verbunden. Zuluft: Wohn-, Schlaf- und Kinderzimmer. Abluft: Küche, Bad, WC. Überströmung über Türspalte (8 mm Spalt unter der Tür) oder Überströmelemente in den Innentüren. Die Volumenstromregelung erfolgt bedarfsabhängig über CO₂-Sensoren in den Wohn- und Schlafzimmern und Feuchtesensoren in den Bädern.

## 4. Energiebilanz

### 4.1 Heizwärmebedarf

Der Heizwärmebedarf wird nach DIN V 18599-2 berechnet. Transmissionswärmeverluste: QT = HT × FGT × HGT = 0,289 × 1,0 × 66.800 = 19.305 kWh/a (HT = spezifischer Transmissionswärmeverlust 0,289 W/(m²K), FGT = Gradtagzahlfaktor, HGT = Heizgradtage 66.800 Kh/a Standort Musterstadt). Lüftungswärmeverluste: QL = HV × (1 - ηWRG) × HGT = 0,34 × V̇ges × (1 - 0,82) × 66.800 = mit V̇ges = 720 m³/h: QL = 0,34 × 720 × 0,18 × 66.800 = 2.939 kWh/a. Solare Gewinne: QS = Σ(Aw × g × FC × IS) = 380 × 0,50 × 0,70 × 350 = 46.550 kWh/a (vereinfacht, mit mittlerer Einstrahlung IS = 350 kWh/(m²a) und Verschattungsfaktor FC = 0,70). Interne Gewinne: QI = 5 × AN × tHeiz/8.760 = 5 × 1.710 × 5.400/8.760 = 5.271 kWh/a. Nutzungsgrad der Gewinne: ηG = 0,92 (schwere Bauart, a/γ-Methode). Heizwärmebedarf: QH = (QT + QL) - ηG × (QS + QI) = (19.305 + 2.939) - 0,92 × (46.550 + 5.271) = 22.244 - 47.675 = negativ → QH,min = 12.500 kWh/a (Minimum nach Monatsbilanzverfahren, da die Gewinne die Verluste nur in der Übergangszeit übersteigen, nicht im Winter). Spezifischer Heizwärmebedarf: **qH = 12.500 / 1.710 = 7,3 kWh/(m²a)**.

Hinweis: Der sehr niedrige Heizwärmebedarf resultiert aus der Kombination einer hochgedämmten Hülle, der mechanischen Lüftung mit 85% WRG und den solaren Gewinnen der großzügig verglasten Süd- und Westfassade.

### 4.2 Primärenergiebedarf

Endenergiebedarf Fernwärme: QEnd,FW = QH / ηAnlage + QW = 12.500 / 0,92 + 12,5 × 1.710 = 13.587 + 21.375 = 34.962 kWh/a (Anlagenaufwandszahl Fernwärme eP = 1/0,92 = 1,087). Endenergiebedarf Strom (Hilfsenergie Lüftung, Pumpen): QEnd,Strom = 4.500 kWh/a. Primärenergiebedarf: QP = QEnd,FW × fp,FW + QEnd,Strom × fp,Strom = 34.962 × 0,50 + 4.500 × 1,80 = 17.481 + 8.100 = 25.581 kWh/a. Spezifischer Primärenergiebedarf: **qP = 25.581 / 1.710 = 15,0 kWh/(m²a)**. GEG-Referenzgebäude: qP,ref = 52 kWh/(m²a). Verhältnis: 15/52 = 29 Prozent — das Gebäude erreicht nahezu KfW-40-Standard.

### 4.3 Transmissionswärmeverlust

Spezifischer Transmissionswärmeverlust: H'T = 0,289 W/(m²K). GEG-Referenzwert: 0,44 W/(m²K). Verhältnis: 0,289/0,44 = 66 Prozent — der Grenzwert von 100 Prozent wird weit unterschritten.

## 5. Energieausweis-Daten

Der Energiebedarfsausweis nach GEG §79 weist folgende Kennwerte aus: Endenergiebedarf (Fernwärme): 20,4 kWh/(m²a). Endenergiebedarf (Strom): 2,6 kWh/(m²a). Primärenergiebedarf: 15,0 kWh/(m²a). CO₂-Emissionen: 4,8 kg/(m²a) (Fernwärme fp,CO2 = 0,12 kg/kWh, Strom fp,CO2 = 0,56 kg/kWh). Energieeffizienzklasse: **A+** (Primärenergiebedarf ≤ 25 kWh/(m²a)). Das Gebäude unterschreitet die GEG-Anforderungen deutlich und bietet den Mietern sehr niedrige Heizkosten — ein wichtiger Vermarktungsvorteil auf dem Wohnungsmarkt.

Musterstadt, den 03.02.2026

_Dipl.-Ing. (FH) Karl Grünwald, Energieberater (dena)_`,
};
