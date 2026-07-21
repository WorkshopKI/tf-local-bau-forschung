/**
 * Schritt- und Phasenmodell des Prüfablaufs.
 *
 * Die früher elf gleichrangigen Reiter sind in drei Phasen gruppiert
 * (1 Verstehen → 2 Bewerten → 3 Abschluss); die beiden Konfigurations-Screens
 * stehen bewusst NEBEN dem Ablauf und zählen nicht mit.
 *
 * Rein: keine React-Abhängigkeit, kein IO. Der Status eines Schritts leitet
 * sich aus echten Fertigstellungssignalen ab (zugeordnete VB, vorhandene
 * Analyse, Fortschritt aus `bewerte()`) — nie aus einer festen Zahl. Genau
 * daran scheiterte der Design-Prototyp, der gegen eine Konstante zählte und
 * deshalb nie „fertig" werden konnte.
 */
import type { RechenBefund } from '../types';

/** Schritte des Prüfablaufs, in Reihenfolge. */
export type SchrittKey =
  | 'kompakt' | 'befunde' | 'vb' | 'canvas' | 'delta'
  | 'wirkung' | 'reader' | 'pruefung' | 'abschluss';

/** Screens neben dem Ablauf — Konfiguration bzw. Messwerkzeug. */
export type KonfigKey = 'checkliste' | 'report' | 'smoke';

export type AnsichtKey = SchrittKey | KonfigKey;

export type SchrittStatus = 'done' | 'warn' | 'partial' | 'todo';

export interface Phase {
  key: 'verstehen' | 'bewerten' | 'abschluss';
  nummer: 1 | 2 | 3;
  label: string;
  schritte: readonly SchrittKey[];
}

export const PHASEN: readonly Phase[] = [
  {
    key: 'verstehen',
    nummer: 1,
    label: 'Verstehen',
    schritte: ['kompakt', 'befunde', 'vb', 'canvas', 'delta', 'wirkung', 'reader'],
  },
  { key: 'bewerten', nummer: 2, label: 'Bewerten', schritte: ['pruefung'] },
  { key: 'abschluss', nummer: 3, label: 'Abschluss', schritte: ['abschluss'] },
];

export const SCHRITT_ORDER: readonly SchrittKey[] =
  PHASEN.flatMap(p => [...p.schritte]);

export const SCHRITT_LABEL: Readonly<Record<AnsichtKey, string>> = {
  kompakt: 'Vorhaben kompakt',
  befunde: 'Rechenchecks',
  vb: 'Vorhabensbeschreibung',
  canvas: 'Canvas',
  delta: 'Delta zum Stand der Technik',
  wirkung: 'Wirkungskette',
  reader: 'Lesen nach Aspekt',
  pruefung: 'Förderfähigkeit bewerten',
  abschluss: 'Gutachten-Entwurf',
  checkliste: 'Checkliste bearbeiten',
  report: 'Import-Report',
  smoke: 'Substanz-Smoke',
};

/** Nicht Teil von `SCHRITT_ORDER` — eigene Guide-Leiste, kein Schrittzähler. */
export const KONFIG_SCHRITTE: readonly KonfigKey[] = ['checkliste', 'report'];

const PHASE_JE_SCHRITT: ReadonlyMap<SchrittKey, Phase> = new Map(
  PHASEN.flatMap(p => p.schritte.map(s => [s, p] as const)),
);

export function phaseVonSchritt(schritt: SchrittKey): Phase {
  const p = PHASE_JE_SCHRITT.get(schritt);
  // SCHRITT_ORDER wird aus PHASEN abgeleitet — die Map ist total.
  if (p === undefined) throw new Error(`Schritt ohne Phase: ${schritt}`);
  return p;
}

export function istSchritt(key: AnsichtKey): key is SchrittKey {
  return (SCHRITT_ORDER as readonly string[]).includes(key);
}

/** 0-basiert; -1 für Konfigurations-Screens. */
export function schrittIndex(key: AnsichtKey): number {
  return (SCHRITT_ORDER as readonly string[]).indexOf(key);
}

/**
 * Woraus der Status abgeleitet wird. Bewusst ein flaches Signal-Objekt statt
 * der Hooks selbst, damit die Ableitung ohne React testbar bleibt.
 */
export interface StatusSignale {
  befunde: readonly RechenBefund[];
  /** Ist der Vorhabensbeschreibung ein Dokument zugeordnet? */
  vbZugeordnet: boolean;
  /** Liegt das Ergebnis des Analyse-Laufs vor (Canvas, SdT-Delta, Wirkung)? */
  infografikDa: boolean;
  /** Fortschritt aus `bewerte()`; `null`, solange die Checkliste lädt. */
  fortschritt: { erledigt: number; gesamt: number } | null;
  abschlussbereit: boolean;
  /** Schritte, die der Prüfer bereits geöffnet hat. */
  besucht: ReadonlySet<string>;
}

/** Trägt mindestens ein Befund Fehler- oder Warnungsschwere? */
export function hatWarnBefund(befunde: readonly RechenBefund[]): boolean {
  return befunde.some(b => b.schwere === 'fehler' || b.schwere === 'warnung');
}

export function statusVonSchritt(schritt: SchrittKey, sig: StatusSignale): SchrittStatus {
  switch (schritt) {
    // Beide zeigen dieselben Rechenchecks — eine Warnung dort ist die
    // wichtigste Information der ganzen Phase 1 und schlägt „besucht".
    case 'kompakt':
    case 'befunde':
      return hatWarnBefund(sig.befunde) ? 'warn' : 'done';

    case 'vb':
      return sig.vbZugeordnet ? 'done' : 'todo';

    // Diese drei zeigen ausschliesslich Ergebnisse des Analyse-Laufs.
    case 'canvas':
    case 'delta':
    case 'wirkung':
      return sig.infografikDa ? 'done' : 'todo';

    case 'reader':
      return sig.vbZugeordnet && sig.besucht.has('reader') ? 'done' : 'todo';

    case 'pruefung': {
      const f = sig.fortschritt;
      if (f === null || f.erledigt === 0) return 'todo';
      return f.erledigt < f.gesamt ? 'partial' : 'done';
    }

    case 'abschluss':
      return sig.abschlussbereit ? 'done' : 'todo';
  }
}

/** Erster Schritt, der noch Arbeit trägt. `null`, wenn alles erledigt ist. */
export function naechsterOffenerSchritt(sig: StatusSignale): SchrittKey | null {
  return SCHRITT_ORDER.find(
    s => statusVonSchritt(s, sig) !== 'done',
  ) ?? null;
}

/** Eine Phase ist fertig, wenn jeder ihrer Schritte `done` ist. */
export function phaseIstFertig(phase: Phase, sig: StatusSignale): boolean {
  return phase.schritte.every(s => statusVonSchritt(s, sig) === 'done');
}

/** Anteil erledigter Schritte über den gesamten Ablauf (0…1). */
export function ablaufFortschritt(sig: StatusSignale): number {
  const done = SCHRITT_ORDER.filter(s => statusVonSchritt(s, sig) === 'done').length;
  return done / SCHRITT_ORDER.length;
}
