/**
 * Shell-Level Background-Autoload des Auslastungs-Embedding-Korpus (v2.29).
 *
 * Problem: Nach einem Cold-Start (Browser „clear site data") sind die
 * Embedding-Caches des Auslastungs-Moduls maschine-lokal leer. Der Download vom
 * Daten-Share lief bisher NUR beim Navigieren ins Modul — der per-Antrag-Korpus
 * im `useEffect` der `EmbeddingCorpusSection` (Einstellungen-Tab), der
 * Verbund-Korpus im Mount von `KlassifizierungsReview`. Es gab keinen
 * Start-Trigger. Zudem blockte ein `aktenzeichenSetHash`-Gate den per-Antrag-
 * Auto-Download, sobald der lokale Antrags-Stand vom Share-Korpus abwich (der
 * häufige Normalzustand: Korpus wird selten neu gebaut, CSV-Importe oft).
 *
 * Seit v4.113 heilt er auch einen HALBEN Korpus (lokal < Share-Manifest) — der
 * häufigste Zustand nach einem Reload mitten im Download, und vorher einer, aus
 * dem die App nie wieder herausfand.
 *
 * Dieser Hook lädt den Korpus einmalig vom Share, sobald SMB online ist —
 * fire-and-forget, non-blocking. Reads vom Share, Writes nur in die lokale IDB
 * (kein `readwrite`-Handle nötig). Bewusst OHNE Hash-Gate (= Äquivalent zum
 * manuellen Button „Vom Datenspeicher laden"): der vorhandene Share-Korpus wird
 * geladen, auch wenn er den lokalen Stand nicht exakt abdeckt; die wenigen
 * neueren Anträge bleiben un-embedded bis zum nächsten manuellen Rebuild.
 *
 * Gegated auf `isAuslastungFreigeschaltet()` (pl + dev) — in prod/demo/kurator No-Op.
 *
 * Siehe Memory `embedding-caches-machine-local` (Ursache) +
 * `cold-start-store-refresh-pattern` (Bug-Klasse).
 */
import { useCallback, useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import {
  countEmbeddings, checkCompat,
  ladeKorpusSignatur, signaturAusManifest, signaturenGleich,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import { ensureVerbundCorpus } from '@/plugins/auslastung/services/matching';
import { bumpAuslastungCorpusSignal } from '@/plugins/auslastung/services/matching';

export function useAuslastungCorpusAutoload(): void {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const attemptedRef = useRef(false);

  const run = useCallback(async () => {
    let changed = false;

    // 1) Verbund-Korpus (Klassifizierung) — eigene Guards (Count + Inflight),
    //    kein Hash, keine Antraege noetig. Unabhaengig vom per-Antrag-Korpus.
    try {
      if ((await ensureVerbundCorpus(storage)) === 'downloaded') changed = true;
    } catch { /* best-effort */ }

    // 2) per-Antrag-Korpus („Themen-Vektoren") — wenn lokal leer ODER unvollständig.
    //
    // Bis v4.113 stand hier `=== 0`. Ein HALB gefüllter Korpus blockierte sich
    // damit dauerhaft selbst — und er entsteht ohne Zutun: `applyCorpusStreamed`
    // schreibt pro Vektor eine eigene IDB-Transaktion und yieldet alle 100, ein
    // Reload mitten in den 14 065 Einzelschreibungen hinterlässt genau so einen
    // Teilbestand. Danach griff der Autoload nie wieder, und die Zeile unter dem
    // Suchfeld nannte den Ausweg nur im Fall von exakt 0 Vektoren.
    //
    // Der Cold-Start-Schutz bleibt, nur präziser: geladen wird, solange der Share
    // MEHR hält als der lokale Stand — ein frisch gebauter, vollständiger Korpus
    // wird nicht angetastet. Und nur aus DEMSELBEN Vektorraum, sonst legte der
    // Download alte Vektoren neben selbst gebaute neue ([signatur.ts](src/core/services/embedding-corpus/signatur.ts)).
    try {
      const lokal = await countEmbeddings(storage.idb);
      await useEmbeddingCorpusMirror.getState().loadManifest(storage);
      const manifest = useEmbeddingCorpusMirror.getState().manifest;
      if (manifest && lokal < manifest.antraegeCount) {
        const id = await getActiveModelId(storage.idb);
        const dim = getModelById(id).dimensions;
        const eigene = await ladeKorpusSignatur(storage.idb);
        const raumPasst = lokal === 0 || eigene === null
          || signaturenGleich(eigene, signaturAusManifest(manifest));
        // Modell-Bruch → inkompatible Vektoren nicht laden (Pitfall #19), Rebuild nötig.
        if (checkCompat(manifest, id, dim).kind === 'compatible' && raumPasst) {
          // Bewusst OHNE aktenzeichenSetHash-Gate (User-Wahl v2.29): vorhandenen
          // Share-Korpus laden, auch wenn er den lokalen Stand nicht exakt abdeckt —
          // identisch zum manuellen Button „Vom Datenspeicher laden".
          const r = await useEmbeddingCorpusMirror.getState().downloadAndApply(storage);
          if (r && r.count > 0) changed = true;
        } else if (!raumPasst) {
          console.info(
            '[corpus-autoload] Share-Korpus stammt aus einem anderen Vektorraum als der '
            + 'lokale Teilbestand — nicht gemischt. Rebuild im Auslastungs-Modul.',
          );
        }
      }
    } catch (err) {
      console.warn('[corpus-autoload] Start-Download fehlgeschlagen:', err);
    }

    // v2.29.1: Konsumenten (Klassifizierung/Matching) re-lesen lassen, falls der
    // Download lief, WÄHREND das Auslastungs-Modul bereits offen ist — sonst
    // bleiben sie auf leerem Mount-Stand bis zum Browser-Reload (cold-start-
    // store-refresh-Klasse). Im Normalfall (Autoload auf Home, vor Navigation)
    // ist noch kein Konsument gemountet → harmloser No-Op.
    if (changed) bumpAuslastungCorpusSignal();
  }, [storage]);

  useEffect(() => {
    if (!isAuslastungFreigeschaltet()) return;
    if (smbStatus.status !== 'online') return;
    if (attemptedRef.current) return;
    attemptedRef.current = true; // Latch vor run() → kein Doppel-Fire (StrictMode)
    // Cold-Start entlasten (v2.61.5): Download + (synchrones) Parsen des ~40-MB-
    // Korpus erst nach dem First-Paint im Leerlauf starten. Sonst kann die
    // Parse-Phase parallel zum Homepage-Aufbau den Main-Thread blockieren
    // („Seite reagiert nicht" auf RAM-knappem Citrix). requestIdleCallback ist
    // unter file:// in Chrome/Edge verfuegbar; Fallback setTimeout.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => { void run(); }, { timeout: 3000 });
    } else {
      window.setTimeout(() => { void run(); }, 1500);
    }
  }, [smbStatus.status, run]);
}
