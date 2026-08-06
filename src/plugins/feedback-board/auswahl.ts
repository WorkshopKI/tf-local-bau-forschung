/**
 * Mehrfachauswahl des Boards (v3.18) — rein, damit die Regeln testbar sind.
 *
 * Die Auswahl lebt als Menge von Ticket-Ids und ist bewusst NICHT persistiert:
 * sie gehört zu einem Arbeitsgang, nicht zu einer Sitzung. Beim Wechsel von
 * Sicht oder Filter wird sie auf das eingeschränkt, was noch sichtbar ist —
 * sonst änderte die Bulk-Leiste Tickets, die niemand mehr vor sich hat.
 */
export type Auswahl = ReadonlySet<string>;

export const LEERE_AUSWAHL: Auswahl = new Set<string>();

export function istGewaehlt(auswahl: Auswahl, id: string): boolean {
  return auswahl.has(id);
}

/** Ein Ticket dazu oder weg. */
export function schalte(auswahl: Auswahl, id: string): Auswahl {
  const next = new Set(auswahl);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Auf die sichtbaren Tickets eindampfen. Liefert die EINGABE zurück, wenn sich
 * nichts ändert — sonst entstünde bei jedem Render eine neue Menge und damit
 * eine Endlosschleife im Effekt, der das aufruft.
 */
export function beschraenkeAuf(auswahl: Auswahl, sichtbareIds: readonly string[]): Auswahl {
  if (auswahl.size === 0) return auswahl;
  const sichtbar = new Set(sichtbareIds);
  let entfernt = false;
  const next = new Set<string>();
  for (const id of auswahl) {
    if (sichtbar.has(id)) next.add(id);
    else entfernt = true;
  }
  return entfernt ? next : auswahl;
}

/** Alle sichtbaren dazu — oder alles weg, wenn schon alles gewählt ist. */
export function schalteAlle(auswahl: Auswahl, sichtbareIds: readonly string[]): Auswahl {
  const alleGewaehlt = sichtbareIds.length > 0 && sichtbareIds.every(id => auswahl.has(id));
  return alleGewaehlt ? LEERE_AUSWAHL : new Set(sichtbareIds);
}

/**
 * Was eine Ziehbewegung bewegt: ist die gezogene Karte Teil der Auswahl, wandert
 * die ganze Auswahl mit. Ist sie es nicht, wandert nur sie — die Auswahl bleibt
 * unberührt. Alles andere überrascht: wer eine unmarkierte Karte zieht, meint sie.
 */
export function zuBewegen(auswahl: Auswahl, gezogeneId: string): string[] {
  return auswahl.has(gezogeneId) ? [...auswahl] : [gezogeneId];
}
