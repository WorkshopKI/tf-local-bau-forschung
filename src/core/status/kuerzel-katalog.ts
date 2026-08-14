/**
 * Nachschlagen im Kürzel-Katalog — **immer über Kürzel × Projektform**.
 *
 * **Warum das die einzige erlaubte Tür ist.** Bis v3.13 war die Kürzeltabelle
 * flach: ein Kürzel, eine Bezeichnung. 77 Kürzel bedeuten aber je nach
 * Projektform etwas anderes — `AB` ist in DL die „Bewilligungsempfehlung durch
 * Haushaltsbeauftragte", in FuE/NW/EP „bewilligungsreif/Akte an Euronorm".
 * Gemessen am Produktivbestand: **11 216 von 14 222 Anträgen (78,9 %)** tragen
 * mindestens ein gesetztes Kürzel, dessen angezeigter Klartext für ihre
 * Projektform falsch ist. Das ist kein Randfall, sondern der Normalfall.
 *
 * **Die Projektform kommt aus `vb_phase`** und deckt sich nicht vollständig mit
 * der Zuarbeit. Dahinter stehen aber **zwei verschiedene Gründe**, und sie
 * dürfen nicht zu einem stillen „unbekannt" verschmelzen:
 *
 * - **DS** (935 Anträge) ist eine echte Projektform — die Zuarbeit ist nur
 *   älter als sie. Eine Lücke, die sich mit der nächsten Zuarbeit schließt.
 *   Wer hier „DS ist doch fast FuE" mappt, verankert eine Vermutung als Wert.
 * - **Irrläufer** (82) ist **gar keine** Projektform, sondern der Vermerk „an
 *   uns gesendet, aber nicht unsere Zuständigkeit". Hier gibt es nichts
 *   nachzuliefern; die Lücke schließt sich nie und soll es auch nicht.
 * - **EP** führt die Zuarbeit umgekehrt, ohne dass es eine `vb_phase` wäre —
 *   bleibt vorerst, wie es ist.
 *
 * Für alle diese Anträge wird **nicht geraten**: sagen alle Projektformen
 * dasselbe, gilt es auch für sie; weichen sie ab, liefert der Nachschlag
 * `eindeutig: false` und der Aufrufer zeigt das Kürzel statt einer der vier
 * möglichen Bedeutungen.
 *
 * **Seit der Klärrunde antwortet die Kuration für DS** ([kuerzel-kuration.ts]).
 * Die Zuarbeit ist unverändert älter als die Projektform — geraten wird
 * weiterhin nichts, aber wo eine Antwort vorliegt, gilt sie. Die Reihenfolge
 * steht in {@link kuerzelAuskunft} und ist der Grund, warum es **keinen**
 * pauschalen Alias DS → FuE als Dateneintrag gibt.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { KUERZEL_KATALOG, type KuerzelEintrag, type KuerzelForm, type Projektform } from './kuerzel-katalog.data';
import {
  QUELLKORREKTUREN, belegText, divergenzBestaetigt, dsBedeutungFuer, vereinheitlichtFuer,
  type KurationsStand,
} from './kuerzel-kuration';
import { korrigierteKatalogBezeichnung } from './seed-label-korrekturen';
import type { Rolle } from './typen';

export type { Projektform, KuerzelForm, KuerzelEintrag };

/**
 * Womit nachgeschlagen wird.
 *
 * `DS` ist **keine `Projektform` der Zuarbeit** — dort gibt es sie nicht.
 * Sie ist eine Form, für die unsere Kuration antwortet; deshalb ein eigener
 * Typ statt einer fünften `Projektform`. Wer `Projektform` erweiterte, machte
 * aus einer offenen Frage stillschweigend einen Katalogeintrag.
 */
export type Nachschlageform = Projektform | 'DS';

/**
 * Woher die gelieferte Bezeichnung kommt. Die Anzeige unterscheidet damit
 * belegt von hergeleitet, ohne `quelle` und `eindeutig` gegeneinander auslegen
 * zu müssen.
 */
