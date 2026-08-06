/**
 * Die Suche des Glossars: Einträge rein, gefilterte Gruppen raus. Rein — keine
 * IndexedDB, kein React, node-testbar.
 *
 * **Eine Liste, vier Arten.** Wer „ABB" eintippt, weiß nicht, ob das eine
 * Abkürzung, ein Kürzel oder ein Statuswert ist — genau deshalb schlägt er nach.
 * Die Suche greift darum über alles und sortiert das Ergebnis erst danach nach
 * Art, mit einem Zähler je Gruppe.
 */
import type { GlossarBegriff } from '@/core/glossar';

/** Die Arten von Einträgen, in der Reihenfolge, in der sie in der Liste stehen. */
export type GlossarArt = 'begriff' | 'statuswert' | 'kuerzel' | 'regel';

export const ART_REIHENFOLGE: readonly GlossarArt[] = [
  'begriff', 'statuswert', 'kuerzel', 'regel',
];

export const ART_LABEL: Record<GlossarArt, string> = {
  begriff: 'Abkürzungen & Begriffe',
  statuswert: 'Statuswerte',
  kuerzel: 'Kürzel',
  regel: 'To-do-Regeln',
};

interface Basis {
  /** Eindeutig ÜBER die Arten hinweg (`begriff:nf`, `statuswert:34`). */
  id: string;
  /** Die fette Zeile in der Liste. */
  titel: string;
  /** Die Zeile darunter — kurz, sonst trägt die schmale Spalte sie nicht. */
  unter: string;
  /**
   * Worauf die Suche greift. Vorberechnet und klein geschrieben: die Liste
   * filtert bei jedem Tastendruck über den ganzen Bestand.
   */
  suchtext: string;
}

export type GlossarEintrag = Basis & { art: 'begriff'; begriff: GlossarBegriff };

export interface GlossarGruppe {
  art: GlossarArt;
  label: string;
  eintraege: GlossarEintrag[];
}

/** Ein Seed-Begriff als Listeneintrag. */
export function begriffAlsEintrag(b: GlossarBegriff): GlossarEintrag {
  return {
    art: 'begriff',
    id: `begriff:${b.id}`,
    titel: b.begriff,
    unter: b.lang ?? b.erklaerung,
    suchtext: `${b.begriff} ${b.lang ?? ''} ${b.erklaerung}`.toLowerCase(),
    begriff: b,
  };
}

/**
 * Trefferwertung: Wer „NF" tippt, will den Eintrag NF oben sehen, nicht die
 * sieben Erklärungen, in denen das Wort vorkommt.
 *
 * 0 = der Titel IST die Eingabe · 1 = Titel beginnt damit · 2 = Titel enthält es
 * · 3 = nur der Fließtext.
 */
export function rang(e: GlossarEintrag, q: string): number {
  const titel = e.titel.toLowerCase();
  if (titel === q) return 0;
  if (titel.startsWith(q)) return 1;
  if (titel.includes(q)) return 2;
  return 3;
}

/**
 * Alle Einträge, gefiltert und nach Art gruppiert. Leere Gruppen fallen weg —
 * eine Überschrift „Kürzel" über nichts sagt nur, dass etwas fehlt, ohne zu
 * sagen was.
 */
export function gruppiere(
  eintraege: readonly GlossarEintrag[], suche: string,
): GlossarGruppe[] {
  const q = suche.trim().toLowerCase();
  const treffer = q === '' ? [...eintraege] : eintraege.filter(e => e.suchtext.includes(q));

  const gruppen: GlossarGruppe[] = [];
  for (const art of ART_REIHENFOLGE) {
    const eigene = treffer.filter(e => e.art === art);
    if (eigene.length === 0) continue;
    eigene.sort((a, b) => (
      (q === '' ? 0 : rang(a, q) - rang(b, q))
      || a.titel.localeCompare(b.titel, 'de', { numeric: true })
    ));
    gruppen.push({ art, label: ART_LABEL[art], eintraege: eigene });
  }
  return gruppen;
}

/** Wie viele Einträge über alle Gruppen — die Zahl im Seitenkopf. */
export function gesamtZahl(gruppen: readonly GlossarGruppe[]): number {
  return gruppen.reduce((n, g) => n + g.eintraege.length, 0);
}

/** Der gewählte Eintrag, aus den sichtbaren Gruppen abgeleitet statt mitgeführt. */
export function waehleEintrag(
  gruppen: readonly GlossarGruppe[], id: string | null,
): GlossarEintrag | null {
  if (id === null) return null;
  for (const g of gruppen) {
    const t = g.eintraege.find(e => e.id === id);
    if (t) return t;
  }
  return null;
}

/**
 * Die Querverweise eines Begriffs — die eigenen plus die, die AUF ihn zeigen.
 * Einseitig gepflegte Verweise blieben sonst an einer Seite hängen, und welche
 * Richtung jemand beim Schreiben gewählt hat, ist für den Leser belanglos.
 */
export function verwandteIds(
  b: GlossarBegriff, alle: readonly GlossarBegriff[],
): string[] {
  const ids = new Set(b.verwandt ?? []);
  for (const anderer of alle) {
    if (anderer.id !== b.id && (anderer.verwandt ?? []).includes(b.id)) ids.add(anderer.id);
  }
  return [...ids].filter(id => alle.some(a => a.id === id));
}
