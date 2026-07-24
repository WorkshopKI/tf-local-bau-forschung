/**
 * Post-Import-Integration des Status-Katalogs: nach jedem CSV-Import werden die
 * beobachteten Werte der kuratierten Wert-Felder gegen den Katalog gehalten und
 * Unbekanntes als `unkuratiert` gesammelt (nie automatisch gemappt).
 *
 * Best-effort und gerätelokal — kein Share-Zugriff. Aufruf gated hinter dem
 * `statusCockpit`-Flag im `importCsvSource`-Abschluss.
 */
import type { IDBStore } from '@/core/services/storage';
import { listAntraegeByProgramm, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import { ladeAktiveVersion, ladeUnkuratiert, speichereUnkuratiert } from './katalog-store';
import { ermittleNeueUnkuratierte, type BeobachteterWert } from './entdecke';

/**
 * Entdeckt neue (Feld,Wert)-Kombis der Wert-Felder in den Antraegen + Verbünden
 * eines Programms und hängt sie an den Unkuratiert-Puffer an. Gibt die Anzahl
 * neu gefundener Werte zurück (0 = nichts Neues).
 */
export async function entdeckeUnkuratiertNachImport(
  idb: IDBStore, programmId: string, jetztIso: string,
): Promise<number> {
  const version = await ladeAktiveVersion(idb);
  const wertFelder = version.felder.filter(f => f.typ === 'wert').map(f => f.feldId);
  if (wertFelder.length === 0) return 0;

  const beobachtet: BeobachteterWert[] = [];
  const sammle = (rec: Record<string, unknown>): void => {
    for (const feldId of wertFelder) {
      const v = rec[feldId];
      if (typeof v === 'string' && v.trim()) beobachtet.push({ feldId, wert: v });
      else if (typeof v === 'number') beobachtet.push({ feldId, wert: String(v) });
    }
  };
  for (const a of await listAntraegeByProgramm(idb, programmId)) {
    sammle(a as unknown as Record<string, unknown>);
  }
  for (const v of await listVerbuendeByProgramm(idb, programmId)) {
    sammle(v as unknown as Record<string, unknown>);
  }

  const bestehend = await ladeUnkuratiert(idb);
  const neu = ermittleNeueUnkuratierte(version, bestehend, beobachtet, jetztIso);
  if (neu.length === 0) return 0;
  await speichereUnkuratiert(idb, [...bestehend, ...neu]);
  return neu.length;
}
