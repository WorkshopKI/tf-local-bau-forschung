/**
 * Zuschaltbare Blöcke des Assistenten — Verlauf und Änderungs-Journal in voller
 * Länge.
 *
 * Die Vorgangsakte trägt davon nur Kennzahlen und die jüngsten Termine. Die volle
 * Chronik, die Statusabschnitte und das Journal reisen erst mit, wenn eine Frage
 * danach fragt (Spec 3.2): irrelevanter Kontext verwirrt die Modelle, auch wenn
 * das Fenster ihn fasste.
 *
 * **Beide Blöcke sagen, worauf sie beruhen.** Ein rekonstruierter Verlauf, den
 * jemand als Beobachtung liest, wird zur Behauptung (bandText.ts); ein Journal
 * ohne Nullpunkt liest sich als vollständig (vorgangssystem.md §12.2).
 *
 * Rein: kein React, kein IDB.
 */
import type { KontextBlock, VorgangsAkte } from '@/core/services/assistent/kontext';
import type { VerlaufsSegment, VerlaufsSpur } from '@/core/status/verlauf/typen';
import type { AntragsChronikMitId } from '@/core/status/journal/lesen';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion } from '@/core/status/typen';
import { baueChronik } from '@/core/status/chronik';
import { baueZurueckgenommene } from '@/core/status/chronik-zurueckgenommen';
import { eintragText, nullpunktText, tagDe, wannText } from '@/plugins/antraege/status/journalTexte';
import { baueSpaltenAufloesung, spaltenAuskunft } from '@/plugins/antraege/status/journalSpalten';

/** `bestand` gehört keinem Vorgang (bestandBlock.ts), die übrigen ihrer Akte. */
export type BlockId = 'verlauf' | 'journal' | 'bestand';

export interface ZusatzBlock extends KontextBlock {
  id: BlockId;
}

/** Wie der Block im Kontext-Chip heißt — „nur das geht ins Modell". */
export const BLOCK_LABEL: Record<BlockId, string> = {
  verlauf: 'voller Verlauf',
  journal: 'Änderungs-Journal',
  bestand: 'Bestand',
};

/** Kappung der Termine im Verlaufs-Block — die jüngsten bleiben. */
export const VERLAUF_MAX_TERMINE = 400;
/** Kappung der Journal-Einträge — die neuesten bleiben. */
export const JOURNAL_MAX_EINTRAEGE = 80;

/** Die Spuren der Entität: beim Verbund seine eigene, dazu die ihrer Teilvorhaben. */
export function relevanteSpuren(
  spuren: readonly VerlaufsSpur[], istVerbund: boolean, azs: ReadonlySet<string>,
): VerlaufsSpur[] {
  return spuren.filter(s => (s.art === 'verbund' ? istVerbund : azs.has(s.id)));
}

/** Statusabschnitte mit benanntem Status — das Signal „Liegezeiten ableitbar". */
export function zaehleAbschnitte(spuren: readonly VerlaufsSpur[]): number {
  return spuren
    .filter(s => s.zustand === 'verlauf')
    .reduce((n, s) => n + s.segmente.filter(g => g.statusRef !== null || g.mehrdeutig === true).length, 0);
}

function statusText(g: VerlaufsSegment): string {
  if (g.kandidaten && g.kandidaten.length > 0) {
    return `${g.kandidaten.map(k => k.lang).join(' oder ')} (am selben Tag, nicht eindeutig)`;
  }
  return g.statusRef?.lang ?? 'ohne Status';
}

function abschnittZeile(g: VerlaufsSegment): string {
  const von = g.vonDatum ? tagDe(g.vonDatum) : 'vor dem ersten Beleg';
  const bis = g.bisDatum ? tagDe(g.bisDatum) : 'offen';
  const dauer = g.dauerTage === null ? 'Dauer unbekannt' : `${g.dauerTage} ${g.dauerTage === 1 ? 'Tag' : 'Tage'}`;
  return `- ${von} bis ${bis}: ${statusText(g)} (${dauer}${g.dauerUnsicher ? ', unsicher' : ''})`;
}

/**
 * Der volle Verlauf: alle Termine der Chronik und die Statusabschnitte je Spur.
 * `null`, wenn es weder Termine noch Spuren gibt.
 */
