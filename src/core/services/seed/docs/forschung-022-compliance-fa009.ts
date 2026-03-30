import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-057',
  filename: 'Compliance_FA009.md',
  format: 'md',
  tags: ['Compliance', 'Gefahrstoff', 'Bioleaching'],
  created: '2026-03-06T10:00:00Z',
  vorgangId: 'FA-2026-009',
  markdown: `---
titel: Umweltrechtliche Bewertung und Arbeitsschutzkonzept Bioleaching FA-2026-009
aktenzeichen: FA-2026-009
datum: 2026-03-06
ersteller: Stabsstelle Arbeitssicherheit und Umweltschutz, TU Musterstadt
---

# Umweltrechtliche Bewertung — Bioleaching FA-2026-009

## 1. Regulatorischer Rahmen

Das Projekt FA-2026-009 (Lithium-Rückgewinnung aus Altbatterien durch Bioleaching) verarbeitet gefährliche Abfälle (Altbatterien), verwendet Mikroorganismen in Bioreaktoren und erzeugt schwermetallhaltige Prozesslösungen. Die relevanten Rechtsvorschriften umfassen: Kreislaufwirtschaftsgesetz (KrWG) — Altbatterien als gefährlicher Abfall, Biostoffverordnung (BioStoffV) — Umgang mit Acidithiobacillus ferrooxidans in Bioreaktoren, Gefahrstoffverordnung (GefStoffV) — Umgang mit Schwefelsäure und Schwermetalllösungen, Bundes-Immissionsschutzgesetz (BImSchG) — Genehmigungsbedarf der Pilotanlage, Arbeitsschutzgesetz (ArbSchG) und DGUV — Arbeitsschutz der Mitarbeiter und Abwasserverordnung (AbwV) — Einleitung von Prozessabwasser. Dieses Dokument bewertet die regulatorischen Anforderungen und definiert die erforderlichen Genehmigungen und Schutzmaßnahmen.

## 2. Abfallrecht — Altbatterien

### 2.1 Einstufung

Lithium-Ionen-Batterien sind nach der Abfallverzeichnisverordnung (AVV) als gefährlicher Abfall eingestuft: AVV-Schlüssel 16 06 05* (andere Batterien und Akkumulatoren) — das Sternchen kennzeichnet gefährlichen Abfall. Die Einstufung beruht auf den gefährlichen Eigenschaften HP 4 (reizend), HP 6 (akute Toxizität — Elektrolyt enthält Lithiumhexafluorophosphat LiPF₆) und HP 14 (ökotoxisch — Schwermetalle Cobalt, Nickel, Mangan). Die Übernahme der Altbatterien durch die TU Musterstadt erfordert eine Anzeige nach §53 KrWG (Sammler und Beförderer gefährlicher Abfälle) oder einen Entsorgungsnachweis nach §50 KrWG (Nachweis-verordnung NachwV). Da die TU Musterstadt die Altbatterien nicht entsorgt, sondern als Forschungsmaterial verwendet (R4 — Verwertung anorganischer Stoffe), ist eine Anzeige nach §53 KrWG ausreichend. Die Entsorgungsnachweise (Übernahme-Scheine) für die angelieferten Altbatterien werden vom Lieferanten (Duesenfeld GmbH, zertifizierter Entsorgungsfachbetrieb) bereitgestellt.

### 2.2 Lagerung

Die Lagerung der Altbatterien auf dem Gelände der TU muss den Anforderungen der TRGS 510 (Lagerung von Gefahrstoffen in ortsbeweglichen Behältern) und der VDI 2263 (Brand- und Explosionsschutz bei Lithium-Ionen-Batterien) entsprechen: Lagerung in einem separaten, belüfteten Lagerraum mit Brandschutztür T30, Auffangwanne (Volumen ≥ 110 Prozent des größten Gebindes), Rauchmelder und Temperaturüberwachung (Alarm bei > 40°C — Frühwarnung für thermisches Durchgehen), Feuerlöscher Klasse D (Metallbrände) in Reichweite, maximale Lagermenge: 500 kg (Mengenschwelle nach TRGS 510 für Lagerklasse 10). Die zerkleinerten und thermisch vorbehandelten Kathodenpulver (nach Entfernung des Elektrolyts) sind weniger gefährlich als intakte Batterien, müssen aber weiterhin als gefährlicher Abfall behandelt werden (AVV 16 06 05*, da der Schwermetallgehalt die Grenzwerte überschreitet).

## 3. Biostoffverordnung — Acidithiobacillus ferrooxidans

### 3.1 Risikobewertung des Organismus

Acidithiobacillus ferrooxidans (Af) ist ein gram-negatives, obligat chemolithoautotrophes Bakterium, das Eisen(II) und elementaren Schwefel als Energiequelle oxidiert. Af ist nach der TRBA 466 (Einstufung von Prokaryoten in Risikogruppen) in die **Risikogruppe 1** eingestuft — nicht pathogen für Menschen, Tiere und Pflanzen, kein Allergiepotential, keine Toxinproduktion. Die Schutzstufe nach BioStoffV ist **Schutzstufe 1** (niedrigstes Schutzniveau). Maßnahmen der Schutzstufe 1: Allgemeine Hygienemaßnahmen (Händewaschen nach Laborarbeit, kein Essen und Trinken im Labor), Kennzeichnung der Bioreaktoren (Biogefährdungs-Symbol, auch wenn der Organismus ungefährlich ist — Kennzeichnung nach GHS/CLP-Verordnung für den Inhalt der Bioreaktoren, insb. Schwefelsäure), Dekontamination verschütteter Kulturlösung (Neutralisation mit NaOH, Aufwischen, Entsorgung als Laborabfall) und kein gentechnisch veränderter Organismus (GVO) — der verwendete Stamm DSMZ 583T ist ein Wildtyp-Stamm. Es ist keine Anzeige nach Gentechnikgesetz (GenTG) oder Gentechnik-Sicherheitsverordnung (GenTSV) erforderlich.

### 3.2 Klarstellung zur GenTSV

Im Antrag wird angemerkt, dass eine Klarstellung mit der zuständigen Behörde empfohlen wird, ob die Bioreaktoren > 10 Liter eine Anzeige nach §6 GenTSV erfordern. Die GenTSV gilt ausschließlich für gentechnische Arbeiten mit GVO. Da Acidithiobacillus ferrooxidans DSMZ 583T kein GVO ist und im Projekt keine gentechnischen Veränderungen vorgenommen werden, ist die GenTSV nicht anwendbar. Eine Anzeige nach GenTSV ist nicht erforderlich. Die Klarstellung mit dem LANUV NRW ist gleichwohl sinnvoll, um spätere Rückfragen zu vermeiden — die Stabsstelle hat eine entsprechende Anfrage am 01.03.2026 gestellt.

## 4. Gefahrstoffverordnung — Schwefelsäure und Schwermetalle

### 4.1 Schwefelsäure

Das Bioleaching erzeugt biogene Schwefelsäure (H₂SO₄) in Konzentrationen von 15–30 g/l (1,5–3 Prozent w/v). Konzentrierte Schwefelsäure (> 15 Prozent w/v) ist nach GHS als ätzend (H314, Verursacht schwere Verätzungen der Haut und schwere Augenschäden) eingestuft. Die im Projekt verwendeten Konzentrationen (< 3 Prozent) fallen unterhalb der Einstufungsschwelle für Hautätzung (> 5 Prozent nach CLP-Verordnung), sind aber als hautreizend einzustufen (H315). Lagerung: Die biogene Säurelösung wird in Edelstahltanks (V4A, säurebeständig) gelagert. Die Lagermenge beträgt maximal 500 Liter je Tank (2 Tanks für die Säureproduktion, 1 Tank als Puffer). Auffangwanne unter allen Tanks (Volumen ≥ 110 Prozent). Neutralisationsmittel (Natronlauge 25 Prozent) in 50-Liter-Kanister griffbereit.

### 4.2 Schwermetall-Lösungen

Das Leachat enthält gelöste Schwermetalle: Li (5–15 g/l), Co (3–8 g/l), Ni (3–8 g/l), Mn (3–8 g/l), Fe (10–20 g/l). Die Gefahrstoffeinstufung der Leachat-Lösung: H302 (gesundheitsschädlich beim Verschlucken — Co, Ni), H315 (verursacht Hautreizungen — saure Lösung), H317 (kann allergische Hautreaktionen verursachen — Ni, Co), H341 (kann vermutlich genetische Defekte verursachen — Co, Klasse 2 CMR-Stoff), H350i (kann bei Einatmen Krebs erzeugen — Ni-Verbindungen, nur als Staub/Aerosol relevant, in Lösung geringeres Risiko). Die Cobalt- und Nickel-Verbindungen in Lösung sind als CMR-Stoffe (krebserzeugend, mutagen, reproduktionstoxisch) der Kategorie 1B (Cobalt) und 1A (Nickelsulfat) eingestuft. Die GefStoffV erfordert daher eine Substitutionsprüfung (§6 Abs. 1 GefStoffV) — eine Substitution ist hier nicht möglich, da die Schwermetalle der Gegenstand der Rückgewinnung sind und nicht vermieden werden können. Die Expositionsminimierung erfolgt durch geschlossene Systeme (Bioreaktoren, Rohrleitungen, Fällungskessel), lokale Absaugung an Probenahmestellen und persönliche Schutzausrüstung.

## 5. Arbeitsschutzkonzept

### 5.1 Gefährdungsbeurteilung

Die Gefährdungsbeurteilung nach §5 ArbSchG identifiziert folgende Gefährdungen: Hautkontakt mit saurer Schwermetalllösung (Verätzung, allergische Reaktion, CMR-Exposition), Einatmen von Aerosolen aus den Bioreaktoren (H₂S-Spuren aus der Schwefeloxidation, Schwermetall-Aerosole bei Verspritzung), Ausrutschen auf nassem Boden (Spritzwasser aus den Bioreaktoren), mechanische Gefährdung (Pumpen, Rührwerke, Filterpresse), thermische Gefährdung (Steam-Explosion-Reaktor, 220°C/25 bar) und elektrische Gefährdung (Pumpen, Rührwerke, Steuerung). Die Maßnahmenhierarchie (STOP-Prinzip: Substitution → Technisch → Organisatorisch → Persönlich) wird angewandt.

### 5.2 Persönliche Schutzausrüstung (PSA)

Beim Arbeiten an den Bioreaktoren und der Fällungsanlage ist folgende PSA vorgeschrieben: Schutzbrille (Korbbrille, DIN EN 166, Kennzeichnung 3 — Tropfen und Spritzer, Filtertyp klar), säurebeständige Handschuhe (Nitril, Länge 38 cm, DIN EN 374, Permeationsklasse ≥ 4 für H₂SO₄, Modell: Ansell AlphaTec 58-335), Laborkittel (lang, geschlossen, Baumwolle oder Polyester/Baumwolle — kein Kunststoff, der bei Säurekontakt schmilzt), Sicherheitsschuhe (S2, säurebeständige Sohle) und bei Arbeiten am Steam-Explosion-Reaktor: zusätzlich Gesichtsschild (DIN EN 166) und hitzebeständige Handschuhe (DIN EN 407, Kontaktwärme ≥ Level 2).

### 5.3 Notfalleinrichtungen

Notdusche (Ganzkörperdusche, nach DIN EN 15154-1, Mindestdurchfluss 60 l/min, erreichbar in 10 Sekunden von jedem Arbeitsplatz): 1 Stück am Ausgang der Technikumshalle. Augenspülstation (DIN EN 15154-2): 2 Stück (je 1 an den Bioreaktoren und an der Fällungsanlage). Erste-Hilfe-Kasten (DIN 13157, Typ C) mit Zusatzausstattung für Verätzungen (Calciumgluconat-Gel für Flusssäure-Verätzungen — obwohl HF im Projekt nicht verwendet wird, wird das Gel als Vorsichtsmaßnahme vorgehalten, da Flusssäure aus LiPF₆ bei der Batterie-Vorbehandlung freigesetzt werden kann). Feuerlöscher: 2 × ABC-Pulver 6 kg, 1 × CO₂ 5 kg (für elektrische Anlagen), 1 × Metallbrandlöscher Klasse D (für den Fall eines Lithium-Brands bei der Vorbehandlung). Flucht- und Rettungsplan (DIN ISO 23601) im Eingangsbereich ausgehängt, Evakuierungsübung jährlich.

## 6. BImSchG-Genehmigung

Die Pilotanlage mit einem Bioreaktor-Volumen von 2 × 500 Liter benötigt keine BImSchG-Genehmigung, da die Mengenschwellen der 4. BImSchV (Verordnung über genehmigungsbedürftige Anlagen) nicht erreicht werden: Anlagen zur biologischen Behandlung von gefährlichen Abfällen erfordern eine Genehmigung ab einer Durchsatzkapazität von 1 t/Tag (Anhang 1, Nr. 8.6). Die Pilotanlage hat einen Durchsatz von 500 kg/d — unter der Schwelle. Eine Anzeige nach §15 BImSchG (Änderung einer bestehenden genehmigungsbedürftigen Anlage) ist ebenfalls nicht erforderlich, da die TU Musterstadt keine BImSchG-genehmigte Anlage am Standort betreibt. Es genügt eine Anzeige beim Gewerbeaufsichtsamt (Bezirksregierung Münster) nach §22 BImSchG (nicht genehmigungsbedürftige Anlage, Betreiberpflicht zur Vermeidung schädlicher Umwelteinwirkungen).

## 7. Abwassereinleitung

Das Prozessabwasser aus der Fällungsstufe (nach Entfernung der Schwermetalle durch selektive Fällung) enthält noch Restkonzentrationen an Schwermetallen. Die Grenzwerte der Abwasserverordnung (AbwV), Anhang 40 (Metallbe- und -verarbeitung) betragen: Co < 1 mg/l, Ni < 0,5 mg/l, Mn < 2 mg/l, Zn < 2 mg/l, Fe < 3 mg/l, pH 6,0–9,0. Die Einhaltung der Grenzwerte wird durch eine Nachfällung (pH 10, NaOH) und eine Filtration (Kammerfilterpresse, Filtrat < 0,5 mg/l Gesamtmetalle) sichergestellt. Die Einleiterlaubnis wird beim kommunalen Abwasserbetrieb beantragt (Indirekteinleiter-Genehmigung nach §58 WHG). Eine Eigenüberwachung (monatliche Abwasseranalyse auf Schwermetalle per ICP-OES) ist vorgesehen.

## Zusammenfassung in einfacher Sprache

Dieses Dokument prueft, welche Umwelt- und Sicherheitsvorschriften beim Batterie-Recycling mit Bakterien eingehalten werden muessen. Alte Batterien gelten als Sondermuell und muessen besonders gelagert werden. Die verwendeten Bakterien sind ungefaehrlich fuer Menschen. Allerdings entstehen im Verfahren saure Loesungen mit giftigen Schwermetallen, weshalb die Mitarbeiter Schutzbrillen, saeurebestaendige Handschuhe und Laborkittel tragen muessen. Die Versuchsanlage braucht keine aufwaendige Genehmigung, weil sie unter den gesetzlichen Mengenschwellen bleibt. Das Abwasser wird gereinigt und auf Schwermetalle ueberprueft, bevor es eingeleitet wird.

Musterstadt, den 06.03.2026

_Dr.-Ing. Markus Sicher, Stabsstelle Arbeitssicherheit und Umweltschutz, TU Musterstadt_`,
};
