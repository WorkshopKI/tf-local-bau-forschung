const EXAMPLES: { name: string; content: string }[] = [
  {
    name: 'Gutachten_Schallschutz_MFH.md',
    content: `---
titel: Schallschutzgutachten Mehrfamilienhaus Lindenstrasse 12
aktenzeichen: BA-2026-032
datum: 2026-02-15
ersteller: Ingenieurbuero Akustik Schmidt, Dipl.-Ing. Markus Schmidt
---

# Schallschutzgutachten — Mehrfamilienhaus Lindenstrasse 12

## 1. Auftraggeber und Gegenstand

**Auftraggeber:** Projektgesellschaft Linden GmbH, vertreten durch Geschaeftsfuehrer Thomas Linden, Hauptstrasse 45, 12345 Musterstadt

**Bauvorhaben:** Neubau eines Mehrfamilienhauses mit 12 Wohneinheiten, 4 Vollgeschosse plus Staffelgeschoss, Tiefgarage mit 14 Stellplaetzen

**Standort:** Lindenstrasse 12, 12345 Musterstadt, Flurstueck 234/5 und 234/6, Gemarkung Musterstadt

**Gegenstand:** Rechnerischer Nachweis des baulichen Schallschutzes nach DIN 4109:2018 (Schallschutz im Hochbau) sowie erhoehter Schallschutz nach VDI 4100:2012, Schallschutzstufe II (SSt II). Der Bauherr hat vertraglich die Erreichung der Schallschutzstufe II als Qualitaetsmerkmal zugesichert. Dieses Gutachten dokumentiert den rechnerischen Nachweis vor Baubeginn; nach Fertigstellung wird eine Abnahmemessung nach DIN EN ISO 16283 empfohlen.

Das Gebaeude liegt an der Lindenstrasse (DTV 6.800 Kfz/d, Schwerlastanteil 4 Prozent) und wird dem Laermpegelbereich III nach DIN 4109 Tabelle 7 zugeordnet. Massgeblicher Aussenlaerm tags: La = 61-65 dB(A). Die laermsensiblen Raeume (Schlafzimmer, Wohnzimmer) sind zur Hofseite orientiert; Kuechen, Baeder und Flure liegen zur Strassenseite.

## 2. Luftschalldaemmung der Trennbauteile

### 2.1 Wohnungstrennwaende

**Anforderung DIN 4109:** R'w >= 53 dB (Mindestanforderung fuer Mehrfamilienhaeuser)
**Anforderung VDI 4100 SSt II:** R'w >= 56 dB

Die Wohnungstrennwaende bestehen aus Kalksandstein-Mauerwerk KS 20-2.0, d = 24 cm (flaechenbezogene Masse m' = 432 kg/m²), beidseitig mit Kalkzementputz 15 mm verputzt. Laborwert der Wand nach DIN EN ISO 140-3: Rw = 62 dB.

Korrekturwert fuer Flankenuebertragung nach DIN 4109 Beiblatt 1 (vereinfachtes Verfahren): KL = -3 dB (schwere Flanken: Stahlbetondecke 22 cm, KS-Aussenwand 20 cm mit WDVS).

**Resultierendes Bau-Schalldaemm-Mass:** R'w = 62 - 3 = **59 dB >= 56 dB (SSt II erfuellt)**

Fuer Wohnungen direkt ueber der Tiefgarageneinfahrt wird zusaetzlich eine Vorsatzschale montiert (CW-Profil 50 mm, Mineralwolle 40 mm, GKF 12,5 mm, Verbesserung DeltaRw = +6 dB). Resultierende Daemmung mit Vorsatzschale: R'w = 65 dB — uebertrifft SSt III (>= 59 dB).

### 2.2 Wohnungstrenndecken (Luftschall)

**Anforderung DIN 4109:** R'w >= 54 dB
**Anforderung VDI 4100 SSt II:** R'w >= 57 dB

Stahlbetonflachdecke d = 22 cm (m' = 550 kg/m²), Laborwert Rw = 60 dB. Mit Flankenkorrrektur KL = -2 dB: R'w = 58 dB >= 57 dB.

**Nachweis erfuellt.** Der schwimmende Estrich (siehe Trittschall) verbessert die Luftschalldaemmung zusaetzlich um DeltaRw = +4 dB, tatsaechlicher Bauwert ca. R'w = 62 dB.

### 2.3 Aussenbauteile (Strassenlaerm)

Fuer Laermpegelbereich III: R'w,res >= 35 dB (Aufenthaltsraeume, DIN 4109 Tabelle 8). Die Aussenwand (KS 20-2.0 mit WDVS 180 mm Mineralwolle) erreicht R'w = 50 dB. Fenster zur Strassenseite erhalten Schallschutzklasse 2 (SSK 2): Rw = 32 dB, Fensteranteil 28 Prozent.

Resultierendes Fassaden-Schalldaemm-Mass nach Mischungsregel: R'w,res = 38,4 dB >= 35 dB.

Schlafzimmer zur Strassenseite (4 Stk.) erhalten SSK 3-Fenster (Rw = 37 dB) fuer den erhoehten Nachtschutz.

## 3. Trittschalldaemmung

### 3.1 Wohnungstrenndecken

**Anforderung DIN 4109:** L'n,w <= 53 dB
**Anforderung VDI 4100 SSt II:** L'n,w <= 46 dB

**Fussbodenaufbau (von oben):**
- Parkett 15 mm auf Trennlage PE-Folie
- Zementestrich CT-C30-F5, d = 55 mm, schwimmend
- Trittschalldaemmplatte Mineralwolle (Steinwolle), dynamische Steifigkeit s' = 10 MN/m³, d = 30 mm
- Stahlbetondecke d = 22 cm

Norm-Trittschallpegel Rohdecke: Ln,w,eq = 76 dB. Trittschallminderung des schwimmenden Estrichs nach DIN EN 12354-2: DeltaLw = 33 dB. Korrekturwert K fuer Flankenuebertragung: 0 dB (schwere Flanken).

**Bewerteter Norm-Trittschallpegel:** L'n,w = 76 - 33 = **43 dB <= 46 dB (SSt II erfuellt)**

### 3.2 Treppenhaus

Treppenlaeufe und -podeste als Stahlbeton-Fertigteile auf elastischen Auflagern (Elastomerpads Typ Sylomer SR 55, statische Steifigkeit 0,012 N/mm³). Trittschallminderung durch Lagerung: DeltaLw = 24 dB. Resultierender Norm-Trittschallpegel in angrenzenden Wohnungen: L'n,w = 41 dB <= 46 dB (SSt II).

### 3.3 Tiefgaragendecke

Die Decke ueber der Tiefgarage erhaelt eine Schwingungsentkopplung zwischen Parkebene und Wohngeschoss. Konstruktion: Industrieboden 80 mm auf Neoprene-Elementen (s' = 8 MN/m³), Stahlbetondecke 28 cm. Resultierende Trittschalldaemmung: L'n,w = 38 dB; Luftschalldaemmung R'w = 68 dB. Koerperscball aus Fahrzeugen (Einfahrtrampe, Parkmanoel) wird durch Beschraenkung der Rampensteilheit auf max. 12 Prozent und Einbau von Dehnfugenmatten an den Rampenenden minimiert.

## 4. Haustechnische Anlagen

### 4.1 Lueftungsanlage

Die kontrollierte Wohnraumlueftung (KWL-Anlage) mit Waermerueckgewinnung erzeugt Ventilator- und Stroemungsgeraeusche. Massnahmen:

- Kulissenschalldaempfer in Zu- und Abluftleitungen (Einfuegungsdaempfung De >= 25 dB bei 250-2000 Hz)
- Telefonieschalldaempfer an Wohnungsuebertragungspunkten (DnEw >= 52 dB)
- Gummipuffer unter dem Zentralgeraet (Eigenfrequenz der Lagerung <= 8 Hz)
- Flexible Anschluesse an allen Kanalabgaengen des Geraets

Maximalschallpegel Wohnraum bei Intensivlueftung: LA = 27 dB(A) <= 30 dB(A) (DIN 4109).

### 4.2 Aufzugsanlage

Maschinenraumloser Seilaufzug, Antrieb im Schachtkopf. Schachtwandstaerke d = 25 cm Stahlbeton. Fuehrungsschienen auf Elastomerpuffern (Koerperschallentkopplung). Antriebsrahmen auf Federdaempfern (Eigenfrequenz 6 Hz). Prognose in unguenstigster Wohnung (Nachbarwohnung 2. OG): LAF,max = 23 dB(A) <= 27 dB(A) (SSt II).

## 5. Nachweiszusammenfassung

| Bauteil | DIN 4109 | VDI SSt II | Erreicht | Bewertung |
|---------|----------|------------|---------|-----------|
| Wohnungstrennwand | R'w >= 53 dB | >= 56 dB | 59 dB | SSt II |
| Trenndecke Luft | R'w >= 54 dB | >= 57 dB | 58 dB | SSt II |
| Trenndecke Tritt | L'n,w <= 53 dB | <= 46 dB | 43 dB | SSt II |
| Treppe | L'n,w <= 53 dB | <= 46 dB | 41 dB | SSt II |
| Tiefgaragendecke Luft | R'w >= 54 dB | >= 57 dB | 68 dB | SSt III |
| Tiefgaragendecke Tritt | L'n,w <= 53 dB | <= 46 dB | 38 dB | SSt III |
| Aussenfassade | R'w,res >= 35 dB | — | 38 dB | DIN |
| Lueftung | LA <= 30 dB(A) | <= 27 dB(A) | 27 dB(A) | SSt II |
| Aufzug | LAF,max <= 30 dB(A) | <= 27 dB(A) | 23 dB(A) | SSt II |

Alle Nachweise der DIN 4109:2018 und VDI 4100:2012 SSt II sind erfuellt. Zur Qualitaetssicherung wird eine bauakustische Abnahmemessung nach DIN EN ISO 16283 nach Fertigstellung empfohlen.

Musterstadt, den 15.02.2026

_Dipl.-Ing. Markus Schmidt, Ingenieurbuero Akustik Schmidt_

## Zusammenfassung in einfacher Sprache

Dieses Gutachten prueft, ob das neue Mehrfamilienhaus mit 12 Wohnungen in der Lindenstrasse 12 seine Bewohner ausreichend vor Laerm schuetzt. Untersucht wurden alle Waende und Decken zwischen den Wohnungen, das Treppenhaus, die Tiefgarage darunter sowie die Fenster zur Strasse. Das Ergebnis ist positiv: Alle gesetzlichen Mindestanforderungen werden erfuellt, und sogar der deutlich strengere freiwillige Standard (Schallschutzstufe II) wird fuer alle Bauteile erreicht. Die Bewohner werden in ihren Wohnungen von Nachbargeraueschen, Trittschall von oben und Strassenlaerm gut geschuetzt sein. Auch Aufzug und Lueftungsanlage sind so geplant, dass sie kaum hoerbar sein werden. Empfohlen wird eine Ueberpruefungsmessung nach dem Einzug, um die Qualitaet der Ausfuehrung zu bestaetigen.`,
  },
  {
    name: 'Stellungnahme_Naturschutz_Bachaue.md',
    content: `---
titel: Naturschutzfachliche Stellungnahme Bebauungsplan Bachaue West
aktenzeichen: BP-2026-007
datum: 2026-03-04
ersteller: Untere Naturschutzbehoerde Kreis Musterland
---

# Naturschutzfachliche Stellungnahme — Bebauungsplan Bachaue West

## 1. Anlass und Verfahren

Die Stadtplanungsbehoerde Musterstadt hat mit Schreiben vom 12.01.2026 (Az. SP-2026-034) die Untere Naturschutzbehoerde (UNB) des Kreises Musterland als Traeger oeffentlicher Belange am Bebauungsplanverfahren Bachaue West beteiligt. Der Bebauungsplan setzt ein allgemeines Wohngebiet (WA) mit maximal zweigeschossiger Bebauung (Grundflaechenzahl 0,4) auf einer Flaeche von 3,2 Hektar im Suedosten der Gemarkung Musterstadt fest. Das Plangebiet grenzt noerdlich an den Muehlenbach (Gewaesser II. Ordnung), suedlich an die Kreisstrasse K 14.

Die UNB nimmt auf Grundlage der eingereichten Planunterlagen (Bebauungsplan-Entwurf Stand 15.12.2025, Begruendung, Umweltbericht nach § 2a BauGB) wie folgt Stellung.

## 2. Plangebiet und Bestandsaufnahme

### 2.1 Biotopstruktur

Das Plangebiet setzt sich aus folgenden Biotoptypen zusammen (kartiert Oktober 2025, Buero fuer Landschaftsplanung Dr. Meyer):

- **Extensivgruenland mit Grosseggen** (Flaeche 0,8 ha, § 30 BNatSchG geschuetzt): Wechselfeuchte Wiese mit Bestaenden von Grossseggenried und Hochstaudenflur entlang des Bachufers. Wurde zuletzt 2018 als Maehwiese genutzt, seitdem brachgefallen.
- **Gehoelzstreifen am Muehlenbach** (Flaeche 0,3 ha, § 30 BNatSchG geschuetzt): Ufergehoel aus Erle (Alnus glutinosa), Esche (Fraxinus excelsior) und Weidenarten (Salix spp.). Strukturell wertvoll, mehrere Hoehlenbaeume kartiert.
- **Intensivgruenland** (Flaeche 1,6 ha, nicht geschuetzt): Regelmaessig gemaeht, artenarme Wirtschaftswiese, geringe oekologische Bedeutung.
- **Ruderalflaeche** (Flaeche 0,5 ha, nicht geschuetzt): Ehemaliger Lagerplatz, Pioniervegetation, erhoeht liegend.

### 2.2 Artenschutzrechtliche Prüfung (ASP) Stufe I

Die eingereichte ASP Stufe I (Dr. Meyer, Dez. 2025) ergab Hinweise auf das Vorkommen folgender relevanter Arten:

**Geburtshelferkroete (Alytes obstetricans, Anl. IV FFH-Richtlinie):** Die Art wurde im Fruehjahr 2025 am suedoestlichen Plangebietsrand nachgewiesen (3 rufende Maennchen). Potenziell geeignete Landlebensraeume (sonnige Boeschungen, Ruderalflaechen) sind im Plangebiet vorhanden. Die Fortpflanzungsgewaesser liegen ausserhalb des Plangebiets (Klaeranlagensturzbach, 200 m suedlich).

**Eisvogel (Alcedo atthis, Anl. I VSchRL):** Ein Brutpaar wurde 2024 und 2025 am Muehlenbach nordwestlich des Plangebiets nachgewiesen. Nahrungshabitat (Flachwasserbereiche) erstreckt sich entlang des Muehlenbachs auch innerhalb des Plangebiets.

**Fledermaeuse (mehrere Arten, Anl. IV FFH-Richtlinie):** Im Gehoelzstreifen wurden bei Detektorbegehungen (Aug./Sep. 2025) Zwergfledermaus (Pipistrellus pipistrellus) und Braunes Langohr (Plecotus auritus) nachgewiesen. Zwei potenzielle Hoehlenquartiere in Schwarz-Erlen wurden kartiert. Jagdhabitat entlang des Bachs ist relevant.

**Hinweis:** Die ASP Stufe I ist fuer Fledermaeuse unvollstaendig, da keine Quartiersbaumkartierung stattfand. Die UNB ordnet eine Quartiersbaumkartierung als Bestandteil der Auflagen an.

## 3. Bewertung nach FFH-Richtlinie und BNatSchG

### 3.1 Gesetzlich geschuetzte Biotope (§ 30 BNatSchG)

Der Grossseggenbestand (0,8 ha) und der Ufergehoelzstreifen (0,3 ha) unterliegen dem gesetzlichen Biotopschutz nach § 30 BNatSchG. Eine Beseitigung oder erhebliche Beeintraechtigung ist grundsaetzlich verboten. Der vorliegende Bebauungsplan-Entwurf sieht vor, diese Bereiche als "Flaechen fuer Massnahmen zum Schutz, zur Pflege und zur Entwicklung von Boden, Natur und Landschaft" (§ 9 Abs. 1 Nr. 20 BauGB) festzusetzen — dies ist zustimmungswuerdig, bedingt jedoch eine praezisere Abgrenzung in der Planzeichnung (aktuell Abweichung von 8-15 m gegenueber der Biotopkartierung).

### 3.2 Artenschutzrechtliche Verbote (§ 44 BNatSchG)

Ohne entsprechende Vermeidungs- und CEF-Massnahmen (Continuous Ecological Functionality) wuerden durch die Bebauung erfullt:
- Zerstoerung von Fortpflanzungs- und Ruhestaetten der Fledermaeuse (§ 44 Abs. 1 Nr. 3 BNatSchG)
- Erhebliche Beeintraechtigung des Nahrungshabitats des Eisvogels
- Verlust von Landlebensraum der Geburtshelferkroete

Die nachfolgend formulierten Auflagen sind Voraussetzung fuer die Feststellung der Zulassungsfaehigkeit des Bebauungsplans.

## 4. Auflagen der Unteren Naturschutzbehoerde

**Auflage 1 — Gewaesserrandstreifen:**
Entlang des Muehlenbachs ist beiderseits ein mindestens 30 m breiter Gewaesserrandstreifen von jeglicher Bebauung, Versiegelung und intensiver Nutzung freizuhalten (§ 38 WHG, § 29 NatSchG LSA). Die Abgrenzung des Randstreifens ist verbindlich in die Planzeichnung aufzunehmen. Innerhalb des Randstreifens sind ausschliesslich extensive Pflege- und Entwicklungsmassnahmen zulaessig.

**Auflage 2 — Bauzeitenregelung:**
Baufeldraaeumung, Rodungsarbeiten und der Abtrag von Oberboden sind ausschliesslich ausserhalb der Vogelbrutzeit und Fledermaus-Wochenstubenzeit zulaessig, d.h. im Zeitraum 01. Oktober bis 28. Februar. Ausnahmen beduerften einer Einzelfallgenehmigung der UNB.

**Auflage 3 — CEF-Massnahme Geburtshelferkroete:**
Vor Baubeginn sind drei Ersatzlaichgewaesser als CEF-Massnahmen anzulegen (Groesse je 15-25 m², Tiefe 50-80 cm, besonnte Flachwasserzone). Die Standorte sind mit der UNB abzustimmen. Die Gewaesser sind fuer 30 Jahre zu unterhalten; ein Pflegeplan ist einzureichen.

**Auflage 4 — Fledermaus-Quartiersbaumkartierung:**
Vor der abschliessenden Abwaegung ist eine fachgerechte Quartiersbaumkartierung aller Baeume mit Stammumfang > 80 cm (auf Brusthoehenhoehe) durch einen anerkannten Sachverstaendigen (Diplom-Biologe oder vergleichbar mit Nachweis Fledermaus-Fachkenntnis) durchzufuehren. Bei Nachweis genutzter Baumquartiere sind die betroffenen Baeume als Habitatbaeume dauerhaft zu sichern und aus der Flaeche herauszunehmen.

**Auflage 5 — Kompensationsmassnahmen:**
Fuer den unvermeidbaren Eingriff in das Intensivgruenland (1,6 ha) ist eine Ausgleichsmassnahme im Verhaeltnis 1:1,5 nachzuweisen. Die Massnahme ist auf vom Kreis Musterland gefuehrten OEkokontoflaechen zu verbuchen oder als grundbuchlich gesicherte Massnahme auf Privatflaechen darzustellen.

**Auflage 6 — Monitoring:**
In den ersten 5 Jahren nach Fertigstellung des Wohngebiets ist jaehrlich ein Monitoring der Geburtshelferkroetenpopulation (Rufkartierung April/Mai) und der Fledermausaktivaet (Transektbegehung mit Ultraschalldetektor, August/September) durchzufuehren. Ergebnisse sind der UNB jeweils bis 30. September vorzulegen.

## 5. Zusammenfassung und Empfehlung

Die UNB stimmt dem Bebauungsplan Bachaue West unter den genannten Auflagen grundsaetzlich zu. Die Bebauung des oekologisch weniger bedeutsamen Intensivgruenlandes und der Ruderalflaeche ist moeglich, wenn die gesetzlich geschuetzten Biotope und die Lebensraeume der geschuetzten Tierarten erhalten und entwickelt werden. Die Auflagen 1-6 sind verbindlich in den Bebauungsplan und den Durchfuehrungsvertrag aufzunehmen.

Musterland, den 04.03.2026

_Dr. Ines Hoffmann, Untere Naturschutzbehoerde Kreis Musterland_

## Zusammenfassung in einfacher Sprache

Das geplante Wohngebiet am Muehlenbach kann gebaut werden, aber nicht ueberall und nicht ohne Auflagen. Im Plangebiet leben geschuetzte Tiere: Kroeten, der Eisvogel am Bach und Fledermaeuse in alten Baeumen. Ausserdem steht ein Teil der Wiese und der Gehoelzstreifen direkt am Wasser unter gesetzlichem Schutz. Die Behoerde erlaubt die Bebauung auf den weniger wertvollen Teilen des Grundstuecks, verlangt aber: Am Bach muss ein 30 Meter breiter Streifen frei bleiben. Baumfaellungen und Erdarbeiten duerfen nur im Winter stattfinden, damit keine Voegel und Fledermaeuse in Brutsaison gestoert werden. Fuer die Kroeten muessen vor Baubeginn drei neue Teiche angelegt werden. Ausserdem muss noch genaeur geprueft werden, ob in den alten Baeumen Fledermaeuse wohnen. Die Natur muss fuer 5 Jahre nach dem Bau beobachtet werden.`,
  },
  {
    name: 'Nachforderung_Statik_Holzbau.md',
    content: `---
titel: Nachforderung fehlende Unterlagen — Bauantrag BA-2026-031
aktenzeichen: BA-2026-031
datum: 2026-03-18
ersteller: Bauaufsichtsbehoerde Musterstadt, SB Dipl.-Ing. Franz Huber
---

# Nachforderung fehlende Unterlagen — Bauantrag BA-2026-031

## 1. Aktenzeichen und Bezug

**Aktenzeichen:** BA-2026-031
**Eingang Bauantrag:** 20.02.2026
**Antragsteller:** Familie Bergmann, Gartenweg 7, 12345 Musterstadt
**Bevollmaechtigte:** Architekturbuero Waldstein GmbH, Dipl.-Ing. Klara Waldstein
**Bauvorhaben:** Neubau Einfamilienhaus in Holzrahmenbauweise, Gartenweg 9, Flurstueck 188, Gemarkung Musterstadt
**Sachbearbeiterin:** Dipl.-Ing. Eva Neumann, Zimmer 214

## 2. Sachverhalt

Der Bauantrag fuer das oben genannte Vorhaben wurde am 20.02.2026 eingereicht und formell geprueft. Der Bauantrag ist grundsaetzlich vollstaendig in Bezug auf Lageplan, Bauzeichnungen und Begruendung. Bei der inhaltlichen Pruefung der eingereichten Standsicherheits- und Brandschutznachweise wurden jedoch wesentliche Maengel und Luecken festgestellt, die eine abschliessende Bearbeitung des Antrags derzeit nicht ermoeglichen.

Die Bauaufsichtsbehoerde fordert gemaess § 69 Abs. 4 MBO (Musterbauordnung) und § 8 der Bauvorlagenverordnung des Landes die nachfolgend aufgelisteten Unterlagen nach. Die Frist zur Nachreichung betraegt **vier Wochen** ab Zugang dieses Schreibens (Zugang gilt als am dritten Werktag nach Absendung bewirkt).

## 3. Fehlende Unterlagen im Einzelnen

### 3.1 Statischer Nachweis Holzrahmen-Aussenwand

**Was fehlt:** Ein vollstaendiger Standsicherheitsnachweis fuer die tragenden Holzrahmenwaende einschliesslich Windlastabtragsystem fehlt. Die eingereichten Unterlagen enthalten lediglich Regelquerschnitte ohne Bemessung der Anschluesse und ohne Nachweis der Aussteifung in beiden Gebaeudehautachsen.

**Warum erforderlich:** Holzrahmenbauten werden nach Eurocode 5 (DIN EN 1995-1-1) und dem nationalen Anwendungsdokument (NA) bemessen. Ohne vollstaendigen Aussteifungsnachweis kann die Standsicherheit des Gebaeudes nicht beurteilt werden. Besonders bei Bauwerken mit offenen Grundrisszonen (wie hier: rueckwaertiger Bereich mit grossflaechiger Verglasung auf 6 m Breite) ist der Windlastnachweis kritisch.

**Rechtsgrundlage:** § 12 MBO (Standsicherheit), § 8 Abs. 2 Nr. 8 BauVorlVO

### 3.2 Detailzeichnungen Wandfusspunktanschluesse

**Was fehlt:** Massstaebliche Detailzeichnungen (mindestens M 1:10) der Anschluesse der Holzrahmenwaende an die Betonbodenplatte. Insbesondere fehlten Angaben zum konstruktiven Holzschutz (Abstand Holz-Unterkante zu Gelaeinde bzw. Betonoberflaehe), zur Kapillarsperre und zur Verankerung der Grundschwelle.

**Warum erforderlich:** Der Wandfusspunkt ist die haeufigste Schadensursache bei Holzrahmenbauten. Feuchtigkeit, die von der Betonplatte aufsteigt, kann ohne Kapillarsperre und ausreichenden Abstand zu Schaeden durch Holzfaeulnis fuehren (Gefaehrdungsklasse GK 2 nach DIN 68800-1). Die Detailzeichnung ist zur Beurteilung des konstruktiven Holzschutzes unabdingbar.

**Rechtsgrundlage:** § 8 Abs. 2 Nr. 9 BauVorlVO, DIN 68800-2 (Bauliche Massnahmen)

### 3.3 Nachweis Holzfeuchte und Holzqualitaet

**Was fehlt:** Angaben zur vorgesehenen Holzfeuchte zum Einbauzeitpunkt fehlen. Es ist nicht erkennbar, ob KVH (Konstruktionsvollholz) oder BSH (Brettschichtholz) verwendet wird und welche Sortierklasse nach DIN 4074 vorgesehen ist.

**Warum erforderlich:** Die Holzfeuchte zum Einbauzeitpunkt beeinflusst massgeblich das Schwindmass und damit die spaetere Massgenauigkeit der Konstruktion. DIN 68800-2 fordert fuer eingebautes Holz in Innenraeumen eine Holzfeuchte von <= 20 Prozent. Bauholz mit zu hoher Feuchte fuehrt nach dem Austrocknen zu Rissen, Verformungen und moeglichen Kraftumlagerungen in der Konstruktion.

**Rechtsgrundlage:** DIN EN 1995-1-1 Abschnitt 3.2, DIN 68800-1

### 3.4 Brandschutznachweis fuer tragende Holzbauteile

**Was fehlt:** Der eingereichte Brandschutznachweis enthaelt keine Nachweise fuer die Feuerwiderstandsdauer der tragenden Holzbauteile. Stuetzen, Traufpfetten und Deckentraeger fehlen in der Brandschutzbemessung vollstaendig.

**Warum erforderlich:** Tragende Holzbauteile muessen im Brandfall eine ausreichende Standsicherheit fuer die Raeumungszeit der Bewohner gewaehrleisten. Fuer freistehende Einfamilienhaeuser (GK 1) ist nach MBO eine Feuerwiderstandsdauer von 30 Minuten (F30-B) fuer tragende Bauteile nachzuweisen. Der Nachweis kann durch "Abbrennrate" (DIN EN 1995-1-2, Charring-Rate-Verfahren) oder durch ausreichende Bekleidung (Kapselklasse K2 60) gefuehrt werden.

**Rechtsgrundlage:** § 26 MBO, DIN EN 1995-1-2 (Eurocode 5 Brandschutz)

### 3.5 Energieausweis und Waermeschutznachweis

**Was fehlt:** Ein Nachweis nach dem Gebaeudeenergiegesetz (GEG 2024) in Form eines Bedarfsausweises liegt nicht vor. Die angegebenen Wandaufbauten (U-Wert-Angaben fehlen in 3 von 6 Bauteilen) sind unvollstaendig.

**Warum erforderlich:** Seit dem GEG 2024 sind alle Neubauten als "Niedrigenergiehaeuser" zu errichten. Der Nachweis ist vor Baubeginn der Bauaufsichtsbehoerde vorzulegen (§ 74 GEG). Ohne vollstaendigen Waermeschutznachweis kann keine Baugenehmigung erteilt werden.

**Rechtsgrundlage:** §§ 10, 15, 74 GEG 2024

### 3.6 Baugrundgutachten fuer Gruendung

**Was fehlt:** Die Bodenverhaeltnisse am Baugrundstuck sind nicht durch ein geotechnisches Gutachten (Baugrundgutachten) belegt. Das Grundstueck liegt laut Kataster im Bereich einer historischen Auffuellung (ehemalige Kiesgrube, aufgefuellt ca. 1960).

**Warum erforderlich:** Bei unbekannten oder problematischen Baugrundverhaeltnissen (insbes. Auffuellungen) ist die Tragfaehigkeit des Baugrundes nachzuweisen. Differenzsetzungen koennen bei Holzbauten wegen der relativen Steifigkeit zu erheblichen Schaeden fuehren. Das Gutachten muss Angaben zu Schichtfolge, Tragfaehigkeit, Setzungsverhalten und Gruendungsempfehlung enthalten (DIN EN 1997-1, Geotechnische Kategorie 2).

**Rechtsgrundlage:** § 18 MBO, DIN EN 1997-1 (Eurocode 7)

## 4. Frist und Hinweis auf Folgen

Die angeforderten Unterlagen sind bis spaetestens **18. April 2026** bei der Bauaufsichtsbehoerde einzureichen. Bei vollstaendiger Nachreichung wird das Verfahren unverzueglich fortgefuehrt. Sollten die Unterlagen nicht fristgerecht und vollstaendig eingehen, wird der Bauantrag gemaess § 69 Abs. 4 Satz 3 MBO als zurueckgenommen behandelt. Die Antragsgebuehr (1.200 EUR, gemaess Gebuehrenordnung Abschnitt 4.1) wird in diesem Fall einbehalten.

Bei Fragen stehen Ihnen Frau Neumann (Tel. 0123/4567-214, eva.neumann@musterstadt.de) und das Sachgebiet Tragwerksplanung (Herr Huber, Tel. -218) gerne zur Verfuegung.

## 5. Rechtsbehelfsbelehrung

Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Widerspruch bei der Bauaufsichtsbehoerde der Stadt Musterstadt, Stadthaus, Rathausplatz 1, 12345 Musterstadt, eingelegt werden.

Musterstadt, den 18.03.2026

_Dipl.-Ing. Franz Huber, Sachgebietsleiter Tragwerksplanung, Bauaufsichtsbehoerde Musterstadt_

## Zusammenfassung in einfacher Sprache

Fuer den Bauantrag eines Holzhauses in der Gartenweg 9 fehlen noch wichtige technische Unterlagen. Die Baubehoerde kann den Antrag erst bearbeiten, wenn diese nachgereicht wurden. Konkret fehlen: ein vollstaendiger Statik-Nachweis fuer die Holzwaende, genaue Zeichnungen wie das Holz an der Betonplatte befestigt wird, Angaben zur Qualitaet des Bauholzes, ein Brandschutz-Nachweis fuer die tragenden Holzteile, ein Energieausweis nach aktuellem Gesetz sowie ein Bodengutachten, da das Grundstueck frueher eine Kiesgrube war. Alle Unterlagen muessen bis zum 18. April 2026 eingereicht werden. Wer die Frist verpasst, muss einen neuen Bauantrag stellen.`,
  },
  {
    name: 'Energieberatung_Waermepumpe.md',
    content: `---
titel: Energieberatungsbericht Heizungsmodernisierung Schulstrasse 3
aktenzeichen: EB-2026-044
datum: 2026-01-28
ersteller: Ingenieurbuero fuer Energieeffizienz Wagner, Dr.-Ing. Sabine Wagner
---

# Energieberatungsbericht — Heizungsmodernisierung Schulstrasse 3

## 1. Auftraggeber und Gebaeudeerfassung

**Auftraggeber:** Eheleute Karl und Maria Hoffmann, Schulstrasse 3, 12345 Musterstadt
**Beraterin:** Dr.-Ing. Sabine Wagner, Ingenieurbuero fuer Energieeffizienz Wagner
**Foerdergrundlage:** BAFA-geforderter Energieberatungsbericht (BEG EM, "Bundesfoerderung effiziente Gebaeude — Einzelmassnahmen")
**Datum der Begehung:** 22.01.2026

### 1.1 Gebaeudebasisdaten

| Merkmal | Wert |
|---------|------|
| Gebaeudetyp | Freistehendes Einfamilienhaus |
| Baujahr | 1972 |
| Wohnflaeche | 148 m² (EG + OG, bewohnt) |
| Keller | Nicht beheizter Keller, d = 2,5 m unter Gelaende |
| Geschosse | EG + OG + ausgebautes DG (teilbeheizt) |
| Bauweise | Massivbau, Ziegelmauerwerk 30 cm ohne Daemmung |
| Bewohner | 2 Erwachsene |
| Heizsystem Ist | Gas-Niedertemperaturkessel Buderus G225 (1998), 22 kW Nennleistung |
| Warmwasser Ist | Bereitung ueber Heizkessel mit 120-l-Speicher |
| Jahresheizwaermebedarf (gemessen) | ca. 26.800 kWh/a (Abrechnung 2023/24) |
| Spezifischer Heizwaermebedarf | ca. 181 kWh/(m²·a) |

Das Gebaeude entspricht dem typischen Energiestandard der fruehen 1970er-Jahre: keine Fassadendaemmung, Kastenfenster wurden 2005 gegen Waermeschutzverglasungen (2-fach, Uw ca. 1,8 W/(m²K)) ausgetauscht, Kellerdecke nicht gedaemmt, Dachschraegen teilweise mit 60 mm Zwischensparrendaemmung (Mineralwolle, eingebaut 2010).

## 2. Ist-Zustand Gebaeudehuelle

| Bauteil | Aufbau | U-Wert Ist | U-Wert GEG-Referenz |
|---------|--------|------------|---------------------|
| Aussenwand | Ziegel 30 cm, Innenputz 15 mm | 1,32 W/(m²K) | 0,24 W/(m²K) |
| Dachschraege | Zwischensparrendbaeaem. 60 mm MW | 0,41 W/(m²K) | 0,24 W/(m²K) |
| Kellerdecke | Betondecke 18 cm, ungedaemmt | 1,60 W/(m²K) | 0,30 W/(m²K) |
| Fenster | 2-fach-Waermeschutzglas (2005) | 1,80 W/(m²K) | 1,30 W/(m²K) |
| Aussentuer | Holz, teilgedaemmt | 1,90 W/(m²K) | 1,80 W/(m²K) |

Der Transmissionswaermeverlust der Gebaeudehuelle betraegt Ht' = 0,87 W/(m²K) und ueberschreitet den GEG-Referenzwert fuer Altbauten (0,50 W/(m²K) fuer sanierte Altbauten) erheblich.

## 3. Empfohlene Modernisierungsmassnahmen

Die Beraterin empfiehlt ein schrittweises Sanierungsprogramm in zwei Phasen.

### Phase 1 (sofortige Empfehlung, Heizung):

**Massnahme H1: Einbau Luft-Wasser-Waermepumpe**

Angesichts des defekten Gaskessels (Brenner erneuert 2021, Gesamtalter 28 Jahre, wirtschaftliche Restnutzungsdauer ueberschritten) wird der Einbau einer Luft-Wasser-Waermepumpe dringend empfohlen.

**Technische Auslegung:**
- Heizlast nach DIN EN 12831: 9,8 kW (berechnet fuer TI = 20 °C, TA,min = -12 °C, bei aktuellem Daemmstand)
- Empfohlenes Geraet: Splitgeraet, Nennwaermeleistung 11 kW bei A7/W35
- Vorlauftemperatur soll auf max. 55 °C begrenzt werden (erfordert Pruefung der Heizkoerperauslegung, ggf. Heizkoerpertausch in 2 Raeumen notwendig)
- Heizwaerme-JAZ (Jahresarbeitszahl) bei Vorlauftemperatur 55 °C: ca. 2,8 (basierend auf Klimadaten DWD-Station Musterstadt, mittlere Aussentemperatur 9,8 °C)
- Warmwasserbereitung: Einbindung in Waermepumpenkreis, Trinkwarmwasserspeicher 200 l mit Legionellenschutzheizung

**Energetische Wirkung (ohne Daemmung, Phase 1 allein):**
- Stromverbrauch Waermepumpe: ca. 26.800 kWh / 2,8 = 9.570 kWh/a
- Strombezugskosten (Waermepumpentarif, angenommen 0,28 EUR/kWh): 2.680 EUR/a
- Bisherige Gaskosten: 26.800 kWh / 11,2 kWh/m³ × 1,08 EUR/m³ = ca. 2.585 EUR/a (Grundgebuehr separat)
- Einsparung Phase 1 allein: ca. 0 EUR/a netto (Einsparung haengt stark vom kuenftigen Strom- und Gaspreis ab)

**Hinweis:** Ohne gleichzeitige Daemmung der Gebaeudehuelle ist die Wirtschaftlichkeit der Waermepumpe allein begrenzt. Die Kombination mit Phase 2 ist daher ausdruecklich empfohlen.

### Phase 2 (empfohlen, Gebaeudehuelle):

**Massnahme D1: Aussenwanddaemmung (WDVS)**

- Systemaufbau: Waermedaemmverbundsystem (WDVS) mit EPS-Hartschaum, d = 160 mm, Reib- und Sockelputz, Edelstahlgewebeschicht, mineralischer Schlussstrich
- U-Wert nach Massnahme: 0,21 W/(m²K) (Anforderung GEG Neubau: 0,24 W/(m²K))
- Heizwaermebedarfsminderung: -7.200 kWh/a (-27 Prozent)

**Massnahme D2: Kellerdeckendaemmung**

- Daemmsystem: Mineralwolledaemmplatten WLG 035, d = 80 mm, Bekleidung mit Gipskarton
- U-Wert nach Massnahme: 0,35 W/(m²K)
- Heizwaermebedarfsminderung: -1.400 kWh/a (-5 Prozent)

**Massnahme D3: Dachschraegendaemmung (Aufstockung)**

- Ergaenzung der bestehenden 60-mm-Zwischensparrendaemmung auf 180 mm Gesamtstaerke (plus 80 mm Untersparrendaemmung)
- U-Wert nach Massnahme: 0,19 W/(m²K)
- Heizwaermebedarfsminderung: -1.800 kWh/a (-7 Prozent)

## 4. Wirtschaftlichkeitsberechnung (Phase 1 + 2 kombiniert)

| Position | Kosten |
|----------|--------|
| Waermepumpe inkl. Einbau, Elektroinstallation, Speicher | 18.500 EUR |
| WDVS Aussenwand (ca. 240 m² Nettofassade) | 19.200 EUR |
| Kellerdeckendaemmung (148 m²) | 4.800 EUR |
| Dachschraege (ca. 90 m² Schraegflaeche) | 5.400 EUR |
| Zwischensumme Investition | **47.900 EUR** |
| BEG EM Foerderung Waermepumpe (30 % + 5 % Effizienzbonus) | -6.475 EUR |
| BEG EM Foerderung Daemmung (15 %) | -4.410 EUR |
| **Nettokosten nach Foerderung** | **37.015 EUR** |

**Energetisches Ergebnis nach Vollsanierung:**
- Neuer Heizwaermebedarf: ca. 16.400 kWh/a (Reduktion um 39 Prozent)
- JAZ Waermepumpe nach Daemmung: ca. 3,4 (niedrigere Vorlauftemperatur moeglich: 45 °C)
- Neuer Stromverbrauch: ca. 4.820 kWh/a
- Neue Heizkosten: ca. 1.350 EUR/a (bei 0,28 EUR/kWh)
- **Jaehrliche Einsparung gegenueber Ist:** ca. 1.235 EUR/a
- **Statische Amortisationszeit (Nettokosten/Einsparung):** ca. 30 Jahre

**Hinweis zur Amortisation:** Bei steigenden Energiepreisen und sinkenden PV-Stromgestehungskosten (Kombination mit 8-kWp-Photovoltaikanlage wird empfohlen) verkuerzt sich die Amortisationszeit erheblich. Die Investition erhoeht den Immobilienwert und verbessert die Energieklasse von G auf B — relevant fuer einen kuenftigen Verkauf.

## 5. Foerdermoeglichkeiten im Detail (Stand Januar 2026)

**BEG EM (Bundesfoerderung effiziente Gebaeude, Einzelmassnahmen):**
- Waermepumpe: Grundfoerderung 30 %, Effizienzbonus +5 % (bei JAZ >= 3,0), Klimabonus +5 % (bei Gasetagenheizung, entfaellt hier), max. foerderbare Kosten 30.000 EUR
- Daemmmassnahmen: 15 %, max. foerderbare Kosten 60.000 EUR
- Antrag ueber BAFA vor Massnahmenbeginn (kein Eigenbau)
- Kumulierbar mit KfW-Kredit (BEG EM Kredit, Zinssatz variabel)

**Steuerbonus (§ 35c EStG):** Alternativ zur BAFA-Foerderung moeglich. 20 Prozent der Massnahmenkosten ueber 3 Jahre von der Einkommensteuer absetzbar (max. 40.000 EUR Gesamtabzug). Bei niedrigem zu versteuernden Einkommen weniger attraktiv als BAFA-Zuschuss.

## Zusammenfassung in einfacher Sprache

Ihr Haus aus dem Jahr 1972 hat noch den alten Daemmstandard und einen veralteten Gaskessel. Wir empfehlen zwei Massnahmen: Erstens den Austausch des Gaskessels gegen eine Waermepumpe — diese holt ihre Heizwaerme guenstig aus der Aussenluft und verbraucht deutlich weniger Energie als eine Gasheizung. Zweitens das Daemmen der Aussenwand, Kellerdecke und des Daches, damit weniger Waerme verloren geht und die Waermepumpe noch effizienter arbeiten kann. Die beiden Massnahmen zusammen kosten rund 48.000 Euro, wovon der Staat etwa 11.000 Euro als Zuschuss uebernimmt. Die Heizkosten sinken danach von rund 2.600 Euro auf rund 1.350 Euro pro Jahr. Ausserdem steigt der Wert Ihres Hauses, und Sie sind weniger abhaengig von Gaspreisschwankungen. Wir raten, mit der Foerderbeantragung beim BAFA vor dem ersten Angebot zu beginnen — der Antrag muss vor Auftragserteilung gestellt sein.`,
  },
  {
    name: 'Protokoll_Baustellenbegehung.md',
    content: `---
titel: Protokoll Baustellenbegehung Kita Sonnenschein Erweiterungsbau
aktenzeichen: BA-2025-088
datum: 2026-03-15
ersteller: Bauaufsichtsbehoerde Musterstadt, Dipl.-Ing. Peter Krause
---

# Protokoll Baustellenbegehung — Kita Sonnenschein Erweiterungsbau

## 1. Begehungsdaten

**Datum:** 15. Maerz 2026, 09:30 Uhr bis 11:45 Uhr
**Anlass:** Regelbegehung im Zuge der Rohbaufertigstellung, Vorbereitung Rohbauabnahme
**Wetter:** 7 °C, leichter Regen, Sicht gut
**Aktenzeichen:** BA-2025-088

## 2. Teilnehmer

| Name | Funktion | Telefon |
|------|----------|---------|
| Dipl.-Ing. Peter Krause | Sachbearbeiter Bauaufsicht Musterstadt | 0123/4567-221 |
| Dipl.-Ing. Anna Lehmann | Objektplanerin, Architekturbuero Lehmann + Partner | 0171/1234567 |
| Polier Stefan Brandt | Bauleiter vor Ort, Baufirma Meister GmbH | 0160/9876543 |
| Dipl.-Ing. Carsten Vogt | Tragwerksplaner, Ingenieurbuero Vogt | 0174/5678901 |

## 3. Bautenstand Rohbau

### 3.1 Betonkonstruktion

Der Rohbau des Erweiterungsbaus (1-geschossig, Grundflaeche 22 m × 14 m, Flachdach) ist weitgehend fertiggestellt. Folgende Arbeiten wurden als abgeschlossen festgestellt:

- Bodenplatte (Stahlbeton C25/30, d = 20 cm, WU-Beton mit Abdichtung nach WU-Richtlinie)
- Stuetzen (4 Stueck, Stahlbeton C25/30, Querschnitt 30 × 30 cm, Hoehe 3,20 m)
- Ringbalken umlaufend (Stahlbeton C25/30, b/d = 30/30 cm)
- Decke ueber EG (Stahlbeton-Filigrandecke, d = 22 cm, Ueberzug auf Ringbalken)

**Betonqualitaet:** Pruefberichte der Begleitpruefung liegen vor (Wuerfeldruckfestigkeit nach 28 Tagen: 33,5 N/mm² fuer C25/30, Anforderung: >= 33 N/mm² — Nachweis erfuellt). Betonierprotokoll: kein Betonieren bei Frost festgestellt, Frischbetontemperaturen im Protokoll dokumentiert (>= 8 °C).

**Massabweichungen:** Stuetzenfussmass an Stuetze A3 um 18 mm verschoben gegenueber Plan (Achsmass Ist: 5,018 m, Soll: 5,000 m). Abweichung ist nach DIN EN 13670 Klasse 2 (Toleranz +/- 25 mm) noch innerhalb der Toleranz. Tragwerksplaner Vogt hat Abweichung schriftlich als unproblematisch bestaetigt (E-Mail vom 14.03.2026 liegt in der Bauakte).

### 3.2 Mauerwerk

Aussenwandmauerwerk (Planziegel PL 17,5-0,9, d = 24 cm) ist bis Oberkante Ringbalken gemauert. Verbandsausfuehrung entspricht der Planung. Oeffnungen fuer Fenster und Tueren plankonform.

**Mangel M-01:** An der Nordwand Achse 3-5 wurde ein Fugenversatz von 35 mm festgestellt (Lagerfuge nicht waagerecht, visuelle Abweichung deutlich erkennbar). Grenzwert nach DIN EN 1996-2: 10 mm/m. Bei einem Wandabschnitt von 3,5 m entspricht dies 12,5 mm/m — Grenzwert ueberschritten. Beseitigung erforderlich (Beurteilung durch Tragwerksplaner, ob Ausbesserung oder Abbruch/Neumauerung).

## 4. Brandschutzpruefung

### 4.1 Brandwand zur Bestandsstruktur

Die Brandwand (REI 90-M nach MBO § 29) zwischen Erweiterungsbau und Bestandsgebaeude der Kita (Baujahr 1994) wurde geprueft.

**Feststellung:** Die Wandstaerke von 24 cm Planziegel mit beidseitigem Putz ist plankonform ausgefuehrt. Die Brandwand ist mindestens 0,50 m ueber Dachoberflaechenbekleidung hinausgefuehrt worden (Messung: 0,62 m). Alle Oeffnungen in der Brandwand sind mit T-90-Tueren (selbstschliessend, Drehfluegel, zugelassenes Fabrikat Dorma RS78) geplant; Tueren noch nicht eingebaut (Rohbauphase).

**Mangel M-02:** Die Schottungsoeffnungen fuer die geplanten Lueftungsleitungen (3 Stk., DN 250) in der Brandwand sind bereits ausgespart, aber nicht mit zugelassenem Brandschutzabschluss (Brandschutzklappen, Zulassung Z-56.2-...) verschlossen. Diese muessen spaetestens vor der Inbetriebnahme eingebaut und auf Funktion geprueft werden. Fuer die Rohbauabnahme ist eine Auflage mit Nachweis des einzubauenden fabrikats ausreichend.

### 4.2 Brandschutz-Schottungen im Allgemeinen

Leitungsdurchfuehrungen durch Decken und Waende wurden stichprobenartig geprueft. Im Bereich der Heizungsleitungsfuehrung (ELT-Keller-Schacht Achse B/2) wurden 2 Oeffnungen festgestellt, die noch keine zugelassene Schottung aufweisen.

**Mangel M-03:** Zwei Rohrdurchfuehrungen (DN 50 Heizungsruecklauf) durch die Kellerdecke ohne Schottung. Einbau Brandschutzmanschetten (Fa. Hilti, FS-ONE oder gleichwertiges, Zulassung ETA-10/0185) bis zur Inbetriebnahme erforderlich.

## 5. Haustechnik-Vorbereitungen

### 5.1 Lueftungsanlage

Schlitze und Kernbohrungen fuer die Lueftungsanlage (Zentralgeraet, Kanalfuehrung unter Decke) sind ausgespart. Kanalgroessen gemaess Lueftungsplanung vom 10.01.2026. Noch keine Rohinstallation der Lueftungsanlage.

**Hinweis H-01:** Die Deckendurchfuehrung fuer den Aussenluftkanal (400 × 250 mm) an der Ostfassade Achse 5 wurde 120 mm zu hoch ausgespart. Korrektur durch Schliessen mit Betonmoertel und Neuherstellung in plankonformer Position erforderlich. Kein sicherheitsrelevanter Mangel, aber vor Putzarbeiten zu erledigen.

### 5.2 Elektrounterverteilung

Leerrohre fuer Elektroinstallation (ELT) sind verlegt; Unterverteilung-Nische in der Wand Achse C/4 ausgespart (40 × 60 cm, Tiefe 15 cm). Einbau der Unterverteilung durch Elektrounternehmen noch ausstehendd.

### 5.3 Sanitaer

Grundleitungen (Abwasser DN 100/DN 75) im Kiesbett unter der Bodenplatte wurden vor Betonage verlegt; Protokoll des Sanitaerunternehmers vom 12.02.2026 liegt vor (Dichtigkeitspruefung bestanden).

## 6. Arbeitsschutz

### 6.1 Absturzsicherung

**Mangel M-04 (sofortiger Handlungsbedarf):** Der Flachdachrand ist an der Nordseite (Laenge 22 m) ohne Absturzsicherung zugaenglich. Arbeiter der Sanitaerfirma und des Dachdeckers waren zum Zeitpunkt der Begehung auf dem Dach taetig. Absturzkante ist 4,20 m ueber Gelaeinde. Nach DGUV Vorschrift 38 (Bauarbeiten) ist bei Absturzhoehen > 2 m eine zugelassene Absturzsicherung (Gelaender nach DIN EN 13374 Klasse A oder B, oder Fanggeruest) anzubringen.

**Anforderung: Sofortige Wirkung — Arbeiten auf dem Dach sind bis zur Anbringung einer ordnungsgemaessen Absturzsicherung einzustellen.**

### 6.2 Persoenliche Schutzausruestung

Bei 4 von 6 anwesenden Arbeitern der Zimmererfirma fehlte das Tragen von Schutzhelmen. Polier Brandt wurde darauf hingewiesen; Helmpflicht auf der Baustelle ist im Bauschildaushang ausgewiesen und muss durchgesetzt werden.

### 6.3 Baustellenordnung

Erste-Hilfe-Kasten: vorhanden und zulaessiges Verfallsdatum. Notfallplan: ausgehaengt. Sanitaercontainer: vorhanden. Zufahrtsweg: ordnungsgemaess befestigt und beschildert.

## 7. Offene Punkte und Massnahmenplan

| Nr. | Mangel/Hinweis | Massnahme | Frist | Verantwortlich |
|-----|---------------|-----------|-------|----------------|
| M-01 | Fugenversatz Nordwand | Beurteilung durch TWP, Entscheidung Ausbesserung/Abbruch | 25.03.2026 | Polier Brandt / TWP Vogt |
| M-02 | Lueftungsschottungen Brandwand | Fabrikat Brandschutzklappen benennen + bestellen | 28.03.2026 | OPlanerin Lehmann |
| M-03 | Rohrdurchfuehrungen ohne Schottung | Brandschutzmanschetten einbauen | vor Inbetriebnahme | Sanitaerfirma |
| M-04 | Absturzsicherung Flachdachrand | Sofortmassnahme Gelaender/Absperring | **sofort** | Polier Brandt |
| H-01 | Deckendurchfuehrung Aussenluft zu hoch | Schliessen + Neuherstellen vor Putz | 15.04.2026 | Polier Brandt |

## 8. Naechster Termin

Naechste Begehung: **18. April 2026, 09:00 Uhr**, Anlass: Pruefung Beseitigung Maengel M-01 bis M-04 und Beginn Innenputzarbeiten. Teilnahme des Tragwerksplaners nur bei Entscheidung M-01 erforderlich.

## 9. Verteiler

- Bauaufsichtsbehoerde Musterstadt (Originalprotokoll, Akte BA-2025-088)
- Architekturbuero Lehmann + Partner (Frau Lehmann)
- Baufirma Meister GmbH (Polier Brandt, Geschaeftsfuehrung)
- Ingenieurbuero Vogt (Herr Vogt)
- Stadtamt fuer Kindertageseinrichtungen Musterstadt (zur Information)

Musterstadt, den 15.03.2026

_Dipl.-Ing. Peter Krause, Bauaufsichtsbehoerde Musterstadt_

## Zusammenfassung in einfacher Sprache

Bei der Baustellenbesichtigung des neuen Kita-Anbaus am 15. Maerz 2026 war der Rohbau weitgehend fertig. Beton und Mauerwerk sind grossteils in Ordnung, aber es wurden vier Maengel gefunden: An einer Wand ist das Mauerwerk schief gesetzt und muss beurteilt werden. In der Brandwand fehlen noch die vorgeschriebenen feuerfesten Abschluesse fuer Lueftungsrohre. Zwei Heizungsrohre durch die Kellerdecke sind noch nicht feuerfest verschlossen. Am wichtigsten: Der Dachrand hat keine Absturzsicherung, obwohl Handwerker oben arbeiten — das muss sofort behoben werden, sonst darf nicht weitergearbeitet werden. Alle Maengel wurden dem Bauleiter mitgeteilt mit klaren Fristen. Die naechste Begehung ist am 18. April 2026.`,
  },
];

export async function downloadExampleDocs(): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const doc of EXAMPLES) {
    zip.file(doc.name, doc.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TeamFlow-Beispieldokumente.zip';
  a.click();
  URL.revokeObjectURL(url);
}
