/**
 * Bestand der abgelegten ZIP-Pakete (`eingang/`) mit Löschbarkeit. Löschbar erst
 * wenn keine Datei mehr offen ist (alle konvertiert/übersprungen/fehlgeschlagen).
 * KEINE IDB-Spiegelung — liest live aus dem persönlichen Ordner.
 */
import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { listEingangBundles, deleteEingangBundle } from '@/core/services/personal-storage/antraege-eingang';
import { istLoeschbar, zusammenfassung, type EingangManifest } from './manifest';

export function BestandsBlock({ reloadSignal }: { reloadSignal?: number }): React.ReactElement | null {
  const storage = useStorage();
  const [bundles, setBundles] = useState<EingangManifest[] | null>(null);

  const laden = async (): Promise<void> => {
    const root = await getPersoenlichHandle(storage.idb).catch(() => null);
    if (!root) { setBundles([]); return; }
    setBundles(await listEingangBundles(root));
  };

  useEffect(() => { void laden(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [storage.idb, reloadSignal]);

  const loeschen = useAsyncAction(async (zipname: string) => {
    const root = await getPersoenlichHandle(storage.idb);
    if (!root) throw new Error('Kein persönlicher Ordner verbunden.');
    // Die übersprungenen Mitglieder benennen: sie existieren nur im ZIP, und das
    // Löschen entfernt die abgelegte Kopie samt Manifest (v4.124).
    const m = bundles?.find(b => b.zipname === zipname) ?? null;
    const offenTexte = m ? zusammenfassung(m) : null;
    const zusatz = offenTexte && offenTexte.uebersprungen > 0
      ? ` ${offenTexte.uebersprungen} Datei(en) wurden NICHT konvertiert und sind danach nur noch in Ihrer Original-Datei vorhanden.`
      : '';
    if (!confirm(`Paket „${zipname}" löschen? Die konvertierten Dokumente bleiben erhalten.${zusatz}`)) return;
    await deleteEingangBundle(root, zipname);
    await laden();
  });

  if (bundles === null) {
    return <div className="mt-5 text-[12px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Bestand laden…</div>;
  }
  if (bundles.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Abgelegte Pakete</div>
      {loeschen.error && (
        <div className="mb-2 rounded p-2 text-[11.5px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
          ⚠ {loeschen.error}
        </div>
      )}
      {bundles.map(b => {
        const z = zusammenfassung(b);
        const loeschbar = istLoeschbar(b);
        // „alle konvertiert" NUR, wenn das stimmt: `istLoeschbar` zählt
        // übersprungene Dateien bewusst als verarbeitet (sonst blockierten sie
        // das Löschen für immer) — die Beschriftung leitete daraus aber „alle N
        // konvertiert ✓" ab, obwohl übersprungen wird, was kein gültiges FKZ
        // trägt: bei DMS-Exporten der Regelfall. Der Löschen-Dialog gab damit
        // die App-Kopie samt der nie konvertierten Mitglieder frei (v4.124).
        const label = !loeschbar
          ? `${z.konvertiert} von ${z.gesamt} konvertiert`
          : z.konvertiert === z.gesamt
            ? `alle ${z.gesamt} Dateien konvertiert ✓ — löschbar`
            : [
              `${z.konvertiert} von ${z.gesamt} konvertiert`,
              z.uebersprungen > 0 ? `${z.uebersprungen} übersprungen` : null,
              z.fehlgeschlagen > 0 ? `${z.fehlgeschlagen} Fehler` : null,
            ].filter(Boolean).join(' · ') + ' — löschbar';
        return (
          <div key={b.zipname} className="flex items-center gap-3 py-2 border-b-[0.5px] border-[var(--tf-border)] last:border-b-0">
            <span className="font-mono text-[12px] text-[var(--tf-text)] truncate max-w-[200px]" title={b.zipname}>{b.zipname}.zip</span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)] flex-1">{label}</span>
            <button
              type="button"
              onClick={() => loeschen.run(b.zipname)}
              disabled={!loeschbar || loeschen.busy}
              aria-label={`Paket ${b.zipname} löschen`}
              title={loeschbar ? 'Paket löschen' : 'Erst löschbar, wenn alle Dateien verarbeitet sind'}
              className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-40 disabled:hover:text-[var(--tf-text-tertiary)]"
            >
              <Trash2 size={13} /> Löschen
            </button>
          </div>
        );
      })}
    </div>
  );
}
