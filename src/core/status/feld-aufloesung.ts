/**
 * Auflösung der Katalog-Felder gegen die Programm-Schemas — und die eine Regel,
 * aus welchem Record ein Feld gelesen wird.
 *
 * **Warum überhaupt aufgelöst wird**: die Code-Felder des Fachsystems tragen als
 * `feldId` den rohen CSV-Spalten-Code (`D_XTEC`). Unter welchem Key die Spalte
 * im Antrag-Record landet, entscheidet aber das Mapping — kanonisch, custom oder
 * schlicht kleingeschrieben (`resolveFieldKey`). Der Code ist der einzige über
 * Programme hinweg stabile Bezeichner; alles andere wird hier aufgelöst.
 *
 * **Warum Ebene und Herkunft getrennt sind**: die Verbund-Codes (`X`-Präfix)
 * beschreiben den Verbund, stehen aber nicht im Verbund-Record — der führt nur
 * Titel und Status. Sie stehen identisch auf jeder TV-Zeile der CSV. `ebene`
 * sagt also, WORÜBER ein Eintrag spricht, `herkunft`, WO er steht.
 *
 * Rein: keine IDB-, keine SMB-Zugriffe. Die Schemas reicht der Aufrufer herein.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { normCode } from '@/core/services/csv/status-datum-gruppen';
import { resolveFieldKey } from '@/core/services/csv/merger/helpers';
import type { MappingVersion, StatusFeldEintrag } from './typen';

/** Wo ein Feld im Record steht (aufgelöst gegen die Schemas). */
export interface AufgeloestesFeld {
  /** Key im Antrag-/Verbund-Record. */
  recordKey: string;
  /** Key der begleitenden Textspalte, falls gemappt. */
  textKey?: string;
}

export type FeldAufloesung = ReadonlyMap<string, AufgeloestesFeld>;

/** Aus welchem Record gelesen wird — explizit gesetzt oder aus der Ebene abgeleitet. */
export function herkunftVon(feld: StatusFeldEintrag): 'verbund-record' | 'tv-record' {
  return feld.herkunft ?? (feld.ebene === 'verbund' ? 'verbund-record' : 'tv-record');
}

/** Index CSV-Spalte (normalisiert) → Record-Key, Master-Schema zuerst. */
function baueSpaltenIndex(schemas: readonly CsvSchema[]): Map<string, string> {
  const geordnet = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  const idx = new Map<string, string>();
  for (const schema of geordnet) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const key = resolveFieldKey(spalte, entry);
      if (!key) continue;
      const norm = normCode(spalte);
      if (!idx.has(norm)) idx.set(norm, key);
    }
  }
  return idx;
}

/**
 * Löst alle Felder einer Fassung gegen die Schemas auf.
 *
 * Regeln, in dieser Reihenfolge:
 * 1. `quelleKey` gesetzt ⇒ der gewinnt (kanonische Umleitung wie
 *    `verbund_status` → `status` im Verbund-Record).
 * 2. Die `feldId` ist als CSV-Spalte gemappt ⇒ deren Record-Key.
 * 3. Sonst ⇒ die `feldId` selbst (kanonische Felder heißen im Record wie sie).
 *
 * **Kollisionsschutz**: landen zwei Felder auf demselben Record-Key, gewinnt das
 * kanonische (das ohne `code`) und das andere fällt aus der Auflösung. Sonst
 * zählte dieselbe Spalte zweimal — als Ereignis und als Ableitungs-Beitrag.
 * Das kann passieren, wenn ein Programm eine Code-Spalte kanonisch mappt.
 */
export function baueFeldAufloesung(
  schemas: readonly CsvSchema[], felder: readonly StatusFeldEintrag[],
): FeldAufloesung {
  const spalten = baueSpaltenIndex(schemas);
  const aufgeloest = new Map<string, AufgeloestesFeld>();
  const besetzt = new Map<string, StatusFeldEintrag>();   // recordKey → Gewinner

  const recordKeyVon = (feld: StatusFeldEintrag): string =>
    feld.quelleKey ?? spalten.get(normCode(feld.feldId)) ?? feld.feldId;

  for (const feld of felder) {
    const recordKey = recordKeyVon(feld);
    const bisher = besetzt.get(recordKey);
    if (bisher) {
      // Kanonisch (ohne Code) schlägt Code-Feld; sonst bleibt der erste stehen.
      const neuerGewinnt = bisher.code !== undefined && feld.code === undefined;
      if (!neuerGewinnt) continue;
      aufgeloest.delete(bisher.feldId);
    }
    besetzt.set(recordKey, feld);
    const textKey = feld.textSpalte ? spalten.get(normCode(feld.textSpalte)) : undefined;
    aufgeloest.set(feld.feldId, { recordKey, ...(textKey ? { textKey } : {}) });
  }
  return aufgeloest;
}

/** Ein gefundener Feldwert samt Herkunft. `tvId` nur bei TV-Ebene. */
export interface FeldVorkommen {
  feld: StatusFeldEintrag;
  wert: string;
  /** Begleitender Texteintrag, falls das Feld einen führt und er gefüllt ist. */
  text?: string;
  tvId?: string;
}

function roh(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/**
 * Sammelt alle gesetzten Feldwerte eines Verbunds — die **eine** Stelle, an der
 * die Ebene/Herkunft-Regel ausgewertet wird. Ableitung, Cockpit und
 * Historie-Reconcile bauen darauf auf, damit sie nie auseinanderlaufen können.
 *
 * Verbund-Felder, die im TV-Record stehen (die `X`-Codes), liefern **einen**
 * Eintrag ohne `tvId`: der erste Teilvorhaben-Record, der einen Wert trägt. Die
 * Spalte steht auf jeder TV-Zeile mit demselben Inhalt; sie je Teilvorhaben zu
 * melden würde denselben Vorgang vervielfachen.
 */
export function sammleVorkommen(
  felder: readonly StatusFeldEintrag[],
  verbundRecord: Record<string, unknown>,
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[],
  aufloesung?: FeldAufloesung,
): FeldVorkommen[] {
  const out: FeldVorkommen[] = [];
  const schluessel = (feld: StatusFeldEintrag): AufgeloestesFeld =>
    aufloesung?.get(feld.feldId) ?? { recordKey: feld.quelleKey ?? feld.feldId };

  for (const feld of felder) {
    const { recordKey, textKey } = schluessel(feld);
    const ausRecord = (rec: Record<string, unknown>, tvId?: string): FeldVorkommen | null => {
      const wert = roh(rec, recordKey);
      if (!wert) return null;
      const text = textKey ? roh(rec, textKey) : '';
      return { feld, wert, ...(text ? { text } : {}), ...(tvId ? { tvId } : {}) };
    };

    if (feld.ebene === 'verbund') {
      const quellen: Record<string, unknown>[] = herkunftVon(feld) === 'verbund-record'
        ? [verbundRecord]
        : antraege.map(a => a.record);
      for (const rec of quellen) {
        const treffer = ausRecord(rec);
        if (treffer) { out.push(treffer); break; }   // erster Treffer genügt
      }
      continue;
    }

    // TV-Ebene: je Teilvorhaben ein eigener Eintrag.
    for (const a of antraege) {
      const treffer = ausRecord(a.record, a.aktenzeichen);
      if (treffer) out.push(treffer);
    }
  }
  return out;
}

/** Bequemlichkeit: Auflösung direkt aus einer Fassung + Schemas. */
export function aufloesungFuer(
  version: MappingVersion, schemas: readonly CsvSchema[],
): FeldAufloesung {
  return baueFeldAufloesung(schemas, version.felder);
}
