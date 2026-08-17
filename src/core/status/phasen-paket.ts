/**
 * Der **Verfahrensschnitt als eigenes Gepäckstück** — die Phasen-Achse einer
 * Fassung ausbauen, transportieren und in eine andere Fassung einsetzen, ohne
 * dabei einen einzigen Kürzel-Stammwert anzufassen.
 *
 * Warum getrennt von `export-import.ts`: dort steht der Ganz-Katalog-Weg (eine
 * `MappingVersion` raus, eine rein). Der taugt nicht, wenn zwei Achsen auf
 * verschiedenen Ständen richtig sind — genau der Fall, für den es diese Datei
 * gibt: auf einem veraltet geladenen Katalog wurden Kürzel gepflegt und
 * veröffentlicht, der zuvor gepflegte Verfahrensschnitt fiel damit zurück. Eine
 * ältere Fassung zu laden holte die Phasen zurück und verwürfe die richtige
 * Kürzel-Arbeit. Phasen ändern sich ohnehin viel seltener als Kürzel; die beiden
 * Achsen gehören deshalb dauerhaft getrennt transportierbar.
 *
 * **Der Schlüssel ist überall der Code bzw. die `feldId`, nie die Wert-Id.**
 * `wertId()` ist `${feldId}::${normalisiert(wert)}` — weicht die Schreibweise
 * eines Rohwerts zwischen zwei Installationen ab, liefe ein Id-Abgleich ins
 * Leere. Der amtliche Code und der rohe Spalten-Code sind die stabilen
 * Bezeichner (dieselbe Begründung wie in {@link setzeCodePhasen}).
 *
 * **Merge, kein Rundumschlag.** Das Paket ist eine Aussage über die Einträge,
 * die es nennt. Was es nicht nennt, bleibt im Ziel unverändert; was es nennt und
 * das Ziel nicht kennt, wird gemeldet statt angelegt. Ein Paket darf keine
 * Katalogzeilen erzeugen — es kuriert eine Achse, es importiert keine Daten.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { zahPhasenVon } from './zah-phasen';
import {
  normalisiereReihenfolge, pruefeZahPhasen, setzeCodePhasen, verwaisteZuordnungen,
  type VerwaisteZuordnungen,
} from './zah-phasen-edit';
import { setzeFeldPhasen, setzeZieltage } from './katalog-edit';
import type { MappingVersion, ZahPhase, ZahPhaseId } from './typen';

/** Formatmarke der Datei. Unterscheidet das Paket vom Voll-Export, der keine
 *  `art` trägt — die Datei sagt selbst, was sie ist, statt dass zwei Knöpfe es
 *  auseinanderhalten müssten. */
export const PHASEN_PAKET_ART = 'zah-phasen';

/** Dateiformat-Version des Pakets — NICHT die Katalog-Fassung (die steht in
 *  `herkunft.fassung`). */
export const PHASEN_PAKET_FORMAT = 1;

/**
 * Der transportable Verfahrensschnitt.
 *
 * Was **nicht** darin steht, ist die Hälfte des Zwecks: keine Kürzel-Stammdaten,
 * keine Kategorien, kein `kurzLabel`, keine `prominenz`, keine To-do-Regeln,
 * keine Textbausteine, kein Betrachtungsbereich, keine Trigger.
 */
export interface PhasenPaket {
  art: typeof PHASEN_PAKET_ART;
  version: typeof PHASEN_PAKET_FORMAT;
  /** Woher der Schnitt stammt — steht in der Rückmeldung („Phasen aus v12"). */
  herkunft: { fassung: number; autor: string | null; zeitstempel: string };
  /** Die vollständige Phasenliste, wie sie in der Quelle GALT (Lücken einer
   *  Bestandsfassung sind aus dem Seed geschlossen). */
  phasen: ZahPhase[];
  /** Code → Phase, je Code einmal. `null` = Marker-Gruppe, ausdrücklich neben
   *  dem Verfahren — nicht dasselbe wie „nicht genannt". */
  codePhasen: { code: number; phaseId: ZahPhaseId | null }[];
  /** Datums-Kürzel → Phase, je `feldId` einmal. */
  feldPhasen: { feldId: string; phaseId: ZahPhaseId }[];
  /** Zieltage je Code. Nur GESETZTE Werte: „kein Ziel definiert" ist eine
   *  Aussage, die aus der Ferne zu setzen niemand braucht — und ein Paket, das
   *  Ziele löschen kann, ist gefährlicher als eines, das es nicht kann. */
  zieltage: { code: number; tage: number }[];
}

