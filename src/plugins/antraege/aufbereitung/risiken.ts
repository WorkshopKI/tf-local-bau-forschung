/**
 * Risiko-Ernte + Lösungsweg-Zuordnung für die Antrag-Aufbereitung (Paket 3, rein
 * deterministisch — KEIN LLM).
 *
 * Zwei Schritte, bewusst getrennt:
 *  1. `ernteRisiken` (im `baueRun` verwendet) liest die benannten technischen
 *     Risiken aus allen `klasse:'risiko'`-Tabellen — reine Ernte, kein Aspekt-Wissen.
 *  2. `zuordneRisiken` (im UI verwendet) heftet jedes Risiko an einen
 *     Lösungsweg-Abschnitt (Aspekt C, Ebene 2). Das braucht das Aspekt-Mapping
 *     (LLM-Baustein, in `baueRun` nicht verfügbar) und läuft daher erst im
 *     Abdeckungs-Tab — analog zu `berechneSubstanz`/`sektionZuAspekte`.
 *
 * Leitprinzip: Nicht sicher Zuordenbares wird EHRLICH als „unzugeordnet" gesammelt,
 * nie unter der Schwelle „irgendwo" angeheftet. Reine Funktionen, keine IO.
 */
import type { VbSektion } from './gliederung';
import type { RisikoEintrag, RunTabelle } from './types';
import type { AspektMapping, OffenerPunktKandidat } from './aspekte';

/**
 * Mindest-Overlap (0…1) zwischen Risiko- und Ziel-Sektions-Titel für eine
 * Zuordnung. Default konservativ: darunter gilt ein Risiko als unzugeordnet
 * (ehrlich sichtbar), statt es einem schwach passenden Abschnitt anzuhängen.
 */
export const RISIKO_MATCH_SCHWELLE = 0.35;

/** Stoppwörter, die vor dem Titel-Overlap entfernt werden (deutsch, kleingeschrieben). */
const STOPWORTE = new Set(['und', 'der', 'die', 'des', 'durch', 'von']);

/** Ergebnis der Lösungsweg-Zuordnung (View-Model, nicht persistiert). */
export interface RisikoZuordnung {
  /** Ziel-Sektions-ID → dort angeheftete Risiken (nur Ziel-Sektionen mit ≥ 1 Treffer). */
  proSektion: Map<string, RisikoEintrag[]>;
  /** Risiken ohne hinreichend passenden Lösungsweg-Abschnitt (Schwelle unterschritten). */
  unzugeordnet: RisikoEintrag[];
  /** Ziel-Sektionen (Lösungsweg-Unterabschnitte) OHNE ein einziges zugeordnetes Risiko. */
  ohneRisiko: VbSektion[];
}

// ---------------------------------------------------------------------------
// Ernte (deterministisch, im baueRun)
// ---------------------------------------------------------------------------

