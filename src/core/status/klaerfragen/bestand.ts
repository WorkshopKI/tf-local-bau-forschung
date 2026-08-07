/**
 * Der Bestandslauf, aus dem die Klärfragen entstehen — **ein** Durchgang, alle
 * Zählungen.
 *
 * **Warum nicht `ladeVorkommen` erweitern.** Das Nachbarmodul (`vorkommen.ts`)
 * zählt Codes und Kürzel für die Klärung und das Glossar; hier werden zusätzlich
 * Rohwerte, Verbundstatus und die Projektform gebraucht. Ein gemeinsames
 * Ergebnisobjekt hieße, dass jeder Aufrufer den Durchgang des anderen mitbezahlt
 * — beide laufen nur auf Knopfdruck und nie zusammen. Geteilt werden stattdessen
 * die reinen Teile (`kuerzelEinesVorgangs`).
 *
 * **Einheit ist der Vorgang, ohne Betrachtungsbereich** (Pitfall #46): Evidenz
 * folgt dem Bereich nicht, sonst sehen zwei Personen mit verschiedenen
 * Einstellungen verschiedene Listen — und der Termin streitet über die Zahl statt
 * über die Frage.
 *
 * Gelesen wird die LOKALE Datenbank; deshalb trägt jedes Ergebnis den
 * Bestandsstand als Stempel. Ohne ihn wäre die Zahl eine Behauptung.
 */
import type { IDBStore } from '@/core/services/storage';
import { listProgramme, listSchemasByProgramm, listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import { jederVorgang } from '../vorgangs-quelle';
import { kuerzelEinesVorgangs } from '../vorkommen';
import { projektformLage } from '../kuerzel-katalog';
import type { MappingVersion } from '../typen';
import type { KlaerfragenBestand } from './typen';

function hoch(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Der jüngste Import über alle Schemas — der Stand, auf den sich alles beruft. */
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

export async function ladeKlaerfragenBestand(
  idb: IDBStore, version: MappingVersion,
): Promise<KlaerfragenBestand> {
  // Zuerst die Verbünde: ihr Status gehört zum Kontext jedes Teilvorhabens, und
  // ohne ihn ließe sich pro Vorgang nicht entdoppeln.
  const vbStatus = new Map<string, string>();
  const rohStatusVerbuende = new Map<string, number>();
  for (const p of await listProgramme(idb)) {
    for (const v of await listVerbuendeByProgramm(idb, p.id)) {
      const s = text(v.status);
      if (s === '') continue;
      vbStatus.set(v.verbund_id, s);
      hoch(rohStatusVerbuende, s);
    }
  }

  const rohStatus = new Map<string, number>();
  const proKuerzel = new Map<string, number>();
  const proKuerzelDs = new Map<string, number>();
  const dsVerbundIds = new Set<string>();
  let dsVorgaenge = 0;
  let gesamtVorgaenge = 0;

  await jederVorgang(idb, version, satz => {
    gesamtVorgaenge++;
    const lage = projektformLage(satz.record.vb_phase);
    const istDs = lage.art === 'zuarbeit-aelter' && lage.label === 'DS';
    if (istDs) {
      dsVorgaenge++;
      if (satz.verbundId !== null) dsVerbundIds.add(satz.verbundId);
    }

    // Eigener Status UND der des Verbunds, als Menge: ein Vorgang, an dem
    // derselbe Wert zweimal steht, zählt einmal.
    const werte = new Set<string>();
    const eigen = text(satz.record.status);
    if (eigen !== '') werte.add(eigen);
    const vb = satz.verbundId !== null ? vbStatus.get(satz.verbundId) : undefined;
    if (vb !== undefined) werte.add(vb);
    for (const w of werte) hoch(rohStatus, w);

    for (const k of kuerzelEinesVorgangs(satz)) {
      hoch(proKuerzel, k);
      if (istDs) hoch(proKuerzelDs, k);
    }
  });

  return {
    rohStatus,
    rohStatusVerbuende,
    proKuerzel,
    proKuerzelDs,
    dsVerbuende: dsVerbundIds.size,
    dsVorgaenge,
    gesamtVorgaenge,
    importiertAm: await juengsterImport(idb),
  };
}