export type BezeichnungsHerkunft =
  /** Der Katalog führt genau diese Projektform. */
  | 'form'
  /** Klärrunde: EIN Wortlaut für alle Formen. */
  | 'einheitlich'
  /** Klärrunde: eigener DS-Wortlaut, weil die Sammelregel hier nicht gilt. */
  | 'ds-kuratiert'
  /** Sammelregel „DS = FuE": abgeleitet, nicht eigens bestätigt. */
  | 'ds-aus-fue'
  /** Erstgeführte Form, weil nichts Besseres da ist — gilt NICHT sicher. */
  | 'geliehen'
  /** Die kuratierte Fassung des Teams hat den Wortlaut überschrieben. */
  | 'kuratiert'
  /** Der Katalog kennt das Kürzel nicht. */
  | 'unbekannt';

/**
 * `vb_phase` → Projektform der Zuarbeit.
 *
 * `NW 1` und `NW 2` sind beide Netzwerk — die Zuarbeit unterscheidet die Stufen
 * nicht. `DS` (5) und `Irrläufer` (9) fehlen bewusst; **warum** sie fehlen,
 * sagt {@link projektformLage}.
 */
const VB_PHASE_ZU_PROJEKTFORM: Readonly<Record<number, Projektform>> = {
  1: 'NW',
  2: 'NW',
  3: 'FuE',
  4: 'DL',
};

/**
 * Warum liefert `vb_phase` keine Projektform?
 *
 * Zwei Gründe, die man nicht verwechseln darf — sonst „repariert" jemand den
 * einen mit der Lösung des anderen:
 *
 * - `zuarbeit-aelter` — die Projektform gibt es, die Zuarbeit kennt sie nur noch
 *   nicht. **Nachlieferbar**: eine neuere Zuarbeit schließt die Lücke.
 * - `keine-projektform` — der Wert IST keine Projektform (Irrläufer: an uns
 *   gesendet, aber nicht unsere Zuständigkeit). **Nicht nachlieferbar**, und das
 *   ist richtig so.
 */
export type ProjektformLage =
  | { art: 'bekannt'; form: Projektform }
  | { art: 'zuarbeit-aelter'; label: string }
  | { art: 'keine-projektform'; label: string }
  | { art: 'unbekannt' };

/** `vb_phase`-Werte, die eine echte Projektform meinen, die der Zuarbeit fehlt. */
const NACH_ZUARBEIT_ENTSTANDEN: Readonly<Record<number, string>> = { 5: 'DS' };

/** `vb_phase`-Werte, die schon begrifflich keine Projektform sind. */
const KEINE_PROJEKTFORM: Readonly<Record<number, string>> = { 9: 'Irrläufer' };

export function projektformLage(vbPhase: unknown): ProjektformLage {
  const n = typeof vbPhase === 'number' ? vbPhase : Number(vbPhase);
  if (!Number.isFinite(n)) return { art: 'unbekannt' };
  const form = VB_PHASE_ZU_PROJEKTFORM[n];
  if (form) return { art: 'bekannt', form };
  const spaeter = NACH_ZUARBEIT_ENTSTANDEN[n];
  if (spaeter) return { art: 'zuarbeit-aelter', label: spaeter };
  const keine = KEINE_PROJEKTFORM[n];
  if (keine) return { art: 'keine-projektform', label: keine };
  return { art: 'unbekannt' };
}

/**
 * Die Projektform, oder `null`. Für die Frage „warum nicht?" gibt es
 * {@link projektformLage} — hier interessiert nur, ob nachgeschlagen werden kann.
 */
export function projektformVonVbPhase(vbPhase: unknown): Projektform | null {
  const lage = projektformLage(vbPhase);
  return lage.art === 'bekannt' ? lage.form : null;
}

/**
 * Womit nachgeschlagen wird — inklusive `'DS'`, für das die Kuration antwortet.
 *
 * Getrennt von {@link projektformVonVbPhase}, weil beide etwas anderes fragen:
 * dort „welche Form führt die Zuarbeit?", hier „womit kann ich nachschlagen?".
 * Irrläufer bleiben `null`; für sie gibt es nichts nachzuliefern.
 */
export function nachschlageformVonLage(lage: ProjektformLage): Nachschlageform | null {
  if (lage.art === 'bekannt') return lage.form;
  return lage.art === 'zuarbeit-aelter' && lage.label === 'DS' ? 'DS' : null;
}

