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
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL, MAP_INFOGRAFIK_SKILL,
} from '@/core/services/skills';
import {
  computeAspekteBaustein, computeSteckbriefBaustein, getOrComputeBaustein, vbHashFuer,
  type AspektMapping, type SteckbriefDaten,
} from '@/plugins/antraege/aufbereitung';
import { parseVbGliederung } from '@/plugins/antraege/aufbereitung/gliederung';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { baueFaktenBlock } from './infografik/fakten';
import {
  buildInfografikPrompt, istInhaltsleer, parseInfografik, type InfografikDaten,
} from './infografik/schema';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { kontextZielFuerLauf } from '@/core/services/ai/ki-ziel';
import { useDokumenteStore, type DocumentFull, type DocumentMeta } from '@/plugins/dokumente/store';
import { getVbZuordnung, setzeVbZuordnung, type VbDokRef } from './store';
import type { MapEinreichung } from './types';
import { leseMapAnalyse, mapBausteinKeys, mapCacheSchluessel } from './vb/analyse-cache';
import { baueMapKorpus, type MapKorpus } from './vb/korpus';
import { findeVbKandidaten, type VbKandidat } from './vb/zuordnung';

export type BausteinLage = 'aus' | 'laeuft' | 'ok' | 'fehler';

export interface UseMapVbResult {
  /** Hauptdokument der Vorhabensbeschreibung, falls gewählt. */
  dokument: DocumentFull | null;
  /** Zusatzdokumente (Marktkonzept, Verwertung, Wirkung …) in Korpus-Reihenfolge. */
  zusatzDokumente: DocumentFull[];
  /** Haupt- und Zusatzdokumente als EIN Text — Grundlage aller Bausteine. */
  korpus: MapKorpus | null;
  gliederung: VbSektion[];
  kandidaten: VbKandidat[];
  alleDokumente: DocumentMeta[];
  waehleDokument: (docId: string) => Promise<void>;
  fuegeZusatzHinzu: (docId: string) => Promise<void>;
  entferneZusatz: (docId: string) => Promise<void>;
  loeseZuordnung: () => Promise<void>;

  steckbrief: SteckbriefDaten | null;
  steckbriefLage: BausteinLage;
  steckbriefFehler: string | null;

  aspektMapping: AspektMapping | null;
  aspekteLage: BausteinLage;
  aspekteFehler: string | null;

  infografik: InfografikDaten | null;
  infografikLage: BausteinLage;
  infografikFehler: string | null;

  /** Alle optionalen Bausteine anstossen. */
  starteAnalyse: () => Promise<void>;
}

