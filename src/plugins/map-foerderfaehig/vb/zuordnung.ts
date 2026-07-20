/**
 * Zuordnung einer Vorhabensbeschreibung zur importierten Einreichung.
 *
 * Die Einreichung trägt kein Aktenzeichen — der etablierte Weg der
 * Antrag-Aufbereitung (Dokument über den FKZ-Tag finden) greift hier also nicht.
 * Stattdessen schlägt diese Datei Kandidaten vor und der Mensch bestätigt.
 * Bewusst kein automatisches Zuordnen: ein falsch zugeordnetes Dokument würde
 * die gesamte inhaltliche Prüfung auf den falschen Antrag stützen.
 */
import type { DocumentMeta } from '@/plugins/dokumente/store';
import type { MapEinreichung } from '../types';

export interface VbKandidat {
  doc: DocumentMeta;
  punkte: number;
  /** Was den Treffer ausgelöst hat — macht den Vorschlag begründbar. */
  grund: string[];
}

/** Muster, an denen eine Vorhabensbeschreibung im Dateinamen erkennbar ist. */
const VB_MUSTER = /(vorhabensbeschreibung|projektbeschreibung|\bvb\b|anlage\s*1)/i;

function normalisiere(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Ordnet die Dokumente nach Passung zur Einreichung. Der beste Kandidat ist ein
 * Vorschlag, keine Entscheidung. Rein.
 */
export function findeVbKandidaten(
  dokumente: readonly DocumentMeta[], einreichung: MapEinreichung, maxTreffer = 5,
): VbKandidat[] {
  const akronym = einreichung.stamm.akronym;
  const akronymNorm = akronym !== null && akronym.length >= 3 ? normalisiere(akronym) : null;
  const titelWoerter = (einreichung.stamm.titel ?? '')
    .split(/\s+/)
    .map(normalisiere)
    .filter(w => w.length >= 5);

  return dokumente
    .map(doc => {
      const nameNorm = normalisiere(doc.filename);
      const grund: string[] = [];
      let punkte = 0;

      if (akronymNorm !== null && nameNorm.includes(akronymNorm)) {
        punkte += 5;
        grund.push(`Akronym „${akronym}" im Dateinamen`);
      }
      if (VB_MUSTER.test(doc.filename)) {
        punkte += 3;
        grund.push('Dateiname deutet auf eine Vorhabensbeschreibung');
      }
      const titelTreffer = titelWoerter.filter(w => nameNorm.includes(w));
      if (titelTreffer.length > 0) {
        punkte += titelTreffer.length;
        grund.push(`${titelTreffer.length} Wort(e) aus dem Projekttitel`);
      }

      return { doc, punkte, grund };
    })
    .filter(k => k.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte || a.doc.filename.localeCompare(b.doc.filename, 'de'))
    .slice(0, maxTreffer);
}
