const EXAMPLES: { name: string; content: string }[] = [
  {
    name: 'Gutachten_Schallschutz_MFH.md',
    content: `# Schallschutzgutachten — Mehrfamilienhaus Lindenstrasse 12

## Auftraggeber
Bauherr: Projektgesellschaft Linden GmbH

## Ergebnis
Die Anforderungen an den Luftschallschutz (R'w >= 53 dB) und Trittschallschutz (L'n,w <= 53 dB) zwischen den Wohnungen werden eingehalten.

## Zusammenfassung in einfacher Sprache
In diesem Gutachten wurde geprueft, ob die Waende und Decken des geplanten Mehrfamilienhauses ausreichend vor Laerm schuetzen. Alle gesetzlichen Anforderungen werden erfuellt.`,
  },
  {
    name: 'Stellungnahme_Naturschutz_Bachaue.md',
    content: `# Naturschutzfachliche Stellungnahme — Bebauungsplan Bachaue West

## Behoerde
Untere Naturschutzbehoerde Kreis Musterland

## Auflagen
1. Ein 30 m breiter Gewaesserrandstreifen ist freizuhalten
2. Baufeldraaeumung nur ausserhalb der Brutzeit (Oktober bis Februar)
3. Fuer die Geburtshelferkroete sind drei Ersatzlaichgewaesser anzulegen

## Zusammenfassung in einfacher Sprache
Am geplanten Baugebiet leben geschuetzte Tiere. Die Behoerde erlaubt die Bebauung unter Auflagen: Am Bach muss ein Streifen frei bleiben, gebaut werden darf nur im Winter, und fuer die Kroeten muessen neue Teiche angelegt werden.`,
  },
  {
    name: 'Nachforderung_Statik_Holzbau.md',
    content: `# Nachforderung — Fehlende Unterlagen Bauantrag BA-2026-031

## Fehlende Unterlagen
1. Standsicherheitsnachweis fuer die Holzrahmenwaende
2. Detailzeichnung der Wandfusspunktanschluesse
3. Angabe der Holzfeuchte zum Einbauzeitpunkt
4. Brandschutznachweis fuer die tragenden Holzbauteile

## Zusammenfassung in einfacher Sprache
Fuer den Bauantrag fuer ein Holzhaus fehlen noch technische Unterlagen. Bitte innerhalb von vier Wochen nachreichen.`,
  },
  {
    name: 'Energieberatung_Waermepumpe.md',
    content: `# Energieberatungsbericht — Heizungsmodernisierung Schulstrasse 3

## Empfehlung
Einbau einer Luft-Wasser-Waermepumpe (10 kW) mit Zusatzdaemmung der Aussenwand auf 14 cm. Jaehrliche Heizkosten sinken von 2.800 EUR auf 1.200 EUR. Foerderung bis 40% moeglich.

## Zusammenfassung in einfacher Sprache
Wir empfehlen den Austausch der alten Gasheizung gegen eine Waermepumpe und bessere Daemmung. Die Heizkosten sinken erheblich und der Staat foerdert den Umbau mit bis zu 40%.`,
  },
  {
    name: 'Protokoll_Baustellenbegehung.md',
    content: `# Protokoll Baustellenbegehung — Kita Sonnenschein Erweiterungsbau

## Datum
15. Maerz 2026, 10:00 Uhr

## Feststellungen
Der Rohbau ist fertiggestellt. Betonqualitaet entspricht den Vorgaben (C25/30).

## Offene Punkte
1. Fehlende Absturzsicherung am Flachdachrand (sofort nachrüsten!)
2. Brandschutz-Durchfuehrungen noch nicht geschottet

## Zusammenfassung in einfacher Sprache
Bei der Baustellenbesichtigung des Kita-Anbaus wurde festgestellt, dass der Rohbau gut vorankommt. Zwei wichtige Punkte muessen sofort erledigt werden: Absturzsicherung am Dach und Brandschutzverschluesse in der Wand.`,
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
