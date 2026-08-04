/**
 * Wie oft ein Statuscode im Bestand wirklich vorkommt — die Zahl, die eine
 * Zuordnung wiegt. Eine Phase mit 222 Vorgängen diskutiert man anders als eine
 * mit dreien.
 *
 * **Gezählt werden Vorgänge, nicht Verbünde.** Die `vorkommen`-Map des
 * Katalog-Tabs zählt etwas anderes (Verbünde je Feld-Wert-Paar) und käme aus dem
 * schweren Kurations-Hook; gebraucht wird hier je Code.
 *
 * **Ohne Betrachtungsbereich-Filter** (Pitfall #46): die Zahl ist Evidenz, nicht
 * Arbeitsvorrat. Zwei Personen mit verschiedenen Bereichs-Einstellungen sollen
 * dieselbe Zahl sehen — sonst streitet der Termin über die Zahl statt über die
 * Zuordnung.
 *
 * **Der Stempel gehört dazu.** Gelesen wird die LOKALE Datenbank; wer Montag
 * importiert hat, hat andere Zahlen als wer Donnerstag importiert hat. Ohne den
 * Bestandsstand daneben wäre die Zahl eine Behauptung.
 */
import type { IDBStore } from '@/core/services/storage';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { jederVorgang, findeStatusCode, type MappingVersion } from '@/core/status';

/** Der Statuscode eines Antrags-Records — `null`, wenn der Text unbekannt ist. */
export function codeAusSatz(record: Record<string, unknown>): number | null {
  const roh = typeof record.status === 'string' ? record.status : '';
  if (roh.trim() === '') return null;
  return findeStatusCode(roh)?.eintrag.code ?? null;
}

/** Zählt Codes über eine Folge von Records. Rein — die Schleife kommt von außen. */
export function zaehleCodes(records: Iterable<Record<string, unknown>>): Map<number, number> {
  const proCode = new Map<number, number>();
  for (const rec of records) {
    const code = codeAusSatz(rec);
    if (code === null) continue;
    proCode.set(code, (proCode.get(code) ?? 0) + 1);
  }
  return proCode;
}

export interface VorkommenStand {
  proCode: Map<number, number>;
  /** Wie viele Vorgänge gezählt wurden (auch die ohne erkannten Code). */
  gesamt: number;
  /** ISO-Zeitpunkt des jüngsten CSV-Imports; `null` wenn unbekannt. */
  importiertAm: string | null;
}

/** Der jüngste Import über alle Schemas — der Stand, auf den sich die Zahlen berufen. */
async function juengsterImport(idb: IDBStore): Promise<string | null> {
  const stempel: string[] = [];
  for (const p of await listProgramme(idb)) {
    for (const s of await listSchemasByProgramm(idb, p.id)) {
      if (typeof s.last_imported_at === 'string' && s.last_imported_at !== '') {
        stempel.push(s.last_imported_at);
      }
    }
  }
  return stempel.sort().pop() ?? null;
}

/**
 * Ein Durchlauf über den Bestand. Wird bewusst NACH dem ersten Rendern
 * angestoßen: die Tabelle steht sofort, die Zahlen kommen nach — 14 000 Anträge
 * zu zählen darf einen Fragebogen nicht aufhalten.
 */
export async function ladeVorkommen(
  idb: IDBStore, version: MappingVersion,
): Promise<VorkommenStand> {
  const records: Record<string, unknown>[] = [];
  await jederVorgang(idb, version, satz => { records.push(satz.record); });
  return {
    proCode: zaehleCodes(records),
    gesamt: records.length,
    importiertAm: await juengsterImport(idb),
  };
}