export function verlaufBlock(e: {
  istVerbund: boolean;
  akte: VorgangsAkte;
  spuren: readonly VerlaufsSpur[] | null;
  /** Nummer der geladenen Katalogfassung; `null` = keine geladen. */
  fassung: number | null;
}): ZusatzBlock | null {
  const termine = e.akte.verlauf?.termine ?? [];
  const azs = new Set(e.akte.teilvorhaben.map(t => t.aktenzeichen));
  const spuren = e.spuren ? relevanteSpuren(e.spuren, e.istVerbund, azs) : [];
  if (termine.length === 0 && spuren.length === 0) return null;

  const z: string[] = [
    'Rekonstruiert aus den Datumsspalten des Exports — keine beobachtete Historie. Je Kürzel steht nur das '
    + `zuletzt gesetzte Datum; frühere Setzungen sind überschrieben. Katalogfassung ${e.fassung ?? 'nicht geladen'}.`,
  ];
  if (termine.length > 0) {
    const gezeigt = termine.slice(-VERLAUF_MAX_TERMINE);
    z.push(gezeigt.length < termine.length
      ? `Alle Termine (die jüngsten ${gezeigt.length} von ${termine.length}):`
      : `Alle Termine (${termine.length}):`);
    for (const t of gezeigt) {
      z.push(`- ${t.tag}${t.kuerzel ? ` ${t.kuerzel}` : ''} ${t.label} — setzen darf ${t.rollen}; ${t.traeger}`);
    }
  }
  if (spuren.length > 0) {
    z.push('Statusabschnitte (aus den gesetzten Kürzeln und den C16-Triggern abgeleitet):');
    for (const s of spuren) {
      z.push(s.art === 'verbund' ? 'Verbund:' : `Teilvorhaben ${s.id}:`);
      if (s.zustand !== 'verlauf') {
        z.push(`- ${s.begruendung ?? 'kein ableitbarer Verlauf'}`);
        continue;
      }
      for (const g of s.segmente) z.push(abschnittZeile(g));
    }
  }
  return { id: 'verlauf', titel: 'Verlauf seit Eingang', zeilen: z };
}

/**
 * Das Änderungs-Journal der Entität: der Nullpunkt, die belegten Änderungen
 * (neueste zuerst) und die zurückgenommenen oder verschobenen Termine.
 *
 * Personen stehen darin nicht — das Journal führt keine Bearbeiter-Spalten
 * (`JOURNAL_AUSGESCHLOSSEN`, vorgangssystem.md §12.6).
 */
export function journalBlock(e: {
  /** `null` = auf diesem Share wird kein Journal geführt. */
  chroniken: readonly AntragsChronikMitId[] | null;
  azs: ReadonlySet<string>;
  version: MappingVersion | null;
  /** Die heutigen Vorkommen — gegen sie wird „zurückgenommen" bestimmt. */
  aktuell: readonly FeldVorkommen[];
  vbPhase: unknown;
}): ZusatzBlock {
  const titel = 'Änderungs-Journal';
  if (e.chroniken === null) return { id: 'journal', titel, zeilen: [nullpunktText(null, false)] };

  const eigene = e.chroniken.filter(c => e.azs.has(c.antragId));
  const gefuehrt = eigene.some(c => c.gefuehrt);
  const z = [nullpunktText(e.chroniken[0]?.journalAb ?? null, gefuehrt)];

  const aufloesung = e.version ? baueSpaltenAufloesung(e.version.felder) : null;
  const eintraege = eigene
    .flatMap(c => c.felder.flatMap(f => f.eintraege.map(x => ({ az: c.antragId, spalte: f.feld, x }))))
    .sort((a, b) => b.x.datum.localeCompare(a.x.datum));
  if (eintraege.length > 0) {
    const gezeigt = eintraege.slice(0, JOURNAL_MAX_EINTRAEGE);
    z.push(gezeigt.length < eintraege.length
      ? `Änderungen, neueste zuerst (die ${gezeigt.length} neuesten von ${eintraege.length}):`
      : `Änderungen, neueste zuerst (${eintraege.length}):`);
    for (const { az, spalte, x } of gezeigt) {
      const name = aufloesung ? spaltenAuskunft(aufloesung, spalte, e.vbPhase).bezeichnung : null;
      z.push(`- ${az}: ${name ? `${name} (${spalte})` : spalte} ${eintragText(x)}`);
    }
  } else if (gefuehrt) {
    z.push('Keine belegten Änderungen ab dem Nullpunkt.');
  }

  if (e.version) {
    const zurueck = baueZurueckgenommene(eigene, e.version.felder, baueChronik(e.aktuell));
    if (zurueck.length > 0) {
      z.push('Zurückgenommene oder verschobene Termine (standen in einem früheren Export, im heutigen nicht mehr):');
      for (const t of zurueck) {
        const was = t.art === 'verschoben' && t.nachTag ? `verschoben auf ${tagDe(t.nachTag)}` : 'zurückgenommen';
        z.push(`- ${tagDe(t.tag)} ${t.feld.code ?? t.feld.feldId} ${t.feld.label}: ${was}, im Journal ${wannText(t.belegt)}`);
      }
    }
  }
  return { id: 'journal', titel, zeilen: z };
}