function fehlertext(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function alsRefs(docs: readonly DocumentFull[]): VbDokRef[] {
  return docs.map(d => ({ docId: d.id, docName: d.filename }));
}

export function useMapVb(einreichung: MapEinreichung | null): UseMapVbResult {
  const storage = useStorage();
  const bridge = useAIBridge();
  const { documents, loadDocument } = useDokumenteStore();

  const [dokument, setDokument] = useState<DocumentFull | null>(null);
  const [zusatzDokumente, setZusatzDokumente] = useState<DocumentFull[]>([]);
  const [steckbrief, setSteckbrief] = useState<SteckbriefDaten | null>(null);
  const [steckbriefLage, setSteckbriefLage] = useState<BausteinLage>('aus');
  const [steckbriefFehler, setSteckbriefFehler] = useState<string | null>(null);
  const [aspektMapping, setAspektMapping] = useState<AspektMapping | null>(null);
  const [aspekteLage, setAspekteLage] = useState<BausteinLage>('aus');
  const [aspekteFehler, setAspekteFehler] = useState<string | null>(null);
  const [infografik, setInfografik] = useState<InfografikDaten | null>(null);
  const [infografikLage, setInfografikLage] = useState<BausteinLage>('aus');
  const [infografikFehler, setInfografikFehler] = useState<string | null>(null);

  const einreichungId = einreichung?.id ?? null;

  // Gespeicherte Zuordnung laden.
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      setDokument(null);
      setZusatzDokumente([]);
      setSteckbrief(null);
      setAspektMapping(null);
      setInfografik(null);
      setSteckbriefLage('aus');
      setAspekteLage('aus');
      setInfografikLage('aus');
      if (einreichungId === null) return;

      const zuordnung = await getVbZuordnung(storage.idb, einreichungId);
      if (abgebrochen || zuordnung === null) return;
      const doc = await loadDocument(zuordnung.docId, storage);
      // Ein nicht mehr auffindbares Zusatzdokument darf die Zuordnung nicht
      // kippen — es fällt still aus dem Korpus, das Hauptdokument bleibt.
      const zusatz = (await Promise.all(
        (zuordnung.zusatz ?? []).map(r => loadDocument(r.docId, storage)),
      )).filter((d): d is DocumentFull => d !== null);
      if (!abgebrochen) {
        setDokument(doc);
        setZusatzDokumente(zusatz);
      }
    })();
    return () => { abgebrochen = true; };
  }, [storage, einreichungId, loadDocument]);

  const korpus = useMemo<MapKorpus | null>(() => {
    if (dokument === null) return null;
    return baueMapKorpus(
      { name: dokument.filename, markdown: dokument.markdown },
      zusatzDokumente.map(d => ({ name: d.filename, markdown: d.markdown })),
      getVbCharCap(kontextZielFuerLauf(bridge)),
    );
  }, [dokument, zusatzDokumente, bridge]);

  const gliederung = useMemo(
    () => (korpus === null ? [] : parseVbGliederung(korpus.markdown)),
    [korpus],
  );

  /** Korpus-Hash = Cache-Schlüssel der Bausteine. Skalar, damit der Rehydrierungs-
   *  Effekt unten an einem Wert hängt und nicht an einer Objekt-Identität. */
  const vbHash = useMemo(
    () => (korpus === null ? null : vbHashFuer(korpus.markdown)),
    [korpus],
  );

  /**
   * Bereits berechnete Bausteine zurückholen. Der Baustein-Cache IST die Persistenz
   * der Analyse — ohne diesen Effekt wären die Ergebnisse nach jedem Wechsel der
   * Seite oder der Einreichung unsichtbar, obwohl sie im kv-Store liegen, und der
   * Prüfer müsste „Mit KI analysieren" erneut drücken.
   *
   * Es wird ausschliesslich bei Treffern geschrieben: einen Miss lässt der Effekt
   * unangetastet, damit eine spät eintreffende Leseantwort niemals ein frisch
   * berechnetes Ergebnis überschreibt. Geleert wird an anderer Stelle (Zuordnungs-
   * Effekt, `verwirfAnalyse`).
   *
   * Kein Transport, kein LLM-Lauf — reines Lesen.
   */
  useEffect(() => {
    if (einreichungId === null || vbHash === null) return;
    let abgebrochen = false;
    void (async () => {
      const analyse = await leseMapAnalyse(storage.idb, einreichungId, vbHash);
      if (abgebrochen) return;
      if (analyse.steckbrief !== null) { setSteckbrief(analyse.steckbrief); setSteckbriefLage('ok'); }
      if (analyse.aspekte !== null) { setAspektMapping(analyse.aspekte); setAspekteLage('ok'); }
      if (analyse.infografik !== null) { setInfografik(analyse.infografik); setInfografikLage('ok'); }
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb, einreichungId, vbHash]);

  const kandidaten = useMemo(
    () => (einreichung === null ? [] : findeVbKandidaten(documents, einreichung)),
    [documents, einreichung],
  );

  /** Analyse-Ergebnisse gehören zum alten Korpus — jede Änderung verwirft sie. */
  const verwirfAnalyse = useCallback((): void => {
    setSteckbrief(null);
    setAspektMapping(null);
    setInfografik(null);
    setSteckbriefLage('aus');
    setAspekteLage('aus');
    setInfografikLage('aus');
  }, []);

  const waehleDokument = useCallback(async (docId: string): Promise<void> => {
    if (einreichungId === null) return;
    const doc = await loadDocument(docId, storage);
    if (doc === null) throw new Error('Das Dokument liess sich nicht laden.');
    // Ein neues Hauptdokument heisst ein neuer Fall — die Zusatzdokumente des
    // alten mitzuschleppen wäre die gefährlichere Annahme.
    await setzeVbZuordnung(storage.idb, einreichungId, { docId, docName: doc.filename });
    setDokument(doc);
    setZusatzDokumente([]);
    verwirfAnalyse();
  }, [storage, einreichungId, loadDocument, verwirfAnalyse]);

  const fuegeZusatzHinzu = useCallback(async (docId: string): Promise<void> => {
    if (einreichungId === null || dokument === null) return;
    if (docId === dokument.id || zusatzDokumente.some(d => d.id === docId)) return;
    const doc = await loadDocument(docId, storage);
    if (doc === null) throw new Error('Das Dokument liess sich nicht laden.');
    const naechste = [...zusatzDokumente, doc];
    await setzeVbZuordnung(storage.idb, einreichungId, {
      docId: dokument.id, docName: dokument.filename, zusatz: alsRefs(naechste),
    });
    setZusatzDokumente(naechste);
    verwirfAnalyse();
  }, [storage, einreichungId, dokument, zusatzDokumente, loadDocument, verwirfAnalyse]);

  const entferneZusatz = useCallback(async (docId: string): Promise<void> => {
    if (einreichungId === null || dokument === null) return;
    const naechste = zusatzDokumente.filter(d => d.id !== docId);
    await setzeVbZuordnung(storage.idb, einreichungId, {
      docId: dokument.id, docName: dokument.filename, zusatz: alsRefs(naechste),
    });
    setZusatzDokumente(naechste);
    verwirfAnalyse();
  }, [storage, einreichungId, dokument, zusatzDokumente, verwirfAnalyse]);

  const loeseZuordnung = useCallback(async (): Promise<void> => {
    if (einreichungId === null) return;
    await setzeVbZuordnung(storage.idb, einreichungId, null);
    setDokument(null);
    setZusatzDokumente([]);
    verwirfAnalyse();
  }, [storage.idb, einreichungId, verwirfAnalyse]);

  const starteAnalyse = useCallback(async (): Promise<void> => {
    if (korpus === null || einreichung === null || einreichungId === null) return;
    if (gliederung.length === 0) return;
    // Alle Bausteine arbeiten auf dem KORPUS, nie auf dem Hauptdokument allein —
    // sonst wäre eine Aussage aus dem Marktkonzept für die KI unsichtbar.
    const vbText = korpus.markdown;

    // Eigenes Cache-Präfix: `getOrComputeBaustein` keyt auf dem übergebenen
    // Schlüssel — ohne MAP-Präfix kollidierte der Cache mit echten Anträgen.
    // Die Keys kommen aus `analyse-cache.ts`, damit Schreiben (hier) und Lesen
    // (Rehydrierung, Cleanup) nicht auseinanderlaufen können.
    const cacheSchluessel = mapCacheSchluessel(einreichungId);

    setSteckbriefLage('laeuft');
    setAspekteLage('laeuft');
    setInfografikLage('laeuft');
    setSteckbriefFehler(null);
    setAspekteFehler(null);
    setInfografikFehler(null);

    try {
      const transport = bridge.getTransportForSkillRun(AUFBEREITUNG_STECKBRIEF_SKILL);
      const ergebnis = await computeSteckbriefBaustein(
        storage.idb, transport, AUFBEREITUNG_STECKBRIEF_SKILL,
        cacheSchluessel, gliederung, vbText,
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
        cacheSchluessel, gliederung, vbText,
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

    try {
      const transport = bridge.getTransportForSkillRun(MAP_INFOGRAFIK_SKILL);
      const laufHash = vbHashFuer(vbText);
      const ergebnis = await getOrComputeBaustein<InfografikDaten>(
        storage.idb, transport, MAP_INFOGRAFIK_SKILL,
        mapBausteinKeys(einreichungId, laufHash).infografik, laufHash,
        () => buildInfografikPrompt(gliederung, vbText, baueFaktenBlock(einreichung)),
        raw => parseInfografik(raw, gliederung),
        {
          // Eine formal gültige, inhaltlich leere Antwort wird nicht gecacht —
          // sonst friert ein Fehlversuch die Ansicht dauerhaft ein.
          verdaechtig: {
            pruefe: istInhaltsleer,
            grund: 'Das Modell hat weder Canvas-Felder noch Delta-Zeilen belegt.',
          },
        },
      );
      if (ergebnis.status === 'ok' && ergebnis.daten !== undefined) {
        setInfografik(ergebnis.daten);
        setInfografikLage('ok');
      } else {
        setInfografikLage('fehler');
        setInfografikFehler(ergebnis.begruendung ?? 'Die Infografik-Daten liessen sich nicht erzeugen.');
      }
    } catch (e) {
      setInfografikLage('fehler');
      setInfografikFehler(fehlertext(e));
    }
  }, [storage.idb, bridge, korpus, gliederung, einreichung, einreichungId]);

  return {
    dokument,
    zusatzDokumente,
    korpus,
    gliederung,
    kandidaten,
    alleDokumente: documents,
    waehleDokument,
    fuegeZusatzHinzu,
    entferneZusatz,
    loeseZuordnung,
    steckbrief,
    steckbriefLage,
    steckbriefFehler,
    aspektMapping,
    aspekteLage,
    aspekteFehler,
    infografik,
    infografikLage,
    infografikFehler,
    starteAnalyse,
  };
}
