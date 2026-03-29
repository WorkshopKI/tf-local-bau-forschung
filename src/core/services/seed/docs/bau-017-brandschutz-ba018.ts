import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-017',
  filename: 'Brandschutz_BA018.md',
  format: 'md',
  tags: ['Brandschutz', 'Senioren', 'Evakuierung'],
  created: '2026-02-19T10:00:00Z',
  vorgangId: 'BA-2026-018',
  markdown: `---
titel: Brandschutzkonzept Seniorenwohnanlage Kirchplatz 11
aktenzeichen: BA-2026-018
datum: 2026-02-19
ersteller: Brandschutz-Ingenieure Müller + Schmidt PartG
---

# Brandschutzkonzept — Seniorenwohnanlage Kirchplatz 11

## 1. Schutzziele und besondere Personengruppe

Die Seniorenwohnanlage Kirchplatz 11 beherbergt ältere Menschen mit eingeschränkter Mobilität, die sich im Brandfall nicht eigenständig retten können. Viele Bewohner nutzen Rollatoren oder Rollstühle, einige sind bettlägerig. Die Tagespflege im Erdgeschoss betreut zusätzlich 12 pflegebedürftige Personen. Das Brandschutzkonzept muss daher von einer verlängerten Räumungszeit ausgehen — die vertikale Evakuierung über Treppen ist für einen Großteil der Bewohner nicht oder nur mit erheblicher Hilfe möglich. Das Konzept basiert daher primär auf dem Prinzip der horizontalen Evakuierung: Bewohner werden zunächst horizontal in den benachbarten Brandabschnitt auf demselben Geschoss gebracht (Defend-in-Place-Strategie), wo sie vor Feuer und Rauch geschützt sind, bis die Feuerwehr eintrifft und bei Bedarf die vertikale Evakuierung durchführt.

Die Gebäudeklasse ist 4 (Oberkante Fußboden oberstes Geschoss bei 7,20 m über Gelände). Die Anforderungen an die Feuerwiderstandsdauer werden gegenüber der Standardanforderung (REI 60 für GK4) auf REI 90 angehoben, um die verlängerte Räumungszeit zu kompensieren. Diese Verschärfung wird als Kompensationsmaßnahme für die eingeschränkte Selbstrettungsfähigkeit der Bewohner festgelegt und im Brandschutzkonzept als verbindliche Auflage dokumentiert.

## 2. Brandabschnitte und horizontale Evakuierung

### 2.1 Geschossweise Brandabschnittsbildung

Jedes Geschoss wird durch eine Brandwand in zwei gleichgroße Brandabschnitte (je 12 Wohneinheiten) geteilt. Die Brandwand ist als Stahlbetonwand d = 20 cm (REI 90-M, nichtbrennbar) ausgeführt und erstreckt sich über die gesamte Gebäudebreite. Die Öffnung in der Brandwand wird durch eine zweiflügelige Rauchschutztür T30-RS (2 × 1,10 m, Gesamtbreite 2,20 m — ausreichend für Krankenbett-Transport) verschlossen. Die Tür steht im Normalbetrieb offen (Feststellanlage mit Rauchschalter) und schließt automatisch bei Rauchdetektierung. Der Türschließer ist gedämpft und schließt die Tür in 8 Sekunden (langsam genug, um Bewohner nicht einzuklemmen). Die Tür hat keine Schwelle (Nullschwelle) und keine Anschlagstufe, um die barrierefreie Passage mit Rollstuhl und Krankenbett zu gewährleisten.

### 2.2 Horizontale Evakuierung

Im Brandfall werden die Bewohner des betroffenen Brandabschnitts durch das Pflegepersonal in den gegenüberliegenden Brandabschnitt gebracht. Die Flurbreite beträgt 2,00 m (Mindestbreite für Begegnungsverkehr Krankenbett/Rollstuhl nach DIN 18040-2). Die Evakuierungszeit für 12 Bewohner durch 3 Pflegekräfte (Nachtbesetzung) wird auf 8 Minuten geschätzt (je Bewohner 40 Sekunden für rollstuhlfähige Personen, je Bewohner 2 Minuten für bettlägerige Personen mit Rettungstuch). Die Brandwand und die Rauchschutztür gewährleisten mindestens 30 Minuten Schutz vor Rauch und 90 Minuten Schutz vor Feuer — die Evakuierungszeit von 8 Minuten wird mit großer Sicherheitsreserve eingehalten.

Der aufnehmende Brandabschnitt hat ausreichend Platz, um die evakuierten Bewohner aufzunehmen: Der Gemeinschaftsflur (2,00 m × 24 m = 48 m²) und der Gemeinschaftsraum (je Brandabschnitt ein Aufenthaltsraum mit 30 m²) bieten zusammen 78 m² Fläche für maximal 12 zusätzliche Personen. Die vertikale Evakuierung über die Aufzüge im Feuerwehrbetrieb oder die Treppenräume erfolgt erst, wenn die Feuerwehr vor Ort ist und die Evakuierung koordiniert.

## 3. Alarmierungskonzept

### 3.1 Stille Alarmierung des Personals

Das Alarmierungskonzept ist zweistufig: (1) Stille Alarmierung des Pflegepersonals über Funkpieper (DECT-Telefone mit Alarmmeldung) unmittelbar nach Auslösung der Brandmeldeanlage. Die Pieper zeigen den Brandort (Geschoss und Brandabschnitt) an und vibrieren gleichzeitig. (2) Allgemeiner Hausalarm frühestens 3 Minuten nach der stillen Alarmierung ODER bei manueller Auslösung durch das Personal über die Brandmeldezentrale. Der zeitliche Vorlauf gibt dem Personal die Möglichkeit, den Brandort zu erkunden, erste Löschmaßnahmen einzuleiten und die Evakuierung vorzubereiten, BEVOR die Bewohner durch den Hausalarm verunsichert werden.

Die Begründung für die verzögerte Hausalarmierung: Ältere und demente Bewohner reagieren auf laute Alarmsignale häufig mit Angst, Verwirrung oder Erstarren. Eine sofortige Hausalarmierung ohne begleitende Betreuung durch Personal kann zu gefährlichen Situationen führen (Stürze, Panikreaktionen, Orientierungsverlust). Die 3-Minuten-Verzögerung ist mit der Feuerwehr und der Bauaufsichtsbehörde abgestimmt und wird als Kompensationsmaßnahme durch die Vollschutz-BMA und die Pieper-Alarmierung gerechtfertigt.

### 3.2 Hausalarm

Der Hausalarm besteht aus einer akustischen Komponente (Sprache über die hausinterne Sprechanlage: beruhigende Durchsage mit konkreten Handlungsanweisungen, nicht Sirenenton) und einer optischen Komponente (Blitzleuchten in den Fluren und Gemeinschaftsräumen, da viele Bewohner höreingeschränkt sind). Die Alarmierung der Feuerwehr erfolgt gleichzeitig mit der stillen Alarmierung des Personals (keine Verzögerung der Feuerwehr-Alarmierung).

## 4. Brandmeldeanlage

Die BMA wird als Kategorie-1-Anlage (Vollschutz) nach DIN 14675 ausgeführt. Automatische Rauchmelder in allen Räumen einschließlich der Bewohner-Wohnungen (hier: vernetzte Rauchwarnmelder nach DIN 14676 Typ C mit Aufschaltung auf die BMA — der Bewohner kann den Melder nicht eigenständig deaktivieren). In der Großküche der Tagespflege: Mehrkriterien-Melder (optisch-thermisch). In der Waschküche: Wärmemelder (Fehlalarmsicherheit gegen Wasserdampf). Die BMZ befindet sich am Empfang im Erdgeschoss (24/7 besetzt). FBF, FAT und Laufkarten für die Feuerwehr hängen neben der BMZ. Ein FSD Klasse 3 ist am Haupteingang installiert.

## 5. Aufzüge und vertikale Evakuierung

Die beiden Aufzüge sind für den Feuerwehrbetrieb nach DIN EN 81-72 ausgerüstet. Im Brandfall fahren die Aufzüge auf Befehl der Feuerwehr einzelne Geschosse an und transportieren bettlägerige oder schwerstmobilitätseingeschränkte Bewohner ins Erdgeschoss. Die Aufzugskabinen haben die Abmessungen 1,40 m × 2,10 m (Krankentragengröße) und eine Tragfähigkeit von 1.600 kg (entspricht 2 Krankenbetten mit Begleitperson). Die Aufzugsschächte sind eigene Brandabschnitte (Schachtwände EI 90, Schachttüren EI 60-C). Die Stromversorgung der Aufzüge ist über das Notstromaggregat (80 kVA, Diesel) für mindestens 72 Stunden gesichert. Die Aufzüge verfügen über eine Raucherkennung im Schacht und in der Vorzone — bei Rauch im Schacht wird der Aufzug automatisch stillgesetzt und darf nur im Feuerwehrbetrieb wieder in Betrieb genommen werden.

Evakuierungsstühle (2 Stück je Geschoss, Modell Evacu-Trac CD7, Tragfähigkeit 182 kg) stehen in den Treppenräumen für die Evakuierung über Treppen bereit. Die Evakuierungsstühle gleiten kontrolliert über die Treppenstufen (Raupen-/Gleitsystem, Geschwindigkeit 0,5 m/s, eine Begleitperson). Rettungstücher (Ski-Pad-Typ, 3 Stück je Geschoss) liegen in den Brandschutzschränken in den Fluren bereit und ermöglichen den schnellen Transport bettlägeriger Bewohner über den Flur in den sicheren Brandabschnitt. Das Pflegepersonal wird halbjährlich in der Anwendung aller Evakuierungshilfsmittel geschult.

## 6. Bauliche Brandschutzmaßnahmen

Die tragenden und aussteifenden Bauteile (Stahlbetonwände, Decken, Stützen) erfüllen die Feuerwiderstandsklasse REI 90 (erhöht gegenüber GK4-Standard REI 60). Die Installationsschächte werden in jedem Geschoss durch Brandschutzabschottungen EI 90 unterteilt. Die Deckenabhängungen in den Fluren sind aus nichtbrennbarem Material (Metallkassetten, A1) und bilden keine zusätzliche Brandlast. Der Fußbodenbelag in den Fluren ist PVC mit schwerentflammbarer Bewertung (Bfl-s1). Die Wohnungseingangstüren sind als T30-RS ausgeführt und verfügen über einen Freilauftürschließer, der die Tür im Normalbetrieb offenhält (zur Aufsicht durch das Personal) und im Brandfall selbsttätig schließt.

Die Rauchableitung in den Treppenräumen erfolgt über Rauchableitungsöffnungen im Dach (1,0 m² je Treppenraum, automatische und manuelle Auslösung). Die Flure erhalten eine Rauchfreihaltung über natürliche Lüftungsöffnungen an den Flurenden (je 1,5 m², automatisch öffnend bei Raucherkennung). Der Schallschutznachweis und der energetische Nachweis liegen als separate Anlagen bei.

Musterstadt, den 19.02.2026

_Dipl.-Ing. Sabine Müller, Brandschutz-Ingenieurin (VBI)_`,
};