export function nachschlageformVonVbPhase(vbPhase: unknown): Nachschlageform | null {
  return nachschlageformVonLage(projektformLage(vbPhase));
}

/**
 * Der Katalog, **wie er nach der Klärrunde gilt**: Quellkorrekturen angewandt,
 * dann Vereinheitlichungen.
 *
 * Einmal beim Modul-Laden gebaut. Alles Weitere liest nur noch diesen Index —
 * sonst müsste jede Auswertung die Reihenfolge für sich kennen, und die erste,
 * die es vergisst, meldet einen längst entschiedenen Widerspruch erneut.
 */
function baueEffektiv(): ReadonlyMap<string, KuerzelEintrag> {
  const out = new Map<string, KuerzelEintrag>();
  for (const e of KUERZEL_KATALOG) {
    const einheitlich = vereinheitlichtFuer(e.kuerzel);
    const korrekturen = QUELLKORREKTUREN.filter(q => q.kuerzel === e.kuerzel);
    const formen: Partial<Record<Projektform, KuerzelForm>> = {};
    let veraendert = false;
    for (const [form, f] of Object.entries(e.formen) as [Projektform, KuerzelForm][]) {
      const q = korrekturen.find(x => x.formen.includes(form) && x.falsch === f.bezeichnung);
      // Zuletzt der Quellen-Vergleich: er entscheidet nur, wo weder eine
      // Vereinheitlichung noch eine Quellkorrektur schon gesprochen hat, und
      // zieht die Behörden-Umbenennung über JEDEN Wortlaut nach.
      const bezeichnung = korrigierteKatalogBezeichnung(
        e.kuerzel, einheitlich?.bezeichnung ?? q?.richtig ?? f.bezeichnung,
      );
      if (bezeichnung !== f.bezeichnung) veraendert = true;
      formen[form] = bezeichnung === f.bezeichnung ? f : { ...f, bezeichnung };
    }
    out.set(e.kuerzel.toUpperCase(), veraendert ? { ...e, formen } : e);
  }
  return out;
}

const INDEX: ReadonlyMap<string, KuerzelEintrag> = baueEffektiv();

/** Der Katalog nach der Klärrunde, in Katalogreihenfolge. */
function effektiveEintraege(): KuerzelEintrag[] {
  return KUERZEL_KATALOG.map(e => INDEX.get(e.kuerzel.toUpperCase()) ?? e);
}

/** Was der Katalog zu einem Kürzel sagt — mit der Angabe, wie sicher das ist. */
export interface KuerzelAuskunft {
  kuerzel: string;
  /** Bezeichnung; `null`, wenn der Katalog das Kürzel nicht kennt. */
  bezeichnung: string | null;
  /**
   * Gilt die Bezeichnung sicher für diesen Antrag?
   *
   * `false` heißt: die Projektform ist unbekannt UND die Projektformen sagen
   * Verschiedenes. Der Aufrufer zeigt dann das Kürzel, nicht eine geratene
   * Bedeutung.
   */
  eindeutig: boolean;
  rollen: readonly Rolle[];
  scope: readonly ('tv' | 'verbund')[];
  kategorien: readonly string[];
  /** Historisches Kürzel: heute heißt es so. */
  ersetztDurch?: string;
  /** Schreibvarianten im Patt — gehört auf die Kuratorenliste. */
  strittig?: boolean;
  /** Aus welcher Projektform die Auskunft stammt; `null` = über alle gleich. */
  quelle: Projektform | null;
  /** Wie die Bezeichnung zustande kam. Siehe {@link BezeichnungsHerkunft}. */
  herkunft: BezeichnungsHerkunft;
  /** Die Entscheidung wirkt, ist aber nicht gegengezeichnet. */
  bestaetigungOffen?: true;
  /** Die Zuarbeit ist an dieser Stelle belegt falsch und wurde korrigiert. */
  quellkorrigiert?: true;
  /** Die geführten Formen sagen Verschiedenes — der eigene Marker (≠ `strittig`). */
  bedeutungsdivergenz?: true;
}

function leer(kuerzel: string): KuerzelAuskunft {
  return {
    kuerzel, bezeichnung: null, eindeutig: false,
    rollen: [], scope: [], kategorien: [], quelle: null, herkunft: 'unbekannt',
  };
}

