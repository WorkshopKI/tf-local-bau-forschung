/**
 * Netzwerk-Erkennung für 16KN-Förderanträge.
 *
 * Domain-Regel: FKZ-Präfix `16KN` markiert einen Antrag als Teil eines
 * Netzwerks. Die ersten 4 Ziffern nach dem Präfix identifizieren das
 * Netzwerk; die letzten 2 Ziffern sind die Antragsnummer innerhalb des
 * Netzwerks. Der Nummernkreis ist zweigeteilt:
 *
 *   **01–09 = Netzwerkantrag (Lead)** — ungerade Nummern gehören zu Phase 1,
 *   gerade zu Phase 2. Wird ein Netzwerkantrag abgelehnt und wieder
 *   eingereicht, zählt die Nummer hoch: Phase 1 läuft `01 → 03 → 05`,
 *   die zugehörige Phase 2 `02 → 04`.
 *   **ab 10 = Teilvorhaben.**
 *
 * Am echten Bestand gemessen (11 150 16KN-Sätze): die Nummern 01–05 tragen
 * ausnahmslos `vb_phase` 1 oder 2, 06–09 kommen (noch) nicht vor, und ab 10
 * steht nie eine Netzwerk-Phase. Das Tupel `Antragsnummer < 10 + vb_phase 1/2`
 * trennt die beiden Hälften deshalb sauber.
 *
 * Beispiele:
 *   16KN106201 → Netzwerk 1062, Lead Phase 1 (vb_phase=1)
 *   16KN106202 → Netzwerk 1062, Lead Phase 2 (vb_phase=2)
 *   16KN106203 → Netzwerk 1062, Lead Phase 1 nach Wiedereinreichung
 *   16KN106227 → Netzwerk 1062, TV
 *   16EP123456 → kein Netzwerk (Einzelantrag)
 *
 * Bewusst eigenständige, minimale Parse-Logik (statt Import aus
 * `src/phase2/matcher/fkz-extractor`), weil das Antrags-Plugin nicht an
 * den Phase-2-Pipeline-Code gekoppelt sein soll — `aktenzeichen` ist hier
 * bereits kanonisch (keine tolerante OCR-Tolerierung nötig).
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { toVbPhaseNumber } from '@/core/utils/vb-phase-mappings';

/** Regex für ein kanonisches 16KN-FKZ. */
const KN_FKZ_PATTERN = /^16KN(\d{4})(\d{2})$/;

/**
 * Liefert die 4-stellige Netzwerk-ID (z. B. `"1062"`) für ein 16KN-FKZ,
 * sonst `null`.
 */
export function extractNetzwerkId(aktenzeichen: string): string | null {
  if (typeof aktenzeichen !== 'string') return null;
  const m = KN_FKZ_PATTERN.exec(aktenzeichen.trim());
  return m ? m[1]! : null;
}

/** Regex für ein kanonisches 16EP-FKZ — das Gegenstück ohne Netzwerkbezug. */
const EP_FKZ_PATTERN = /^16EP\d{6}$/;

/**
 * `true` für ein 16EP-FKZ, also einen Antrag **ohne** Netzwerkbezug.
 *
 * Bewusst nicht als „alles, was nicht 16KN ist" formuliert: ein DS-Antrag trägt
 * `16DS…` und ist damit weder das eine noch das andere. Wer die Frage stellt,
 * meint die beiden ausgeschriebenen Präfixe — nicht deren Komplement.
 */
export function istEinzelFkz(aktenzeichen: string): boolean {
  if (typeof aktenzeichen !== 'string') return false;
  return EP_FKZ_PATTERN.test(aktenzeichen.trim());
}

/**
 * Liefert das 2-stellige Suffix nach den 4 Netzwerk-Ziffern (z. B. `"01"`,
 * `"27"`), oder `null` für nicht-16KN-FKZs.
 */
export function extractNetzwerkSuffix(aktenzeichen: string): string | null {
  if (typeof aktenzeichen !== 'string') return null;
  const m = KN_FKZ_PATTERN.exec(aktenzeichen.trim());
  return m ? m[2]! : null;
}

/** Höchste Antragsnummer, die noch ein Netzwerkantrag ist — ab `10` beginnen
 *  die Teilvorhaben (siehe Kopf-Kommentar). */
