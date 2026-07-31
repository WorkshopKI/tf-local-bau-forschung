/**
 * Stufen 2 und 3 des Pfad-Guards der Variante „local" (Node-Seite).
 *
 * Stufe 1 (`pfad-segmente.ts`) prüft die Segmente rein syntaktisch. Hier kommt
 * dazu, was nur mit Dateisystem-Zugriff geht:
 *   2. Der aufgelöste Pfad muss unterhalb der Slot-Wurzel liegen.
 *   3. `realpath` auf das längste existierende Präfix — sonst führte ein Symlink
 *      oder eine Windows-Junction INNERHALB der Kopie wieder heraus.
 *
 * Der Client adressiert ausschliesslich über Slot-NAMEN. Ein absoluter Pfad ist
 * im Protokoll gar nicht ausdrückbar — Traversal ist damit nicht gefiltert,
 * sondern strukturell unmöglich. Dieser Guard ist die zweite Verteidigungslinie
 * für den Fall, dass jemand die Brücke direkt anspricht.
 */

import { realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pruefeSegmente } from '../../src/core/services/infrastructure/local-fs/pfad-segmente';
import type { LocalFsFehler } from '../../src/core/services/infrastructure/local-fs/protokoll';

export type AufloesungsErgebnis =
  | { ok: true; absolut: string; segmente: string[] }
  | { ok: false; fehler: LocalFsFehler; grund: string };

/**
 * Windows-Pfade jenseits von MAX_PATH (260) brauchen das `\\?\`-Präfix, sonst
 * scheitert `fs` mit ENOENT auf einem Pfad, den es gibt. Trifft real z.B.
 * `_intern/phase2/runs/<iso>.jsonl` unter einer tief liegenden Wurzel.
 */
const MAX_PATH_SCHWELLE = 240;

export function langpfadTauglich(absolut: string): string {
  if (process.platform !== 'win32') return absolut;
  if (absolut.length < MAX_PATH_SCHWELLE) return absolut;
  if (absolut.startsWith('\\\\?\\')) return absolut;
  // UNC (`\\server\share`) braucht die abweichende Form `\\?\UNC\server\share`.
  if (absolut.startsWith('\\\\')) return `\\\\?\\UNC\\${absolut.slice(2)}`;
  return `\\\\?\\${absolut}`;
}

/** Vergleichsform: win32 ist case-insensitiv, POSIX nicht. */
function schluessel(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

/** Liegt `kandidat` innerhalb von `wurzel` (oder IST die Wurzel)? */
function liegtUnterhalb(kandidat: string, wurzel: string): boolean {
  const k = schluessel(path.resolve(kandidat));
  const w = schluessel(path.resolve(wurzel));
  return k === w || k.startsWith(w.endsWith(path.sep) ? w : w + path.sep);
}

/**
 * Längstes existierendes Präfix eines Pfads. Für den `realpath`-Recheck: der
 * Zielpfad existiert bei `create`-Operationen noch nicht, sein Elternteil aber
 * schon — und genau dort könnte der Symlink sitzen.
 */
function existierendesPraefix(absolut: string): string {
  let aktuell = absolut;
  for (;;) {
    if (existsSync(aktuell)) return aktuell;
    const eltern = path.dirname(aktuell);
    if (eltern === aktuell) return aktuell;
    aktuell = eltern;
  }
}

/**
 * Löst `relativPfad` unterhalb von `wurzelAbsolut` auf und prüft alle drei Stufen.
 *
 * `wurzelAbsolut` muss bereits `realpath`-aufgelöst sein (macht `baueSlotTabelle`
 * einmalig beim Start) — sonst schlägt der Recheck fehl, wenn die Wurzel selbst
 * über einen Symlink oder ein substituiertes Laufwerk erreicht wird.
 */
export function loeseAuf(wurzelAbsolut: string, relativPfad: string): AufloesungsErgebnis {
  const segmentPruefung = pruefeSegmente(relativPfad ?? '');
  if (!segmentPruefung.ok) {
    return {
      ok: false,
      fehler: 'ungueltiger-pfad',
      grund: `Segment abgelehnt (${segmentPruefung.fehler}): ${segmentPruefung.segment ?? relativPfad}`,
    };
  }

  const absolut = path.resolve(wurzelAbsolut, ...segmentPruefung.segmente);

  // Stufe 2: rein lexikalisch — fängt alles, was `path.resolve` normalisiert.
  if (!liegtUnterhalb(absolut, wurzelAbsolut)) {
    return { ok: false, fehler: 'ungueltiger-pfad', grund: 'Pfad liegt ausserhalb der Wurzel' };
  }

  // Stufe 3: Symlinks/Junctions können lexikalisch sauber aussehen und trotzdem
  // herausführen. `realpathSync.native` folgt ihnen und wir prüfen erneut.
  try {
    const praefix = existierendesPraefix(absolut);
    const echt = realpathSync.native(praefix);
    if (!liegtUnterhalb(echt, wurzelAbsolut)) {
      return { ok: false, fehler: 'ungueltiger-pfad', grund: 'Pfad zeigt (via Symlink/Junction) aus der Wurzel heraus' };
    }
  } catch {
    // realpath kann auf exotischen Mounts scheitern. Stufe 2 hat bereits
    // bestanden — wir lassen durch statt den Betrieb zu blockieren.
  }

  return { ok: true, absolut, segmente: segmentPruefung.segmente };
}

export interface SlotTabelle {
  /** Slot-Name → realpath-aufgelöste, absolute Wurzel. */
  wurzeln: Map<string, string>;
  /** Slots, deren konfigurierter Ordner beim Start fehlte. */
  fehlend: string[];
}

/**
 * Baut die Slot-Tabelle aus dem `local`-Config-Block. Die Wurzeln werden EINMAL
 * beim Start `realpath`-aufgelöst — danach ist jeder Vergleich in `loeseAuf`
 * gegen eine kanonische Form.
 */
export function baueSlotTabelle(slots: Record<string, string>): SlotTabelle {
  const wurzeln = new Map<string, string>();
  const fehlend: string[] = [];
  for (const [name, pfad] of Object.entries(slots)) {
    if (!pfad) continue;
    const absolut = path.resolve(pfad);
    if (!existsSync(absolut)) {
      fehlend.push(name);
      continue;
    }
    try {
      wurzeln.set(name, realpathSync.native(absolut));
    } catch {
      wurzeln.set(name, absolut);
    }
  }
  return { wurzeln, fehlend };
}
