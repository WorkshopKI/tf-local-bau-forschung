/**
 * Der Phasen-Vergleichs-Report: **alte abgeleitete Spine-Phase** gegen **neue
 * ZAH-Phase aus dem Status-Code**, Verbund für Verbund.
 *
 * Warum es ihn gibt: der Rückbau des Ableitungsmodells (Ränge, Prominenz,
 * `terminal`) ist der einzige nicht-additive Schritt des Vorgangssystems. Bevor
 * er passiert, muss belegt sein, dass die neue Lesebrille dasselbe zeigt wie die
 * alte — sonst verschöbe sich unbemerkt, wo Anträge im Verfahren stehen.
 *
 * Dieser Report ist das Belegstück. **Null Abweichungen (oder nur erklärte)** ist
 * das Eintrittskriterium für den späteren Rückbau-Lauf; er ersetzt damit die
 * Idee hinter dem `byte-identitaet`-Guard, der die alte Map gegen sich selbst
 * hielt.
 *
 * Die ZAH-Phase hängt am **Statuswert** (`status`/`verbund_status`), die
 * Spine-Phase am ganzen Feld-Ensemble. Verglichen wird deshalb gegen die
 * Abbildung ZAH-Phase → Spine-Phase; eine Abweichung heißt „hier sagen beide
 * Lesarten etwas anderes", nicht „hier ist ein Fehler".
 *
 * Rein und deterministisch: keine IO, keine Uhr (`heute` wird injiziert).
 */
import { leiteStatusAb } from './ableitung';
import type { VerbundFelder } from './cockpit-berechnung';
// Die Abbildung ZAH-Phase → Spine-Phase wohnt in `zah-phasen.ts` und wird hier
// nur BENUTZT, nicht weitergereicht: ein zweiter Ausgang für dasselbe Objekt
// wäre ein zweiter Fundort — genau das, was der Modulkopf dort ausschließt.
import { ZAH_ZU_SPINE } from './zah-phasen';
import { normalisiereWert, type MappingVersion, type SpinePhase, type ZahPhaseId } from './typen';

/** Ein Verbund im Vergleich beider Lesarten. */
export interface PhasenVergleichZeile {
  verbundId: string;
  /** Roher Statuswert, auf dem die ZAH-Phase beruht (leer = keiner gesetzt). */
  statusRoh: string;
  /** Code des Statuswerts, `null` = nicht im Katalog. */
  code: number | null;
  /** Die neue Lesart. `null` = Marker oder unbekannt. */
  zahPhase: ZahPhaseId | null;
  /** Die alte, abgeleitete Lesart. */
  spinePhase: SpinePhase;
  /** Die neue Lesart, auf die alte Wirbelsäule übersetzt. */
  erwarteteSpine: SpinePhase | null;
  /** Warum die Zeile abweicht — leer, wenn sie übereinstimmt. */
  grund: 'abweichung' | 'ohne-code' | 'marker' | 'kein-status' | null;
}

export interface PhasenVergleich {
  zeilen: PhasenVergleichZeile[];
  /** Beide Lesarten stimmen überein. */
  gleich: number;
  /** Echte Abweichungen — die Zahl, die vor dem Rückbau null sein soll. */
  abweichend: number;
  /** Erklärte Nicht-Vergleiche (Marker, ohne Code, ohne Status). */
  unvergleichbar: number;
}

/** Die Wert-Felder, deren Statuswert die ZAH-Phase trägt (VB zuerst). */
const STATUS_FELDER = ['verbund_status', 'status'] as const;

/** Der erste gesetzte Statuswert eines Verbunds (Verbund-Status hat Vorrang). */
function statusVon(vf: VerbundFelder): string {
  for (const feldId of STATUS_FELDER) {
    const direkt = vf.felder[feldId]?.trim();
    if (direkt) return direkt;
    for (const rec of Object.values(vf.tvFelder)) {
      const w = rec[feldId]?.trim();
      if (w) return w;
    }
  }
  return '';
}

/**
 * Stellt beide Lesarten gegenüber. `heute` nur für die Datumsregeln der alten
 * Ableitung; ohne Stichtag evaluieren die zu `false` (wie überall).
 */
