/**
 * Der Korpus holt sich beim Start, was er braucht — und sagt, wenn er veraltet
 * ist (v4.127; vorher `useAuslastungCorpusAutoload`).
 *
 * **Zwei Korpora, zwei Zielgruppen** — und genau das war die Luecke:
 *
 *  - Der **Verbund-Korpus** dient allein der Klassifizierung. Er gehoert dem
 *    Auslastungs-Modul und bleibt an dessen Freischaltung.
 *  - Der **Antraege-Korpus** ist der VEKTORINDEX DER SUCHE. Die Stufe „auch
 *    aehnliche Themen" liest ihn direkt aus der IDB — in jeder Variante. Er hing
 *    trotzdem an `isAuslastungFreigeschaltet()`: in `zim-dashboard`
 *    (`auslastung: false`) lief der Abgleich nie, in `zah-pl` erst nach dem
 *    Auslastungs-Zusatzpasswort. Wer die Aehnlichkeitssuche einschaltete, ohne
 *    das Modul zu haben, bekam eine Stufe ohne Vektoren und den Rat, ein Modul
 *    zu oeffnen, das es in seinem Build nicht gibt.
 *
 * **Wann er laeuft.** Wo das Modul offen ist (dev/pl mit Passwort), beim Start
 * im Leerlauf wie bisher — dort wird der Korpus ohnehin fuer das Matching
 * gebraucht. Sonst erst, wenn jemand die Aehnlichkeitssuche einschaltet. Das
 * folgt der bewussten Bedarfs-Ladung des ~200-MB-Modells (v4.113,
 * runtime-layers.md): ein ~40-MB-Download ueber SMB bei jedem Kaltstart, fuer
 * jeden, der die Stufe nie benutzt, waere die Gegenrichtung.
 *
 * **Was er entscheidet**, entscheidet er nicht hier: die Regel steht rein in
 * [abgleich.ts](@/core/services/embedding-corpus/abgleich), dieser Hook fuehrt
 * sie aus. Vorher stand sie als `lokal < manifest.antraegeCount` mitten im
 * Effekt — also nur die Anzahl, blind gegen jede Textfassung.
 *
 * Reads vom Share, Writes nur in die lokale IDB (kein `readwrite`-Handle noetig).
 *
 * Siehe Memory `embedding-caches-machine-local` (Ursache) +
 * `cold-start-store-refresh-pattern` (Bug-Klasse).
 */
import { useCallback, useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import type { StorageService } from '@/core/services/storage';
import {
  countEmbeddings,
  clearEmbeddings,
  entscheideAbgleich,
  aktuelleKorpusSignatur,
  ladeKorpusSignatur,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import { useKorpusAbgleich } from '@/core/hooks/useKorpusAbgleich';
import { useProfile } from '@/core/hooks/useProfile';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { canWriteDatenShare } from '@/config/feature-flags';
import { isDataMutationBusy } from '@/core/services/csv/data-mutation-gate';
import { ensureVerbundCorpus } from '@/plugins/auslastung/services/matching';
import { bumpAuslastungCorpusSignal } from '@/plugins/auslastung/services/matching';
import { fuehreNachlaufAus, istNachlaufAn } from '@/plugins/auslastung/services/matching';

/**
 * Cold-Start entlasten (v2.61.5): Download + Anwenden des ~40-MB-Korpus erst
 * nach dem First-Paint. Sonst kann die Parse-Phase parallel zum Seitenaufbau den
 * Main-Thread blockieren („Seite reagiert nicht" auf RAM-knappem Citrix).
 */
function imLeerlauf(fn: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 3000 });
  } else {
    window.setTimeout(fn, 1500);
  }
}

/** Der Suchindex: entscheiden, ggf. laden, Befund hinterlegen. */
async function gleicheAntraegeKorpusAb(storage: StorageService): Promise<void> {
  const status = useKorpusAbgleich.getState();
  status.setLaeuft(true);
  try {
    const lokalCount = await countEmbeddings(storage.idb);
    await useEmbeddingCorpusMirror.getState().loadManifest(storage);
    const manifest = useEmbeddingCorpusMirror.getState().manifest;
    const modellId = await getActiveModelId(storage.idb);
    const befund = entscheideAbgleich({
      lokalCount,
      lokalSignatur: await ladeKorpusSignatur(storage.idb),
      manifest,
      aktiveSignatur: aktuelleKorpusSignatur(getModelById(modellId)),
    });
    status.setBefund(befund);

    if (befund.aktion !== 'ergaenzen' && befund.aktion !== 'ersetzen') {
      if (befund.aktion !== 'nichts') console.info('[korpus-abgleich]', befund.grund);
      return;
    }
    // Fremder Raum wird ERSETZT, nie ergaenzt: ein Kosinus-Vergleich ueber zwei
    // Vektorraeume liefert Zahlen, die nach Aehnlichkeit aussehen.
    if (befund.aktion === 'ersetzen') await clearEmbeddings(storage.idb);
    const r = await useEmbeddingCorpusMirror.getState().downloadAndApply(storage);
    // Konsumenten (Klassifizierung/Matching) re-lesen lassen, falls der Download
    // lief, WAEHREND eine Ansicht schon offen ist — sonst bleiben sie auf dem
    // leeren Mount-Stand bis zum Reload (cold-start-store-refresh-Klasse).
    if (r && r.count > 0) bumpAuslastungCorpusSignal();
  } catch (err) {
    console.warn('[korpus-abgleich] Abgleich fehlgeschlagen:', err);
  } finally {
    useKorpusAbgleich.getState().setLaeuft(false);
  }
}

