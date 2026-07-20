/**
 * Anlagen-Referenzen (Projektbeschreibung, Markteinführungskonzept, …).
 *
 * Übernommen wird nur der **Präsenz-Nachweis** — Name, Grösse, Typ, Hash. Die
 * Download-URLs bleiben draussen: `url` und `data.fileUrl` zeigen im Echtfall auf
 * unterschiedliche Buckets (letzteres auf eine Quarantäne-Kopie), und ein
 * signierter Link gehört nicht in eine dauerhaft gespeicherte lokale Entität.
 * Die Prüfung braucht die Datei ohnehin über den Dokumentenindex, nicht über
 * einen Link aus dem JSON.
 */
import type { MapAnlageRef } from '../types';
import { alsListe, alsText, alsZahl, lesePfad } from './pfad';

/** Erntet ein einzelnes Anlagen-Array. Rein. */
export function ernteAnlagenFeld(roh: unknown, quellFeld: string): MapAnlageRef[] {
  return alsListe(roh)
    .map(eintrag => ({
      name: alsText(lesePfad(eintrag, 'name')) ?? '(ohne Namen)',
      originalName: alsText(lesePfad(eintrag, 'originalName')),
      groesse: alsZahl(lesePfad(eintrag, 'size')),
      typ: alsText(lesePfad(eintrag, 'type')),
      hash: alsText(lesePfad(eintrag, 'hash')),
      bucket: alsText(lesePfad(eintrag, 'bucket')),
      quellFeld,
    }));
}

/**
 * Erntet alle in der Schema-Definition genannten Anlagen-Felder und hängt sie
 * in der Reihenfolge der Definition aneinander. Rein.
 */
export function ernteAnlagen(quelle: unknown, anlagenPfade: readonly string[]): MapAnlageRef[] {
  const alle: MapAnlageRef[] = [];
  for (const pfad of anlagenPfade) {
    alle.push(...ernteAnlagenFeld(lesePfad(quelle, pfad), pfad));
  }
  return alle;
}
