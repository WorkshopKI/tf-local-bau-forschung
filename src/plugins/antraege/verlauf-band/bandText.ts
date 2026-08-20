/**
 * Der Verlauf als **Klartext zum Mitnehmen**.
 *
 * Dieser Text ist für Rückfragen ans Fachsystem gedacht — deshalb trägt er,
 * anders als die Bahn, **die Codes mit**. In der Oberfläche wäre `AK4` eine
 * Vokabel, die nur die Hälfte des Teams kennt; in einer Mail an die Fachseite
 * ist sie das einzige, worüber sich eindeutig reden lässt.
 *
 * Er nennt außerdem, worauf er beruht: Bestandsstand, Katalogfassung und den
 * Hinweis, dass die Bahn **rekonstruiert** ist. Ein abgeleiteter Verlauf, den
 * jemand als Beobachtung weitergibt, wird zur Behauptung.
 *
 * Rein: keine Uhr, kein DOM.
 */
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { KONFIDENZ_TEXT } from '../ausklapp/SpurListe';
import { dauerText } from './bandGeometrie';

export interface BandKopf {
  /** Aktenzeichen oder Verbund-Id, über die der Text spricht. */
  bezug: string;
  /** Beschriftung der geladenen Katalogfassung; `null` = keine geladen. */
  fassung: string | null;
  /** Nullpunkt des Import-Diff-Journals. */
  journalAb: string | null;
  /** Rechtes Ende der Achse. */
  bezugsZeitpunkt: string;
}

function statusMitCode(roh: string, code: number | null, lang: string): string {
  return code === null ? `${lang} (kein Code, Rohwert „${roh}")` : `${lang} [${code}]`;
}

export function baueVerlaufsText(
  spuren: readonly VerlaufsSpur[], kopf: BandKopf,
): string {
  const z: string[] = [
    `Statusverlauf ${kopf.bezug}`,
    'REKONSTRUIERT aus den Datumsspalten des Exports — keine beobachtete Historie.',
    `Achse bis ${kopf.bezugsZeitpunkt}`
      + ` · Katalogfassung ${kopf.fassung ?? 'nicht geladen'}`
      + ` · Journal ${kopf.journalAb === null ? 'nicht geführt' : `ab ${kopf.journalAb}`}`,
    '',
  ];

  for (const s of spuren) {
    z.push(s.art === 'verbund' ? 'VERBUND' : `TEILVORHABEN ${s.id}`);
    if (s.begruendung !== undefined) z.push(`  ${s.begruendung}`);
    if (s.abweichung) {
      z.push(`  ABWEICHUNG (${s.abweichung.art}): Export „${s.abweichung.beobachtet}"`
        + (s.abweichung.erwartet ? `, abgeleitet „${s.abweichung.erwartet.roh}"` : ''));
    }
    for (const seg of s.segmente) {
      const r = seg.statusRef;
      // Der Text ist für Rückfragen ans Fachsystem gedacht und trägt deshalb die
      // Codes mit — gerade beim mehrdeutigen Segment, wo es auf sie ankommt
      // (bis v4.122 stand dort „ohne Status", obwohl beide Werte bekannt sind).
      const statusText = seg.kandidaten && seg.kandidaten.length > 0
        ? `${seg.kandidaten.map(k => statusMitCode(k.roh, k.code, k.lang)).join(' ODER ')}`
          + ' [mehrdeutig, gleichtägig]'
        : r ? statusMitCode(r.roh, r.code, r.lang) : 'ohne Status';
      z.push(`  ${seg.vonDatum ?? '????-??-??'} – ${seg.bisDatum ?? 'offen'}`
        + `  ${statusText}`
        + `  (${dauerText(seg.dauerTage)}${seg.dauerUnsicher ? ', unsicher' : ''})`);
    }
    for (const u of s.uebergaenge) {
      z.push(`  ${u.datum}  ${u.kuerzel}`
        + (u.kuerzelHistorisch ? ` (im Export ${u.kuerzelHistorisch})` : '')
        + (u.bezeichnung !== null ? `  ${u.bezeichnung}` : '')
        + (u.bezeichnungEindeutig ? '' : ' [je Projektform verschieden]')
        + `  — ${KONFIDENZ_TEXT[u.konfidenz]}`
        + (u.setztStatus ? `  → ${statusMitCode(u.setztStatus.roh, u.setztStatus.code, u.setztStatus.lang)}` : ''));
      if (u.bedingung && u.bedingung.urteil !== 'erfuellt' && u.bedingung.gruende.length > 0) {
        z.push(`      ${u.bedingung.gruende.join(' · ')}`);
      }
    }
    z.push('');
  }
  return z.join('\n');
}