/** Sagen die geführten Formen Verschiedenes? Auf dem EFFEKTIVEN Eintrag. */
function divergent(e: KuerzelEintrag): boolean {
  const werte = Object.values(e.formen).map(f => f.bezeichnung);
  return new Set(werte).size > 1;
}

function ausForm(
  e: KuerzelEintrag, f: KuerzelForm,
  quelle: Projektform | null, eindeutig: boolean,
  herkunft: BezeichnungsHerkunft, stand?: KurationsStand,
): KuerzelAuskunft {
  return {
    kuerzel: e.kuerzel,
    bezeichnung: f.bezeichnung,
    eindeutig,
    rollen: f.rollen,
    scope: f.scope,
    kategorien: f.kategorien,
    ...(e.ersetztDurch ? { ersetztDurch: e.ersetztDurch } : {}),
    ...(e.strittig ? { strittig: true } : {}),
    quelle,
    herkunft,
    ...(stand === 'bestaetigung_offen' ? { bestaetigungOffen: true as const } : {}),
    ...(QUELLKORREKTUREN.some(q => q.kuerzel === e.kuerzel) ? { quellkorrigiert: true as const } : {}),
    ...(divergent(e) ? { bedeutungsdivergenz: true as const } : {}),
  };
}

/**
 * Schlägt ein Kürzel nach. **Die Form ist Pflicht** — auch als `null`, denn
 * „ich weiß sie nicht" ist eine andere Frage als „egal".
 *
 * Reihenfolge, und zwar in dieser:
 *
 * 1. **Vereinheitlicht** — die Klärrunde hat einen Wortlaut für alle Formen
 *    festgestellt. Er steckt schon im effektiven Index, hier wird nur die
 *    Herkunft benannt.
 * 2. **Die Form selbst**, wenn der Katalog sie führt.
 * 3. **DS mit eigener Antwort** — schlägt die Sammelregel. Genau deshalb ist
 *    die Sammelregel eine Reihenfolge und kein Dateneintrag: als Eintrag würde
 *    sie diese acht überschreiben, sobald jemand sie scharf schaltet.
 * 4. **DS ohne eigene Antwort** — Sammelregel „DS = FuE", als abgeleitet
 *    gekennzeichnet.
 * 5. **Geliehen** — erstgeführte Form. `eindeutig` nur, wenn ohnehin alle
 *    dasselbe sagen; sonst zeigt der Aufrufer das Kürzel statt einer Bedeutung.
 */
export function kuerzelAuskunft(kuerzel: string, form: Nachschlageform | null): KuerzelAuskunft {
  const k = kuerzel.trim().toUpperCase();
  const e = INDEX.get(k);
  if (!e) return leer(kuerzel.trim());

  const formen = Object.entries(e.formen) as [Projektform, KuerzelForm][];
  if (formen.length === 0) return leer(e.kuerzel);

  const einheitlich = vereinheitlichtFuer(e.kuerzel);
  if (einheitlich) {
    // Jede Form trägt denselben Wortlaut; welche gelesen wird, ist gleichgültig.
    return ausForm(e, formen[0]![1], null, true, 'einheitlich', einheitlich.stand);
  }

  if (form !== null && form !== 'DS') {
    const f = e.formen[form];
    if (f) return ausForm(e, f, form, true, 'form');
    // Die Zuarbeit führt das Kürzel, aber nicht für diese Projektform. Dann
    // gilt dieselbe Regel wie ohne Form — nicht eine fremde raten.
  }

  if (form === 'DS') {
    const ds = dsBedeutungFuer(e.kuerzel);
    if (ds) {
      const quelle = e.formen[ds.entsprichtForm];
      // Der Wortlaut kommt aus der Kuration, Rollen und Scope aus der Form, die
      // ihn führt — sonst stünde die Bedeutung ohne ihren Kontext da.
      const basis: KuerzelForm = quelle
        ? { ...quelle, bezeichnung: ds.bezeichnung }
        : { bezeichnung: ds.bezeichnung, rollen: [], scope: [], kategorien: [] };
      return ausForm(e, basis, null, true, 'ds-kuratiert', ds.stand);
    }
    const fue = e.formen.FuE;
    if (fue) return ausForm(e, fue, null, true, 'ds-aus-fue');
  }

  const ersteEintrag = formen[0]!;
  const alleGleich = !divergent(e);
  return ausForm(e, ersteEintrag[1], null, alleGleich, 'geliehen');
}