export function vergleichePhasen(
  version: MappingVersion, alle: readonly VerbundFelder[], heute?: string,
): PhasenVergleich {
  // Statuswert → Katalog-Eintrag. Über beide Wert-Felder, weil derselbe Rohwert
  // unter `status` und `verbund_status` geführt wird.
  const nachWert = new Map<string, { code?: number; zahPhaseId?: ZahPhaseId | null; marker?: boolean }>();
  for (const w of version.werte) {
    const k = normalisiereWert(w.wert);
    if (!nachWert.has(k)) nachWert.set(k, w);
  }

  const zeilen: PhasenVergleichZeile[] = [];
  let gleich = 0;
  let abweichend = 0;
  let unvergleichbar = 0;

  for (const vf of alle) {
    const statusRoh = statusVon(vf);
    const spinePhase = leiteStatusAb(version, vf.felder, vf.tvFelder, heute).spinePhase;
    const eintrag = statusRoh ? nachWert.get(normalisiereWert(statusRoh)) : undefined;
    const code = eintrag?.code ?? null;
    const zahPhase = eintrag?.zahPhaseId ?? null;

    const basis = { verbundId: vf.verbundId, statusRoh, code, zahPhase, spinePhase };

    if (!statusRoh) {
      zeilen.push({ ...basis, erwarteteSpine: null, grund: 'kein-status' });
      unvergleichbar++;
      continue;
    }
    if (code === null) {
      zeilen.push({ ...basis, erwarteteSpine: null, grund: 'ohne-code' });
      unvergleichbar++;
      continue;
    }
    if (zahPhase === null) {
      zeilen.push({ ...basis, erwarteteSpine: null, grund: 'marker' });
      unvergleichbar++;
      continue;
    }

    const erwarteteSpine = ZAH_ZU_SPINE[zahPhase];
    if (erwarteteSpine === spinePhase) {
      zeilen.push({ ...basis, erwarteteSpine, grund: null });
      gleich++;
    } else {
      zeilen.push({ ...basis, erwarteteSpine, grund: 'abweichung' });
      abweichend++;
    }
  }

  return { zeilen, gleich, abweichend, unvergleichbar };
}

/** Eine wiederkehrende Abweichungs-Form, mit Anzahl. */
export interface AbweichungsMuster {
  statusRoh: string;
  code: number | null;
  zahPhase: ZahPhaseId | null;
  spinePhase: SpinePhase;
  anzahl: number;
  /** Beispiel-Verbünde (max. 5) zum Nachschlagen. */
  beispiele: string[];
}

/**
 * Gruppiert die Abweichungen nach (Statuswert, alte Phase) — absteigend nach
 * Anzahl.
 *
 * Ohne diese Verdichtung ist der Report unbrauchbar: die Abweichungen sind
 * **systematisch**, nicht zufällig. Die alte Ableitung liest das ganze
 * `D_`-Feld-Ensemble (höchster Rang gewinnt, terminal schlägt Rang), die neue
 * Lesart nur den Statustext — ein Antrag mit Status „beantragt", an dem schon
 * `D_AT4` hängt, kam alt als „Fachprüfung" heraus. Eine flache Liste mit
 * hunderten Zeilen versteckt genau das; ein Dutzend Muster macht es lesbar und
 * damit entscheidbar.
 */
export function abweichungsMuster(v: PhasenVergleich): AbweichungsMuster[] {
  const proMuster = new Map<string, AbweichungsMuster>();
  for (const z of v.zeilen) {
    if (z.grund !== 'abweichung') continue;
    const key = `${z.statusRoh}|${z.spinePhase}`;
    const vorhanden = proMuster.get(key);
    if (vorhanden) {
      vorhanden.anzahl++;
      if (vorhanden.beispiele.length < 5) vorhanden.beispiele.push(z.verbundId);
      continue;
    }
    proMuster.set(key, {
      statusRoh: z.statusRoh,
      code: z.code,
      zahPhase: z.zahPhase,
      spinePhase: z.spinePhase,
      anzahl: 1,
      beispiele: [z.verbundId],
    });
  }
  return [...proMuster.values()].sort(
    (a, b) => b.anzahl - a.anzahl || a.statusRoh.localeCompare(b.statusRoh, 'de'),
  );
}

/** Kurzfassung für die Oberfläche. */
export function vergleichZusammenfassung(v: PhasenVergleich): string {
  const gesamt = v.zeilen.length;
  if (gesamt === 0) return 'Kein Bestand geladen — nichts zu vergleichen.';
  if (v.abweichend === 0) {
    return `${v.gleich} von ${gesamt} Verbünden stimmen überein, `
      + `${v.unvergleichbar} sind nicht vergleichbar. Keine Abweichung.`;
  }
  return `${v.abweichend} von ${gesamt} Verbünden weichen ab `
    + `(${v.gleich} gleich, ${v.unvergleichbar} nicht vergleichbar).`;
}
