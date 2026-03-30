import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-060',
  filename: 'Zwischenbericht_FA004.md',
  format: 'md',
  tags: ['Zwischenbericht', 'Beton', 'Selbstheilung'],
  created: '2026-03-22T10:00:00Z',
  vorgangId: 'FA-2026-004',
  markdown: `---
titel: 12-Monats-Zwischenbericht Selbstheilende Betone FA-2026-004
aktenzeichen: FA-2026-004
datum: 2026-03-22
ersteller: Prof. Dr.-Ing. Werner Zement, Institut für Baustoffe und Konstruktion, TU Musterstadt
---

# Zwischenbericht — Selbstheilende Betone FA-2026-004

## 1. Projektübersicht und Fortschritt

Das Projekt FA-2026-004 entwickelt selbstheilende Betone, die Risse durch eingebettete Mikrokapseln autonom verschließen und so die Dauerhaftigkeit und Wasserundurchlässigkeit von Stahlbetonkonstruktionen (Brücken, Tunnel, Tiefgaragen) erheblich verbessern. Nach 12 von 24 Monaten Laufzeit sind die Arbeitspakete AP 1 (Mikrokapsel-Synthese) und AP 2 (Betonmischungsentwicklung) abgeschlossen, AP 3 (Rissüberbrückungsversuche) und AP 4 (Dauerhaftigkeitstests) laufen planmäßig. Der Meilenstein M1 (reproduzierbare Kapsel-Synthese mit Zielgrößenverteilung 50–200 µm, Einschlusseffizienz ≥ 80 Prozent) wurde im Monat 6 erreicht. Der Meilenstein M2 (Rissüberbrückung ≥ 0,3 mm nachgewiesen) wurde im Monat 10 erreicht. Das Projekt verläuft insgesamt planmäßig mit einem bedeutenden unerwarteten Befund in der Druckfestigkeitsprüfung (siehe Abschnitt 3.2).

## 2. AP 1: Mikrokapsel-Synthese (abgeschlossen)

### 2.1 Kapsel-Design

Die Mikrokapseln bestehen aus einer Hülle (Melamin-Harnstoff-Formaldehyd, MUF) und einem Kernmaterial (Methylmethacrylat-Monomer, MMA, mit Benzoylperoxid als Initiator). Bei Rissbildung im Beton brechen die Kapseln auf, das MMA-Monomer tritt aus und polymerisiert durch den Initiator und den Kontakt mit der alkalischen Porenlosung des Betons (pH 12–13 beschleunigt die Polymerisation) zu Polymethylmethacrylat (PMMA) — einem transparenten, druckfesten Polymer, das den Riss ausfüllt und versiegelt. Die Wahl von MMA als Heilungsmittel (statt des häufiger verwendeten Epoxidharzes) basiert auf drei Vorteilen: niedrige Viskosität (0,6 mPa·s bei 20°C, verglichen mit 100–1.000 mPa·s für Epoxid) — das Monomer kann auch in feinste Risse (< 0,1 mm Breite) kapillar eindringen, gute Haftung an der Betonmatrix (PMMA bindet kovalent an die Calciumhydroxid-Oberfläche) und Temperaturbeständigkeit (PMMA bleibt bis 80°C formstabil, im Gegensatz zu einigen Epoxid-Systemen, die bei 60°C erweichen).

### 2.2 Syntheseergebnisse

Die Kapsel-Synthese erfolgt durch In-situ-Polykondensation der MUF-Hülle an der Oberfläche von MMA-Tröpfchen in einer Öl-in-Wasser-Emulsion (Emulgator: Poly(ethylen-alt-maleinsäureanhydrid), PEMA, 2 Prozent w/v; Rührergeschwindigkeit 300 rpm, Temperatur 55°C, Reaktionszeit 4 Stunden). Die Zielgrößenverteilung von 50–200 µm wurde nach 8 Syntheseiterationen erreicht (systematische Variation der Rührergeschwindigkeit 200–600 rpm und der Emulgatorkonzentration 0,5–3 Prozent). Die finale Partikegrößenverteilung (Lasergranulometrie, Malvern Mastersizer 3000): D10 = 62 µm, D50 = 118 µm, D90 = 185 µm — innerhalb des Zielbereichs. Die Wandstärke der MUF-Hülle beträgt 2,0 ± 0,3 µm (REM-Analyse an Bruchflächen, 50 Kapseln vermessen). Die Einschlusseffizienz (Anteil des MMA-Kernmaterials am Gesamtkapselgewicht): **84 Prozent** (Zielwert ≥ 80 Prozent, erreicht).

Die thermogravimetrische Analyse (TGA) zeigt, dass die Kapseln bis 180°C thermisch stabil sind (Masserverlust < 5 Prozent) — die Betonmischtemperatur von 20–30°C und die Hydratationswärme (max. 70°C im Inneren massiger Bauteile) beschädigen die Kapseln nicht. Die Kapseln überstehen den alkalischen Angriff der Betonpore (pH 12,5, Lagerung in gesättigter Ca(OH)₂-Lösung über 28 Tage: keine sichtbare Degradation der Hülle, Einschlusseffizienz nach 28 Tagen: 81 Prozent — geringfügiger Verlust durch Diffusion). Die Langzeitstabilität der Kapseln in der alkalischen Betonumgebung über Jahrzehnte ist ein offener Forschungspunkt, der in AP 4 adressiert wird.

## 3. AP 2: Betonmischungsentwicklung (abgeschlossen)

### 3.1 Mischungsentwurf

Der Referenzbeton (ohne Kapseln) ist ein C30/37 mit CEM I 42,5 R (380 kg/m³), w/z = 0,45, Gesteinskörnung 0/16 mm (Rheinkies), Fließmittel (PCE, 0,8 Prozent des Zementgewichts). Die Kapseln werden als Volumenzugabe dem Frischbeton beigemischt (Zugabe während des Mischvorgangs im Zwangsmischer, nach der Wasserzugabe, Mischzeit 2 Minuten). Vier Kapselgehalte wurden untersucht: 0 Prozent (Referenz), 1 Vol.-Prozent, 3 Vol.-Prozent und 5 Vol.-Prozent (bezogen auf das Betonvolumen).

### 3.2 Druckfestigkeit

Die 28-Tage-Druckfestigkeit (Würfel 150 mm, 3 Proben je Mischung, nach DIN EN 12390-3) zeigt folgenden Zusammenhang mit dem Kapselgehalt:

| Kapselgehalt | fc,28 [N/mm²] | Veränderung vs. Referenz |
|-------------|--------------|-------------------------|
| 0% (Referenz) | 42,5 ± 1,8 | — |
| 1% | 41,2 ± 2,1 | -3,1% |
| 3% | 39,1 ± 1,5 | -8,0% |
| 5% | 35,8 ± 2,4 | -15,8% |

Die Druckfestigkeitsreduktion durch die Kapseln ist signifikant und übersteigt die im Antrag angenommenen -8 Prozent bei 3 Prozent Kapselgehalt. Die Ursache ist die Schwächung der Betonmatrix durch die weichen Kapseln (E-Modul PMMA 3.300 N/mm² vs. Gesteinskörnung 60.000 N/mm²), die als Spannungskonzentratoren wirken. Bei 5 Prozent Kapselgehalt sinkt die Festigkeit unter die Mindestanforderung für C30/37 (fck = 30 N/mm²): 35,8 - 1,96 × 2,4 = 31,1 N/mm² — noch über dem charakteristischen Wert, aber mit geringer Reserve.

**Unerwarteter Befund:** Die Mischung mit 3 Prozent Kapseln zeigt eine unerwartet hohe Biegezugfestigkeit (fct,fl = 5,2 N/mm² vs. 4,8 N/mm² Referenz — +8 Prozent). Dieser Effekt wird auf die Mikrorissüberbrückung durch die Kapseln zurückgeführt: Während der Belastung brechen die Kapseln vor dem Gestein und geben MMA frei, das die Mikrorisse temporär stabilisiert und den Bruchprozess verzögert. Dieser Befund ist wissenschaftlich interessant und wird in einer separaten Publikation vertieft.

### 3.3 Verarbeitbarkeit

Die Verarbeitbarkeit des Frischbetons (Ausbreitmaß nach DIN EN 12350-5) nimmt mit steigendem Kapselgehalt ab: Referenz 520 mm (F4), 1 Prozent 510 mm, 3 Prozent 480 mm (F3), 5 Prozent 440 mm (F3). Bei 3 Prozent Kapselgehalt ist die Verarbeitbarkeit noch akzeptabel, bei 5 Prozent wird der Beton steif und schlecht einzubringen. Der optimale Kapselgehalt wird auf **3 Prozent** festgelegt (Kompromiss zwischen Heilungswirkung und mechanischen Eigenschaften).

## 4. AP 3: Rissüberbrückungsversuche (laufend, 70 Prozent abgeschlossen)

### 4.1 Versuchsaufbau

Die Rissüberbrückung wird an Betonprismen (40 × 40 × 160 mm) mit einer kontrollierten Rissbreite geprüft. Die Prismen werden im 3-Punkt-Biegeversuch (DIN EN 196-1) bis zur Rissbildung belastet (Rissöffnung durch CMOD-Sensor — Crack Mouth Opening Displacement — gesteuert). Die Ziel-Rissbreiten sind: 0,1 mm, 0,2 mm, 0,3 mm und 0,5 mm. Nach der Rissbildung werden die Prismen 28 Tage bei 20°C und 95 Prozent relativer Feuchte gelagert (Heilungsphase). Die Heilungswirkung wird durch 3 Methoden bewertet: Kapillarer Saugversuch (DIN EN 13057 — reduzierte Kapillarsaugrate zeigt Rissverschluss an), Wasserundurchlässigkeitsversuch (Wasserdurchfluss unter 0,5 bar Druck durch den Riss — Reduktion des Durchflusses zeigt Versiegelung), Wiederbelastung (erneuter 3-Punkt-Biegeversuch — Wiederherstellung der Biegezugfestigkeit zeigt mechanische Heilung).

### 4.2 Ergebnisse (vorläufig)

Die Rissüberbrückung wurde für Rissbreiten bis 0,3 mm nachgewiesen (Meilenstein M2 erreicht). Die Ergebnisse:

| Rissbreite | Kapillarsaugrate Reduktion | Wasserdurchfluss Reduktion | Biegezugfestigkeit Wiederherstellung |
|-----------|--------------------------|--------------------------|-------------------------------------|
| 0,1 mm | -92% | -98% | 78% |
| 0,2 mm | -85% | -95% | 65% |
| 0,3 mm | -72% | -88% | 48% |
| 0,5 mm | -45% | -62% | 22% |

Die Ergebnisse zeigen, dass die Mikrokapseln Risse bis 0,3 mm effektiv verschließen (Wasserundurchlässigkeit um 88 Prozent reduziert, Biegezugfestigkeit zu 48 Prozent wiederhergestellt). Bei 0,5 mm Rissbreite ist die Heilungswirkung deutlich geringer — das MMA-Volumen der Kapseln reicht nicht aus, um den größeren Rissraum vollständig zu füllen. Für die Praxis der WU-Beton-Konstruktionen (Wasserundurchlässige Bauwerke, zulässige Rissbreite 0,15–0,20 mm nach DAfStb-Richtlinie) ist die Heilungswirkung bis 0,3 mm ausreichend und bietet einen bedeutenden Sicherheitszuschlag.

Die Referenzproben (ohne Kapseln) zeigen ebenfalls eine gewisse Selbstheilung durch natürliche Karbonatisierung (CaCO₃-Ausfällung im Riss): -25 Prozent Kapillarsaugrate bei 0,1 mm Rissbreite nach 28 Tagen. Die Mikrokapseln verstärken diesen Effekt um den Faktor 3–4.

## 5. AP 4: Dauerhaftigkeitstests (laufend, 30 Prozent abgeschlossen)

Die Dauerhaftigkeitstests umfassen: Frost-Tau-Wechsel-Versuch (DIN EN 12390-9, CDF-Verfahren: 28 Zyklen -20°C/+20°C in 3 Prozent NaCl-Lösung) — nach 50 Zyklen (Stand Monat 12) zeigen die Proben mit 3 Prozent Kapseln keinen signifikanten Unterschied zur Referenz (Abwitterung: 0,8 kg/m² vs. 0,7 kg/m² Referenz — beide unter dem Grenzwert 1,5 kg/m²). Chlorideindringversuch (NT Build 443, 35 Tage in 165 g/l NaCl-Lösung) — die chloridinduzierte Korrosion der Bewehrung ist die Hauptursache für Brückenschäden; die Frage ist, ob die Kapseln die Chloridpenetration durch Risse verlangsamen. Ergebnis: Die Chlorideindringtiefe durch den geheilten 0,2 mm-Riss beträgt 4,2 mm (mit Kapseln) vs. 12,8 mm (ohne Kapseln, offener Riss) — eine Reduktion um 67 Prozent. Dies ist das vielversprechendste Ergebnis des Projekts und bestätigt die Hypothese, dass die Kapsel-Heilung die Dauerhaftigkeit von Stahlbetonkonstruktionen unter Chloridbelastung signifikant verbessert.

## 6. Nächste Schritte (Monat 13–24)

AP 3 Fortsetzung: Untersuchung der Heilungskinetik (Zeitreihe: 1, 7, 14, 28, 90 Tage Heilung) und der Mehrfachheilung (Kann derselbe Riss nach erneuter Öffnung ein zweites Mal heilen? Hypothese: Ja, wenn in der Umgebung des Risses noch intakte Kapseln vorhanden sind). AP 4 Fortsetzung: Frost-Tau bis 150 Zyklen (Ziel: 200 Zyklen), Beschleunigte Alterung (Kapseln in alkalischer Lösung bei 60°C über 6 Monate — simuliert 20 Jahre Alterung nach Arrhenius). AP 5 (neu): Bakterielle Kapseln — ein alternativer Ansatz, bei dem Bacillus-Sporen zusammen mit Calciumlactat-Nährsubstrat in die Kapseln eingeschlossen werden. Bei Rissbildung und Wasserzutritt keimen die Sporen aus, verstoffwechseln das Calciumlactat und fällen Calciumcarbonat (CaCO₃) im Riss aus (biogene Kalkstein-Bildung). Der Vorteil gegenüber dem MMA-System: der CaCO₃-Verschluss ist mineralisch und hat die gleiche chemische Zusammensetzung wie der Beton selbst. Die Herausforderung: Überleben der Sporen im alkalischen Betonmilieu (pH 12,5) und bei der Betonmischtemperatur (bis 30°C, unkritisch für Sporen, aber die hohe Alkalinität kann die Sporenwand angreifen). Die Stammwahl (Bacillus cohnii, alkalitolerant, pH-Optimum 10–11) und die Verkapslung (PVA-Hydrogel als Puffermatrix) werden im Monat 13–18 erprobt. Die Verlängerung des Projekts um 12 Monate (bis Monat 36) wird beantragt, um die bakterielle Heilung vollständig zu evaluieren.

## 7. Mittelverwendung und Publikationen

Verbrauchte Mittel (12 Monate): 285.000 Euro von 580.000 Euro (49 Prozent bei 50 Prozent Laufzeit — exakt im Plan). Publikationen: 1 Journalartikel eingereicht bei Cement and Concrete Research (Thema: Mikrokapsel-Synthese und Betonmischung), 1 Konferenzbeitrag auf der fib Symposium 2026 (Thema: Rissüberbrückungsversuche, Poster). 1 Patentanmeldung vorbereitet (DE-Anmeldung über PVA, Thema: MMA-MUF-Mikrokapseln für selbstheilenden Beton, Einreichung Monat 14).

## Zusammenfassung in einfacher Sprache

Dieses Projekt entwickelt Beton, der sich selbst reparieren kann. Dazu werden winzige Kapseln in den Beton gemischt, die bei einem Riss aufbrechen und ein Klebemittel freisetzen, das den Riss verschliesst. Nach einem Jahr Forschung funktioniert die Herstellung der Kapseln zuverlaessig, und Risse bis zu 0,3 Millimeter Breite koennen so wirksam abgedichtet werden. Besonders vielversprechend ist, dass der geheilte Beton deutlich weniger Salz eindringen laesst, was Bruecken und Tunnel besser vor Korrosion schuetzt. Der optimale Kapselanteil liegt bei 3 Prozent, weil bei mehr Kapseln der Beton zu viel an Druckfestigkeit verliert.

Musterstadt, den 22.03.2026

_Prof. Dr.-Ing. Werner Zement, TU Musterstadt_`,
};