/**
 * Legt den **kuratierten** Wortlaut der aktiven Fassung über eine Auskunft.
 *
 * Der Grund: die App führt zwei Wortlaut-Quellen, und beide erreichen dieselbe
 * Seite. Die Chronik zeigt `StatusFeldEintrag.label` aus der Fassung — was die
 * PL im Kürzel-Tab bearbeitet und für das Team freigibt. Die Verlaufs-Spur zeigt
 * `kuerzelAuskunft` — einkompilierte Fremddaten, die keine Freigabe erreicht.
 * Dieselben zwei Reiter, zwei Texte für dasselbe Kürzel; `XKS` las sich links
 * „DL-Gutachten fertig - FB/AB" und rechts „Gutachten fertig".
 *
 * **Die Kuration gewinnt — bis auf einen Fall.** Wo die Projektformen etwas
 * VERSCHIEDENES sagen (`bedeutungsdivergenz`, 58 Kürzel), bleibt der Katalog
 * stehen: die Fassung kennt nur einen Wortlaut je Code und kann diese
 * Unterscheidung gar nicht ausdrücken. Sie hier gewinnen zu lassen, gäbe jedem
 * Antrag wieder die Bedeutung einer fremden Projektform — genau der Zustand vor
 * v3.13, der 78,9 % der Anträge betraf.
 *
 * Unbekannte Kürzel bekommen dagegen sehr wohl den kuratierten Text: der Katalog
 * kennt 36 Codes der Zuarbeit nicht, und ein Name ist dort besser als keiner.
 *
 * **Nur die Bezeichnung**, nicht die Rollen. `rollenLage` unterscheidet „jede
 * Rolle" von „Rolle unbekannt"; ein Feld der Fassung trägt immer eine (leere =
 * neutrale) Rollenliste, überlagert verschwände die zweite Aussage.
 *
 * Rein: nimmt den Text entgegen, statt ihn zu holen — der Katalog kennt die
 * Fassung nicht und soll sie nicht kennen.
 */
export function ueberlagereKuration(
  auskunft: KuerzelAuskunft, kuratiertesLabel: string | undefined,
): KuerzelAuskunft {
  const label = kuratiertesLabel?.trim();
  if (!label || label === auskunft.bezeichnung) return auskunft;
  if (auskunft.bedeutungsdivergenz) return auskunft;
  return { ...auskunft, bezeichnung: label, eindeutig: true, quelle: null, herkunft: 'kuratiert' };
}

/**
 * Löst ein historisches Kürzel auf die heutige Form auf. Liefert `null`, wenn
 * es nie umbenannt wurde.
 *
 * Nicht stillschweigend ersetzen: ein Antrag von 2018 trägt `AAW`, und wer den
 * Verlauf liest, muss beide Formen sehen — „AAW (heute ARW)".
 */
export function heutigesKuerzel(kuerzel: string): string | null {
  return INDEX.get(kuerzel.trim().toUpperCase())?.ersetztDurch ?? null;
}

/** Was eine einzelne Projektform zu einem Kürzel sagt. */
export interface FormBedeutung {
  form: Projektform;
  bezeichnung: string;
}

/** Ein Kürzel, dessen Bedeutung zwischen den Projektformen auseinandergeht. */
export interface UneinigesKuerzel {
  kuerzel: string;
  /** Je geführter Projektform eine Bedeutung, in Katalogreihenfolge. */
  bedeutungen: readonly FormBedeutung[];
  /**
   * Trägt der Katalog dafür schon `strittig`? Das misst etwas ANDERES — ein
   * Schreibvarianten-Patt des Generators, nicht einen Bedeutungsunterschied.
   * Beide Angaben stehen deshalb nebeneinander statt übereinander.
   *
   * `YW` trägt beides („Wichtig" / „Wichtig:" im Patt, und der Fachbereich hat
   * den Unterschied als projektformabhängig bestätigt) — der beste Beleg
   * dafür, dass die zwei Marker nicht verschmelzen dürfen.
   */
  strittig: boolean;
  /**
   * Hat die Klärrunde den Unterschied als **richtig** bestätigt? Dann ist der
   * Fall geklärt und wird nicht erneut gefragt — er war nie ein Fehler.
   */
  bestaetigt: boolean;
  /** Beleg der Bestätigung, für Anzeige und Bericht; `null` = unentschieden. */
  beleg: string | null;
}

