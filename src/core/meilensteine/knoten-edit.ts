/**
 * Reine Baum-Operationen auf der Knotenliste eines Meilenstein-Plans —
 * Datenbasis des Konfigurations-Editors. Kein React, keine IO, keine Uhr:
 * jede Operation nimmt eine Liste und gibt eine neue zurück.
 *
 * Die Liste ist flach (`elternId`), die Ordnung steckt in `sortierung`. Die
 * Anzeige-`nummer` (1 / 1.4 / 1.4.2) wird NICHT von Hand gepflegt, sondern nach
 * jeder Strukturänderung neu aus der Baumposition abgeleitet — von Hand gepflegte
 * Nummern laufen sonst nach der ersten Einfügung auseinander.
 */
import type { MeilensteinKnoten } from './typen';

/** Kinder eines Knotens (`null` = Wurzeln), nach `sortierung` aufsteigend. */
export function kinderVon(
  knoten: readonly MeilensteinKnoten[], elternId: string | null,
): MeilensteinKnoten[] {
  return knoten
    .filter(k => k.elternId === elternId)
    .sort((a, b) => a.sortierung - b.sortierung || a.id.localeCompare(b.id));
}

/**
 * Tiefensuche-Reihenfolge: Eltern vor Kindern, Geschwister nach `sortierung`.
 * Das ist zugleich die Anzeige- und die Speicher-Reihenfolge — so entspricht die
 * gespeicherte Liste immer dem, was die PL gesehen hat.
 */
export function sortiereKnoten(knoten: readonly MeilensteinKnoten[]): MeilensteinKnoten[] {
  const out: MeilensteinKnoten[] = [];
  const besucht = new Set<string>();
  const lauf = (elternId: string | null): void => {
    for (const k of kinderVon(knoten, elternId)) {
      if (besucht.has(k.id)) continue;
      besucht.add(k.id);
      out.push(k);
      lauf(k.id);
    }
  };
  lauf(null);
  // Waisen (Eltern gelöscht o.Ä.) hinten anhängen statt verschwinden lassen.
  for (const k of knoten) if (!besucht.has(k.id)) out.push(k);
  return out;
}

/** Tiefe eines Knotens im Baum (0 = Wurzel). Zyklen-sicher. */
export function tiefeVon(knoten: readonly MeilensteinKnoten[], id: string): number {
  const byId = new Map(knoten.map(k => [k.id, k]));
  const gesehen = new Set<string>([id]);
  let tiefe = 0;
  let cursor = byId.get(id)?.elternId ?? null;
  while (cursor !== null && !gesehen.has(cursor)) {
    gesehen.add(cursor);
    tiefe++;
    cursor = byId.get(cursor)?.elternId ?? null;
  }
  return tiefe;
}

/** Leitet alle Anzeige-Nummern aus der Baumposition ab (1, 1.1, 1.1.1 …). */
export function nummeriereNeu(knoten: readonly MeilensteinKnoten[]): MeilensteinKnoten[] {
  const nummern = new Map<string, string>();
  const lauf = (elternId: string | null, praefix: string): void => {
    kinderVon(knoten, elternId).forEach((k, i) => {
      const nummer = praefix ? `${praefix}.${i + 1}` : String(i + 1);
      nummern.set(k.id, nummer);
      lauf(k.id, nummer);
    });
  };
  lauf(null, '');
  return knoten.map(k => {
    const nummer = nummern.get(k.id);
    return nummer && nummer !== k.nummer ? { ...k, nummer } : k;
  });
}

/** Erste freie ID der Form `mst-nN`. Pur — keine Uhr, kein Zufall. */
export function naechsteKnotenId(knoten: readonly MeilensteinKnoten[]): string {
  const belegt = new Set(knoten.map(k => k.id));
  for (let i = 1; ; i++) {
    const id = `mst-n${i}`;
    if (!belegt.has(id)) return id;
  }
}

/** Ändert genau einen Knoten. Unbekannte ID = No-op (gleiche Referenz). */
export function aendereKnoten(
  knoten: readonly MeilensteinKnoten[], id: string, patch: Partial<MeilensteinKnoten>,
): MeilensteinKnoten[] {
  if (!knoten.some(k => k.id === id)) return knoten as MeilensteinKnoten[];
  return knoten.map(k => (k.id === id ? { ...k, ...patch, id: k.id } : k));
}

/**
 * Neuen Knoten unter `elternId` anhängen. Erbt Soll-Woche und Typ-Filter vom
 * Elternteil — ein Unter-Meilenstein liegt fast nie in einer anderen Woche als
 * sein Sammel-Knoten, und wer ihn dort haben will, ändert eine Zahl statt vier.
 */
export function fuegeKnotenHinzu(
  knoten: readonly MeilensteinKnoten[], elternId: string | null, label = 'Neuer Meilenstein',
): MeilensteinKnoten[] {
  const eltern = elternId === null ? null : knoten.find(k => k.id === elternId) ?? null;
  const geschwister = kinderVon(knoten, elternId);
  const letzter = geschwister.length > 0 ? geschwister[geschwister.length - 1] : undefined;
  const neu: MeilensteinKnoten = {
    id: naechsteKnotenId(knoten),
    elternId,
    nummer: '',
    label,
    sollWoche: eltern?.sollWoche ?? letzter?.sollWoche ?? 1,
    relevantFuerFrist: true,
    nurTypen: eltern ? [...eltern.nurTypen] : [],
    aktiv: true,
    bedingung: { einige: [] },
    sortierung: (letzter?.sortierung ?? 0) + 10,
  };
  return nummeriereNeu([...knoten, neu]);
}

/** Entfernt einen Knoten samt aller Nachfahren. */
export function entferneKnoten(
  knoten: readonly MeilensteinKnoten[], id: string,
): MeilensteinKnoten[] {
  const zuLoeschen = new Set<string>([id]);
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const k of knoten) {
      if (k.elternId !== null && zuLoeschen.has(k.elternId) && !zuLoeschen.has(k.id)) {
        zuLoeschen.add(k.id);
        gewachsen = true;
      }
    }
  }
  return nummeriereNeu(knoten.filter(k => !zuLoeschen.has(k.id)));
}

/** Vertauscht einen Knoten mit seinem Nachbarn. Am Rand ein No-op. */
export function verschiebeKnoten(
  knoten: readonly MeilensteinKnoten[], id: string, richtung: 'hoch' | 'runter',
): MeilensteinKnoten[] {
  const k = knoten.find(x => x.id === id);
  if (!k) return knoten as MeilensteinKnoten[];
  const geschwister = kinderVon(knoten, k.elternId);
  const i = geschwister.findIndex(x => x.id === id);
  const j = richtung === 'hoch' ? i - 1 : i + 1;
  const partner = geschwister[j];
  if (!partner) return knoten as MeilensteinKnoten[];
  return nummeriereNeu(knoten.map(x => {
    if (x.id === k.id) return { ...x, sortierung: partner.sortierung };
    if (x.id === partner.id) return { ...x, sortierung: k.sortierung };
    return x;
  }));
}