/** Was die Übernahme bewirkt hat. Zahlen sind **Änderungen**, nicht Fundstellen:
 *  „74 Zuordnungen" an einem Paket, das nichts verschiebt, wäre eine Lüge mit
 *  richtiger Zahl. Einzige Ausnahme ist {@link UebernahmeBericht.phasen}. */
export interface UebernahmeBericht {
  /** Phasen in der übernommenen Liste (Bestand, keine Differenz — die Bilanz der
   *  Phasen-Änderungen liefert `katalogDrift`/`driftSatz`). */
  phasen: number;
  /** Codes, deren Zuordnung sich geändert hat. */
  codes: number;
  /** Datums-Kürzel, deren Phase sich geändert hat. */
  felder: number;
  /** Codes, deren Zieltag sich geändert hat. */
  zieltage: number;
  /** Codes aus dem Paket, die das Ziel nicht führt — aufsteigend. */
  unbekannteCodes: number[];
  /** Dasselbe für Datums-Kürzel — alphabetisch. */
  unbekannteFelder: string[];
  /**
   * Zuordnungen, die **danach** auf einen Schritt zeigen, den der neue Zuschnitt
   * nicht führt.
   *
   * Sie entstehen, weil die Phasenliste ERSETZT wird: hat das Ziel einen Wert an
   * einer Phase, die das Paket abgeschafft hat, und sagt das Paket zu diesem Code
   * nichts, bleibt der Verweis stehen. Das ist ein getragener Zustand (die App
   * liest ihn wie „ohne Phase"), aber keiner, den jemand erst drei Klicks später
   * im Kopf des Katalog-Tabs entdecken soll.
   */
  verwaist: VerwaisteZuordnungen;
  /** Was der Übernahme im Weg stand. Nicht leer ⇒ es wurde **nichts** geändert. */
  fehler: string[];
}

export interface PhasenUebernahme {
  /** Bei Fehlern identisch mit der Eingabe (dieselbe Referenz). */
  version: MappingVersion;
  bericht: UebernahmeBericht;
}

export interface PhasenPaketErgebnis {
  ok: boolean;
  paket?: PhasenPaket;
  fehler?: string;
}

function leererBericht(): UebernahmeBericht {
  return {
    phasen: 0, codes: 0, felder: 0, zieltage: 0,
    unbekannteCodes: [], unbekannteFelder: [], verwaist: { werte: 0, felder: 0 }, fehler: [],
  };
}

// --- Ausbauen ---------------------------------------------------------------

