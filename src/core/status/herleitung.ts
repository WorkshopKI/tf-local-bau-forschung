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
 *    **Näherung** gekennzeichnet: die `D_`-Spalten tragen je Kürzel das ZULETZT
 *    gesetzte Datum (V9, Fachabstimmung 03.08.2026), frühere Setzungen sind im
 *    Export überschrieben und darin nicht mehr unterscheidbar.
 * 6. **Datenstand** — wann importiert, welche Katalog-Fassung, woher.
 *
 * Rein und deterministisch: kein IDB, kein `new Date()` — `stichtag` und
 * `datenstand` reicht der Aufrufer herein.
 */
import { formatDatumsWert as tagDe } from '@/core/services/csv/dateParse';
import { statusKurzLabelMit, type LabelHerkunft } from '@/core/utils/status-wert-labels';
import { baueChronik, type ChronikEintrag } from './chronik';
import type { FeldVorkommen } from './feld-aufloesung';
import { findeStatusCode, type StatusCodeIndex, type StatusCodeTreffer } from './status-codes';
import { kuerzelIndex } from './feld-zugriff';
import { triggerFuerKuerzel, triggerFuerProgramm } from './trigger-share';
import { triggerSegmenteVon, alsText, baueLegende } from './trigger-satz';
import { erklaereSegmente, erklaerKatalog, type ErklaertesSegment } from './trigger-erklaerung';
import { rollenLabel, rollenVonFeld } from './rollen';
import { zahPhaseLabel, SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from './zah-phasen';
import type { MappingVersion, Rolle, TriggerZeile, ZahPhaseId } from './typen';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

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
  /**
   * Dieselbe Aussage als Ids, für die Anzeige, die `PA` erklären können soll.
   * Zusätzlich statt statt `rollen`, nicht anstelle: der String ist das
   * Anzeigeergebnis von `rollenLabel` und bleibt die eine Schreibweise. Ihn zum
   * Erklären zurück zu parsen wäre ein zweiter Leseweg (siehe `rollen.ts`).
   */
  rollenIds: readonly Rolle[];
  /** Begleittext aus der `T_`-Spalte, falls gefüllt. */
  text?: string;
}

/** Der letzte Vorgang, so weit er sich aus den Datumsspalten ablesen lässt. */
export interface LetzterVorgang extends VerlaufSchritt {
  /** Was dieses Kürzel im Programm des Antrags auslöst, in Folge-Reihenfolge. */
  trigger: TriggerWirkungSatz[];
}

/**
 * Eine Trigger-Wirkung in Satzform — einmal flach, einmal in ihre erklärbaren
 * Stücke zerlegt.
 *
 * Beides, weil beides gebraucht wird: `satz` trägt die Textausgabe („Herleitung
 * kopieren"), `segmente` die Anzeige, die `ABB` und `59` erklären können soll.
 * Sie können nicht auseinanderlaufen — `satz` IST die Verkettung der Segmente.
 */
export interface TriggerWirkungSatz {
  folge: number;
  satz: string;
  segmente: ErklaertesSegment[];
}

/**
 * Der Kopf einer Status-Erklärung: Code, amtlicher Text, ZAH-Phase, Kurzform.
 *
 * Eigener Typ, weil er **ohne** die teure Vorkommen-Auswertung zu haben ist —
 * die zweite Ebene im Popover („TV-Status: 72 · … · ZAH-Phase Entscheidung")
 * braucht genau das und nichts weiter.
 */
export interface StatusKurz {
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
  /** Warnung, wenn der Statuswert nicht im Katalog steht. */
  nichtImKatalog: boolean;
  /** Die Kurzform, die überall in der Oberfläche in der Pille steht. */
  kurzLabel: string;
  /** Woher sie kommt — die Auskunft, die ein Kurator hier braucht: steht in
   *  der Pille eure Fassung, die Auslieferung, oder ist nichts gepflegt? */
  kurzLabelHerkunft: LabelHerkunft;
}

export interface Herleitung extends StatusKurz {
  /** ISO-Tag, seit wann der Status gilt — `null`, wenn nicht bestimmbar. */
  seit: string | null;
  /** Tage seit `seit`, gegen den Stichtag. `null`, wenn `seit` fehlt. */
  tage: number | null;
  letzterVorgang: LetzterVorgang | null;
  /** Chronologisch ABSTEIGEND, ohne den letzten Vorgang. */
  verlauf: VerlaufSchritt[];
  /** Wie viele Schritte die Näherung insgesamt kennt (auch die ungezeigten). */
  verlaufGesamt: number;
  /** Programm des Antrags (`FM_NUMMER`); `null`, wenn die Spalte nichts liefert. */
  programm: string | null;
  /** Programm bekannt, aber die Trigger-Tabelle führt keine Zeile dazu. */
  programmOhneTrigger: boolean;
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
  /**
   * Programm-/Richtlinien-Nummer des Antrags (`FM_NUMMER` → `unterprogramm_id`).
   * Gefiltert wird ausschließlich darauf — dasselbe Kürzel löst in Richtlinie 76
   * und 131 Verschiedenes aus, und die Erklärung eines fremden Programms wäre
   * schlimmer als gar keine.
   */
  programm: string | null;
  datenstand: Datenstand;
  /** ISO — injiziert, nie `new Date()` hier drin. */
  stichtag: string;
  /** Nachschlage-Index; Default ist die Auslieferung. */
  index?: StatusCodeIndex;
  /** Wie viele Verlaufs-Schritte höchstens (Default 5, siehe Konzept 6.1). */
  maxVerlauf?: number;
}