const MAX_NETZWERKANTRAG_NUMMER = 9;

/** Antragsnummer als Zahl (`"03"` → `3`); `-1` für nicht-16KN-FKZs. */
function antragsNummer(item: Pick<AntragListItem, 'aktenzeichen'>): number {
  const suffix = extractNetzwerkSuffix(item.aktenzeichen);
  return suffix === null ? -1 : Number(suffix);
}

/**
 * `true` wenn der Antrag ein Netzwerkantrag ist — Antragsnummer unter `10`
 * und vb_phase ist `1` oder `2`. Bis v4.4 waren nur `01`/`02` zugelassen; das
 * ließ jede **Wiedereinreichung nach Ablehnung** (`03`/`04`/`05`) durchfallen,
 * womit ihr Netzwerk namenlos blieb.
 *
 * Die Programm-Bedingung (136/76/46) wird nicht hart geprüft, weil der
 * Programm-ID-Namespace produktiv frei vergeben wird; das Tupel
 * `vb_phase + Antragsnummer` ist programmübergreifend robust.
 */
export function isNetzwerkLead(item: Pick<AntragListItem, 'aktenzeichen' | 'vb_phase'>): boolean {
  const nummer = antragsNummer(item);
  if (nummer < 0 || nummer > MAX_NETZWERKANTRAG_NUMMER) return false;
  const phase = toVbPhaseNumber(item.vb_phase);
  return phase === 1 || phase === 2;
}

/**
 * Wählt aus mehreren Netzwerkanträgen den **jüngsten Versuch**: die höchste
 * Antragsnummer. Ein Netzwerk kann seit der erweiterten Lead-Erkennung zwei
 * Phase-1-Leads führen — den abgelehnten `01` und die gültige `03` (im Bestand
 * 27 Fälle). Ohne diese Regel entschiede die Eingabe-Reihenfolge, welcher Name
 * das Netzwerk beschriftet; im Bestand trägt der abgelehnte Versuch sein
 * Akronym zudem eingeklammert (`(Telemedizin)` vs. `Telemedizin`).
 */
function juengsterAntrag(kandidaten: AntragListItem[]): AntragListItem | null {
  let best: AntragListItem | null = null;
  for (const k of kandidaten) {
    if (best === null || antragsNummer(k) > antragsNummer(best)) best = k;
  }
  return best;
}

/**
 * Sortier-Schlüssel für die TV-Reihenfolge innerhalb einer Netzwerk-Gruppe:
 * Leads zuerst (aufsteigend, also `01` vor `02` vor `03`), dann alle anderen
 * nach Aktenzeichen aufsteigend.
 */
export function compareNetzwerkOrder(a: AntragListItem, b: AntragListItem): number {
  const aLead = isNetzwerkLead(a);
  const bLead = isNetzwerkLead(b);
  if (aLead !== bLead) return aLead ? -1 : 1;
  return a.aktenzeichen.localeCompare(b.aktenzeichen);
}

/**
 * Sammelt alle vb_phase-Werte (1/2) aus einer TV-Liste.
 */
export function collectPhases(tvs: AntragListItem[]): Set<number> {
  const out = new Set<number>();
  for (const tv of tvs) {
    const p = toVbPhaseNumber(tv.vb_phase);
    if (p === 1 || p === 2) out.add(p);
  }
  return out;
}

function trimmedString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Liefert den fachlichen Netzwerk-Namen aus dem `akronym`-Feld (CSV-Spalte
 * `VB_KURZNAM`) des Netzwerkantrags. Bei einem Netzwerkantrag (Antragsnummer
 * < 10 + vb_phase 1/2) ist der Akronym-Wert gleichzeitig der Name des
 * Netzwerks, zu dem alle Anträge mit derselben 4-Ziffer-ID gehören.
 *
 * Zwei Vorrang-Stufen, wenn mehrere Netzwerkanträge im Snapshot stehen:
 * Phase 1 schlägt Phase 2 (sie trägt den ursprünglichen Netzwerk-Namen),
 * und innerhalb einer Phase gewinnt der jüngste Versuch (höchste
 * Antragsnummer, siehe `juengsterAntrag`). Anträge ohne Akronym zählen gar
 * nicht mit — sonst verdrängte eine namenlose Wiedereinreichung den Namen
 * ihres Vorgängers. Ist kein benannter Netzwerkantrag im Snapshot, return
 * `null` — Caller fällt auf `"Netzwerk <id>"` zurück.
 */
