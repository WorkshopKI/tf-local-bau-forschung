/**
 * Bau, Abgleich und Spiegelung des Embedding-Korpus — die Mechanik hinter der
 * Karte „Embedding-Korpus" in „Suche & Index" (v4.127).
 *
 * **Warum hier und nicht mehr im Auslastungs-Modul.** Der Korpus ist der
 * VEKTORINDEX DER SUCHE; das Auslastungs-Modul ist nur sein zweiter Konsument.
 * Gebaut wurde er trotzdem dort — hinter einem Zusatzpasswort, und der Knopf
 * „Corpus aufbauen" hing zusaetzlich an `isDevContext()`, existierte in `zah-pl`
 * also gar nicht. Gleichzeitig forderten drei Texte dazu auf, ihn zu klicken.
 * Jetzt liegt er, wo der Index gepflegt wird, und das Kurator-Schloss ist die
 * schaerfere Grenze als der Experten-Schalter, der ihn vorher verbarg.
 *
 * Der Lauf selbst ist unveraendert uebernommen: drei Phasen (Antraege →
 * Verbuende → Centroids), Build-Lock ueber den ganzen Lauf inkl. Upload,
 * RAM-Warnung vorweg. Die Centroid-Phase braucht die Auslastungs-Kategorien —
 * dass die Kuration dafuer in das Modul greift, ist die Kopplungsrichtung, die
 * `home`, `antraege` und `einstellungen` ohnehin schon haben (umgekehrt
 * importiert das Modul nichts aus der Kuration; kein Zyklus).
 *
 * Getrennt von der Karte, weil das zwei Verantwortungen sind: hier laeuft ein
 * mehrminuetiger Job mit Lock, Abbruch und Fortschritt — dort wird gezeigt.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useProfile } from '@/core/hooks/useProfile';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import {
  clearEmbeddings,
  entscheideAbgleich,
  aktuelleKorpusSignatur,
  ladeKorpusSignatur,
  signaturenGleich,
  type AbgleichBefund,
  type KorpusSignatur,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import { useKorpusAbgleich } from '@/core/hooks/useKorpusAbgleich';
import { acquireBuildLock, heartbeat, releaseLock } from '@/core/services/infrastructure/build-lock';
import {
  buildEmbeddingCorpus,
  buildVerbundEmbeddingCorpus,
  clearVerbundEmbeddings,
  ensureVerbundCorpus,
  ermittleKorpusBestand,
  invalidateVerbundEmbeddingsCache,
  loadAllVerbundEmbeddings,
  uploadVerbundCorpusToShare,
  bumpAuslastungCorpusSignal,
  LOCK_STUFE_KORPUS,
  type KorpusBestand,
} from '@/plugins/auslastung/services/matching';
import { computeKategorieCentroidsFromVerbund } from '@/plugins/auslastung/services/klassifizierung';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';

export type BauPhase = 'antrag' | 'verbund' | 'centroids';

export const PHASEN_LABEL: Record<BauPhase, string> = {
  antrag: 'Vorhaben-Vektoren',
  verbund: 'Verbund-Vektoren',
  centroids: 'Kategorie-Centroids berechnen…',
};

export interface PhasenFortschritt {
  phase: BauPhase;
  done: number;
  total: number;
  last?: string;
  etaSec?: number;
}

/**
 * Was ein Lauf tatsaechlich getan hat.
 *
 * `buildEmbeddingCorpus` liefert das seit jeher zurueck — gelesen hat es
 * niemand. Ein Vollbau, der 136 Vorhaben ueberspringt, meldete „fertig" und
 * sonst nichts; erst in einer anderen Variante fiel die Luecke auf, und dort
 * war sie nicht mehr erklaerbar (v4.128).
 */
export interface BauBilanz {
  eingebettet: number;
  uebersprungen: number;
  /** Der Lauf hat trotz „nachziehen" voll gebaut (fremder Vektorraum). */
  vollErzwungen: boolean;
  abgebrochen: boolean;
}

export interface KorpusBau {
  bestand: KorpusBestand | null;
  befund: AbgleichBefund | null;
  /** Bilanz des letzten Laufs in dieser Sitzung. */
  bilanz: BauBilanz | null;
  /** Stimmt der lokale Vektorraum mit dem ueberein, den ein Lauf jetzt erzeugt? */
  raumAktuell: boolean;
  signatur: KorpusSignatur | null;
  fortschritt: PhasenFortschritt | null;
  laeuft: boolean;
  fehler: string | null;
  /** `false` = „Nachziehen" waere in Wahrheit ein Vollbau (fremder Raum). */
  nachziehenMoeglich: boolean;
  baue: (voll: boolean) => Promise<void>;
  ladeVomSpeicher: () => Promise<void>;
  leere: () => Promise<void>;
  abbrechen: () => void;
  neuLesen: () => Promise<void>;
}

