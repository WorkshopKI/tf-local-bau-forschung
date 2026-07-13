/**
 * Deterministische Satz↔Zitat-Zuordnung als FALLBACK, wenn das Modell keine
 * `→ stützt Satz N`-Marker geliefert hat (Journey-Paket 4). Rein lexikalisch
 * (Wortüberlappung, deutsche Stoppwörter) — kein LLM, keine IO. Nach dem Vorbild
 * von `aufbereitung/risiken.ts`: konservative Schwelle, Leitprinzip „lieber nicht
 * zuordnen als falsch zuordnen" (unter der Schwelle → `satzIndizes: []` = „ohne
 * Zuordnung", ehrlich sichtbar). Analog zum Token-Overlap in `feedbackFaq.ts`.
 *
 * Nummerierung 0-basiert über `splitSentences(finalerText)` — dieselbe Basis wie
 * Parser, `data-satz-index`, Check-Engine und `belege.ts`. Alle erzeugten Belege
 * tragen `abgeleitet: true`; die UI kennzeichnet sie als „automatisch zugeordnet".
 */
import { splitSentences } from '@/core/services/skills';
import type { QuellenBeleg } from '@/core/services/skills';

/** Mindest-Anzahl distinktiver gemeinsamer Tokens für eine Zuordnung. */
const MIN_GEMEINSAM = 2;
/** Kappung: höchstens so viele gestützte Sätze je Zitat. */
const MAX_SAETZE = 2;

/** Stoppwörter (deutsch, kleingeschrieben) — vor dem Overlap entfernt. */
const STOPWORTE = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'sowie', 'bzw', 'als', 'wie', 'auch', 'noch', 'schon', 'nur', 'sehr',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'wurde', 'wurden', 'sein', 'hat', 'haben',
  'mit', 'für', 'auf', 'von', 'bei', 'aus', 'nach', 'über', 'unter', 'durch', 'zur', 'zum',
  'nicht', 'kein', 'keine', 'sich', 'ihre', 'ihres', 'seiner', 'deren', 'dessen',
  'dieser', 'diese', 'dieses', 'im', 'in', 'an', 'zu', 'um', 'vor', 'ohne', 'gegen', 'daher',
  'wo', 'was', 'wer', 'wann', 'warum', 'welche', 'welcher', 'welches',
]);

/** Roh-Zitat vor der Satz-Zuordnung (aus der flachen Quellenanalyse extrahiert). */
export interface ExtrahiertesZitat {
  zitat: string;
  abschnittRef?: string;
}

/**
 * Distinktive Tokens: lowercase/NFC, Satzzeichen raus, ohne Stoppwörter. Kurze
 * Alpha-Tokens (< 3) fallen weg, ZAHLEN bleiben aber (z.B. „35", „90" — die sind
 * gerade diskriminierend).
 */
export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter(t => (t.length >= 3 || /\d/.test(t)) && !STOPWORTE.has(t)),
  );
}

/**
 * Extrahiert die Zitat-Zeilen aus der flachen `quellenanalyse` (nur Zeilen mit
 * einem Anführungszeichen). Listen-Marker + Fundstelle werden abgetrennt: `(Abschn.
 * x.y)` ODER das im internen Modell übliche `– VB, Abschnitt N` / `Abschnitt N`.
 * Kein `→ stützt`-Gate (das ist gerade der Fall, in dem KEINE Marker existieren).
 */
export function extrahiereZitate(quellenanalyse: string): ExtrahiertesZitat[] {
  if (!quellenanalyse.trim()) return [];
  const out: ExtrahiertesZitat[] = [];
  for (const raw of quellenanalyse.split('\n')) {
    let line = raw.trim();
    if (!line || !/[„“”"«»]/u.test(line)) continue;
    line = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, ''); // Listen-Marker

    let abschnittRef: string | undefined;
    const paren = line.match(/\(\s*Abschn\.?\s*([\d.]+)\s*\)/iu);
    if (paren) {
      abschnittRef = paren[1];
      line = line.replace(paren[0], '').trim();
    } else {
      const vb = line.match(/\s*[–—-]?\s*(?:VB,?\s*)?Abschnitt\s+(\d+(?:\.\d+)*)\s*\.?\s*$/iu);
      if (vb && vb.index != null) {
        abschnittRef = vb[1];
        line = line.slice(0, vb.index).trim();
      }
    }
    line = line.replace(/[\s–—-]+$/u, '').trim(); // hängender Trenner
    if (!line) continue;
    out.push({ zitat: line, ...(abschnittRef ? { abschnittRef } : {}) });
  }
  return out;
}

/**
 * Ordnet jedes Zitat dem/den Satz/Sätzen des finalen Textes mit der größten
 * distinktiven Wortüberlappung zu — aber nur, wenn der beste Treffer ≥
 * `MIN_GEMEINSAM` gemeinsame Tokens hat. Mehrdeutig (≥ 3 gleichauf an der Spitze)
 * oder unter Schwelle → `satzIndizes: []` („ohne Zuordnung"). Alle Belege tragen
 * `abgeleitet: true`.
 */
export function ordneSaetzeZu(zitate: ExtrahiertesZitat[], finalerText: string): QuellenBeleg[] {
  const satzTokens = splitSentences(finalerText).map(tokenSet);
  return zitate.map(z => {
    const qt = tokenSet(z.zitat);
    const scores = satzTokens.map(st => {
      let s = 0;
      for (const t of qt) if (st.has(t)) s++;
      return s;
    });
    const best = scores.length > 0 ? Math.max(...scores) : 0;
    let satzIndizes: number[] = [];
    if (best >= MIN_GEMEINSAM) {
      const treffer = scores.flatMap((s, i) => (s === best ? [i] : []));
      // Eindeutiger oder knapp mehrdeutiger Spitzentreffer → zuordnen; sonst ehrlich leer.
      if (treffer.length <= MAX_SAETZE) satzIndizes = treffer;
    }
    return {
      zitat: z.zitat,
      ...(z.abschnittRef ? { abschnittRef: z.abschnittRef } : {}),
      satzIndizes,
      abgeleitet: true,
    };
  });
}
