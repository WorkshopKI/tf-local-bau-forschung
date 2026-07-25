/**
 * Post-Import-Integration des Status-Systems (ein Aufruf `nachImportStatusPflege`):
 * (1) Auto-Discovery unbekannter Statuswerte als `unkuratiert` (nie automatisch
 * mappen) und (2) Historie-Reconcile (neue `StatusEvent`s anhängen).
 *
 * Best-effort und gerätelokal — kein Share-Zugriff. Aufruf gated hinter dem
 * `statusCockpit`-Flag im `importCsvSource`-Abschluss.
 */
import type { IDBStore } from '@/core/services/storage';
import { listAntraegeByProgramm, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import { ladeAktiveVersion, ladeUnkuratiert, speichereUnkuratiert } from './katalog-store';
import { ermittleNeueUnkuratierte, pruneKuratierte, type BeobachteterWert } from './entdecke';
import { leseFeldWert } from './feld-zugriff';
import { reconcileStatusEvents } from './reconcile';

/**
 * Entdeckt neue (Feld,Wert)-Kombis der Wert-Felder und hängt sie an den
 * Unkuratiert-Puffer an. Liest ebene-korrekt (Verbund- vs. TV-Felder). Gibt die
 * Anzahl neu gefundener Werte zurück.
 */
export async function entdeckeUnkuratiertNachImport(
  idb: IDBStore, programmId: string, jetztIso: string,
): Promise<number> {
  const version = await ladeAktiveVersion(idb);
  const wertFelder = version.felder.filter(f => f.typ === 'wert');
  if (wertFelder.length === 0) return 0;

  const antraege = await listAntraegeByProgramm(idb, programmId);
  const verbuende = await listVerbuendeByProgramm(idb, programmId);
  const beobachtet: BeobachteterWert[] = [];
  for (const feld of wertFelder) {
    const records = feld.ebene === 'verbund' ? verbuende : antraege;
    for (const rec of records) {
      const wert = leseFeldWert(rec as unknown as Record<string, unknown>, feld);
      if (wert) beobachtet.push({ feldId: feld.feldId, wert });
    }
  }

  // Vor dem Anhängen aufräumen: was die PL inzwischen team-weit kuratiert hat,
  // ist hier kein Fund mehr (der Katalog kommt seit v2.332 vom Daten-Share).
  const bestehend = pruneKuratierte(version, await ladeUnkuratiert(idb));
  const neu = ermittleNeueUnkuratierte(version, bestehend, beobachtet, jetztIso);
  if (neu.length === 0) {
    await speichereUnkuratiert(idb, bestehend);
    return 0;
  }
  await speichereUnkuratiert(idb, [...bestehend, ...neu]);
  return neu.length;
}

/** Ein Post-Import-Aufruf: Auto-Discovery + Historie-Reconcile. Best-effort. */
export async function nachImportStatusPflege(
  idb: IDBStore, programmId: string, touchedAktenzeichen: readonly string[], jetztIso: string,
): Promise<{ neueWerte: number; neueEvents: number }> {
  const neueWerte = await entdeckeUnkuratiertNachImport(idb, programmId, jetztIso);
  const neueEvents = await reconcileStatusEvents(idb, programmId, touchedAktenzeichen, jetztIso);
  return { neueWerte, neueEvents };
}