/**
 * Zieht den Verfahrensschnitt aus einer Fassung.
 *
 * Aufgenommen wird nur, was die Fassung ausdrücklich SAGT — und zwar in einer
 * Form, die am Zielort noch etwas bedeutet. Drei Fälle fallen deshalb raus:
 *
 * - `zahPhaseId === undefined` („hat noch niemand entschieden"): käme es mit,
 *   würde am Zielort aus einer offenen Frage eine Antwort. `null` dagegen ist
 *   die gepflegte Aussage „läuft neben dem Verfahren" und reist mit.
 * - **Verwaiste Zuordnungen** — ein Eintrag, der auf eine Phase zeigt, die
 *   diese Fassung nicht (mehr) führt. Das ist ein normaler, von der App
 *   ausdrücklich getragener Katalogzustand (`verwaisteZuordnungen`): gelesen
 *   wird er wie „ohne Phase", umgeschrieben wird er nicht. Als Paket-Inhalt
 *   wäre er wertlos und schädlich zugleich — er trüge einen toten Verweis in
 *   eine Fassung, in der der Eintrag vielleicht sauber zugeordnet ist. Er ist
 *   **keine Aussage**, also transportiert ihn das Paket nicht.
 * - Werte ohne `code` — der Code ist der einzige übertragbare Schlüssel.
 *
 * Die Phasenliste kommt über `zahPhasenVon`, also im geltenden Zuschnitt — eine
 * Fassung von vor v3.6 führt `fristLaeuft` nicht, und ein Paket mit halben
 * Phasen wäre am Zielort nicht mehr rekonstruierbar.
 *
 * **Das Paket transportiert keine Arbeitslisten** und konnte es auch vor v4.87
 * nur versehentlich: die damalige `kategorieVorgabe` reiste als Teil der
 * Phasenliste mit und verschob am Zielort Anträge zwischen Reitern. Das Feld ist
 * entfallen; die Arbeitsliste steht im Code und reist gar nicht.
 */
export function bauePhasenPaket(v: MappingVersion): PhasenPaket {
  const phasen = [...zahPhasenVon(v.zahPhasen)];
  const gefuehrt = new Set(phasen.map(p => p.id));
  /** Zeigt die Zuordnung auf eine Phase, die diese Fassung nicht führt? `null`
   *  ist ausdrücklich KEIN Verweis ins Leere, sondern die Marker-Gruppe. */
  const verwaist = (id: ZahPhaseId | null): boolean => id !== null && !gefuehrt.has(id);

  const codePhasen: PhasenPaket['codePhasen'] = [];
  const zieltage: PhasenPaket['zieltage'] = [];
  // Je Code EINMAL: derselbe Code steht im Katalog unter `status` UND
  // `verbund_status`; zweimal im Paket hieße, dass die Sortierung entscheidet.
  const phaseGesehen = new Set<number>();
  const zielGesehen = new Set<number>();

  for (const w of v.werte) {
    if (w.code === undefined) continue;
    if (w.zahPhaseId !== undefined && !verwaist(w.zahPhaseId) && !phaseGesehen.has(w.code)) {
      phaseGesehen.add(w.code);
      codePhasen.push({ code: w.code, phaseId: w.zahPhaseId });
    }
    if (w.zieltage != null && !zielGesehen.has(w.code)) {
      zielGesehen.add(w.code);
      zieltage.push({ code: w.code, tage: w.zieltage });
    }
  }

  const feldPhasen = v.felder
    .filter(f => f.zahPhaseId != null && !verwaist(f.zahPhaseId))
    .map(f => ({ feldId: f.feldId, phaseId: f.zahPhaseId! }));

  return {
    art: PHASEN_PAKET_ART,
    version: PHASEN_PAKET_FORMAT,
    herkunft: { fassung: v.version, autor: v.autor, zeitstempel: v.zeitstempel },
    phasen,
    codePhasen: codePhasen.sort((a, b) => a.code - b.code),
    feldPhasen: feldPhasen.sort((a, b) => a.feldId.localeCompare(b.feldId)),
    zieltage: zieltage.sort((a, b) => a.code - b.code),
  };
}

/** Der Dateiinhalt — eingerückt wie der Voll-Export, damit ein Mensch ihn lesen
 *  und im Zweifel von Hand prüfen kann. */
export function exportierePhasenPaket(v: MappingVersion): string {
  return JSON.stringify(bauePhasenPaket(v), null, 2);
}

// --- Erkennen und prüfen ----------------------------------------------------

/** Trägt dieses JSON die Formatmarke? Die eine Stelle, an der Voll-Export und
 *  Paket auseinandergehalten werden — von der Import-Weiche UND von
 *  `validiereImport`, damit dort eine Absage statt „Struktur unvollständig"
 *  steht. */
export function istPhasenPaket(daten: unknown): boolean {
  return !!daten && typeof daten === 'object'
    && (daten as { art?: unknown }).art === PHASEN_PAKET_ART;
}

