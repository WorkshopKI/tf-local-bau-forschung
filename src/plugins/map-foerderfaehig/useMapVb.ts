/**
 * Vorhabensbeschreibung zur Einreichung: Zuordnung, Gliederung, Steckbrief und
 * Aspekt-Mapping.
 *
 * Alle LLM-Anteile sind **optional**. Ohne Bridge bleiben Gliederung und
 * Lesemodus vollständig nutzbar — nur Steckbrief und Fundstellen-Vorschläge
 * fehlen, mit klarer Meldung statt stiller Leere. Das ist die Leitplanke: kein
 * KI-Element darf die Prüfung blockieren.
 *
 * Transport ausschliesslich über `getTransportForSkillRun` (Pitfall #30) — die
 * Bausteine tragen VB-Inhalte und dürfen nie extern laufen. Der Chat-Reset vor
 * jedem Lauf (Pitfall #36) passiert innerhalb von `getOrComputeBaustein`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import {
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL,
} from '@/core/services/skills';
import {
  computeAspekteBaustein, computeSteckbriefBaustein, parseVbGliederung,
  type AspektMapping, type SteckbriefDaten,
} from '@/plugins/antraege/aufbereitung';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { useDokumenteStore, type DocumentFull, type DocumentMeta } from '@/plugins/dokumente/store';
import { getVbZuordnung, setzeVbZuordnung } from './store';
import type { MapEinreichung } from './types';
import { findeVbKandidaten, type VbKandidat } from './vb/zuordnung';

export type BausteinLage = 'aus' | 'laeuft' | 'ok' | 'fehler';

export interface UseMapVbResult {
  /** Zugeordnetes VB-Dokument, falls gewählt. */
  dokument: DocumentFull | null;
  gliederung: VbSektion[];
  kandidaten: VbKandidat[];
  alleDokumente: DocumentMeta[];
  waehleDokument: (docId: string) => Promise<void>;
  loeseZuordnung: () => Promise<void>;

  steckbrief: SteckbriefDaten | null;
  steckbriefLage: BausteinLage;
  steckbriefFehler: string | null;

  aspektMapping: AspektMapping | null;
  aspekteLage: BausteinLage;
  aspekteFehler: string | null;

  /** Beide optionalen Bausteine anstossen. */
  starteAnalyse: () => Promise<void>;
}

function fehlertext(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useMapVb(einreichung: MapEinreichung | null): UseMapVbResult {
  const storage = useStorage();
  const bridge = useAIBridge();
  const { documents, loadDocument } = useDokumenteStore();

  const [dokument, setDokument] = useState<DocumentFull | null>(null);
  const [steckbrief, setSteckbrief] = useState<SteckbriefDaten | null>(null);
  const [steckbriefLage, setSteckbriefLage] = useState<BausteinLage>('aus');
  const [steckbriefFehler, setSteckbriefFehler] = useState<string | null>(null);
  const [aspektMapping, setAspektMapping] = useState<AspektMapping | null>(null);
  const [aspekteLage, setAspekteLage] = useState<BausteinLage>('aus');
  const [aspekteFehler, setAspekteFehler] = useState<string | null>(null);

  const einreichungId = einreichung?.id ?? null;

  // Gespeicherte Zuordnung laden.
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      setDokument(null);
      setSteckbrief(null);
      setAspektMapping(null);
      setSteckbriefLage('aus');
      setAspekteLage('aus');
      if (einreichungId === null) return;

      const zuordnung = await getVbZuordnung(storage.idb, einreichungId);
      if (abgebrochen || zuordnung === null) return;
      const doc = await loadDocument(zuordnung.docId, storage);
      if (!abgebrochen) setDokument(doc);
    })();
    return () => { abgebrochen = true; };
  }, [storage, einreichungId, loadDocument]);

  const gliederung = useMemo(
    () => (dokument === null ? [] : parseVbGliederung(dokument.markdown)),
    [dokument],
  );

  const kandidaten = useMemo(
    () => (einreichung === null ? [] : findeVbKandidaten(documents, einreichung)),
    [documents, einreichung],
  );

  const waehleDokument = useCallback(async (docId: string): Promise<void> => {
    if (einreichungId === null) return;
    const doc = await loadDocument(docId, storage);
    if (doc === null) throw new Error('Das Dokument liess sich nicht laden.');
    await setzeVbZuordnung(storage.idb, einreichungId, { docId, docName: doc.filename });
    setDokument(doc);
    // Analyse-Ergebnisse gehören zum alten Dokument — verwerfen.
    setSteckbrief(null);
    setAspektMapping(null);
    setSteckbriefLage('aus');
    setAspekteLage('aus');
  }, [storage, einreichungId, loadDocument]);

  const loeseZuordnung = useCallback(async (): Promise<void> => {
    if (einreichungId === null) return;
    await setzeVbZuordnung(storage.idb, einreichungId, null);
    setDokument(null);
    setSteckbrief(null);
    setAspektMapping(null);
  }, [storage.idb, einreichungId]);

  const starteAnalyse = useCallback(async (): Promise<void> => {
    if (dokument === null || einreichungId === null || gliederung.length === 0) return;

    // Eigenes Cache-Präfix: `getOrComputeBaustein` keyt auf dem übergebenen
    // Schlüssel — ohne MAP-Präfix kollidierte der Cache mit echten Anträgen.
    const cacheSchluessel = `map:${einreichungId}`;

    setSteckbriefLage('laeuft');
    setAspekteLage('laeuft');
    setSteckbriefFehler(null);
    setAspekteFehler(null);

    try {
      const transport = bridge.getTransportForSkillRun(AUFBEREITUNG_STECKBRIEF_SKILL);
      const ergebnis = await computeSteckbriefBaustein(
        storage.idb, transport, AUFBEREITUNG_STECKBRIEF_SKILL,
        cacheSchluessel, gliederung, dokument.markdown,
      );
      if (ergebnis.status === 'ok' && ergebnis.daten !== undefined) {
        setSteckbrief(ergebnis.daten);
        setSteckbriefLage('ok');
      } else {
        setSteckbriefLage('fehler');
        setSteckbriefFehler(ergebnis.begruendung ?? 'Der Steckbrief liess sich nicht erzeugen.');
      }
    } catch (e) {
      setSteckbriefLage('fehler');
      setSteckbriefFehler(fehlertext(e));
    }

    try {
      const transport = bridge.getTransportForSkillRun(AUFBEREITUNG_ASPEKTE_SKILL);
      const ergebnis = await computeAspekteBaustein(
        storage.idb, transport, AUFBEREITUNG_ASPEKTE_SKILL,
        cacheSchluessel, gliederung, dokument.markdown,
      );
      if (ergebnis.status === 'ok' && ergebnis.daten !== undefined) {
        setAspektMapping(ergebnis.daten);
        setAspekteLage('ok');
      } else {
        setAspekteLage('fehler');
        setAspekteFehler(ergebnis.begruendung ?? 'Die Aspekt-Zuordnung liess sich nicht erzeugen.');
      }
    } catch (e) {
      setAspekteLage('fehler');
      setAspekteFehler(fehlertext(e));
    }
  }, [storage.idb, bridge, dokument, gliederung, einreichungId]);

  return {
    dokument,
    gliederung,
    kandidaten,
    alleDokumente: documents,
    waehleDokument,
    loeseZuordnung,
    steckbrief,
    steckbriefLage,
    steckbriefFehler,
    aspektMapping,
    aspekteLage,
    aspekteFehler,
    starteAnalyse,
  };
}
