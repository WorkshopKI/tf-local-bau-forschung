/**
 * Reiner Merge der eingesammelten Sponsoring-Stimmen in die zentrale
 * feedback.json (v2.32). Spiegelbild von `mergeWuenscheIntoZuweisungen`
 * (Auslastungs-Modul): kein FS, kein Store → komplett unit-testbar.
 *
 * Pro Stimmen-Datei eines Users (`kuerzel` + Map `ticketId → Punkte`) wird der
 * Punkte-Sponsor-Eintrag dieses Users (`user_id === kuerzel`) auf jedem Ticket
 * gesetzt/ersetzt. Retraktion: fuer jeden in DIESEM Batch gelesenen `kuerzel`
 * werden Punkte-Eintraege entfernt, die nicht mehr (oder mit 0) in seiner Datei
 * stehen. User OHNE Datei im Batch bleiben unangetastet (kein versehentliches
 * Loeschen). Stunden-Sponsoring (`type==='hours'`) wird NIE angefasst.
 *
 * **Stale-Guard (v4.1).** Seit die persoenlichen Ordner unter mehreren Wurzeln
 * liegen, wird derselbe User bei einem Gruppenwechsel oder einer Ordnerleiche
 * ZWEIMAL gelesen — je Wurzel EIN eigener Aufruf, also zwei getrennte Batches
 * nacheinander. Ohne Guard entschiede die Wurzel-Reihenfolge: kaeme die alte
 * Datei als zweite, zoege sie die frische Stimme wieder zurueck. Deshalb bleibt
 * ein vorhandener Eintrag unangetastet, wenn die gerade gelesene Datei STRIKT
 * AELTER ist als sein `created_at` (dort steht der Zeitstempel der Quelldatei).
 * Unparsebar oder gleich → alter Pfad, damit sich Bestandsdaten unveraendert
 * verhalten.
 */
import type { FeedbackItem, FeedbackSponsor } from '@/core/types/feedback';
import type { SponsorVoteFile } from './feedbackSponsorOutbox';
import { recalcSponsorTotals } from './feedbackSharedFile';

export interface MergeSponsorResult {
  items: FeedbackItem[];
  /** Neu angelegte Punkte-Sponsor-Eintraege. */
  neu: number;
  /** Bestehende Eintraege mit geaenderter Punktzahl. */
  aktualisiert: number;
  /** Entfernte Eintraege (Retraktion: Stimme zurueckgezogen / auf 0 gesetzt). */
  entfernt: number;
}

interface Wanted { points: number; ts: string }

export function mergeSponsorVotesIntoItems(
  items: readonly FeedbackItem[],
  batch: readonly SponsorVoteFile[],
): MergeSponsorResult {
  // kuerzel deren Datei in diesem Lauf gelesen wurde (nur diese werden reconciled).
  const collectedKuerzels = new Set<string>();
  // ticketId → (kuerzel → gewuenschte Punkte + Zeitstempel der Datei)
  const desired = new Map<string, Map<string, Wanted>>();

  /** kuerzel → Zeitstempel der gelesenen Datei (fuer den Stale-Guard). */
  const dateiStempel = new Map<string, string>();

  for (const file of batch) {
    if (!file || typeof file.kuerzel !== 'string' || !file.kuerzel) continue;
    const kuerzel = file.kuerzel;
    collectedKuerzels.add(kuerzel);
    const ts = typeof file.updatedAt === 'string' ? file.updatedAt : '';
    dateiStempel.set(kuerzel, ts);
    for (const [ticketId, rawPts] of Object.entries(file.votes ?? {})) {
      const points = Math.max(0, Math.floor(Number(rawPts) || 0));
      if (points <= 0) continue; // 0 / negativ = keine Stimme → via Abwesenheit retrahiert
      let m = desired.get(ticketId);
      if (!m) { m = new Map<string, Wanted>(); desired.set(ticketId, m); }
      m.set(kuerzel, { points, ts });
    }
  }

  let neu = 0;
  let aktualisiert = 0;
  let entfernt = 0;
  const nextItems: FeedbackItem[] = [];

  for (const item of items) {
    const wanted = desired.get(item.id);
    const sponsors = item.sponsors ?? [];
    const hasCollectedExisting = sponsors.some(
      s => s.type === 'points' && collectedKuerzels.has(s.user_id),
    );
    // Kein gelesener User hat hier einen Punkte-Eintrag UND keiner wuenscht etwas
    // → Item unveraendert durchreichen (gleiche Referenz, kein Re-Render-Churn).
    if (!wanted && !hasCollectedExisting) { nextItems.push(item); continue; }

    let itemChanged = false;
    const nextSponsors: FeedbackSponsor[] = [];
    const seen = new Set<string>();

    for (const s of sponsors) {
      // Stunden + fremde (nicht im Batch gelesene) Punkte-Eintraege unangetastet.
      if (s.type !== 'points' || !collectedKuerzels.has(s.user_id)) {
        nextSponsors.push(s);
        continue;
      }
      // Stale-Guard: die gerade gelesene Datei ist aelter als der Stand, der
      // hier schon steht → sie stammt aus einer Ordnerleiche/alten Wurzel und
      // darf weder retrahieren noch ueberschreiben.
      if (istStrengAelter(dateiStempel.get(s.user_id), s.created_at)) {
        nextSponsors.push(s);
        seen.add(s.user_id);
        continue;
      }
      seen.add(s.user_id);
      const w = wanted?.get(s.user_id);
      if (!w) { entfernt++; itemChanged = true; continue; } // Retraktion
      if (w.points !== s.amount) {
        nextSponsors.push({ ...s, amount: w.points });
        aktualisiert++;
        itemChanged = true;
      } else {
        nextSponsors.push(s);
      }
    }

    // Brandneue Stimmen gelesener User ohne bisherigen Eintrag.
    if (wanted) {
      for (const [kuerzel, w] of wanted) {
        if (seen.has(kuerzel)) continue;
        nextSponsors.push({
          user_id: kuerzel,
          user_display_name: kuerzel,
          type: 'points',
          amount: w.points,
          created_at: w.ts,
        });
        neu++;
        itemChanged = true;
      }
    }

    if (!itemChanged) { nextItems.push(item); continue; }
    const totals = recalcSponsorTotals(nextSponsors);
    nextItems.push({
      ...item,
      sponsors: nextSponsors,
      sponsor_points_total: totals.points,
      sponsor_hours_total: totals.hours,
    });
  }

  return { items: nextItems, neu, aktualisiert, entfernt };
}

/**
 * Strikt aelter. Unparsebar oder gleich zaehlt NICHT als aelter — Bestandsdaten
 * (und der Normalfall „dieselbe Datei nochmal gelesen") verhalten sich damit
 * exakt wie vor dem Guard.
 */
export function istStrengAelter(datei: string | undefined, vorhanden: string | undefined): boolean {
  const a = datei ? Date.parse(datei) : Number.NaN;
  const b = vorhanden ? Date.parse(vorhanden) : Number.NaN;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a < b;
}