function istPhase(p: unknown): p is ZahPhase {
  if (!p || typeof p !== 'object') return false;
  const k = p as Partial<ZahPhase>;
  return typeof k.id === 'string' && typeof k.label === 'string' && typeof k.reihenfolge === 'number';
}

/** Prüft ein eingelesenes Paket auf Struktur. Die fachlichen Grenzen (Anzahl,
 *  eindeutige Kennungen, Zuordnungen ins Leere) prüft erst
 *  {@link uebernimmPhasen} — sie hängen an der Zusammensetzung, nicht an der
 *  Form, und ihre Sätze gehören in denselben Bericht wie das Ergebnis. */
export function validierePhasenPaket(daten: unknown): PhasenPaketErgebnis {
  if (!istPhasenPaket(daten)) return { ok: false, fehler: 'Kein Phasen-Paket.' };
  const p = daten as Partial<PhasenPaket>;
  if (p.version !== PHASEN_PAKET_FORMAT) {
    return { ok: false, fehler: `Unbekanntes Paket-Format (${String(p.version)}), erwartet ${PHASEN_PAKET_FORMAT}.` };
  }
  if (!Array.isArray(p.phasen) || !p.phasen.every(istPhase)) {
    return { ok: false, fehler: 'Die Phasenliste fehlt oder trägt einen ungültigen Eintrag.' };
  }
  if (!Array.isArray(p.codePhasen) || !p.codePhasen.every(z => (
    !!z && typeof z.code === 'number'
    && (z.phaseId === null || typeof z.phaseId === 'string')
  ))) {
    return { ok: false, fehler: 'Ungültige Code-Zuordnung.' };
  }
  if (!Array.isArray(p.feldPhasen) || !p.feldPhasen.every(z => (
    !!z && typeof z.feldId === 'string' && typeof z.phaseId === 'string'
  ))) {
    return { ok: false, fehler: 'Ungültige Kürzel-Zuordnung.' };
  }
  if (!Array.isArray(p.zieltage) || !p.zieltage.every(z => (
    !!z && typeof z.code === 'number' && typeof z.tage === 'number'
  ))) {
    return { ok: false, fehler: 'Ungültiger Zieltag-Eintrag.' };
  }
  const h = p.herkunft;
  if (!h || typeof h !== 'object' || typeof h.fassung !== 'number') {
    return { ok: false, fehler: 'Die Herkunftsangabe fehlt.' };
  }
  return { ok: true, paket: daten as PhasenPaket };
}

// --- Einsetzen --------------------------------------------------------------

/**
 * Setzt den Schnitt aus dem Paket in `ziel` ein.
 *
 * **Erst prüfen, dann in einem Durchgang anwenden.** Ein halb übernommener
 * Schnitt — neue Phasenliste, aber alte Zuordnungen — wäre schlimmer als gar
 * keiner: er sähe gepflegt aus und wäre verwaist. Steht etwas im Weg, kommt
 * `ziel` unverändert zurück (dieselbe Referenz) und der Bericht trägt die Sätze.
 *
 * Die Phasenliste wird **ersetzt**, nicht vereinigt — das ist der Zweck („1
 * Phase entfernt · 2 umbenannt"). Die Zuordnungen dagegen werden gemischt: ein
 * Code, den das Paket nicht nennt, behält seine.
 *
 * Genau daraus können im Ziel **neue Verwaiste** entstehen: schafft das Paket
 * eine Phase ab, an der das Ziel noch Einträge führt, und sagt es zu deren Codes
 * nichts, zeigen sie danach ins Leere. Das ist kein Grund abzubrechen — die App
 * trägt diesen Zustand (`verwaisteZuordnungen`) — aber einer, es zu SAGEN; die
 * Zahl steht im Bericht.
 */