export function getNetzwerkName(members: AntragListItem[]): string | null {
  const benannt = members.filter(m => isNetzwerkLead(m) && trimmedString(m.akronym) !== null);
  if (benannt.length === 0) return null;
  const phase1 = benannt.filter(l => toVbPhaseNumber(l.vb_phase) === 1);
  const chosen = juengsterAntrag(phase1.length > 0 ? phase1 : benannt)!;
  return trimmedString(chosen.akronym);
}

/**
 * Baut einen Cross-Programm-Index: `netzwerkId (4 Ziffern) → Netzwerk-Name`,
 * der aus *allen* Netzwerk-Lead-Anträgen über alle Programme hinweg gebildet
 * wird. Wird gebraucht, weil die Netzwerk-Leads (Programme 136 / 76 / 46)
 * typischerweise NICHT im selben Programm liegen wie die TVs (16KN-Anträge
 * in anderen Programmen). Im aktiven RAM-Snapshot der Liste fehlt der Lead
 * daher meist, und der lokale `getNetzwerkName(members)` würde `null`
 * liefern — der Index schließt diese Lücke.
 *
 * Vorrang wie in `getNetzwerkName`: Phase-1-Lead schlägt Phase-2-Lead bei
 * abweichenden Akronymen, und innerhalb einer Phase gewinnt der jüngste
 * Versuch. Letzteres ist hier nicht kosmetisch: die Eingabe ist der
 * Cross-Programm-Scan, seine Reihenfolge ist Store-Reihenfolge — ein
 * Last-write-wins würde das Label eines Netzwerks vom Zufall abhängig machen.
 */
export function buildNetzwerkNameIndex(items: AntragListItem[]): Map<string, string> {
  const phase1 = new Map<string, { name: string; nummer: number }>();
  const phase2 = new Map<string, { name: string; nummer: number }>();
  for (const item of items) {
    if (!isNetzwerkLead(item)) continue;
    const nid = extractNetzwerkId(item.aktenzeichen);
    if (nid === null) continue;
    const name = trimmedString(item.akronym);
    if (name === null) continue;
    const phase = toVbPhaseNumber(item.vb_phase);
    const ziel = phase === 1 ? phase1 : phase === 2 ? phase2 : null;
    if (ziel === null) continue;
    const nummer = antragsNummer(item);
    const bisher = ziel.get(nid);
    if (bisher === undefined || nummer > bisher.nummer) ziel.set(nid, { name, nummer });
  }
  const out = new Map<string, string>();
  // Phase-2 zuerst eintragen, dann mit Phase-1 überschreiben.
  for (const [k, v] of phase2) out.set(k, v.name);
  for (const [k, v] of phase1) out.set(k, v.name);
  return out;
}

/**
 * Wählt den finalen Netzwerk-Namen: Index-Wert hat Vorrang, danach
 * der lokale Member-Scan, danach `null` (Caller-Fallback zu
 * `"Netzwerk <id>"`).
 */
export function resolveNetzwerkName(
  netzwerkId: string,
  members: AntragListItem[],
  index?: Map<string, string> | null,
): string | null {
  const fromIndex = index?.get(netzwerkId);
  if (fromIndex) return fromIndex;
  return getNetzwerkName(members);
}

/**
 * Formatiert das Gruppen-Label. Wenn ein Netzwerk-Name aus dem Lead bekannt
 * ist, wird er als Präfix verwendet; ansonsten der technische Fallback
 * `"Netzwerk <id>"`. Phasen werden angehängt: `"INNOWERK · Phase 1 + 2"`.
 */
export function formatNetzwerkLabel(
  netzwerkId: string,
  phases: Set<number>,
  name: string | null,
): string {
  const head = name ?? `Netzwerk ${netzwerkId}`;
  const known = [...phases].filter(p => p === 1 || p === 2).sort();
  if (known.length === 0) return head;
  if (known.length === 1) return `${head} · Phase ${known[0]}`;
  return `${head} · Phase ${known.join(' + ')}`;
}
