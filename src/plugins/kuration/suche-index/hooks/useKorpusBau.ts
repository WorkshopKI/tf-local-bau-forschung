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
  planeVerbundQueue,
  uploadVerbundCorpusToShare,
  bumpAuslastungCorpusSignal,
  berechneBauRate,
  ladeBauRate,
  merkeBauRate,
  LOCK_STUFE_KORPUS,
  type BuildAbbruchGrund,
  type BauRate,
  type KorpusBestand,
} from '@/plugins/auslastung/services/matching';
import { computeKategorieCentroidsFromVerbund } from '@/plugins/auslastung/services/klassifizierung';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { computeEtaMsFromSamples, type ThroughputSample } from '@/core/utils/eta';
import { berechneGesamt, type BauPhase, type BauPlan } from './bauFortschritt';

export interface PhasenFortschritt {
  phase: BauPhase;
  /** Stand INNERHALB der laufenden Phase — trägt die Zeile „X von Y". */
  done: number;
  total: number;
  last?: string;
  /** Stand des GANZEN Laufs — trägt den Balken. */
  gesamtDone: number;
  gesamtTotal: number;
  prozent: number;
  /** Geschätzte Restzeit des ganzen Laufs in Sekunden. */
  etaSec?: number;
}

/**
 * Wie weit das gleitende Fenster der Restzeit zurückreicht.
 *
 * Die ZEIT ist das Maß, nicht die Anzahl: bei ~20 ms je Vektor spannen 40
 * Messpunkte nur 0,8 s und blieben damit unter der Konfidenz-Schwelle von
 * `computeEtaMsFromSamples` (1,5 s) — es gäbe nie eine Restzeit. Die
 * Punkt-Obergrenze ist nur ein Deckel gegen unbegrenztes Wachsen.
 */
const FENSTER_MS = 15_000;
const FENSTER_SAMPLES_MAX = 400;

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
  /** Antraege ohne Embedding-Text — ein Normalfall, meist eine Handvoll. */
  ohneText: number;
  /**
   * Antraege, deren Einbettung SCHEITERTE.
   *
   * Bis v6.15 lag das mit `ohneText` in einer Zahl („13.418 übersprungen (kein
   * Text oder Fehler)"), und ein Lauf, dem die Pipeline wegbrach, war von einem
   * Bestand ohne Texte nicht zu unterscheiden.
   */
  fehlgeschlagen: number;
  /** Wortlaut des ersten Fehlers — das, was vorher nur in der Konsole stand. */
  ersterFehler?: string;
  /**
   * Hat der Lauf den Vektorraum als abgeloest vermerkt?
   *
   * Die Karte sagt dem Leser, was mit seinem Korpus geschehen ist — sie darf das
   * nicht aus „es gab Fehler" ableiten. Ein Lauf im GLEICHEN Raum stempelt auch
   * mit Einzelfehlern, weil er nichts abloest.
   */
  signaturGestempelt: boolean;
  /** Ist das Ergebnis beim Team angekommen? */
  gespiegelt: boolean;
  /** Der Lauf hat trotz „nachziehen" voll gebaut (fremder Vektorraum). */
  vollErzwungen: boolean;
  abgebrochen: boolean;
  abbruchGrund?: BuildAbbruchGrund;
}

export interface KorpusBau {
  bestand: KorpusBestand | null;
  befund: AbgleichBefund | null;
  /** Bilanz des letzten Laufs in dieser Sitzung. */
  bilanz: BauBilanz | null;
  /** Gemessene Bau-Rate DIESES Rechners, oder `null` vor der ersten Messung. */
  rate: BauRate | null;
  /** Stimmt der lokale Vektorraum mit dem ueberein, den ein Lauf jetzt erzeugt? */
  raumAktuell: boolean;
  signatur: KorpusSignatur | null;
  fortschritt: PhasenFortschritt | null;
  laeuft: boolean;
  fehler: string | null;
  /** Der lokale Bau steht, nur das Spiegeln hat nicht geklappt — `spiegle()` reicht. */
  spiegelungOffen: boolean;
  /** `false` = „Nachziehen" waere in Wahrheit ein Vollbau (fremder Raum). */
  nachziehenMoeglich: boolean;
  baue: (voll: boolean) => Promise<void>;
  ladeVomSpeicher: () => Promise<void>;
  /** Nur hochladen — ohne einen einzigen Vektor neu zu rechnen. */
  spiegle: () => Promise<void>;
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
  const [rate, setRate] = useState<BauRate | null>(null);
  const [signatur, setSignatur] = useState<KorpusSignatur | null>(null);
  const [raumAktuell, setRaumAktuell] = useState(true);
  const [fortschritt, setFortschritt] = useState<PhasenFortschritt | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [spiegelungOffen, setSpiegelungOffen] = useState(false);
  const abbruchRef = useRef<AbortController | null>(null);