/** Chronik-Eintrag → Anzeige-Schritt. */
function alsSchritt(e: ChronikEintrag): VerlaufSchritt {
  return {
    tag: e.tag,
    ...(e.feld.code ? { code: e.feld.code } : {}),
    label: e.feld.label,
    rollen: rollenLabel(e.feld),
    rollenIds: rollenVonFeld(e.feld),
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
 *
 * Nachgeschlagen wird in der FASSUNG, nicht am Feld-Objekt im Vorkommen: das
 * kann aus einer älteren Auflösung stammen und trüge dann eine veraltete
 * Zuordnung.
 */
function bestimmeSeit(
  chronik: readonly ChronikEintrag[],
  version: MappingVersion,
  zahPhase: ZahPhaseId | null,
): string | null {
  if (!zahPhase) return null;
  const passend = chronik.filter(e => {
    const feld = version.felder.find(f => f.feldId === e.feld.feldId);
    return feld?.zahPhaseId === zahPhase;
  });
  const letzter = passend[passend.length - 1];
  return letzter?.tag ?? null;
}

/**
 * Code, amtlicher Text, ZAH-Phase und Kurzform eines Rohstatus. Rein, ohne
 * Vorkommen.
 *
 * Die **eine** Stelle, an der ein Statustext auf seine Einordnung gebracht wird —
 * `baueHerleitung` baut darauf auf, und die zweite Ebene im Popover benutzt sie
 * allein. Ein zweiter Weg liefe beim ersten Umhängen eines Codes auseinander.
 *
 * Hieß bis v3.15 `statusKurz`. Der Name las sich wie „kurzes Label" und stand
 * damit genau dem im Weg, was `statusKurzLabel` in `status-wert-labels.ts` jetzt
 * liefert; die Funktion hier liefert den **Kopf einer Erklärung**.
 *
 * Die Kurzform holt sie sich aus derselben Quelle wie die Oberfläche — der
 * Popover soll erklären, was in der Pille steht, nicht etwas Zweites.
 */
export function statusHerleitungKopf(
  version: MappingVersion, roh: unknown, index?: StatusCodeIndex,
): StatusKurz {
  const statusRoh = typeof roh === 'string' ? roh.trim() : '';
  const treffer = findeStatusCode(statusRoh, index);
  const code = treffer?.eintrag.code ?? null;

  // Die Phase steht am kuratierten Statuswert — SOFERN die Fassung schon Codes
  // trägt. Bestandsfassungen tun das erst nach dem Nachziehen; bis dahin greift
  // der Auslieferungs-Schnitt, damit die Erklärung nicht wochenlang „keine
  // Phase" behauptet, obwohl der Code längst einer zugeordnet ist.
  const wertEintrag = code !== null ? version.werte.find(w => w.code === code) : undefined;
  const zahPhase: ZahPhaseId | null = wertEintrag?.zahPhaseId !== undefined
    ? wertEintrag.zahPhaseId
    : (code !== null ? SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null : null);
  const marker = wertEintrag?.marker === true
    || (code !== null && wertEintrag?.marker === undefined && SEED_MARKER_CODES.has(code));

  const kurz = statusKurzLabelMit(statusRoh);

  return {
    statusRoh,
    code,
    statusText: treffer?.eintrag.text ?? statusRoh,
    joinArt: treffer?.art ?? null,
    zahPhase,
    zahPhaseLabel: zahPhaseLabel(zahPhase, version.zahPhasen),
    marker,
    nichtImKatalog: statusRoh !== '' && treffer === null,
    kurzLabel: kurz.text,
    kurzLabelHerkunft: kurz.herkunft,
  };
}

/**
 * Baut die Erklärung. Rein — dieselbe Eingabe liefert immer dieselbe Ausgabe.
 *
 * Berücksichtigt für Verlauf und letzten Vorgang nur **relevante** Kürzel, wenn
 * die Fassung welche markiert hat; sonst alle. So bleibt die Erklärung kurz,
 * ohne dass eine leere Relevanz-Liste sie leer laufen ließe.
 */
export function baueHerleitung(e: HerleitungEingabe): Herleitung {
  const kurz = statusHerleitungKopf(e.version, e.statusRoh, e.index);

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

  const seit = bestimmeSeit(chronik, e.version, kurz.zahPhase);
  const seitMs = seit ? new Date(seit).getTime() : NaN;
  const stichtagMs = new Date(e.stichtag).getTime();
  const tage = Number.isNaN(seitMs) || Number.isNaN(stichtagMs)
    ? null
    : Math.floor((stichtagMs - seitMs) / MS_TAG);

  // Nur die Trigger des eigenen Programms. Ohne Programm bleibt die Menge leer —
  // `triggerFuerProgramm` kennt keinen Ersatz (siehe dort).
  const programm = (e.programm ?? '').trim() || null;
  const eigeneTrigger = triggerFuerProgramm(e.trigger, programm);
  const legende = baueLegende(e.version.textbausteine);
  // Einmal je Erklärung, nicht je Segment: der Index läuft über alle Katalog-Felder.
  const felderIndex = kuerzelIndex(e.version.felder);
  const katalog = erklaerKatalog(e.version);

  const letzterVorgang: LetzterVorgang | null = neuester
    ? {
      ...alsSchritt(neuester),
      trigger: (neuester.feld.code ? triggerFuerKuerzel(eigeneTrigger, neuester.feld.code) : [])
        .map(z => {
          const roh = triggerSegmenteVon(z, legende);
          return {
            folge: z.folge,
            satz: alsText(roh),
            segmente: erklaereSegmente(katalog, roh, felderIndex),
          };
        }),
    }
    : null;

  const maxVerlauf = e.maxVerlauf ?? 5;
  return {
    ...kurz,
    seit,
    tage,
    letzterVorgang,
    verlauf: rest.slice(0, maxVerlauf).map(alsSchritt),
    verlaufGesamt: rest.length,
    programm,
    programmOhneTrigger: programm !== null && e.trigger.length > 0 && eigeneTrigger.length === 0,
    datenstand: e.datenstand,
  };
}

/** Code + amtlicher Text eines Status, wie er im Kopf steht. */
function kopfVon(s: StatusKurz): string {
  return s.code !== null ? `${s.code} · ${s.statusText}` : s.statusText || '(kein Status)';
}

/** Was zusätzlich in die Kopie soll: die benannte Ebene und was daneben steht. */
export interface TextRahmen {
  /** „Verbund-Status" / „TV-Status" — welche Ebene erklärt wird. */
  ebeneLabel: string;
  /** Abweichende Status der jeweils anderen Ebene, schon beschriftet. */
  abweichend?: readonly { label: string; kurz: StatusKurz; anzahl: number }[];
  /** Distinkte abweichende Werte, die `abweichend` nicht mehr aufzählt. */
  weitere?: number;
}

/**
 * Die Erklärung als Fließtext — für „Herleitung kopieren" (Support-Fälle) und
 * als Grundlage jeder Textausgabe. Bewusst dieselbe Quelle wie die Anzeige,
 * damit Kopie und Bildschirm nie auseinanderlaufen — deshalb trägt auch die
 * Kopie die Ebene und die abweichende Gegenseite, wenn der Aufrufer sie kennt.
 */
export function herleitungAlsText(h: Herleitung, rahmen?: TextRahmen): string {
  const zeilen: string[] = [];
  const seitTeil = h.seit ? ` — seit ${tagDe(h.seit)}${h.tage !== null ? ` (${h.tage} Tage)` : ''}` : '';
  const praefix = rahmen ? `${rahmen.ebeneLabel}: ` : '';
  zeilen.push(`${praefix}${kopfVon(h)}${seitTeil}`);

  for (const a of rahmen?.abweichend ?? []) {
    const phase = a.kurz.nichtImKatalog
      ? ' · nicht im Katalog'
      : a.kurz.marker
        ? ' · Marker (ohne Phase)'
        : a.kurz.zahPhase !== null ? ` · ZAH-Phase ${a.kurz.zahPhaseLabel}` : '';
    const wieViele = a.anzahl > 1 ? ` (${a.anzahl} TV)` : '';
    zeilen.push(`${a.label}: ${kopfVon(a.kurz)}${wieViele}${phase}`);
  }
  if (rahmen?.weitere) zeilen.push(`… ${rahmen.weitere} weitere abweichende Statuswerte`);

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
    if (h.programmOhneTrigger) {
      zeilen.push(`  Für Programm ${h.programm} sind keine Trigger importiert.`);
    } else if (h.programm === null) {
      zeilen.push('  Programm des Antrags unbekannt — Trigger nicht zuordenbar.');
    }
  } else {
    zeilen.push('Letzter Vorgang: kein Datumseintrag gefunden.');
  }

  if (h.verlauf.length > 0) {
    zeilen.push(`Davor: ${h.verlauf.map(s => `${s.label} (${tagDe(s.tag)})`).join(', ')}`);
    if (h.verlaufGesamt > h.verlauf.length) {
      zeilen.push(`  … ${h.verlaufGesamt - h.verlauf.length} weitere Einträge`);
    }
    zeilen.push('  (Näherung: je Kürzel steht nur das zuletzt gesetzte Datum im Export.)');
  }

  const d = h.datenstand;
  const importiert = d.importiertAm ? tagDe(d.importiertAm.slice(0, 10)) : 'unbekannt';
  const trigger = d.triggerVersion === null
    ? 'Trigger nicht importiert'
    : `Trigger v${d.triggerVersion} (${d.triggerHerkunft})`;
  zeilen.push(`Datenstand: Import ${importiert} · Katalog v${d.katalogVersion} · ${trigger}`);
  return zeilen.join('\n');
}
