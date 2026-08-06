/**
 * Wie oft ein Statuscode und wie oft ein Kürzel im Bestand wirklich vorkommt —
 * die Zahl, die eine Zuordnung wiegt. Eine Phase mit 222 Vorgängen diskutiert
 * man anders als eine mit dreien, und ein Kürzel, das nie gesetzt wird, ist eine
 * andere Auskunft als eines, das täglich läuft.
 *
 * **Gezählt werden Vorgänge, nicht Verbünde.** Die `vorkommen`-Map des
 * Katalog-Tabs zählt etwas anderes (Verbünde je Feld-Wert-Paar, siehe
 * `cockpit-berechnung.ts`) und käme aus dem schweren Kurations-Hook; gebraucht
 * wird hier je Code bzw. je Kürzel.
 *
 * **Ohne Betrachtungsbereich-Filter** (Pitfall #46): die Zahl ist Evidenz, nicht
 * Arbeitsvorrat. Zwei Personen mit verschiedenen Bereichs-Einstellungen sollen
 * dieselbe Zahl sehen — sonst streitet der Termin über die Zahl statt über die
 * Zuordnung. Fürs Glossar gilt dasselbe Argument: es erklärt den Bestand, es
 * verteilt keine Arbeit.
 *
 * **Der Stempel gehört dazu.** Gelesen wird die LOKALE Datenbank; wer Montag
 * importiert hat, hat andere Zahlen als wer Donnerstag importiert hat. Ohne den
 * Bestandsstand daneben wäre die Zahl eine Behauptung.
 *
 * Importe bewusst an den Nachbarmodulen statt am Barrel `@/core/status`: aus dem
 * Barrel heraus wäre das ein Selbstbezug, und `npm run cycles` hat eine leere
 * Allowlist.
 */
import type { IDBStore } from '@/core/services/storage';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { jederVorgang, type VorgangsRohsatz } from './vorgangs-quelle';
import { findeStatusCode } from './status-codes';
import type { MappingVersion } from './typen';

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

/**
 * Die Kürzel EINES Vorgangs, entdoppelt. Ein Kürzel kann über zwei Felder an
 * denselben Vorgang kommen (Verbund- und TV-Record); gezählt wird trotzdem ein
 * Vorgang, sonst wöge ein doppelt geführtes Kürzel schwerer als ein einfach
 * geführtes.
 *
 * Normalisiert auf NFC (Pitfall #22) — sonst findet ein Umlaut-Kürzel seinen
 * eigenen Eintrag im Katalog nicht wieder.
 */
export function kuerzelEinesVorgangs(satz: VorgangsRohsatz): Set<string> {
  const codes = new Set<string>();
  for (const v of satz.vorkommen) {
    const code = v.feld.code;
    if (code !== undefined && code !== '') codes.add(code.normalize('NFC'));
  }
  return codes;
}

export interface VorkommenStand {
  proCode: Map<number, number>;
  /** Wie viele Vorgänge das Kürzel gesetzt tragen (nicht: wie oft es gesetzt wurde). */
  proKuerzel: Map<string, number>;
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
 * EIN Durchlauf über den Bestand für beide Zählungen. Wird bewusst NACH dem
 * ersten Rendern angestoßen: die Tabelle steht sofort, die Zahlen kommen nach —
 * 14 000 Anträge zu zählen darf einen Fragebogen nicht aufhalten.
 */
export async function ladeVorkommen(
  idb: IDBStore, version: MappingVersion,
): Promise<VorkommenStand> {
  const records: Record<string, unknown>[] = [];
  const proKuerzel = new Map<string, number>();
  await jederVorgang(idb, version, satz => {
    records.push(satz.record);
    for (const code of kuerzelEinesVorgangs(satz)) {
      proKuerzel.set(code, (proKuerzel.get(code) ?? 0) + 1);
    }
  });
  return {
    proCode: zaehleCodes(records),
    proKuerzel,
    gesamt: records.length,
    importiertAm: await juengsterImport(idb),
  };
}
