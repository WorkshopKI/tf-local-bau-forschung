/**
 * Die **Status-Erklärung**: warum steht dieser Antrag auf diesem Status, und was
 * ist zuletzt passiert?
 *
 * Vollständig aus Daten gerendert — kein handgepflegter Text, der veralten
 * könnte. Die Bausteine:
 *
 * 1. **Code + Text + ZAH-Phase** aus dem Status-Katalog (`status-codes.ts`).
 *    Kein Treffer heißt „nicht im Katalog", nicht „irgendeine Phase".
 * 2. **Seit wann** — das jüngste Datum, das zum Status passt. Lässt es sich
 *    nicht bestimmen, wird es **weggelassen**, nicht geraten (eine erfundene
 *    Liegezeit wäre schlimmer als keine).
 * 3. **Letzter Vorgang** — die jüngste gefüllte relevante `D_`-Spalte mit
 *    Kürzel-Beschreibung und Rolle.
 * 4. **Was der Trigger auslöste** — die Zeilen der Trigger-Tabelle zu diesem
 *    Kürzel, in Satzform.
 * 5. **Verlauf** — die letzten Datumsspalten chronologisch. Ausdrücklich als
 *    **Näherung** gekennzeichnet: das Fachsystem führt je Kürzel nur EIN Datum,
 *    mehrfach gesetzte Kürzel sind darin nicht unterscheidbar.
 * 6. **Datenstand** — wann importiert, welche Katalog-Fassung, woher.
 *
 * Rein und deterministisch: kein IDB, kein `new Date()` — `stichtag` und
 * `datenstand` reicht der Aufrufer herein.
 */
import { baueChronik, type ChronikEintrag } from './chronik';
import type { FeldVorkommen } from './feld-aufloesung';
import { findeStatusCode, type StatusCodeIndex, type StatusCodeTreffer } from './status-codes';
import { triggerFuerKuerzel } from './trigger-share';
import { rollenLabel } from './rollen';
import {
  zahPhaseLabel, ZAH_ZU_SPINE, SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES,
} from './zah-phasen';
import type { MappingVersion, TriggerZeile, ZahPhaseId } from './typen';

/** Ein Eintrag der Verlaufs-Näherung. */
export interface VerlaufSchritt {
  /** ISO-Tag `YYYY-MM-DD`. */
  tag: string;
  /** Kürzel des Fachsystems, falls das Feld eines trägt. */
  code?: string;
  /** Bezeichnung aus der Kürzel-Zuarbeit. */
  label: string;
  /** `AB/FB` bzw. `alle` — wer den Eintrag setzt. */
  rollen: string;
  /** Begleittext aus der `T_`-Spalte, falls gefüllt. */
  text?: string;
}

/** Der letzte Vorgang, so weit er sich aus den Datumsspalten ablesen lässt. */
export interface LetzterVorgang extends VerlaufSchritt {
  /** Trigger-Zeilen zu diesem Kürzel, in Folge-Reihenfolge (Satzform). */
  trigger: TriggerZeile[];
}

export interface Herleitung {
  /** Rohwert, wie er im Export steht. */
  statusRoh: string;
  /** Amtlicher Code — `null`, wenn der Katalog den Text nicht kennt. */
  code: number | null;
  /** Amtliche Bezeichnung; ohne Treffer der Rohwert selbst. */
  statusText: string;
  /** Wie der Text auf den Code kam (`exakt` / über eine lose Variante). */
  joinArt: StatusCodeTreffer['art'] | null;
  zahPhase: ZahPhaseId | null;
  zahPhaseLabel: string;
  /** Marker-Status (29/88/93/94) laufen bewusst ohne Phase mit. */
  marker: boolean;
  /** ISO-Tag, seit wann der Status gilt — `null`, wenn nicht bestimmbar. */
  seit: string | null;
  /** Tage seit `seit`, gegen den Stichtag. `null`, wenn `seit` fehlt. */
  tage: number | null;
  letzterVorgang: LetzterVorgang | null;
  /** Chronologisch ABSTEIGEND, ohne den letzten Vorgang. */
  verlauf: VerlaufSchritt[];
  /** Wie viele Schritte die Näherung insgesamt kennt (auch die ungezeigten). */
  verlaufGesamt: number;
  /** Warnung, wenn der Statuswert nicht im Katalog steht. */
  nichtImKatalog: boolean;
  datenstand: Datenstand;
}

/** Woher die Anzeige ihre Zahlen hat — gehört sichtbar an jede Erklärung. */
export interface Datenstand {
  /** ISO-Zeitpunkt des jüngsten CSV-Imports; `null` wenn unbekannt. */
  importiertAm: string | null;
  katalogVersion: number;
  /** Import-Stand der Trigger-Tabelle; `null` = keine importiert. */
  triggerVersion: number | null;
  /** Woher die Trigger-Tabelle geladen wurde. */
  triggerHerkunft: 'share' | 'cache' | 'leer';
}