  const neuLesen = useCallback(async (): Promise<void> => {
    const b = await ermittleKorpusBestand(storage.idb, programmId);
    setBestand(b);
    setRate(await ladeBauRate(storage.idb));
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
    setSpiegelungOffen(false);
    setLaeuft(true);
    // Sofort eine eigene Phase, statt den Bestandswert von VOR dem Lauf stehen
    // zu lassen: das Modell zu laden dauert, und „98 %" ist waehrenddessen keine
    // Auskunft ueber diesen Lauf.
    setFortschritt({
      phase: 'vorbereiten', done: 0, total: 0,
      gesamtDone: 0, gesamtTotal: 0, prozent: 0,
    });
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

      // Beide Phasen ZUSAMMEN sind der Lauf. Ihre Groessen stehen vorher fest —
      // sonst kann der Balken nur je Phase von vorne zaehlen, und genau das war
      // der gemeldete Fehler. `planeVerbundQueue` ist dieselbe Regel, die der
      // Verbund-Lauf gleich selbst anwendet (kein zweiter Regelsatz).
      const plan: BauPlan = {
        antrag: voll ? antraege.length : (bestand?.zuEmbedden.length ?? antraege.length),
        verbund: (await planeVerbundQueue(storage.idb, antraege, !voll)).length,
      };

      // Gleitendes Fenster statt Mittelwert seit Laufbeginn: die ersten Sekunden
      // sind Warmlauf der Kernel, und Antraege ohne Text rauschen in
      // Millisekunden durch. Ein Gesamtmittel aus beidem sagte „25 min", wo
      // fuenf gemeint waren.
      let samples: ThroughputSample[] = [];
      let letztePhase: BauPhase = 'vorbereiten';
      let ersterTick = 0;
      let letzterTick = 0;

      const melde = (phase: BauPhase, done: number, total: number, last?: string): void => {
        if (phase === 'antrag') plan.antrag = total;
        if (phase === 'verbund') plan.verbund = total;
        const g = berechneGesamt(plan, phase, done);

        const jetzt = Date.now();
        if (letztePhase !== phase) {
          // Zwischen den Phasen liegt ein Leerlauf (IDB-Scan, Bucketing); ihn im
          // Fenster zu behalten hiesse, die Pause als Arbeitstempo zu messen.
          samples = [];
          letztePhase = phase;
        }
        if (ersterTick === 0) ersterTick = jetzt;
        letzterTick = jetzt;
        samples.push({ t: jetzt, processed: g.gesamtDone });
        while (
          samples.length > FENSTER_SAMPLES_MAX
          || (samples.length > 2 && jetzt - (samples[0] as ThroughputSample).t > FENSTER_MS)
        ) {
          samples.shift();
        }
        const etaMs = computeEtaMsFromSamples(samples, g.gesamtTotal);
        setFortschritt({
          phase, done, total, last,
          gesamtDone: g.gesamtDone, gesamtTotal: g.gesamtTotal, prozent: g.prozent,
          etaSec: etaMs === null ? undefined : etaMs / 1000,
        });
      };

      const erg = await buildEmbeddingCorpus(storage.idb, antraege, {
        incremental: !voll,
        programmId,
        onProgress: p => melde('antrag', p.done, p.total, p.lastAntrag),
        signal: controller.signal,
      });

      // Ein abgebrochener Lauf ist zu Ende — er darf nicht in die zweite Phase
      // weiterlaufen. Als die Einbettung an einem verlorenen Grafik-Kontext
      // starb, tat der Verbund-Lauf danach exakt dasselbe noch einmal, und der
      // Balken sprang trotzdem auf 100 %, weil Centroids und Spiegeln als
      // „hinter allem" gelten.
      if (erg.aborted) {
        setBilanz({
          eingebettet: erg.done - erg.skipped,
          ohneText: erg.ohneText,
          fehlgeschlagen: erg.fehlgeschlagen,
          ersterFehler: erg.ersterFehler,
          signaturGestempelt: erg.signaturGestempelt,
          vollErzwungen: erg.vollErzwungen,
          abgebrochen: true,
          abbruchGrund: erg.abbruchGrund,
          gespiegelt: false,
        });
        // Die bis zum Abbruch geschriebenen Vektoren sind da — wer sie liest,
        // soll nicht auf dem Stand von vorher sitzen bleiben.
        bumpAuslastungCorpusSignal();
        return;
      }

      if (lockGehalten) await heartbeat(storage.idb).catch(() => undefined);

      // Verbund-Phase: klein gegen die Antraege, aber bei einem Vollbau ein
      // zweiter mehrminütiger Lauf — ohne eigenen Fortschritt fröre die Anzeige
      // nach den 100 % der ersten Phase scheinbar ein (v2.21.2).
      //
      // `vollErzwungen` gilt fuer BEIDE Haelften: stammte der lokale Korpus aus
      // einem fremden Vektorraum, sind auch die Verbund-Vektoren daraus — sie
      // inkrementell stehen zu lassen, hiesse den Raum nur halb abzuloesen.
      const vErg = await buildVerbundEmbeddingCorpus(storage.idb, antraege, {
        incremental: !voll && !erg.vollErzwungen,
        signal: controller.signal,
        onProgress: p => melde('verbund', p.done, p.total, p.lastVerbundId),
      });
      // Vor jeder Abzweigung: geschrieben ist geschrieben. Haenge das an den
      // Erfolgsfall, und ein abgebrochener Lauf laesst den Modul-Cache auf dem
      // Stand von vorher stehen.
      invalidateVerbundEmbeddingsCache();
      bumpAuslastungCorpusSignal();

      // `done` zaehlt die Durchlaeufe — was wirklich entstanden ist, ist die
      // Differenz zu den Uebersprungenen. Fehler stehen dabei GETRENNT von
      // „kein Text": ein Lauf, dem die Pipeline wegbrach, sah bis v6.15 aus wie
      // ein Bestand ohne Texte.
      const eingebettetAntrag = erg.done - erg.skipped;
      const eingebettetVerbund = vErg.done - vErg.skipped;
      const fehlgeschlagen = erg.fehlgeschlagen + vErg.fehlgeschlagen;

      // Nur ein vollstaendiger, fehlerfreier Lauf darf weiter: er entscheidet
      // ueber Centroids, Spiegelung und Messung gleichermassen.
      const sauber = !vErg.aborted && fehlgeschlagen === 0;
      setBilanz({
        eingebettet: eingebettetAntrag + eingebettetVerbund,
        ohneText: erg.ohneText + vErg.ohneText,
        fehlgeschlagen,
        ersterFehler: erg.ersterFehler ?? vErg.ersterFehler,
        signaturGestempelt: erg.signaturGestempelt,
        vollErzwungen: erg.vollErzwungen,
        abgebrochen: vErg.aborted,
        abbruchGrund: vErg.abbruchGrund,
        gespiegelt: false,
      });

      if (!sauber) {
        // NICHT spiegeln. Ein halber Korpus wuerde sonst zum Stand des ganzen
        // Teams — genau das ist in der Abnahme passiert: ein Lauf, dem nach 827
        // Vorhaben der Grafik-Kontext wegbrach, hat das gute Manifest auf dem
        // Datenspeicher ueberschrieben.
        setSpiegelungOffen(true);
        setFehler(
          `Der Lauf konnte ${fehlgeschlagen.toLocaleString('de-DE')} Vektoren nicht erzeugen `
          + '— er wurde deshalb NICHT auf den Datenspeicher gespiegelt. Der Stand des Teams '
          + 'bleibt unberührt. Nach einem sauberen Lauf spiegelt „Erneut spiegeln" von Hand.',
        );
        return;
      }
      // Nur ein VOLLBAU taugt als Messung fuer die Schaetzung am Knopf: er ist
      // der Lauf, den sie vorhersagen soll, und nur er hat beide Phasen in
      // ihrer vollen Groesse gesehen. Fehlerfrei ist er hier schon.
      if ((voll || erg.vollErzwungen) && letzterTick > ersterTick) {
        const gemessen = berechneBauRate(
          letzterTick - ersterTick,
          eingebettetAntrag,
          eingebettetVerbund,
          new Date().toISOString(),
        );
        if (gemessen) {
          await merkeBauRate(storage.idb, gemessen);
          setRate(gemessen);
        }
      }

      if (lockGehalten) await heartbeat(storage.idb).catch(() => undefined);

      // Label setzen und einen Tick yielden, damit React es zeichnet, BEVOR die
      // synchrone Centroid-Rechnung den Main-Thread belegt.
      setFortschritt({
        phase: 'centroids', done: 0, total: 0,
        ...berechneGesamt(plan, 'centroids', 0),
      });
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

      // Upload — soft-fail: der lokale Bau bleibt gültig, nur das Team hat ihn
      // dann noch nicht. Er bekommt eine eigene Phase am vollen Balken, statt
      // die Anzeige auf den Bestandswert zurückfallen zu lassen: über VPN dauert
      // das Minuten, und „98 %" wäre dann eine Auskunft über etwas anderes.
      setFortschritt({
        phase: 'spiegeln', done: 0, total: 0,
        ...berechneGesamt(plan, 'spiegeln', 0),
      });
      const aktiv = aktuelleKorpusSignatur(getModelById(await getActiveModelId(storage.idb)));
      try {
        await useEmbeddingCorpusMirror.getState().uploadFromIdb(
          storage, aktiv.modellId, aktiv.dim, profile?.name, { skipLock: true },
        );
        // Der core-Mirror deckt nur die Vorhaben-Vektoren ab; ohne diesen
        // zweiten Schritt hätte ein neuer Rechner keine Verbund-Vektoren für
        // die Klassifizierung (v2.19).
        await uploadVerbundCorpusToShare(storage, aktiv.modellId, aktiv.dim, profile?.name);
        setBilanz(b => (b ? { ...b, gespiegelt: true } : b));
      } catch (err) {
        setSpiegelungOffen(true);
        setFehler(
          'Der Bau ist fertig und liegt lokal — nur das Spiegeln auf den Datenspeicher ist '
          + `gescheitert: ${err instanceof Error ? err.message : String(err)} `
          + '„Erneut spiegeln" wiederholt allein den Upload, ohne neu zu bauen.',
        );
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
  }, [storage, programmId, profile, config, klassifizierungen, persistAuslastung, neuLesen,
      bestand]);

  /**
   * Nur spiegeln — der Bau liegt schon in der IndexedDB.
   *
   * Bis v6.16 war der Upload ausschliesslich das Anhaengsel von `baue()`:
   * scheiterte er (ueber VPN keine Seltenheit, der Verzeichnis-Handle verliert
   * dabei seinen gecachten Zustand), war der einzige Weg zum Team ein
   * kompletter Neubau — 46 Minuten fuer eine Datei, die fertig danebenlag.
   * `serializeCorpus` baut Manifest und Bin deterministisch aus dem Cache; hier
   * wird kein einziger Vektor neu gerechnet.
   */
  const spiegle = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaeuft(true);
    setFortschritt({
      phase: 'spiegeln', done: 0, total: 0,
      gesamtDone: 0, gesamtTotal: 0, prozent: 100,
    });
    try {
      const aktiv = aktuelleKorpusSignatur(getModelById(await getActiveModelId(storage.idb)));
      await useEmbeddingCorpusMirror.getState().uploadFromIdb(
        storage, aktiv.modellId, aktiv.dim, profile?.name,
      );
      await uploadVerbundCorpusToShare(storage, aktiv.modellId, aktiv.dim, profile?.name);
      setSpiegelungOffen(false);
    } catch (err) {
      setSpiegelungOffen(true);
      setFehler(`Spiegeln auf den Datenspeicher fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLaeuft(false);
      setFortschritt(null);
      await neuLesen();
    }
  }, [storage, profile, neuLesen]);

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
    bestand, befund, bilanz, rate, raumAktuell, signatur, fortschritt, laeuft, fehler,
    spiegelungOffen,
    nachziehenMoeglich: raumAktuell && (bestand?.zuEmbedden.length ?? 0) > 0,
    baue, ladeVomSpeicher, spiegle, leere, abbrechen, neuLesen,
  };
}
