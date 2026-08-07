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
import { falte, falteText, ursprung } from '@/core/utils/textFaltung';
import type { KuerzelZeile, RegelZeile, StatuswertZeile } from './glossarZeilen';

/**
 * Die Eingabe, einmal aufbereitet.
 *
 * **Warum ein eigener Typ statt der rohen Zeichenkette.** Jeder Vergleich
 * bräuchte sonst dieselbe Faltung, und die Liste vergleicht bei jedem
 * Tastendruck über den ganzen Bestand — 604 Einträge mal zweimal falten wäre
 * Arbeit, die einmal reicht. Wichtiger noch: so gibt es GENAU EINE Lesart der
 * Eingabe. Ein zweiter Aufrufer, der selbst `split(' ')` macht, hätte sonst
 * seine eigene.
 */
export interface Suchbegriff {
  /** Getrimmt, ungefaltet — für Meldungen, die die Eingabe zitieren. */
  roh: string;
  /** Gefaltet am Stück — für „der Titel IST die Eingabe". */
  ganz: string;
  /** Die gefalteten Wörter. ALLE müssen vorkommen; leer heißt „kein Filter". */
  woerter: string[];
}

/**
 * Eingabe lesen: falten, in Wörter zerlegen.
 *
 * **Mehrere Wörter werden UND-verknüpft, und die Reihenfolge zählt nicht.**
 * „brief nf" soll „Brief NF von BB angelegt" finden. Als ein Literal gesucht,
 * traf die Eingabe nur, wenn man die Wortstellung des Bestands erriet — was
 * gerade der nicht kann, der nachschlägt.
 */
export function leseSuche(roh: string): Suchbegriff {
  const getrimmt = roh.trim();
  const ganz = falteText(getrimmt);
  return { roh: getrimmt, ganz, woerter: ganz.split(/\s+/).filter(w => w.length > 0) };
}

/** Der leere Begriff — filtert nichts. */
export const KEINE_SUCHE: Suchbegriff = { roh: '', ganz: '', woerter: [] };

/** Trifft der Begriff diesen (bereits gefalteten) Suchtext? */
function trifft(suchtext: string, begriff: Suchbegriff): boolean {
  return begriff.woerter.every(w => suchtext.includes(w));
}

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
   * Worauf die Suche greift. Vorberechnet und GEFALTET: die Liste filtert bei
   * jedem Tastendruck über den ganzen Bestand.
   */
  suchtext: string;
  /** Der gefaltete Titel allein — die Trefferwertung fragt nur ihn. */
  titelSuch: string;
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
    suchtext: falteText(`${b.begriff} ${b.lang ?? ''} ${b.erklaerung}`),
    titelSuch: falteText(b.begriff),
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
    suchtext: falteText(`${z.code} ${z.label} ${z.phaseLabel} ${z.kategorieLabel}`),
    titelSuch: falteText(`${z.code} · ${z.label}`),
    zeile: z,
  };
}

/**
 * Worauf die Kürzel-Suche greift — EINE Formel für beide Reiter. „Nachschlagen"
 * und „Für meine Rolle wichtig" zeigen dieselben Kürzel; träfe dieselbe Eingabe
 * dort unterschiedlich, wäre nicht zu erklären, warum.
 */
function kuerzelSuchtext(z: KuerzelZeile): string {
  return falteText(`${z.code} ${z.label} ${z.csvSpalte} ${z.ordner}`);
}

/** Ein Kürzel als Listeneintrag. */
export function kuerzelAlsEintrag(z: KuerzelZeile): GlossarEintrag {
  return {
    art: 'kuerzel',
    id: `kuerzel:${z.code}`,
    titel: z.code,
    unter: z.label,
    suchtext: kuerzelSuchtext(z),
    titelSuch: falteText(z.code),
    zeile: z,
  };
}

/**
 * Trifft die Suche dieses Kürzel? Für die Rollensicht, die keine
 * `GlossarEintrag`e baut, sondern direkt auf den Zeilen filtert.
 */
export function passtKuerzel(z: KuerzelZeile, begriff: Suchbegriff): boolean {
  return trifft(kuerzelSuchtext(z), begriff);
}

/** Eine To-do-Regel als Listeneintrag. */
export function regelAlsEintrag(z: RegelZeile): GlossarEintrag {
  return {
    art: 'regel',
    id: `regel:${z.regel.id}`,
    titel: z.regel.beschreibung,
    unter: z.sperre ? 'Sperre — legt Stränge still' : z.regel.todo,
    suchtext: falteText(`${z.regel.id} ${z.regel.beschreibung} ${z.regel.todo} ${z.satz}`),
    titelSuch: falteText(z.regel.beschreibung),
    zeile: z,
  };
}