/**
 * Alle Kürzel, deren Bedeutung von der Projektform abhängt — **mit der Angabe,
 * welche Form was sagt**.
 *
 * {@link projektformAbhaengigeKuerzel} liefert nur die Namen; das reicht für
 * eine Warnung, nicht für eine Frage. Wer klären will, ob `DMB` „Anzahl der
 * Bescheinigungen" oder „Bescheinigung an ZE versandt" heißt, braucht beide
 * Wortlaute samt Herkunft.
 */
export function uneinigeKuerzel(): UneinigesKuerzel[] {
  const out: UneinigesKuerzel[] = [];
  for (const e of effektiveEintraege()) {
    // Auf dem EFFEKTIVEN Eintrag: ein vereinheitlichtes Kürzel ist nicht mehr
    // uneinig, und ohne diesen Schritt meldete jede Auswertung den längst
    // entschiedenen Widerspruch weiter.
    if (!divergent(e)) continue;
    const formen = Object.entries(e.formen) as [Projektform, KuerzelForm][];
    const bestaetigt = divergenzBestaetigt(e.kuerzel);
    out.push({
      kuerzel: e.kuerzel,
      bedeutungen: formen.map(([form, f]) => ({ form, bezeichnung: f.bezeichnung })),
      strittig: e.strittig === true,
      bestaetigt: bestaetigt !== null,
      beleg: bestaetigt ? belegText(bestaetigt.beleg) : null,
    });
  }
  return out;
}

/** Alle Kürzel, deren Bedeutung von der Projektform abhängt. */
export function projektformAbhaengigeKuerzel(): string[] {
  return uneinigeKuerzel().map(u => u.kuerzel);
}

/**
 * Uneinige Kürzel, zu denen **noch keine Antwort** vorliegt — die Menge, aus
 * der die Klärfragen zur Bedeutung entstehen.
 *
 * Ein Widerspruch zwischen den Formen ist für sich noch kein Problem: solange
 * jede Form ihren eigenen Eintrag hat, zeigt die App jedem Vorgang die richtige
 * Bedeutung. Falsch wird es erst, wo **geliehen** werden muss — und das ist
 * seit der Klärrunde nur noch dort, wo weder eine DS-Antwort noch eine
 * FuE-Fassung existiert, aus der die Sammelregel schöpfen könnte.
 *
 * Gemessen am heutigen Katalog: **leer**. Jedes uneinige Kürzel führt eine
 * FuE-Form. Das ist kein Grund, die Ableitung zu entfernen — die nächste
 * Zuarbeit kann ein Kürzel bringen, das nur NW und DL kennt.
 */
export function offeneBedeutungen(): UneinigesKuerzel[] {
  return uneinigeKuerzel().filter(u =>
    !u.bestaetigt && kuerzelAuskunft(u.kuerzel, 'DS').herkunft === 'geliehen');
}

/** Alle geführten Kürzel, in Katalogreihenfolge. */
export function alleKuerzel(): string[] {
  return KUERZEL_KATALOG.map(e => e.kuerzel);
}

/** Die Kuratorenliste: Schreibvarianten, bei denen keine Mehrheit entschied. */
export function strittigeKuerzel(): string[] {
  return KUERZEL_KATALOG.filter(e => e.strittig).map(e => e.kuerzel);
}

/** Die Glossar-Gliederung aus der Zuarbeit, nach Häufigkeit absteigend. */
export function kuerzelKategorien(): { name: string; anzahl: number }[] {
  const z = new Map<string, number>();
  for (const e of KUERZEL_KATALOG) {
    for (const f of Object.values(e.formen)) {
      for (const k of f.kategorien) z.set(k, (z.get(k) ?? 0) + 1);
    }
  }
  return [...z.entries()].sort((a, b) => b[1] - a[1]).map(([name, anzahl]) => ({ name, anzahl }));
}
