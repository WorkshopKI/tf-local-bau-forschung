/**
 * Quell-Auflösung des Gutachtens: welche VB gilt, welche Dokumente liegen sonst noch
 * vor, und was davon geht als EIN Korpus ins Modell.
 *
 * Ersetzt den direkten `resolveVb`-Aufruf im Workflow-Hook. Der Unterschied ist nicht
 * die VB (die kommt unverändert aus `resolveVb`, inklusive Ordner-Fallback), sondern
 * dass das Ergebnis zusätzlich das **Inventar** trägt — vorher wusste die Gutachten-
 * Seite schlicht nicht, dass es weitere Dokumente gibt, und zeigte deshalb nur einen
 * Dateinamen an.
 *
 * Byte-Identität bei leerer Auswahl ist eine harte Eigenschaft, kein Nebeneffekt:
 * `baueKorpus(vb, [])` gibt `vb.markdown` unverändert zurück ⇒ gleicher `hashText`
 * ⇒ die Relevanz-Map-Caches aller Bestands-Verbünde bleiben gültig.
 */
import type { IDBStore } from '@/core/services/storage';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { resolveVb, listDocsByFkz, type VbAufloesung } from '../kurzfassung/vbDokument';
import type { KurzfassungContext } from '../kurzfassung/types';
import { baueKorpus, type KorpusDok } from '../dokumentKorpus';
import { getKorpusAuswahl } from './korpus-store';
import {
  baueInventar, waehleZusatzIds, zeigeSammelHinweis,
  type KorpusKandidat, type KorpusAuswahlRecord,
} from './korpusAuswahl';

export interface GutachtenKorpus {
  /** Die maßgebliche VB — treibt `vbDokument`/`vbVorhanden`/„Konvertierung prüfen". */
  vb: VbAufloesung;
  /** docId der aktiven VB; `null` beim Ordner-Fallback (dort gibt es keinen IDB-Record). */
  vbDocId: string | null;
  /** true = mehrere Dokumente tragen den VB-Tag → die Wahl darf nicht dem Zufall überlassen bleiben. */
  vbMehrdeutig: boolean;
  inventar: KorpusKandidat[];
  auswahl: KorpusAuswahlRecord;
  /** Die tatsächlich aufgenommenen Zusatzdokumente, in Inventar-Reihenfolge. */
  zusatz: KorpusDok[];
  /** Was ins `{{vbMarkdown}}` geht. Bei leerer Auswahl === `vb.markdown`. */
  markdown: string;
  /** Volltexte je docId — für „Konvertierung prüfen" pro Inventar-Zeile. */
  volltexte: Map<string, DocumentFull>;
  /** true = der persistente Sammel-Hinweis steht an. */
  sammelHinweis: boolean;
}

/**
 * Löst VB + Inventar + Korpus in einem Rutsch auf.
 *
 * `resolveVb` scannt die `doc:`-Keys intern erneut — das ist ein bewusst in Kauf
 * genommener zweiter Scan. Er hält den Ordner-Fallback an genau EINER Stelle; pro
 * Verbund sind es eine Handvoll Keys. Nicht durch einen Fork der Fallback-Logik
 * „wegoptimieren" — genau solche Zweitpfade waren der Ursprung dieser Bug-Klasse.
 */
export async function resolveGutachtenKorpus(
  idb: IDBStore, ctx: Pick<KurzfassungContext, 'key' | 'knownIds'>,
): Promise<GutachtenKorpus | null> {
  const [vb, alleDocs, auswahl] = await Promise.all([
    resolveVb(idb, ctx),          // wendet den expliziten VB-Pick bereits an
    listDocsByFkz(idb, ctx.key),
    getKorpusAuswahl(idb, ctx.key),
  ]);
  if (!vb) return null;

  const inventar = baueInventar(alleDocs, ctx.key);
  const volltexte = new Map(alleDocs.map(d => [d.id, d]));
  const vbDocId = vb.dokument?.id ?? null;
  const vbMehrdeutig = inventar.filter(k => k.vbKandidat).length > 1;

  const zusatz = waehleZusatzIds(inventar, auswahl.aufgenommen, vbDocId)
    .map(id => volltexte.get(id))
    .filter((d): d is DocumentFull => d != null)
    .map(d => ({ name: d.filename, markdown: d.markdown }));

  const vbDok: KorpusDok = {
    name: vb.quelleName ?? vb.dokument?.filename ?? 'Vorhabensbeschreibung',
    markdown: vb.markdown,
  };

  return {
    vb,
    vbDocId,
    vbMehrdeutig,
    inventar,
    auswahl,
    zusatz,
    markdown: baueKorpus(vbDok, zusatz),
    volltexte,
    sammelHinweis: zeigeSammelHinweis(inventar, auswahl, vbDocId),
  };
}
