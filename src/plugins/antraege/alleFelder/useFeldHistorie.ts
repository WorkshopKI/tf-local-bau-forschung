/**
 * Die Änderungs-Historie **je Feld** — für den `↻ N`-Knopf in „Alle Felder" und
 * das Fenster dahinter.
 *
 * Bis v4.122 hatte die Historie zwei Zuleitungen, und beide liefen ins Leere:
 *
 * - Am **Verbund** stand ein fest verdrahtetes `{}` (`VerbundDetail`). Der Knopf
 *   rendert nur bei `historyCounts[feld]` — er konnte dort nie erscheinen, und
 *   das Fenster war damit unerreichbar.
 * - Am **Teilvorhaben** kam er aus dem IDB-Store `antrag_historie`. Der wird nur
 *   befüllt, wo ein Spalten-Mapping `trackHistory: true` trägt; gemessen tun das
 *   0 von 549 Mappings der drei echten Schemas, und `antrag_historie.jsonl` im
 *   Snapshot ist 0 Byte.
 *
 * Dieselbe Wurzel wurde am Geschwister schon behoben: die Sektion „Historie"
 * liest seit v4.11 das **Import-Diff-Journal** statt des nie befüllten Stores
 * ([VerbundHistorie](../VerbundHistorie.tsx)). Dieser Hook zieht die Feld-Historie
 * nach — er führt beide Quellen zusammen:
 *
 * 1. **Import-Diff-Journal** (der Nachtlauf, im Bestand 1 953 belegte Änderungen
 *    über 60 Felder auf 623 Anträgen). Sein `feld` ist ein Katalog-/Spalten-Code
 *    (`D_AAE`); der Record-Key entsteht über denselben Spalten-Index wie überall
 *    sonst (`baueSpaltenIndex`) — nie über eine eigene Namens-Heuristik.
 * 2. **`antrag_historie`** (IDB) für Mappings mit `trackHistory: true`. Heute
 *    leer, aber weiterhin gelesen: wer die Fahne setzt, soll seine Einträge
 *    sehen, ohne dass hier etwas nachgezogen werden muss.
 *
 * Der **Nullpunkt** wird mitgeführt und gehört an die Anzeige (§12.2): ohne ihn
 * liest sich eine kurze Chronik als vollständige.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getHistoryByAz } from '@/core/services/csv';
import type { AntragHistorieEntry, CsvSchema } from '@/core/services/csv/types';
import { baueSpaltenIndex, spaltenSchluessel } from '@/core/status/feld-aufloesung';
import { ART_TEXT, tagDe, wannText, wertText } from '../status/journalTexte';
import { useJournalChroniken } from '../status/useJournalChroniken';

export interface FeldHistorieEintrag {
  id: string;
  /** Fertiger Zeit-Text („am 03.08.2026" / „zwischen … und …"). */
  wann: string;
  /** ISO-Tag für die Sortierung (absteigend). */
  sortier: string;
  /** Was passiert ist — „geändert", „zurückgenommen", … */
  art: string;
  alt: string;
  neu: string;
  /** Woher der Eintrag stammt (Aktenzeichen bzw. CSV-Quelle). */
  quelle: string;
}

export interface FeldHistorie {
  /** Record-Key → Anzahl belegter Änderungen. Speist den `↻ N`-Knopf. */
  counts: Record<string, number>;
  /** Record-Key → Einträge, jüngste zuerst. */
  eintraege: ReadonlyMap<string, FeldHistorieEintrag[]>;
  /** Nullpunkt des Journals; `null` = auf diesem Share läuft keines. */
  journalAb: string | null;
  /** Wird für diese Anträge überhaupt mitgeschrieben? */
  gefuehrt: boolean;
  laden: boolean;
}

const LEER: FeldHistorie = {
  counts: {}, eintraege: new Map(), journalAb: null, gefuehrt: false, laden: false,
};

/**
 * Historie für einen oder mehrere Anträge (am Verbund: alle TVs). Die Zählung
 * läuft über alle mitgegebenen Aktenzeichen zusammen — die Feldliste in „Alle
 * Felder" ist am Verbund ebenfalls über die TVs verschmolzen.
 */
export function useFeldHistorie(
  aktenzeichen: readonly string[],
  schemas: readonly CsvSchema[],
): FeldHistorie {
  const storage = useStorage();
  const [stichtag] = useState(() => new Date().toISOString().slice(0, 10));
  const azKey = aktenzeichen.join('|');
  const azListe = useMemo(() => (azKey ? azKey.split('|') : []), [azKey]);

  const { laden, chroniken, journalAb, gefuehrt } = useJournalChroniken(azListe, stichtag);

  // Der IDB-Store ist im Bestand leer; der Lauf bleibt trotzdem drin, damit ein
  // Mapping mit `trackHistory: true` ohne Code-Änderung sichtbar wird.
  const [ausStore, setAusStore] = useState<AntragHistorieEntry[]>([]);
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const alle: AntragHistorieEntry[] = [];
      for (const az of azListe) {
        try { alle.push(...await getHistoryByAz(storage.idb, az)); } catch { /* Store fehlt */ }
      }
      if (!abgebrochen) setAusStore(alle);
    })();
    return () => { abgebrochen = true; };
  }, [azListe, storage.idb]);

  const quellNamen = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of schemas) m.set(s.id, s.csv_source_name);
    return m;
  }, [schemas]);

  const spaltenIndex = useMemo(() => baueSpaltenIndex(schemas), [schemas]);

  return useMemo<FeldHistorie>(() => {
    if (azListe.length === 0) return { ...LEER, laden };
    const proFeld = new Map<string, FeldHistorieEintrag[]>();
    const anhaengen = (key: string, e: FeldHistorieEintrag): void => {
      const l = proFeld.get(key);
      if (l) l.push(e); else proFeld.set(key, [e]);
    };

    for (const c of chroniken ?? []) {
      for (const fc of c.felder) {
        // Katalog-/Spalten-Code → Record-Key über den geteilten Index; ohne
        // Treffer bleibt der Code selbst stehen (kanonische Felder heißen so).
        const key = spaltenIndex.get(spaltenSchluessel(fc.feld)) ?? fc.feld;
        for (const e of fc.eintraege) {
          anhaengen(key, {
            id: `j:${c.antragId}:${fc.feld}:${e.stempel}:${e.datum}`,
            wann: wannText(e),
            sortier: e.datum,
            art: ART_TEXT[e.art],
            alt: wertText(e.von),
            neu: wertText(e.nach),
            quelle: c.antragId,
          });
        }
      }
    }

    for (const h of ausStore) {
      anhaengen(h.feld, {
        id: `s:${h.id}`,
        wann: `am ${tagDe(h.geaendert_am.slice(0, 10))}`,
        sortier: h.geaendert_am.slice(0, 10),
        art: ART_TEXT.geaendert,
        alt: h.alt_wert == null ? '—' : String(h.alt_wert),
        neu: h.neu_wert == null ? '—' : String(h.neu_wert),
        quelle: quellNamen.get(h.csv_schema_id) ?? h.aktenzeichen,
      });
    }

    const counts: Record<string, number> = {};
    for (const [key, liste] of proFeld) {
      liste.sort((a, b) => b.sortier.localeCompare(a.sortier));
      counts[key] = liste.length;
    }
    return { counts, eintraege: proFeld, journalAb, gefuehrt, laden };
  }, [azListe, chroniken, ausStore, spaltenIndex, quellNamen, journalAb, gefuehrt, laden]);
}
