/**
 * Wo ein eigenes App-Fenster steht und wie es geöffnet wird — an genau einer
 * Stelle (Guard `no-parallel-fenster-features`).
 *
 * Herkunft: der Geometrie-Block aus `components/help/hilfeFensterDokument.ts`
 * (v2.402, Seiten-Hilfe als eigenes Fenster). Er zog hierher, als das
 * Kanban-Vollbild (v3.47) ein zweites Fenster brauchte — ein zweiter
 * Features-String wäre genau die Doppelung, die dieses Projekt beim Board
 * gerade bezahlt hat (`no-parallel-board-geometry`). Die Hilfe importiert
 * seither von hier; ihre Tests laufen unverändert weiter.
 *
 * Rein: keine IO, kein DOM, kein React — damit unter `environment: 'node'`
 * prüfbar (die Vitest-Suite hat kein jsdom).
 */

export interface Bildschirm {
  availWidth: number;
  availHeight: number;
  availLeft?: number;
  availTop?: number;
}

export interface FensterGeometrie {
  breite: number;
  hoehe: number;
  links: number;
  oben: number;
}

/** Rechts angedockt, volle nutzbare Höhe — die App bleibt links daneben sichtbar. */
export function berechneAngedocktGeometrie(schirm: Bildschirm, breite: number): FensterGeometrie {
  const links0 = schirm.availLeft ?? 0;
  const oben0 = schirm.availTop ?? 0;
  return {
    breite,
    hoehe: Math.max(400, schirm.availHeight - 80),
    links: Math.max(links0, links0 + schirm.availWidth - breite - 24),
    oben: oben0 + 24,
  };
}

/** Boden für die große Form — darunter zeigt ein Kanban keine zwei Bahnen mehr. */
export const GROSS_MIN_BREITE = 900;
export const GROSS_MIN_HOEHE = 600;
/** Anteil der nutzbaren Fläche. Nicht 100 %: ein Fenster ohne sichtbaren Rand
 *  liest sich als Vollbild, und dann sucht man die Schließen-Geste am
 *  Bildschirmrand statt in der Kopfzeile. */
const GROSS_ANTEIL = 0.92;

/**
 * Mittig, fast bildschirmfüllend — die Form für Inhalte, die Platz BRAUCHEN
 * (Kanban-Vollbild). Gegenstück zu `berechneAngedocktGeometrie`, wo die App
 * daneben sichtbar bleiben soll.
 *
 * Der Boden darf die nutzbare Fläche überschreiten: auf einem kleinen Schirm
 * ist ein Fenster, das über den Rand ragt, immer noch besser als eines, in dem
 * die Bahnen nicht nebeneinander passen — der Nutzer kann es verschieben.
 */
export function berechneGrossGeometrie(schirm: Bildschirm): FensterGeometrie {
  const links0 = schirm.availLeft ?? 0;
  const oben0 = schirm.availTop ?? 0;
  const breite = Math.max(GROSS_MIN_BREITE, Math.round(schirm.availWidth * GROSS_ANTEIL));
  const hoehe = Math.max(GROSS_MIN_HOEHE, Math.round(schirm.availHeight * GROSS_ANTEIL));
  return {
    breite,
    hoehe,
    // Nie negativ gegen den Schirm-Ursprung: bei einem Fenster, das breiter ist
    // als die Fläche, säße die linke Kante sonst ausserhalb und die Kopfzeile
    // mit dem Schließen-Knopf wäre nicht erreichbar.
    links: links0 + Math.max(0, Math.round((schirm.availWidth - breite) / 2)),
    oben: oben0 + Math.max(0, Math.round((schirm.availHeight - hoehe) / 2)),
  };
}

/**
 * Features-String für `window.open`. Bewusst OHNE `noopener` — damit wäre das
 * Handle `null` und die gesamte Mechanik tot.
 */
export function fensterFeatures(g: FensterGeometrie): string {
  return `popup=yes,width=${g.breite},height=${g.hoehe},left=${g.links},top=${g.oben},resizable=yes,scrollbars=yes`;
}
