import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-030',
  filename: 'Altlastengutachten_BA006.md',
  format: 'md',
  tags: ['Altlasten', 'PAK', 'Sanierung'],
  created: '2026-01-15T10:00:00Z',
  vorgangId: 'BA-2026-006',
  markdown: `---
titel: Altlastengutachten Industrieweg 3 — Orientierende Untersuchung und Sanierungskonzept
aktenzeichen: BA-2026-006
datum: 2026-01-15
ersteller: EnviroConsult GmbH, Umweltgutachter
---

# Altlastengutachten — Industrieweg 3

## 1. Historische Erkundung

### 1.1 Nutzungsgeschichte

Die historische Erkundung des Grundstücks Industrieweg 3 (Flurstück 803/1, Gemarkung Musterstadt, Grundstücksfläche 4.200 m²) wurde anhand folgender Quellen durchgeführt: Grundbuchauszüge (Amtsgericht Musterstadt, 1918–2025), Gewerbeanmeldungen (Ordnungsamt, 1920–1985), Luftbildauswertung (Landesvermessungsamt, Bilder von 1945, 1968, 1984, 2002, 2020), Zeitzeugeninterviews (ehemaliger Betriebsleiter Herr Wilfried Teerbusch, 78 Jahre) und Archivrecherche im Stadtarchiv Musterstadt.

Das Grundstück wurde wie folgt genutzt: 1920–1960: Teerverarbeitungsbetrieb Franz Teerbusch & Söhne (Destillation von Steinkohlenteer, Herstellung von Teerölen, Dachpappen und Bitumenanstrichen). Die Produktionsanlagen umfassten 3 Teerkessel (je 5 m³ Fassungsvermögen), ein Destillationsgebäude, ein Lagertank für Rohöl (unterirdisch, 20 m³) und offene Lagerflächen für Teerfässer. 1960–1985: Umstellung auf Bitumenverarbeitung und Straßenbaumaterialien (Kaltasphalt, Fugenvergussmassen). Rückbau der Teerkessel 1962, Weiterbetrieb des unterirdischen Lagertanks bis 1980 (Stilllegungsprotokoll nicht auffindbar). 1985–2005: Leerstand, Grundstück eingezäunt, keine Sanierung durchgeführt. 2005–heute: Erwerb durch die Metallbau Krämer GmbH & Co. KG als Baugrundstück für eine Gewerbehalle.

### 1.2 Verdachtsflächen

Aus der historischen Erkundung ergeben sich 3 Verdachtsbereiche: VF1 — ehemaliger Standort der Teerkessel (Nordwestecke, ca. 200 m²), VF2 — ehemaliger unterirdischer Lagertank (Mitte, ca. 80 m²), VF3 — ehemalige Lagerfläche für Teerfässer (Südostecke, ca. 300 m²). Die Gesamtfläche der Verdachtsflächen beträgt 580 m² (14 Prozent der Grundstücksfläche).

## 2. Feldarbeiten — Orientierende Untersuchung

### 2.1 Bodenproben

Im Zeitraum 10.–14.01.2026 wurden 14 Rammkernsondierungen (RKS) bis zu einer Tiefe von 5 m unter Geländeoberkante durchgeführt. Die Sondierungen wurden gemäß DIN EN ISO 22475-1 (Geotechnische Erkundung — Probenentnahme) ausgeführt. An jeder Sondierung wurden Bodenproben aus 4 Tiefenstufen entnommen (0–1 m, 1–2 m, 2–3 m, 3–5 m), insgesamt 56 Bodenproben. Die Proben wurden in Braunglasflaschen mit Teflondichtung luftdicht verpackt und gekühlt (4°C) an das akkreditierte Labor AnalytikZentrum Musterstadt (DAkkS-Akkreditierung Nr. D-PL-12345-01) übergeben.

### 2.2 Grundwasserproben

Aus 3 bestehenden Grundwassermessstellen (GWM 1 bis GWM 3, Ausbautiefe 8 m, Filterbereich 4–8 m) wurden Grundwasserproben nach DIN 38402-13 (Probennahme von Grundwasser) entnommen. Vor der Probennahme wurde das stehende Wasser in den Messstellen abgepumpt (3 Messstellenvolumina) und die Leitfähigkeit, der pH-Wert und der Sauerstoffgehalt bis zur Stabilisierung überwacht (Kriterium: < 10 Prozent Abweichung über 3 aufeinanderfolgende Messungen).

### 2.3 Bodenluftproben

An 6 Bodenluftmessstellen (Rammsonden mit perforiertem Rohr, Tiefe 1,5 m) wurden Bodenluftproben auf BTEX und leichtflüchtige chlorierte Kohlenwasserstoffe (LCKW) analysiert (Direktmessung mit PID und Probennahme auf Aktivkohle-Röhrchen für Laboranalyse).

## 3. Analyseergebnisse

### 3.1 PAK-Belastung im Boden

Die Summe der 16 EPA-PAK (polyzyklische aromatische Kohlenwasserstoffe nach US-EPA 610) wurde nach DIN EN 16181 (Bestimmung von PAK mittels HPLC/Fluoreszenz) bestimmt. Die höchsten Konzentrationen wurden im Verdachtsbereich VF1 (Teerkessel) gemessen:

| Sondierung | Tiefe | PAK16 [mg/kg] | Benzo(a)pyren [mg/kg] | Naphthalin [mg/kg] |
|-----------|-------|--------------|---------------------|-------------------|
| RKS 2 | 0-1m | 82 | 8,4 | 45 |
| RKS 2 | 1-2m | 210 | 22 | 120 |
| RKS 2 | 2-3m | 145 | 15 | 85 |
| RKS 3 | 0-1m | 48 | 5,1 | 28 |
| RKS 3 | 1-2m | 165 | 18 | 95 |
| RKS 7 (VF2) | 1-2m | 380 | 42 | 210 |
| RKS 7 (VF2) | 2-3m | 520 | 58 | 280 |
| RKS 11 (VF3) | 0-1m | 35 | 3,8 | 18 |

Die Prüfwerte der BBodSchV (Bundes-Bodenschutzverordnung) für den Wirkungspfad Boden → Mensch betragen: Benzo(a)pyren 1 mg/kg (Wohngebiete) bzw. 12 mg/kg (Gewerbegebiete). Die Prüfwerte für Gewerbegebiete werden in den Verdachtsbereichen VF1 und VF2 deutlich überschritten (max. 58 mg/kg B(a)P bei Prüfwert 12 mg/kg — 5-fache Überschreitung). Im Verdachtsbereich VF3 liegen die Konzentrationen unter den Gewerbe-Prüfwerten. Außerhalb der Verdachtsflächen (Sondierungen RKS 9, 10, 12–14) wurden keine erhöhten PAK-Konzentrationen gemessen (alle Werte < 5 mg/kg PAK16).

### 3.2 BTEX im Boden und Bodenluft

Die BTEX-Konzentrationen (Benzol, Toluol, Ethylbenzol, Xylole) im Boden liegen an allen Messstellen unterhalb der Prüfwerte der BBodSchV (Benzol < 0,1 mg/kg bei Prüfwert 1 mg/kg). Die Bodenluft-Messungen zeigen leicht erhöhte Naphthalin-Konzentrationen in VF2 (Naphthalin 0,8 mg/m³ bei Prüfwert 5 mg/m³) — unterhalb der Prüfwerte, aber ein Hinweis auf eine fortlaufende Ausgasung aus der Kontamination.

### 3.3 Grundwasser

Die Grundwasserproben zeigen erhöhte PAK-Konzentrationen in GWM 2 (Abstrom VF2): Naphthalin 18 µg/l (GFS nach LAWA: 1 µg/l — 18-fache Überschreitung). Benzo(a)pyren 0,15 µg/l (GFS: 0,01 µg/l). Die Grundwasserbelastung bestätigt, dass die Schadstoffquelle im Bereich des ehemaligen Lagertanks (VF2) das Grundwasser erreicht hat. Der Grundwasserstrom fließt nach Nordosten (hydraulisches Gefälle i = 0,003, Durchlässigkeit kf = 2,5 × 10⁻⁴ m/s), die Schadstofffahne erstreckt sich voraussichtlich 80–120 m in Abstromrichtung.

## 4. Gefährdungsabschätzung

### 4.1 Wirkungspfad Boden → Mensch

Bei der geplanten Gewerbenutzung (Produktionshalle, Büro, befestigte Flächen) ist der direkte Kontakt mit dem kontaminierten Boden im Normalbetrieb ausgeschlossen (Versiegelung durch Bodenplatte und Außenbefestigung). Der Wirkungspfad ist erst bei Erdarbeiten (Baugrube, Leitungsgräben) relevant. Maßnahme: Arbeitsschutzvorkehrungen nach TRGS 524 (Sanierung kontaminierter Bereiche) während der Bauphase.

### 4.2 Wirkungspfad Boden → Grundwasser

Die PAK-Kontamination hat das Grundwasser bereits erreicht (siehe GWM 2). Ohne Sanierung wird die Schadstoffquelle weiterhin Schadstoffe in das Grundwasser freisetzen. Die Ausbreitung der Schadstofffahne gefährdet potenziell den Trinkwasserbrunnen der Stadtwerke in 1,2 km Entfernung (Transportzeit bei Abstromsgeschwindigkeit 0,3 m/d: ca. 11 Jahre — der Brunnen ist langfristig gefährdet).

## 5. Sanierungskonzept

### 5.1 Variante A — Auskofferung

Entfernung des kontaminierten Bodens im Bereich VF1 und VF2 (geschätzt 2.800 m³, Tiefe bis 3 m). Vorteile: Vollständige Quellenbeseitigung, keine Nutzungseinschränkungen, keine Langzeitüberwachung. Nachteile: Hohe Kosten, Entsorgungsaufwand (LAGA Z2/gefährlicher Abfall). Kosten: Auskofferung 280.000 Euro, Entsorgung (200 Euro/t × 4.200 t) 840.000 Euro, Verfüllung mit sauberem Boden 120.000 Euro, Grundwasser-Monitoring 2 Jahre 40.000 Euro. **Gesamtkosten: ca. 1.280.000 Euro.** Dauer: 10 Wochen Auskofferung, 8 Wochen Verfüllung.

### 5.2 Variante B — Einkapselung

Oberflächenabdichtung der Verdachtsflächen VF1 und VF2 mit einer mineralischen Dichtung (Bentonitmatte + PE-HD-Folie) unter der geplanten Bodenplatte der Gewerbehalle. Vorteile: Deutlich geringere Kosten, Integration in die Baumaßnahme. Nachteile: Kontamination verbleibt im Boden, Nutzungseinschränkung (kein Kellerausbau, keine Erdarbeiten ohne Genehmigung), Langzeitüberwachung des Grundwassers erforderlich (20 Jahre). Kosten: Dichtungseinbau 65.000 Euro, Grundwasser-Monitoring 20 Jahre 280.000 Euro. **Gesamtkosten: ca. 345.000 Euro.**

### 5.3 Variante C — In-situ-Behandlung

Chemische Oxidation (ISCO — In-Situ Chemical Oxidation) mit Kaliumpermanganat-Injektion in den Kontaminationsherd. Die Permanganat-Lösung (2 Prozent KMnO₄) wird über Injektionsbrunnen (12 Stück, Raster 3 × 3 m) in den Boden eingebracht und oxidiert die PAK zu CO₂ und Wasser. Vorteile: Kein Bodenaushub, keine Entsorgung. Nachteile: Unsichere Wirksamkeit bei gebundenen PAK (Sorption an Tonminerale), lange Behandlungsdauer (12–18 Monate), hoher Chemikalienbedarf. Kosten: Injektionssystem 120.000 Euro, Chemikalien 180.000 Euro, Monitoring 150.000 Euro. **Gesamtkosten: ca. 450.000 Euro.**

## 6. Empfehlung

Bei der geplanten gewerblichen Nutzung mit Büroanteil empfiehlt das Gutachterbüro **Variante A (Auskofferung)**, da: (1) Die Kontamination vollständig beseitigt wird und keine Nutzungseinschränkungen verbleiben. (2) Die Baugrube für die Gewerbehalle ohnehin bis 1,5 m Tiefe ausgehoben wird — die zusätzliche Auskofferung bis 3 m ist wirtschaftlich vertretbar. (3) Der Grundwasserschutz langfristig gesichert wird ohne kostenintensives Monitoring. (4) Der Grundstückswert nach Sanierung deutlich steigt (Altlastenfreiheit als Vermarktungsvorteil). Die Entsorgung des kontaminierten Bodens erfolgt auf der Sondermülldeponie Emscherbruch (Entsorgungsnachweis nach NachwV liegt vor, Annahmebestätigung vom 05.01.2026). Ein Grundwasser-Monitoring über 2 Jahre (vierteljährliche Beprobung an 3 Messstellen) ist nach Abschluss der Auskofferung zur Erfolgskontrolle erforderlich.

Musterstadt, den 15.01.2026

_Dr. rer. nat. Stefan Bodenbach, EnviroConsult GmbH, Sachverständiger für Altlasten_`,
};
