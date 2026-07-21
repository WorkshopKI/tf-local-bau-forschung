/**
 * Gruppierung der Prüfkriterien für die Anzeige.
 *
 * Rein. Die Zählweise folgt exakt `bewerte()`: gezählt werden nur ANWENDBARE
 * Items, und „erledigt" ist, was nicht in `ergebnis.offen` steht. Damit kann
 * die Summe der Gruppenzähler nie vom Gesamtfortschritt abweichen — genau
 * dieses Auseinanderlaufen zweier Zählungen ist im Design-Prototyp der Grund,
 * warum die Bewertung nie fertig wurde.
 */
import type { MapBewertungsErgebnis } from '../checkliste/bewertung';

export interface GruppenFortschritt {
  gruppe: string;
  erledigt: number;
  /** Anzahl anwendbarer Items — nicht anwendbare zählen nirgends mit. */
  gesamt: number;
}

export function baueGruppenFortschritt(
  ergebnis: MapBewertungsErgebnis,
): GruppenFortschritt[] {
  const offen = new Set(ergebnis.offen);
  const reihenfolge: string[] = [];
  const je = new Map<string, GruppenFortschritt>();

  for (const z of ergebnis.zustaende) {
    const gruppe = z.item.gruppe;
    if (!je.has(gruppe)) {
      je.set(gruppe, { gruppe, erledigt: 0, gesamt: 0 });
      reihenfolge.push(gruppe);
    }
    if (!z.anwendbar) continue;

    const eintrag = je.get(gruppe)!;
    eintrag.gesamt += 1;
    if (!offen.has(z.item.id)) eintrag.erledigt += 1;
  }

  return reihenfolge.map(g => je.get(g)!);
}
