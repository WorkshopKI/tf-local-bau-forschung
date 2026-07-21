/**
 * Reine Auswahl-/Inventar-Logik des Gutachten-Korpus (testbar ohne React, ohne IDB).
 *
 * Hintergrund: die Aufnahmefläche bietet sechs Dokumenttypen an, der Gutachten-Pfad
 * las aber nur EIN Dokument (die jüngste VB). Wer fünf Dateien ablegte, bekam ein
 * Gutachten aus einer davon — ohne Hinweis. Dieses Modul beantwortet die zwei Fragen,
 * die daraus folgen: WAS liegt zu diesem Verbund vor (Inventar) und WAS davon geht in
 * den Kontext (Auswahl).
 *
 * Die Zusatzdokumente sind **Opt-in**: eine leere Auswahl bedeutet „Korpus === VB" und
 * ist damit byte-identisch zum bisherigen Verhalten — dieselbe Zeichenkette, derselbe
 * `hashText`, gültige Relevanz-Map-Caches. Der Preis dafür ist der persistente Hinweis
 * in der UI (`hinweisErledigt`); ohne ihn wäre Opt-in nur eine bequeme Voreinstellung.
 */
import type { DocumentFull } from '@/plugins/dokumente/store';
import type { AntragDokumentTyp } from '@/core/services/csv/types';
import { typAusTags } from '@/core/components/dokumentAufnahmeFkz';

/** Ein Dokument des Verbundes, wie das Inventar es zeigt. */
export interface KorpusKandidat {
  docId: string;
  filename: string;
  typ: AntragDokumentTyp;
  created: string;
  zeichen: number;
  /** true = trägt den VB-Tag, kommt also als maßgebliche VB in Frage. */
  vbKandidat: boolean;
}

/** Persistierte Korpus-Mitgliedschaft — Gutachten-lokal (die Aufbereitung hat ihre eigene Regel). */
export interface KorpusAuswahlRecord {
  key: string;
  /** Opt-in: aufgenommene ZUSATZ-Dokumente. Leer/fehlend = Korpus === VB (byte-identisch). */
  aufgenommen: string[];
  /** true = der Sammel-Hinweis wurde bewusst behandelt (aufgenommen ODER abgelehnt). */
  hinweisErledigt?: boolean;
  geaendert_am: string;
}

const VB_TAG = 'vorhabensbeschreibung';

export function leererKorpusRecord(key: string): KorpusAuswahlRecord {
  return { key, aufgenommen: [], geaendert_am: new Date().toISOString() };
}

/**
 * Inventar aller Dokumente des Verbundes. Reihenfolge: `created` aufsteigend, bei
 * Gleichstand nach Dateiname — **stabil**, damit ein Toggle nicht die Position aller
 * anderen im Prompt verschiebt (sonst diffte jeder Klick den gesamten Kontext).
 */
export function baueInventar(docs: readonly DocumentFull[], verbundKey: string): KorpusKandidat[] {
  return docs
    .filter(d => (Array.isArray(d.tags) ? d.tags : []).includes(verbundKey))
    .map(d => {
      const tags = Array.isArray(d.tags) ? d.tags : [];
      return {
        docId: d.id,
        filename: d.filename ?? '(ohne Namen)',
        typ: typAusTags(tags),
        created: d.created ?? '',
        zeichen: (d.markdown ?? '').length,
        vbKandidat: tags.includes(VB_TAG),
      };
    })
    .sort((a, b) => a.created.localeCompare(b.created) || a.filename.localeCompare(b.filename));
}

/**
 * Welche Zusatzdokumente gehen in den Korpus? Die aktive VB ist NIE dabei — sie ist
 * konstruktionsbedingt der Präfix, stünde sie zusätzlich in der Liste, käme ihr Text
 * doppelt im Prompt an. Unbekannte docIds (Dokument gelöscht) fallen still raus, statt
 * die Auflösung zu brechen.
 */
export function waehleZusatzIds(
  inventar: readonly KorpusKandidat[], aufgenommen: readonly string[], vbDocId: string | null,
): string[] {
  const gewuenscht = new Set(aufgenommen);
  return inventar
    .filter(k => k.docId !== vbDocId && gewuenscht.has(k.docId))
    .map(k => k.docId);
}

/** Eine Mitgliedschaft umschalten. Idempotent, dublettenfrei, Reihenfolge stabil. */
export function schalteAufnahme(
  aufgenommen: readonly string[], docId: string, aufnehmen: boolean,
): string[] {
  const ohne = aufgenommen.filter(id => id !== docId);
  return aufnehmen ? [...ohne, docId] : ohne;
}

/** Alle Zusatzdokumente aufnehmen (der „Alle aufnehmen"-Knopf). Ohne die aktive VB. */
export function nimmAlleAuf(inventar: readonly KorpusKandidat[], vbDocId: string | null): string[] {
  return inventar.filter(k => k.docId !== vbDocId).map(k => k.docId);
}

/** Zähler für den Inventar-Kopf („5 Dokumente · 1 im Gutachten-Kontext"). */
export function zaehleAufgenommen(
  inventar: readonly KorpusKandidat[], aufgenommen: readonly string[], vbDocId: string | null,
): { imKorpus: number; gesamt: number } {
  const zusatz = waehleZusatzIds(inventar, aufgenommen, vbDocId);
  // Die VB zählt mit, sofern es überhaupt eine gibt (Ordner-Fallback hat keine docId,
  // ist aber trotzdem im Kontext — darum über die Inventar-Länge, nicht über vbDocId).
  const vbImKorpus = inventar.length > 0 ? 1 : 0;
  return { imKorpus: vbImKorpus + zusatz.length, gesamt: inventar.length };
}

/**
 * Steht der Sammel-Hinweis an? Sichtbar, solange nichts aufgenommen wurde, es aber
 * etwas aufzunehmen gäbe — und der Bearbeiter die Frage noch nicht beantwortet hat.
 * Bewusst kein Flash nach dem Upload: wer nach „Fertig" neu lädt, muss ihn wiedersehen.
 */
export function zeigeSammelHinweis(
  inventar: readonly KorpusKandidat[], auswahl: KorpusAuswahlRecord, vbDocId: string | null,
): boolean {
  if (auswahl.hinweisErledigt) return false;
  if (auswahl.aufgenommen.length > 0) return false;
  return inventar.some(k => k.docId !== vbDocId);
}
