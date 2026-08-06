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
 * der Zuarbeit: `DS` (935 Anträge) und `Irrläufer` (82) haben dort keine
 * Entsprechung, `EP` ist umgekehrt keine `vb_phase`. Für diese Anträge wird
 * **nicht geraten**: sagen alle Projektformen dasselbe, gilt es auch für sie;
 * weichen sie ab, liefert der Nachschlag `eindeutig: false` und der Aufrufer
 * zeigt das Kürzel statt einer der vier möglichen Bedeutungen.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { KUERZEL_KATALOG, type KuerzelEintrag, type KuerzelForm, type Projektform } from './kuerzel-katalog.data';
import type { Rolle } from './typen';

export type { Projektform, KuerzelForm, KuerzelEintrag };

/**
 * `vb_phase` → Projektform der Zuarbeit.
 *
 * `NW 1` und `NW 2` sind beide Netzwerk — die Zuarbeit unterscheidet die Stufen
 * nicht. `DS` (5) und `Irrläufer` (9) haben keine Entsprechung und liefern
 * `null`; das ist eine Aussage („wir wissen es nicht") und keine Lücke.
 */
const VB_PHASE_ZU_PROJEKTFORM: Readonly<Record<number, Projektform>> = {
  1: 'NW',
  2: 'NW',
  3: 'FuE',
  4: 'DL',
};

export function projektformVonVbPhase(vbPhase: unknown): Projektform | null {
  const n = typeof vbPhase === 'number' ? vbPhase : Number(vbPhase);
  if (!Number.isFinite(n)) return null;
  return VB_PHASE_ZU_PROJEKTFORM[n] ?? null;
}

const INDEX: ReadonlyMap<string, KuerzelEintrag> = new Map(
  KUERZEL_KATALOG.map(e => [e.kuerzel.toUpperCase(), e]),
);

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
}

function leer(kuerzel: string): KuerzelAuskunft {
  return { kuerzel, bezeichnung: null, eindeutig: false, rollen: [], scope: [], kategorien: [], quelle: null };
}

function ausForm(e: KuerzelEintrag, f: KuerzelForm, quelle: Projektform | null, eindeutig: boolean): KuerzelAuskunft {
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
  };
}

/**
 * Schlägt ein Kürzel nach. **Die Projektform ist Pflicht** — auch als `null`,
 * denn „ich weiß sie nicht" ist eine andere Frage als „egal".
 *
 * Ohne Projektform gilt: stimmen alle geführten Formen überein, ist die Antwort
 * eindeutig; sonst kommt sie mit `eindeutig: false` heraus.
 */
export function kuerzelAuskunft(kuerzel: string, projektform: Projektform | null): KuerzelAuskunft {
  const k = kuerzel.trim().toUpperCase();
  const e = INDEX.get(k);
  if (!e) return leer(kuerzel.trim());

  if (projektform !== null) {
    const f = e.formen[projektform];
    if (f) return ausForm(e, f, projektform, true);
    // Die Zuarbeit führt das Kürzel, aber nicht für diese Projektform. Dann
    // gilt dieselbe Regel wie ohne Projektform — nicht eine fremde Form raten.
  }

  const formen = Object.entries(e.formen) as [Projektform, KuerzelForm][];
  if (formen.length === 0) return leer(e.kuerzel);
  const ersteEintrag = formen[0]!;
  const alleGleich = formen.every(([, f]) => f.bezeichnung === ersteEintrag[1].bezeichnung);
  return ausForm(e, ersteEintrag[1], null, alleGleich);
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

/** Alle Kürzel, deren Bedeutung von der Projektform abhängt. */
export function projektformAbhaengigeKuerzel(): string[] {
  const out: string[] = [];
  for (const e of KUERZEL_KATALOG) {
    const b = new Set(Object.values(e.formen).map(f => f.bezeichnung));
    if (b.size > 1) out.push(e.kuerzel);
  }
  return out;
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