export function uebernimmPhasen(ziel: MappingVersion, paket: PhasenPaket): PhasenUebernahme {
  const fehler = pruefeZahPhasen(paket.phasen);

  const bekannt = new Set(paket.phasen.map(p => p.id));
  const fremde = [...new Set([
    ...paket.codePhasen.filter(z => z.phaseId !== null && !bekannt.has(z.phaseId))
      .map(z => z.phaseId as ZahPhaseId),
    ...paket.feldPhasen.filter(z => !bekannt.has(z.phaseId)).map(z => z.phaseId),
  ])].sort();
  // Kann nach `bauePhasenPaket` nur noch eine von Hand editierte Datei
  // auslösen: verwaiste Zuordnungen einer Fassung räumt schon der Ausbau weg.
  if (fremde.length > 0) {
    fehler.push(
      'Das Paket ordnet Einträge Phasen zu, die es selbst nicht führt: '
      + `${fremde.join(', ')}.`,
    );
  }

  if (fehler.length > 0) return { version: ziel, bericht: { ...leererBericht(), fehler } };

  // --- Was das Ziel überhaupt kennt ---
  const zielCodes = new Set<number>();
  for (const w of ziel.werte) if (w.code !== undefined) zielCodes.add(w.code);
  const zielFelder = new Set(ziel.felder.map(f => f.feldId));

  const unbekannteCodes = [...new Set([
    ...paket.codePhasen.map(z => z.code),
    ...paket.zieltage.map(z => z.code),
  ].filter(c => !zielCodes.has(c)))].sort((a, b) => a - b);
  const unbekannteFelder = paket.feldPhasen
    .filter(z => !zielFelder.has(z.feldId)).map(z => z.feldId).sort();

  // --- Was sich dadurch ändert (gezählt VOR dem Anwenden) ---
  const codeMap = new Map<number, ZahPhaseId | null>(
    paket.codePhasen.filter(z => zielCodes.has(z.code)).map(z => [z.code, z.phaseId]),
  );
  const feldMap = new Map<string, ZahPhaseId>(
    paket.feldPhasen.filter(z => zielFelder.has(z.feldId)).map(z => [z.feldId, z.phaseId]),
  );
  const zieltagMap = new Map<number, number>(
    paket.zieltage.filter(z => zielCodes.has(z.code)).map(z => [z.code, z.tage]),
  );

  const codesGeaendert = new Set<number>();
  const zieltageGeaendert = new Set<number>();
  // `setzeZieltage` schlüsselt nach Wert-Id; die Auflösung Code → Ids passiert
  // hier, und zwar über ALLE Zeilen des Codes — sonst trüge `status` einen
  // anderen Zieltag als `verbund_status`.
  const zieltageJeWertId = new Map<string, number>();
  for (const w of ziel.werte) {
    if (w.code === undefined) continue;
    if (codeMap.has(w.code) && w.zahPhaseId !== codeMap.get(w.code)) codesGeaendert.add(w.code);
    const tage = zieltagMap.get(w.code);
    if (tage !== undefined) {
      zieltageJeWertId.set(w.id, tage);
      if (w.zieltage !== tage) zieltageGeaendert.add(w.code);
    }
  }
  const felderGeaendert = ziel.felder
    .filter(f => feldMap.has(f.feldId) && f.zahPhaseId !== feldMap.get(f.feldId)).length;

  // --- Anwenden ---
  let version: MappingVersion = {
    ...ziel,
    zahPhasen: normalisiereReihenfolge(paket.phasen),
  };
  version = setzeCodePhasen(version, codeMap);
  version = setzeFeldPhasen(version, feldMap);
  version = setzeZieltage(version, zieltageJeWertId);

  return {
    version,
    bericht: {
      phasen: paket.phasen.length,
      codes: codesGeaendert.size,
      felder: felderGeaendert,
      zieltage: zieltageGeaendert.size,
      unbekannteCodes,
      unbekannteFelder,
      // Am ERGEBNIS gezählt, nicht als Differenz: was danach ins Leere zeigt,
      // ist die Aussage, die der Kuratorin hilft — woher es kam, nicht.
      verwaist: verwaisteZuordnungen(version),
      fehler: [],
    },
  };
}