/**
 * Der Nachlauf zieht den Suchindex an neue CSV-Daten heran — **nur auf einem
 * Rechner, der sich dafuer gemeldet hat** ([korpus-nachlauf.ts](@/plugins/auslastung/services/matching/korpus-nachlauf)).
 *
 * Die Bestandsaufnahme kostet eine Cursor-Passage ueber ~14 k Records. Deshalb
 * fragt dieser Hook ZUERST den Schalter und laesst erst dann rechnen: die Kosten
 * landen dort, wo der Nutzen ist.
 */
async function nachlaufWennGewollt(
  storage: StorageService,
  programmId: string | null,
  online: boolean,
  darfSchreiben: boolean,
  profilName?: string,
): Promise<void> {
  try {
    if (!(await istNachlaufAn(storage.idb))) return;
    const erg = await fuehreNachlaufAus({
      storage, programmId, online, darfSchreiben,
      datenUpdateLaeuft: isDataMutationBusy(),
      profilName,
    });
    // Immer eine Zeile — auch das Nichtstun hat einen Grund, und ein stiller
    // Nachlauf ist von einem kaputten nicht zu unterscheiden.
    console.info(`[korpus-nachlauf] ${erg.urteil.grund}`
      + (erg.urteil.laeuft ? ` (${erg.eingebettet} eingebettet, hochgeladen: ${erg.hochgeladen})` : ''));
  } catch (err) {
    console.warn('[korpus-nachlauf] Vorprüfung fehlgeschlagen:', err);
  }
}

export function useEmbeddingKorpusAbgleich(): void {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const semantischAn = useSemanticSearchMode(s => s.enabled);
  const { profile } = useProfile();
  const programmId = useActiveProgramm(s => s.activeProgrammId);
  const verbundRef = useRef(false);
  const antraegeRef = useRef(false);
  const nachlaufRef = useRef(false);

  const online = smbStatus.status === 'online';

  // 1) Verbund-Korpus (Klassifizierung) — eigene Guards (Count + Inflight),
  //    kein Hash, keine Antraege noetig. Bleibt am Auslastungs-Modul: ausserhalb
  //    davon gibt es niemanden, der ihn liest.
  useEffect(() => {
    if (!online || verbundRef.current) return;
    if (!isAuslastungFreigeschaltet()) return;
    verbundRef.current = true; // Latch VOR dem Lauf → kein Doppel-Fire (StrictMode)
    imLeerlauf(() => {
      void ensureVerbundCorpus(storage)
        .then(r => { if (r === 'downloaded') bumpAuslastungCorpusSignal(); })
        .catch(() => undefined); // best-effort
    });
  }, [online, storage]);

  // 2) Antraege-Korpus = Suchindex. Kein Modul-Gate mehr (siehe Dateikopf).
  const starteAntraege = useCallback(() => {
    if (antraegeRef.current) return;
    antraegeRef.current = true;
    imLeerlauf(() => { void gleicheAntraegeKorpusAb(storage); });
  }, [storage]);

  useEffect(() => {
    if (!online) return;
    if (!isAuslastungFreigeschaltet() && !semantischAn) return;
    starteAntraege();
  }, [online, semantischAn, starteAntraege]);

  // 3) Nachlauf — nach dem Abgleich, damit er nicht gegen einen laufenden
  //    Download baut, und erst wenn ein Programm feststeht (ohne das gibt es
  //    keinen Bestand, ueber den er urteilen koennte).
  useEffect(() => {
    if (!online || nachlaufRef.current || !programmId) return;
    nachlaufRef.current = true;
    const darfSchreiben = canWriteDatenShare(
      profile?.is_kurator === true || profile?.is_admin === true,
    );
    imLeerlauf(() => {
      void nachlaufWennGewollt(storage, programmId, online, darfSchreiben, profile?.name);
    });
  }, [online, programmId, storage, profile]);
}
