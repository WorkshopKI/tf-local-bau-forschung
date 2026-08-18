/**
 * Der **Bestandslauf** der Vorgangs-Regeln-Seite: einmal über alle Programme,
 * Verbünde und Anträge, damit der Katalog-Editor weiß, welche seiner Felder und
 * Werte überhaupt vorkommen.
 *
 * Eigene Datei, weil es eine eigene Verantwortung ist: der Hook daneben führt
 * den Editor-Zustand (Entwurf, Speichern, Fassungsliste), dies hier liest Daten
 * und rechnet sie zusammen. Vermischt trug `useStatusCockpit.ts` beides und lief
 * über die Zeilen-Schwelle des Health-Baselines.
 *
 * **Der Lauf wird gecacht** (`cockpitCache.ts`): über 7 500 Verbünde kostet er
 * Sekunden, und der Router mountet die Seite bei jeder Rückkehr neu. Gecacht
 * wird NUR dieses Ergebnis — nie die Fassung, die hier das Arbeitsstück ist.
 */
import {
  listProgramme, listVerbuendeByProgramm, listAntraegeByProgramm, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import type { CsvSchema } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { tfPerfLog } from '@/core/utils/tfPerf';
import { bestandGeneration } from '@/core/services/bestand-generation';
import {
  baueVerbundFelder, zaehleVorkommen, zuletztGesehen, csvSpaltenJeFeld,
  type VerbundFelder,
} from '@/core/status/cockpit-berechnung';
import { baueFeldAufloesung } from '@/core/status/feld-aufloesung';
import { getAlleEvents } from '@/core/status/event-store';
import { programmNummernVon } from '@/plugins/antraege/status/programmNummer';
import type { MappingVersion } from '@/core/status/typen';
import { useCockpitCache, cockpitCacheGilt } from './cockpitCache';

export interface Bestand {
  verbundFelder: VerbundFelder[];
  /** Roh mitgeführt: der Bedingungs-Editor braucht den Spalten-Vorrat. */
  schemas: CsvSchema[];
  vorkommen: Map<string, number>;
  zuletzt: Map<string, string>;
  csvSpalten: Map<string, string[]>;
  /** Programm-Nummer (`FM_NUMMER`) → Anzahl Anträge; für den Trigger-Import. */
  programmAntraege: Map<string, number>;
  /** Anträge ganz ohne Programm-Nummer — dort greift das Vorgangssystem nie. */
  antraegeOhneProgramm: number;
  /**
   * Verbünde, deren Teilvorhaben verschiedene Programm-Nummern tragen.
   *
   * Verletzt die Invariante „ein Verbund läuft in genau einer Richtlinie" — dann
   * hinge die Trigger-Auswahl an der Zeilenreihenfolge. Gemeldet statt geheilt
   * (`programmNummer`); erwartet ist 0.
   */
  programmUneinheitlich: { verbundId: string; nummern: string[] }[];
}

/**
 * Liest und rechnet den Bestand. `neuRechnen` geht am Cache vorbei — das ist der
 * Weg des „neu berechnen"-Knopfs.
 */
export async function ladeBestand(
  idb: IDBStore, version: MappingVersion, neuRechnen = false,
): Promise<Bestand> {
    // Der Bestand hängt an den Daten UND an der benutzten Fassung
    // (`baueVerbundFelder` projiziert mit ihr). Die Fassung geht als Nummer +
    // Zeitstempel ein — bei einer Nummern-Kollision trägt dieselbe Nummer
    // verschiedenen Inhalt.
    const schluessel = [
      version.version, version.zeitstempel ?? '', bestandGeneration(),
    ].join('|');
    const cache = useCockpitCache.getState();
    if (!neuRechnen && cockpitCacheGilt(cache, schluessel, Date.now()) && cache.bestand) {
      console.info(
        `[status-cockpit] Bestand aus dem Cache (${cache.bestand.verbundFelder.length} Verbünde,`
        + ` berechnet vor ${Math.round((Date.now() - cache.berechnetAm) / 1000)} s)`,
      );
      return cache.bestand;
    }
    const tBestand = performance.now();
    let ioMs = 0;
    // Die Events hängen nicht an der Fassung und nicht am Bestandslauf — sie hier
    // ANZUSTOSSEN statt sie hinterher zu erwarten, überlappt ihren Store-Read mit
    // der Schleife darunter. Sequenziell gelesen wartete er auf sie, obwohl er
    // nichts von ihr braucht.
    const eventsP = getAlleEvents(idb);
    const programme = await listProgramme(idb);
    const vf: VerbundFelder[] = [];
    const schemas: CsvSchema[] = [];
    // Fällt hier kostenlos ab: die Schleife liest die Anträge ohnehin. Ein
    // zweiter Durchlauf für dieselbe Zahl wäre eine zweite Wahrheit.
    const programmAntraege = new Map<string, number>();
    let antraegeOhneProgramm = 0;
    const programmUneinheitlich: { verbundId: string; nummern: string[] }[] = [];
    for (const p of programme) {
      const tIo = performance.now();
      const [verbuende, antraege, programmSchemas] = await Promise.all([
        listVerbuendeByProgramm(idb, p.id),
        listAntraegeByProgramm(idb, p.id),
        listSchemasByProgramm(idb, p.id),
      ]);
      ioMs += performance.now() - tIo;
      schemas.push(...programmSchemas);
      // Je Programm auflösen: dieselbe Spalte kann in verschiedenen Programmen
      // unter verschiedenen Record-Keys liegen.
      const aufloesung = baueFeldAufloesung(programmSchemas, version.felder);
      const byVb = new Map<string, { aktenzeichen: string; record: Record<string, unknown> }[]>();
      const einzeln: { aktenzeichen: string; record: Record<string, unknown> }[] = [];
      for (const a of antraege) {
        const up = typeof a.unterprogramm_id === 'string' ? a.unterprogramm_id.trim() : '';
        if (up) programmAntraege.set(up, (programmAntraege.get(up) ?? 0) + 1);
        else antraegeOhneProgramm += 1;
        const rec = a as unknown as Record<string, unknown>;
        const vbid = typeof a.verbund_id === 'string' && a.verbund_id ? a.verbund_id : null;
        const eintrag = { aktenzeichen: a.aktenzeichen, record: rec };
        if (vbid) {
          const list = byVb.get(vbid);
          if (list) list.push(eintrag); else byVb.set(vbid, [eintrag]);
        } else {
          einzeln.push(eintrag);
        }
      }
      // Invariante „ein Verbund läuft in genau einer Richtlinie" — hier prüfbar,
      // weil die Gruppierung ohnehin steht. Erwartet ist eine leere Liste.
      for (const [vbid, tvs] of byVb) {
        const nummern = programmNummernVon(tvs.map(t => ({
          unterprogramm_id: typeof t.record.unterprogramm_id === 'string'
            ? t.record.unterprogramm_id : undefined,
        })));
        if (nummern.length > 1) programmUneinheitlich.push({ verbundId: vbid, nummern });
      }
      for (const v of verbuende) {
        vf.push(baueVerbundFelder(version, v.verbund_id, v as unknown as Record<string, unknown>, byVb.get(v.verbund_id) ?? [], aufloesung));
        byVb.delete(v.verbund_id);
      }
      // Verbund-IDs ohne Verbund-Record (Waisen) + antragslose Einzelantraege
      for (const [vbid, tvs] of byVb) vf.push(baueVerbundFelder(version, vbid, {}, tvs, aufloesung));
      for (const e of einzeln) vf.push(baueVerbundFelder(version, e.aktenzeichen, {}, [e], aufloesung));
    }
    tfPerfLog(
      `cockpit ladeBestand: ${vf.length} Verbünde, ${schemas.length} Schemas`
      + ` in ${(performance.now() - tBestand).toFixed(0)}ms (io ${ioMs.toFixed(0)}ms)`,
    );
    const bestand: Bestand = {
      verbundFelder: vf,
      schemas,
      vorkommen: zaehleVorkommen(vf),
      zuletzt: zuletztGesehen(await eventsP),
      csvSpalten: csvSpaltenJeFeld(schemas),
      programmAntraege,
      antraegeOhneProgramm,
      programmUneinheitlich,
    };
    useCockpitCache.getState().setzen(schluessel, bestand, vf.length);
    return bestand;
}