/**
 * Trefferwertung: Wer „NF" tippt, will den Eintrag NF oben sehen, nicht die
 * sieben Erklärungen, in denen das Wort vorkommt.
 *
 * 0 = der Titel IST die Eingabe · 1 = Titel beginnt damit · 2 = der Titel trägt
 * ALLE Wörter · 3 = nur der Fließtext.
 *
 * Stufe 0 und 1 messen die Eingabe am Stück: „brief nf" soll einen Eintrag, der
 * wörtlich so beginnt, über einen stellen, bei dem die beiden Wörter nur
 * irgendwo im Titel stehen.
 */
export function rang(e: GlossarEintrag, begriff: Suchbegriff): number {
  const titel = e.titelSuch;
  if (titel === begriff.ganz) return 0;
  if (titel.startsWith(begriff.ganz)) return 1;
  if (trifft(titel, begriff)) return 2;
  return 3;
}

/**
 * Alle Einträge, gefiltert und nach Art gruppiert. Leere Gruppen fallen weg —
 * eine Überschrift „Kürzel" über nichts sagt nur, dass etwas fehlt, ohne zu
 * sagen was.
 */
export function gruppiere(
  eintraege: readonly GlossarEintrag[], begriff: Suchbegriff,
): GlossarGruppe[] {
  const leer = begriff.woerter.length === 0;
  const treffer = leer ? [...eintraege] : eintraege.filter(e => trifft(e.suchtext, begriff));

  const gruppen: GlossarGruppe[] = [];
  for (const art of ART_REIHENFOLGE) {
    const eigene = treffer.filter(e => e.art === art);
    if (eigene.length === 0) continue;
    eigene.sort((a, b) => (
      (leer ? 0 : rang(a, begriff) - rang(b, begriff))
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

/** Halboffene Bereiche `[von, bis)` im ORIGINAL-Text, aufsteigend verschmolzen. */
function verschmelze(bereiche: { von: number; bis: number }[]): { von: number; bis: number }[] {
  bereiche.sort((a, b) => a.von - b.von || a.bis - b.bis);
  const out: { von: number; bis: number }[] = [];
  for (const b of bereiche) {
    const letzter = out[out.length - 1];
    // `<=` statt `<`: zwei Wörter, die nahtlos aneinanderstoßen, sollen EIN
    // Markierungsfeld ergeben, keine zwei mit unsichtbarer Fuge dazwischen.
    if (letzter && b.von <= letzter.bis) letzter.bis = Math.max(letzter.bis, b.bis);
    else out.push({ von: b.von, bis: b.bis });
  }
  return out;
}

/**
 * Den Suchbegriff im Text auszeichnen — JEDES Wort, an JEDER Stelle.
 *
 * Gibt Segmente zurück, kein JSX — die Vitest-Projekte laufen ohne DOM, und die
 * Auszeichnung gehört ohnehin der Liste (vgl. `anfragen/highlight.ts`).
 *
 * **Gesucht wird im gefalteten Text, markiert wird im Original.** Die Faltung
 * verschiebt Positionen („ü" wird zerlegt, „ß" verdoppelt); ohne die Herkunft
 * aus `falte()` säße die Markierung daneben. Ein Wort, das hier gar nicht
 * vorkommt, trägt nichts bei — es hat den Eintrag über einen anderen Text
 * getroffen, und das ist kein Grund, hier etwas zu erfinden.
 */
export function markiere(text: string, begriff: Suchbegriff): Segment[] {
  const ganz: Segment[] = [{ text, treffer: false }];
  if (begriff.woerter.length === 0 || text === '') return ganz;

  const f = falte(text);
  const roh: { von: number; bis: number }[] = [];
  for (const wort of begriff.woerter) {
    // Schrittweite 1, nicht `wort.length`: „aa" in „aaa" überlappt sich selbst,
    // und das Verschmelzen unten räumt das ohnehin auf.
    for (let i = f.text.indexOf(wort); i !== -1; i = f.text.indexOf(wort, i + 1)) {
      roh.push(ursprung(f, i, i + wort.length));
    }
  }
  if (roh.length === 0) return ganz;

  const segmente: Segment[] = [];
  let ab = 0;
  for (const { von, bis } of verschmelze(roh)) {
    if (von > ab) segmente.push({ text: text.slice(ab, von), treffer: false });
    segmente.push({ text: text.slice(von, bis), treffer: true });
    ab = bis;
  }
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