export function useKorpusBau(): KorpusBau {
  const storage = useStorage();
  const programmId = useActiveProgramm(s => s.activeProgrammId);
  const { profile } = useProfile();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const persistAuslastung = useAuslastungData(s => s.persist);

  const [bestand, setBestand] = useState<KorpusBestand | null>(null);
  const [befund, setBefund] = useState<AbgleichBefund | null>(null);
  const [bilanz, setBilanz] = useState<BauBilanz | null>(null);
  const [signatur, setSignatur] = useState<KorpusSignatur | null>(null);
  const [raumAktuell, setRaumAktuell] = useState(true);
  const [fortschritt, setFortschritt] = useState<PhasenFortschritt | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const abbruchRef = useRef<AbortController | null>(null);

  const neuLesen = useCallback(async (): Promise<void> => {
    const b = await ermittleKorpusBestand(storage.idb, programmId);
    setBestand(b);
    await useEmbeddingCorpusMirror.getState().loadManifest(storage);
    const aktiv = aktuelleKorpusSignatur(getModelById(await getActiveModelId(storage.idb)));
    const lokal = await ladeKorpusSignatur(storage.idb);
    setSignatur(lokal);
    setRaumAktuell(b.lokal === 0 || (lokal !== null && signaturenGleich(lokal, aktiv)));
    setBefund(entscheideAbgleich({
      lokalCount: b.lokal,
      lokalSignatur: lokal,
      manifest: useEmbeddingCorpusMirror.getState().manifest,
      aktiveSignatur: aktiv,
    }));
  }, [storage, programmId]);

  useEffect(() => { void neuLesen(); }, [neuLesen]);

  const baue = useCallback(async (voll: boolean): Promise<void> => {
    // Die RAM-Warnung bleibt wortgleich: der Lauf laedt ein ~200-MB-Modell in
    // den Speicher DIESES Tabs, und auf geteilten Citrix-Sitzungen hat genau das
    // Tabs abgeschossen (v2.47).
    if (!confirm(
      'Der Korpus-Bau lädt ein ~200-MB-Modell in den Arbeitsspeicher dieses Browser-Tabs '
      + 'und läuft mehrere Minuten. In geteilten Sitzungen (z.B. Citrix mit mehreren Nutzern) '
      + 'kann der Tab dabei abstürzen („Aw, Snap" / Out of Memory).\n\n'
      + 'Nur starten, wenn sonst niemand baut und genügend RAM frei ist. Jetzt starten?',
    )) return;

    setFehler(null);
    setBilanz(null);
    setLaeuft(true);
    const controller = new AbortController();
    abbruchRef.current = controller;

    // Lock VOR dem lokalen Bau (nicht erst beim Upload): sonst laden zwei Nutzer
    // im selben Host je ein 200-MB-Modell. Ohne Schreibrecht/offline gibt es
    // ohnehin nichts zu koordinieren → best-effort weiter.
    let lockGehalten = false;
    try {
      const lock = await acquireBuildLock(storage.idb, LOCK_STUFE_KORPUS);
      if (!lock.acquired) {
        setFehler(
          `Es baut bereits jemand (${lock.existing.kurator_name}, seit ${Math.round(lock.ageMinutes)} min). `
          + 'Bitte warten oder „Vom Datenspeicher laden".',
        );
        setLaeuft(false);
        abbruchRef.current = null;
        return;
      }
      lockGehalten = true;
    } catch (err) {
      console.warn('[korpus-bau] Build-Lock nicht verfügbar, baue best-effort ohne Lock:', err);
    }

    try {
      // Volle Records nur transient — die Embedding-Texte liegen nicht im
      // Slim-Cache und sollen nach dem Lauf wieder freigegeben werden.
      const antraege = programmId ? await listAntraegeByProgramm(storage.idb, programmId) : [];
      const erg = await buildEmbeddingCorpus(storage.idb, antraege, {
        incremental: !voll,
        programmId,
        onProgress: p => setFortschritt({
          phase: 'antrag', done: p.done, total: p.total, last: p.lastAntrag, etaSec: p.etaSec,
        }),
        signal: controller.signal,
      });
      // `done` zaehlt die Durchlaeufe, `skipped` die ohne Vektor — die Differenz
      // ist, was wirklich entstanden ist. Ohne diese Zeile bleibt ein Lauf, der
      // Vorhaben auslaesst, von einem vollstaendigen ununterscheidbar.
      setBilanz({
        eingebettet: erg.done - erg.skipped,
        uebersprungen: erg.skipped,
        vollErzwungen: erg.vollErzwungen,
        abgebrochen: erg.aborted,
      });
      if (lockGehalten) await heartbeat(storage.idb).catch(() => undefined);

      // Verbund-Phase: klein gegen die Antraege, aber bei einem Vollbau ein
      // zweiter mehrminütiger Lauf — ohne eigenen Fortschritt fröre die Anzeige
      // nach den 100 % der ersten Phase scheinbar ein (v2.21.2).
      await buildVerbundEmbeddingCorpus(storage.idb, antraege, {
        incremental: !voll,
        signal: controller.signal,
        onProgress: p => setFortschritt({
          phase: 'verbund', done: p.done, total: p.total, last: p.lastVerbundId, etaSec: p.etaSec,
        }),
      });
      if (lockGehalten) await heartbeat(storage.idb).catch(() => undefined);
      invalidateVerbundEmbeddingsCache();

      // Label setzen und einen Tick yielden, damit React es zeichnet, BEVOR die
      // synchrone Centroid-Rechnung den Main-Thread belegt.
      setFortschritt({ phase: 'centroids', done: 0, total: 0 });
      await new Promise(r => setTimeout(r, 0));
      const verbundEmbs = await loadAllVerbundEmbeddings(storage.idb);
      const centroids = computeKategorieCentroidsFromVerbund(
        klassifizierungen, verbundEmbs, config.ueberKategorien, antraege,
      );
      useAuslastungData.setState(state => ({
        data: {
          ...state.data,
          config: {
            ...state.data.config,
            ueberKategorien: state.data.config.ueberKategorien.map(k => ({
              ...k, referenzEmbedding: centroids.get(k.id),
            })),
            embeddingCorpusBuiltAt: new Date().toISOString(),
          },
        },
      }));
      await persistAuslastung(storage);

      setFortschritt(null);
      bumpAuslastungCorpusSignal();

      // Upload — soft-fail: der lokale Bau bleibt gültig, nur das Team hat ihn
      // dann noch nicht.
      const aktiv = aktuelleKorpusSignatur(getModelById(await getActiveModelId(storage.idb)));
      try {
        await useEmbeddingCorpusMirror.getState().uploadFromIdb(
          storage, aktiv.modellId, aktiv.dim, profile?.name, { skipLock: true },
        );
        // Der core-Mirror deckt nur die Vorhaben-Vektoren ab; ohne diesen
        // zweiten Schritt hätte ein neuer Rechner keine Verbund-Vektoren für
        // die Klassifizierung (v2.19).
        await uploadVerbundCorpusToShare(storage, aktiv.modellId, aktiv.dim, profile?.name);
      } catch (err) {
        setFehler(`Bau abgeschlossen — Upload auf den Datenspeicher fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err));
    } finally {
      setLaeuft(false);
      setFortschritt(null);
      abbruchRef.current = null;
      if (lockGehalten) await releaseLock(storage.idb).catch(() => undefined);
      await neuLesen();
    }
  }, [storage, programmId, profile, config, klassifizierungen, persistAuslastung, neuLesen]);

  /**
   * Der schnelle Weg: holen statt rechnen. Räumt vorher den lokalen Cache — ein
   * angefangener Bau würde den Download sonst blockieren, und ein fremder
   * Vektorraum darf nicht ergänzt, sondern muss ersetzt werden.
   */
  const ladeVomSpeicher = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaeuft(true);
    try {
      await clearEmbeddings(storage.idb);
      await clearVerbundEmbeddings(storage.idb);
      invalidateVerbundEmbeddingsCache();
      const r = await useEmbeddingCorpusMirror.getState().downloadAndApply(storage);
      const v = await ensureVerbundCorpus(storage);
      bumpAuslastungCorpusSignal();
      if (!r || r.count === 0) {
        setFehler('Es wurden keine Vorhaben-Vektoren geladen — Manifest oder Bin-Datei fehlt oder ist leer.');
      } else if (v !== 'downloaded') {
        setFehler('Die Vorhaben-Vektoren sind da, die Verbund-Vektoren (für die Klassifizierung) liegen aber nicht (kompatibel) auf dem Datenspeicher. Ein voller Neuaufbau spiegelt sie mit.');
      }
    } catch (err) {
      setFehler(`Laden vom Datenspeicher fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLaeuft(false);
      await neuLesen();
      // Die Suche liest denselben Zustand — sonst spricht sie bis zum Reload
      // vom Stand vor dem Download.
      useKorpusAbgleich.getState().setBefund(null);
    }
  }, [storage, neuLesen]);

  const leere = useCallback(async (): Promise<void> => {
    if (!confirm('Alle Vektoren im lokalen Cache löschen? Die Ähnlichkeitssuche ist danach ohne Wirkung, bis der Korpus neu geladen oder gebaut wurde.')) return;
    setLaeuft(true);
    try {
      await clearEmbeddings(storage.idb);
      await clearVerbundEmbeddings(storage.idb);
      invalidateVerbundEmbeddingsCache();
      bumpAuslastungCorpusSignal();
    } finally {
      setLaeuft(false);
      await neuLesen();
    }
  }, [storage, neuLesen]);

  const abbrechen = useCallback(() => { abbruchRef.current?.abort(); }, []);

  return {
    bestand, befund, bilanz, raumAktuell, signatur, fortschritt, laeuft, fehler,
    nachziehenMoeglich: raumAktuell && (bestand?.zuEmbedden.length ?? 0) > 0,
    baue, ladeVomSpeicher, leere, abbrechen, neuLesen,
  };
}