/** Header-Zelle normalisieren (lowercase, Umlaute gefaltet, nur alphanumerisch). */
function normHeader(s: string): string {
  return s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

/** Sektion, in deren Zeichen-Span `offset` fällt. Da die Gliederung überlappungsfrei
 *  partitioniert, ist der einzige Treffer automatisch die tiefste Ebene. */
function sektionAnOffset(gliederung: VbSektion[], offset: number): VbSektion | undefined {
  return gliederung.find(s => offset >= s.start && offset < s.end);
}

/**
 * Erntet benannte technische Risiken aus allen `klasse:'risiko'`-Tabellen: je
 * Datenzeile `{ titel, beschreibung, sektionId }`. `titel` = die „Risiko"-Spalte,
 * `beschreibung` = die „Beschreib…"-Spalte (Klassifikation garantiert beide).
 * `sektionId` = VB-Sektion am Tabellen-Beginn (tiefste Ebene) — bei Tabellen aus
 * einer separaten Anlage-5-Datei (`rolle !== 'vb'`) bewusst `undefined`.
 */
export function ernteRisiken(tabellen: RunTabelle[], gliederung: VbSektion[]): RisikoEintrag[] {
  const out: RisikoEintrag[] = [];
  for (const t of tabellen) {
    if (t.klasse !== 'risiko') continue;
    const titelIdx0 = t.header.findIndex(h => normHeader(h).includes('risiko'));
    const beschrIdx0 = t.header.findIndex(h => normHeader(h).includes('beschreib'));
    const titelIdx = titelIdx0 >= 0 ? titelIdx0 : 0;
    const sektionId = t.rolle === 'vb' ? sektionAnOffset(gliederung, t.start)?.id : undefined;
    for (const row of t.rows) {
      const titel = (row[titelIdx] ?? '').trim();
      if (!titel) continue;
      const beschreibung = (beschrIdx0 >= 0 ? row[beschrIdx0] ?? '' : '').trim();
      out.push({ titel, beschreibung, ...(sektionId ? { sektionId } : {}) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zuordnung (deterministisch, im UI — braucht das Aspekt-Mapping)
// ---------------------------------------------------------------------------

/** Titel → eindeutige Tokens (lowercase, Umlaute gefaltet, Stoppwörter raus, Länge ≥ 2).
 *  Dedupe, damit ein in Risiko- UND Herkunftstitel doppeltes Wort den Overlap nicht
 *  künstlich aufbläht (Muster `bezTokens` in `tabellen.ts`). */
function titelTokens(s: string): string[] {
  return [...new Set(
    s.toLowerCase().normalize('NFC')
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2 && !STOPWORTE.has(t)),
  )];
}

/** Grobe Stamm-Gleichheit: kurze Tokens exakt, ab 5 Zeichen genügt gleicher 5er-Präfix. */
function stammGleich(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

/** Anteil der A-Tokens mit einem Stamm-Partner in B, normiert auf die größere Menge. */
function tokenOverlapStamm(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let treffer = 0;
  for (const ta of a) if (b.some(tb => stammGleich(ta, tb))) treffer++;
  return treffer / Math.max(a.length, b.length);
}

/**
 * Ziel-Sektionen für die Risiko-Zuordnung: die dem Aspekt C zugeordneten Sektionen
 * mit Ebene ≥ 2 (die Lösungsweg-Unterabschnitte); gibt es keine, die C-Sektionen
 * selbst. Reihenfolge = Dokumentreihenfolge.
 */
function zielSektionen(mapping: AspektMapping, gliederung: VbSektion[]): VbSektion[] {
  const byId = new Map(gliederung.map(s => [s.id, s]));
  const cSektionen = [...new Set(mapping.zuordnung['C'] ?? [])]
    .map(id => byId.get(id))
    .filter((s): s is VbSektion => !!s)
    .sort((a, b) => a.start - b.start);
  const unter = cSektionen.filter(s => s.ebene >= 2);
  return unter.length > 0 ? unter : cSektionen;
}

/**
 * Ordnet jedes Risiko dem am besten passenden Lösungsweg-Abschnitt zu. Match-Text =
 * Risiko-Titel + Titel seiner Herkunftssektion (robust gegen untergliederte wie
 * tabellarische Risiko-Darstellungen), verglichen per Stamm-Token-Overlap gegen die
 * Ziel-Titel. Bestes Match ab `RISIKO_MATCH_SCHWELLE`, sonst unzugeordnet.
 */
export function zuordneRisiken(
  risiken: RisikoEintrag[], mapping: AspektMapping, gliederung: VbSektion[],
): RisikoZuordnung {
  const byId = new Map(gliederung.map(s => [s.id, s]));
  const ziele = zielSektionen(mapping, gliederung);
  const zielTokens = ziele.map(z => ({ z, tokens: titelTokens(z.titel) }));

  const proSektion = new Map<string, RisikoEintrag[]>();
  const unzugeordnet: RisikoEintrag[] = [];

  for (const r of risiken) {
    const herkunftTitel = r.sektionId ? byId.get(r.sektionId)?.titel ?? '' : '';
    const matchTokens = titelTokens(`${r.titel} ${herkunftTitel}`);
    let bestId: string | null = null;
    let bestScore = 0;
    for (const { z, tokens } of zielTokens) {
      const score = tokenOverlapStamm(matchTokens, tokens);
      if (score > bestScore) { bestScore = score; bestId = z.id; }
    }
    if (bestId && bestScore >= RISIKO_MATCH_SCHWELLE) {
      const liste = proSektion.get(bestId) ?? [];
      liste.push(r);
      proSektion.set(bestId, liste);
    } else {
      unzugeordnet.push(r);
    }
  }

  const ohneRisiko = ziele.filter(z => !proSektion.has(z.id));
  return { proSektion, unzugeordnet, ohneRisiko };
}

/**
 * Ziel-Sektionen ohne benanntes Risiko als offene-Punkt-Kandidaten (stabile Keys
 * `risiko-fehlt:<sektionId>`, Aspekt-Referenz D). Muster wie `fehlendeAlsKandidaten`
 * — speist dieselbe `offenePunkte`-Mechanik.
 */
export function risikoFehltKandidaten(ohneRisiko: VbSektion[]): OffenerPunktKandidat[] {
  return ohneRisiko.map(s => ({
    key: `risiko-fehlt:${s.id}`,
    aspektId: 'D',
    text: `Lösungsweg ${s.nummer ?? s.id} (${s.titel}) ohne benanntes technisches Risiko`,
  }));
}
