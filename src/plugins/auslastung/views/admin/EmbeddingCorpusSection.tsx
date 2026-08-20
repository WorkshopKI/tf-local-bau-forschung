/**
 * Themen-Vektoren — read-only Status (v4.127).
 *
 * **Rollentausch.** Bis v4.127 lag hier der Bau (drei Phasen, Build-Lock,
 * Upload) und in der Kuration nur eine Statuskarte. Das war verkehrt herum: die
 * Vektoren sind der Suchindex, den das Auslastungs-Modul mitbenutzt, nicht
 * umgekehrt. Der Bau steht jetzt in Kuration → „Suche & Index"
 * ([EmbeddingKorpusSection](@/plugins/kuration/suche-index/sections/EmbeddingKorpusSection)),
 * hinter dem Kurator-Schloss — einer schärferen Grenze als der Experten-Schalter,
 * der diesen Reiter verbirgt. Was hier bleibt, ist die Antwort auf „habe ich
 * Vektoren, und sind sie aktuell?", denn davon hängt die Klassifizierung ab.
 *
 * Bewusst KEIN Knopf: zwei Bau-Türen für denselben Korpus wären zwei Stellen,
 * an denen ein 200-MB-Modell startet, und der Build-Lock müsste sie sortieren.
 */
import { useEffect, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useEmbeddingCorpusMirror } from '@/core/hooks/useEmbeddingCorpusMirror';
import {
  countEmbeddings,
  getCorpusBuildVersion,
  ladeKorpusSignatur,
  signaturText,
  CORPUS_BUILD_VERSION,
  type KorpusSignatur,
} from '@/core/services/embedding-corpus';
import { useAuslastungCorpusSignal } from '../../services/matching';

export function EmbeddingCorpusSection({ storage }: { storage: StorageService }): React.ReactElement {
  const manifest = useEmbeddingCorpusMirror(s => s.manifest);
  const manifestGeladen = useEmbeddingCorpusMirror(s => s.manifestLoaded);
  const ladeManifest = useEmbeddingCorpusMirror(s => s.loadManifest);
  // Der Korpus kann sich unter der offenen Seite ändern (Start-Abgleich,
  // Nachlauf) — ohne dieses Signal stünde hier bis zum Reload der Mount-Stand
  // (cold-start-store-refresh-Klasse).
  const signal = useAuslastungCorpusSignal();
  const [lokal, setLokal] = useState<number | null>(null);
  const [signatur, setSignatur] = useState<KorpusSignatur | null>(null);

  useEffect(() => {
    if (!manifestGeladen) void ladeManifest(storage);
  }, [manifestGeladen, ladeManifest, storage]);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const [n, sig] = await Promise.all([
        countEmbeddings(storage.idb),
        ladeKorpusSignatur(storage.idb),
      ]);
      if (abgebrochen) return;
      setLokal(n);
      setSignatur(sig);
    })();
    return () => { abgebrochen = true; };
  }, [storage, signal]);

  const shareVersion = manifest ? getCorpusBuildVersion(manifest) : null;
  const lokalVeraltet = signatur !== null && signatur.buildVersion < CORPUS_BUILD_VERSION;
  // Ohne lokale Signatur (Bestand vor v4.113) ist die Fassung des Datenspeichers
  // die einzige Aussage, die es gibt — sie darf dann nicht als bloße Zahl
  // dastehen: ein Messfeld ohne Urteil meldet keinen Stillstand.
  const shareVeraltet = shareVersion !== null && shareVersion < CORPUS_BUILD_VERSION;

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-2">
        Themen-Vektoren für Klassifizierung
      </h3>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-3">
        Stufe 2 des Matchings vergleicht ein Vorhaben mit den Kategorie-Centroids. Ohne Vektoren
        bleibt sie ohne Wirkung; die Stufen 0 und 1 arbeiten weiter.
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
        <dt className="text-[var(--tf-text-secondary)]">Auf diesem Rechner:</dt>
        <dd className="text-[var(--tf-text)]">
          {lokal === null ? '…' : `${lokal.toLocaleString('de-DE')} Vektoren`}
        </dd>
        <dt className="text-[var(--tf-text-secondary)]">Auf dem Datenspeicher:</dt>
        <dd className="text-[var(--tf-text)]">
          {!manifestGeladen
            ? '…'
            : manifest === null
              ? <span className="text-[var(--tf-text-tertiary)]">kein Korpus abgelegt</span>
              : `${manifest.antraegeCount.toLocaleString('de-DE')} Vektoren`}
        </dd>
        {manifest && (
          <>
            <dt className="text-[var(--tf-text-secondary)]">Zuletzt gebaut:</dt>
            <dd className="text-[var(--tf-text)]">
              {new Date(manifest.builtAt).toLocaleDateString('de-DE')}
              {manifest.builderProfile && (
                <span className="text-[var(--tf-text-tertiary)]"> · {manifest.builderProfile}</span>
              )}
              <span className={shareVeraltet ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--tf-text-tertiary)]'}>
                {' '}· Textfassung v{shareVersion}
                {shareVeraltet && ` — überholt, aktuell wäre v${CORPUS_BUILD_VERSION}`}
              </span>
            </dd>
          </>
        )}
        {signatur && (
          <>
            <dt className="text-[var(--tf-text-secondary)]">Vektorraum hier:</dt>
            <dd className={lokalVeraltet ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--tf-text)]'}>
              {signaturText(signatur)}
              {lokalVeraltet && (
                <span className="ml-2 text-[11px]">
                  — überholt (aktuell wäre Text v{CORPUS_BUILD_VERSION}; v1/v2 kennen die
                  Projektbeschreibung nicht)
                </span>
              )}
            </dd>
          </>
        )}
      </dl>

      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3 leading-relaxed">
        Bauen, holen und nachziehen: <span className="text-[var(--tf-text-secondary)]">Kuration →
        „Suche &amp; Index“ → „Vektoren der Ähnlichkeitssuche“</span>. Dort liegt derselbe Korpus —
        er trägt zugleich die Stufe „auch ähnliche Themen“ der Suche.
      </p>
    </div>
  );
}