export interface HerleitungEingabe {
  version: MappingVersion;
  /** Alle gesetzten Statuseinträge des Verbunds (`sammleVorkommen`). */
  vorkommen: readonly FeldVorkommen[];
  /** Der rohe Statuswert, der erklärt werden soll. */
  statusRoh: unknown;
  trigger: readonly TriggerZeile[];
  datenstand: Datenstand;
  /** ISO — injiziert, nie `new Date()` hier drin. */
  stichtag: string;
  /** Nachschlage-Index; Default ist die Auslieferung. */
  index?: StatusCodeIndex;
  /** Wie viele Verlaufs-Schritte höchstens (Default 5, siehe Konzept 6.1). */
  maxVerlauf?: number;
}

const MS_TAG = 86_400_000;

/** Chronik-Eintrag → Anzeige-Schritt. */
function alsSchritt(e: ChronikEintrag): VerlaufSchritt {
  return {
    tag: e.tag,
    ...(e.feld.code ? { code: e.feld.code } : {}),
    label: e.feld.label,
    rollen: rollenLabel(e.feld),
    ...(e.text ? { text: e.text } : {}),
  };
}

/**
 * Seit wann gilt der Status?
 *
 * Belastbar ist nur ein Datum, das **zum Status gehört**. Weil der Export keine
 * Status-Historie führt, gibt es dafür genau eine ehrliche Quelle: ein
 * Datumsfeld, das der Katalog derselben ZAH-Phase zuordnet wie den aktuellen
 * Status. Findet sich keines, liefert die Funktion `null` — und die Anzeige
 * lässt die Zeile weg, statt das jüngste beliebige Datum als „seit" auszugeben.
 */
function bestimmeSeit(
  chronik: readonly ChronikEintrag[],
  version: MappingVersion,
  zahPhase: ZahPhaseId | null,
): string | null {
  if (!zahPhase) return null;
  // Welche Datumsfelder gehören zu dieser Phase? Über den Katalog-Eintrag des
  // Feldes: dort steht die (alte) Spine-Phase, die wir auf die ZAH-Phase
  // abbilden — dieselbe Tabelle, die auch der Phasen-Vergleich nutzt.
  const gesucht = ZAH_ZU_SPINE[zahPhase];
  const passend = chronik.filter(e => {
    const feld = version.felder.find(f => f.feldId === e.feld.feldId);
    return feld?.spinePhase !== undefined && feld.spinePhase === gesucht;
  });
  const letzter = passend[passend.length - 1];
  return letzter?.tag ?? null;
}

/**
 * Baut die Erklärung. Rein — dieselbe Eingabe liefert immer dieselbe Ausgabe.
 *
 * Berücksichtigt für Verlauf und letzten Vorgang nur **relevante** Kürzel, wenn
 * die Fassung welche markiert hat; sonst alle. So bleibt die Erklärung kurz,
 * ohne dass eine leere Relevanz-Liste sie leer laufen ließe.
 */
