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
import type { KuerzelZeile, RegelZeile, StatuswertZeile } from './glossarZeilen';

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

export type GlossarEintrag =
  | (Basis & { art: 'begriff'; begriff: GlossarBegriff })
  | (Basis & { art: 'statuswert'; zeile: StatuswertZeile })
  | (Basis & { art: 'kuerzel'; zeile: KuerzelZeile })
  | (Basis & { art: 'regel'; zeile: RegelZeile });

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

/** Ein Statuswert als Listeneintrag. */
export function statuswertAlsEintrag(z: StatuswertZeile): GlossarEintrag {
  return {
    art: 'statuswert',
    id: `statuswert:${z.code}`,
    titel: `${z.code} · ${z.label}`,
    unter: `${z.phaseLabel} · ${z.kategorieLabel}`,
    // Der Code auch nackt: wer „34" tippt, sucht den Statuswert 34.
    suchtext: `${z.code} ${z.label} ${z.phaseLabel} ${z.kategorieLabel}`.toLowerCase(),
    zeile: z,
  };
}

/**
 * Worauf die Kürzel-Suche greift — EINE Formel für beide Reiter. „Nachschlagen"
 * und „Für meine Rolle wichtig" zeigen dieselben Kürzel; träfe dieselbe Eingabe
 * dort unterschiedlich, wäre nicht zu erklären, warum.
 */
function kuerzelSuchtext(z: KuerzelZeile): string {
  return `${z.code} ${z.label} ${z.csvSpalte} ${z.ordner}`.toLowerCase();
}

/** Ein Kürzel als Listeneintrag. */
export function kuerzelAlsEintrag(z: KuerzelZeile): GlossarEintrag {
  return {
    art: 'kuerzel',
    id: `kuerzel:${z.code}`,
    titel: z.code,
    unter: z.label,
    suchtext: kuerzelSuchtext(z),
    zeile: z,
  };
}

/**
 * Trifft die Suche dieses Kürzel? Für die Rollensicht, die keine
 * `GlossarEintrag`e baut, sondern direkt auf den Zeilen filtert.
 */
export function passtKuerzel(z: KuerzelZeile, suche: string): boolean {
  const q = suche.trim().toLowerCase();
  return q === '' || kuerzelSuchtext(z).includes(q);
}

/** Eine To-do-Regel als Listeneintrag. */
export function regelAlsEintrag(z: RegelZeile): GlossarEintrag {
  return {
    art: 'regel',
    id: `regel:${z.regel.id}`,
    titel: z.regel.beschreibung,
    unter: z.sperre ? 'Sperre — legt Stränge still' : z.regel.todo,
    suchtext: `${z.regel.id} ${z.regel.beschreibung} ${z.regel.todo} ${z.satz}`.toLowerCase(),
    zeile: z,
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
 * Die sichtbaren Einträge über alle Gruppen hinweg, in Anzeigereihenfolge —
 * die Achse, auf der die Pfeiltasten wandern. Die Gruppierung ist eine Frage der
 * Darstellung; wer tippt und dann nach unten drückt, meint „der nächste".
 */
export function flacheIds(gruppen: readonly GlossarGruppe[]): string[] {
  return gruppen.flatMap(g => g.eintraege.map(e => e.id));
}

/**
 * Ein Schritt hoch (`-1`) oder runter (`+1`).
 *
 * An den Enden wird GEKLEMMT, nicht umgebrochen: in einer nach Art gruppierten
 * Liste führt der Sprung vom letzten Kürzel zurück zur ersten Abkürzung nur zu
 * der Frage, was gerade passiert ist. Ohne Auswahl (oder wenn die Auswahl gerade
 * weggefiltert wurde) steigt man am passenden Ende ein.
 */
export function naechsteId(
  ids: readonly string[], aktuell: string | null, richtung: 1 | -1,
): string | null {
  if (ids.length === 0) return null;
  const i = aktuell === null ? -1 : ids.indexOf(aktuell);
  if (i === -1) return (richtung === 1 ? ids[0] : ids[ids.length - 1]) ?? null;
  return ids[Math.min(ids.length - 1, Math.max(0, i + richtung))] ?? null;
}

/** Ein Stück Text mit der Auskunft, ob es die Fundstelle ist. */
export interface Segment {
  text: string;
  treffer: boolean;
}

/**
 * Den Suchbegriff im Text auszeichnen — ALLE Vorkommen, nicht nur das erste:
 * bei „Brief NF von BB angelegt/ergänzt" markiert eine Suche nach „e" sonst
 * ausgerechnet die erste, beliebige Stelle.
 *
 * Gibt Segmente zurück, kein JSX — die Vitest-Projekte laufen ohne DOM, und die
 * Auszeichnung gehört ohnehin der Liste (vgl. `anfragen/highlight.ts`).
 *
 * Gerechnet wird auf `toLowerCase()`, damit die Positionen 1:1 zum Original
 * passen. Verschiebt eine Sonderform die Länge doch (`'İ'` wird zu zwei
 * Zeichen), zeigt die Zeile lieber unmarkiert als zerschnitten.
 */
export function markiere(text: string, suche: string): Segment[] {
  const ganz: Segment[] = [{ text, treffer: false }];
  const q = suche.trim().toLowerCase();
  if (q === '' || text === '') return ganz;

  const heu = text.toLowerCase();
  if (heu.length !== text.length) return ganz;

  const segmente: Segment[] = [];
  let ab = 0;
  for (let i = heu.indexOf(q, ab); i !== -1; i = heu.indexOf(q, ab)) {
    if (i > ab) segmente.push({ text: text.slice(ab, i), treffer: false });
    segmente.push({ text: text.slice(i, i + q.length), treffer: true });
    ab = i + q.length;
  }
  if (segmente.length === 0) return ganz;
  if (ab < text.length) segmente.push({ text: text.slice(ab), treffer: false });
  return segmente;
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
