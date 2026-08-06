/**
 * Aus gesetzten Datumsfeldern werden **Übergänge**: welches Kürzel wann gesetzt
 * wurde, von wem, und ob damit ein Statuswechsel belegt ist.
 *
 * Die Chronologie baut nicht diese Datei, sondern `baueChronik` — sie parst die
 * Datumsformate, wirft `ignoriert`/`nebensaechlich` heraus und entdoppelt je
 * (Feld, Tag). Dieselbe Regel wie Chronik und Zeitstrahl, damit alle drei
 * Ansichten denselben Bestand zeigen.
 *
 * **Tagesgranularität, keine Uhrzeit.** Der Export führt keine; mehrere Kürzel
 * am selben Tag bleiben deshalb unsortiert nebeneinander stehen und werden nie
 * in eine erfundene Reihenfolge gebracht (das erledigt `segmente.ts`).
 *
 * Rein: keine IO, keine Uhr.
 */
import { baueChronik } from '../chronik';
import { heutigesKuerzel, kuerzelAuskunft, type Projektform } from '../kuerzel-katalog';
import type { FeldVorkommen } from '../feld-aufloesung';
import type { KuerzelTriggerRegel } from '../kuerzel-trigger.data';
import { statusRefVonRegel } from './status-ref';
import type { RollenLage, SpurArt, VerlaufsUebergang } from './typen';

/** Nachschlag (Kürzel, Projektform) → Regel. Einmal gebaut, nicht je Vorgang. */
export type RegelIndex = ReadonlyMap<string, KuerzelTriggerRegel>;

/** Baut den Index über die Regeln der Zuarbeit. Schlüssel `KÜRZEL|PROJEKTFORM`. */
export function baueRegelIndex(regeln: readonly KuerzelTriggerRegel[]): RegelIndex {
  const m = new Map<string, KuerzelTriggerRegel>();
  for (const r of regeln) {
    const k = schluessel(r.kuerzel, r.projektform);
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

function schluessel(kuerzel: string, projektform: string): string {
  return `${kuerzel.normalize('NFC').toUpperCase()}|${projektform}`;
}

/** Gilt die Regel für diese Ebene? `scope: null` heißt „die Zuarbeit sagt es nicht". */
function scopeDeckt(regel: KuerzelTriggerRegel, art: SpurArt): boolean {
  if (regel.scope === null) return false;
  return art === 'tv'
    ? regel.scope === 'tv' || regel.scope === 'tv+verbund'
    : regel.scope === 'verbund' || regel.scope === 'tv+verbund';
}

/** Was die Aggregationsprüfung eines Verbunds über ein Kürzel sagt. */
export type AggregationsPruefung = (kuerzel: string, quantor: 'alle' | 'kein') => boolean | null;

export interface UebergangsEingabe {
  vorkommen: readonly FeldVorkommen[];
  /** `null` = Projektform unbekannt; dann liefert der Katalog nur bei
   *  formübergreifender Übereinstimmung eine Bedeutung. */
  projektform: Projektform | null;
  art: SpurArt;
  regeln: RegelIndex;
  /** Prüft `XPC+`/`XPC?` über die Teilvorhaben; ohne sie bleibt `erfuellt: null`. */
  pruefeAggregation?: AggregationsPruefung;
}

/**
 * Alle Übergänge einer Ebene, aufsteigend nach Tag.
 *
 * **Die Regel wird unter beiden Kürzel-Formen gesucht** — erst unter der im
 * Export gefundenen, dann unter der heutigen. Die Zuarbeit ist auf dem neuen
 * Stand; eine Spalte aus 2018 trägt den alten Namen. Ohne den zweiten Versuch
 * bliebe ein umbenanntes Kürzel für immer ohne Statuswechsel.
 */
export function baueUebergaenge(e: UebergangsEingabe): VerlaufsUebergang[] {
  const chronik = baueChronik(e.vorkommen, { zeigeNebensaechlich: false });
  const out: VerlaufsUebergang[] = [];

  for (const eintrag of chronik) {
    const roh = eintrag.feld.code?.normalize('NFC');
    if (!roh) continue;                       // kanonische Felder ohne Kürzel-Code
    const heute = heutigesKuerzel(roh);
    const auskunft = kuerzelAuskunft(roh, e.projektform);
    const regel = e.projektform === null
      ? undefined
      : e.regeln.get(schluessel(roh, e.projektform))
        ?? (heute ? e.regeln.get(schluessel(heute, e.projektform)) : undefined);

    const rollenLage: RollenLage = auskunft.bezeichnung === null || !auskunft.eindeutig
      ? 'unbekannt'
      : auskunft.rollen.length > 0 ? 'benannt' : 'neutral';

    const uebergang: VerlaufsUebergang = {
      kuerzel: heute ?? roh,
      ...(heute ? { kuerzelHistorisch: roh } : {}),
      datum: eintrag.tag,
      rollen: rollenLage === 'benannt' ? auskunft.rollen : [],
      rollenLage,
      konfidenz: 'kein_kuerzel',
      bezeichnung: auskunft.bezeichnung,
      bezeichnungEindeutig: auskunft.eindeutig,
    };

    if (regel && scopeDeckt(regel, e.art) && regel.zielStatus) {
      uebergang.konfidenz = 'trigger_bestaetigt';
      uebergang.setztStatus = statusRefVonRegel(regel.zielStatus.roh, regel.zielStatus.code);
    } else if (regel && regel.scope === null) {
      // Eine eigene Aussage: die Regel gibt es, ihre Ebene steht nicht fest.
      uebergang.scopeUnbestimmt = true;
    }

    if (regel?.bedingung?.art === 'aggregation-tv') {
      const b = regel.bedingung;
      uebergang.ausAggregation = {
        quantor: b.quantor,
        kuerzel: b.kuerzel,
        erfuellt: e.pruefeAggregation ? e.pruefeAggregation(b.kuerzel, b.quantor) : null,
      };
    }

    out.push(uebergang);
  }
  return out;
}