export function baueHerleitung(e: HerleitungEingabe): Herleitung {
  const statusRoh = typeof e.statusRoh === 'string' ? e.statusRoh.trim() : '';
  const treffer = findeStatusCode(statusRoh, e.index);
  const code = treffer?.eintrag.code ?? null;

  // Die Phase steht am kuratierten Statuswert — SOFERN die Fassung schon Codes
  // trägt. Bestandsfassungen tun das erst nach dem Nachziehen; bis dahin greift
  // der Auslieferungs-Schnitt, damit die Erklärung nicht wochenlang „keine
  // Phase" behauptet, obwohl der Code längst einer zugeordnet ist.
  const wertEintrag = code !== null ? e.version.werte.find(w => w.code === code) : undefined;
  const zahPhase: ZahPhaseId | null = wertEintrag?.zahPhaseId !== undefined
    ? wertEintrag.zahPhaseId
    : (code !== null ? SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null : null);
  const marker = wertEintrag?.marker === true
    || (code !== null && wertEintrag?.marker === undefined && SEED_MARKER_CODES.has(code));

  // Relevanz filtert, sobald die Fassung überhaupt welche kennt. Nachgeschlagen
  // wird in der FASSUNG, nicht am Feld-Objekt im Vorkommen: das kann aus einer
  // älteren Auflösung stammen und trüge dann eine veraltete Markierung — die
  // Fassung ist die eine Wahrheit (dieselbe Regel wie in `bestimmeSeit`).
  const relevanteFelder = new Set(
    e.version.felder.filter(f => f.relevant === true).map(f => f.feldId),
  );
  const gefiltert = relevanteFelder.size > 0
    ? e.vorkommen.filter(v => relevanteFelder.has(v.feld.feldId))
    : e.vorkommen;

  const chronik = baueChronik(gefiltert, { zeigeNebensaechlich: false });
  // NICHT einfach umdrehen: `baueChronik` sortiert aufsteigend nach Tag und
  // innerhalb eines Tages Meilenstein zuerst. Ein blindes `reverse()` kehrt auch
  // die zweite Ordnung um — dann gewinnt am selben Tag der NEBENSÄCHLICHSTE
  // Eintrag den Platz als „letzter Vorgang" (beobachtet: „allgemeine Ablehnung"
  // stand vor „Ablehnung an Ast", beide vom 22.06.).
  const absteigend = [...chronik].sort((a, b) => b.tag.localeCompare(a.tag));
  const [neuester, ...rest] = absteigend;

  const seit = bestimmeSeit(chronik, e.version, zahPhase);
  const seitMs = seit ? new Date(seit).getTime() : NaN;
  const stichtagMs = new Date(e.stichtag).getTime();
  const tage = Number.isNaN(seitMs) || Number.isNaN(stichtagMs)
    ? null
    : Math.floor((stichtagMs - seitMs) / MS_TAG);

  const letzterVorgang: LetzterVorgang | null = neuester
    ? {
      ...alsSchritt(neuester),
      trigger: neuester.feld.code ? triggerFuerKuerzel(e.trigger, neuester.feld.code) : [],
    }
    : null;

  const maxVerlauf = e.maxVerlauf ?? 5;
  return {
    statusRoh,
    code: treffer?.eintrag.code ?? null,
    statusText: treffer?.eintrag.text ?? statusRoh,
    joinArt: treffer?.art ?? null,
    zahPhase,
    zahPhaseLabel: zahPhaseLabel(zahPhase, e.version.zahPhasen),
    marker,
    seit,
    tage,
    letzterVorgang,
    verlauf: rest.slice(0, maxVerlauf).map(alsSchritt),
    verlaufGesamt: rest.length,
    nichtImKatalog: statusRoh !== '' && treffer === null,
    datenstand: e.datenstand,
  };
}

/** `YYYY-MM-DD` → `DD.MM.YYYY`; unlesbar → der Rohwert. */
function tagDe(tag: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : tag;
}

/**
 * Die Erklärung als Fließtext — für „Herleitung kopieren" (Support-Fälle) und
 * als Grundlage jeder Textausgabe. Bewusst dieselbe Quelle wie die Anzeige,
 * damit Kopie und Bildschirm nie auseinanderlaufen.
 */
export function herleitungAlsText(h: Herleitung): string {
  const zeilen: string[] = [];
  const kopf = h.code !== null ? `${h.code} · ${h.statusText}` : h.statusText || '(kein Status)';
  const seitTeil = h.seit ? ` — seit ${tagDe(h.seit)}${h.tage !== null ? ` (${h.tage} Tage)` : ''}` : '';
  zeilen.push(`${kopf}${seitTeil}`);

  if (h.nichtImKatalog) {
    zeilen.push('Statuswert nicht im Katalog — keine ZAH-Phase zugeordnet.');
  } else if (h.marker) {
    zeilen.push('Marker — läuft ohne Phase neben dem Verfahren.');
  } else if (h.zahPhase === null) {
    zeilen.push('Diesem Code ist noch keine ZAH-Phase zugeordnet.');
  } else {
    zeilen.push(`ZAH-Phase: ${h.zahPhaseLabel}`);
  }

  if (h.letzterVorgang) {
    const v = h.letzterVorgang;
    zeilen.push(`Letzter Vorgang: ${v.code ?? ''} „${v.label}" (${tagDe(v.tag)}, Rolle ${v.rollen})`.trim());
    if (v.text) zeilen.push(`  Notiz: ${v.text}`);
    for (const t of v.trigger) zeilen.push(`  Dieser Trigger löste aus: ${t.satz}`);
  } else {
    zeilen.push('Letzter Vorgang: kein Datumseintrag gefunden.');
  }

  if (h.verlauf.length > 0) {
    zeilen.push(`Davor: ${h.verlauf.map(s => `${s.label} (${tagDe(s.tag)})`).join(', ')}`);
    if (h.verlaufGesamt > h.verlauf.length) {
      zeilen.push(`  … ${h.verlaufGesamt - h.verlauf.length} weitere Einträge`);
    }
    zeilen.push('  (Verlauf ist eine Näherung aus den Datumsspalten.)');
  }

  const d = h.datenstand;
  const importiert = d.importiertAm ? tagDe(d.importiertAm.slice(0, 10)) : 'unbekannt';
  const trigger = d.triggerVersion === null
    ? 'Trigger nicht importiert'
    : `Trigger v${d.triggerVersion} (${d.triggerHerkunft})`;
  zeilen.push(`Datenstand: Import ${importiert} · Katalog v${d.katalogVersion} · ${trigger}`);
  return zeilen.join('\n');
}
