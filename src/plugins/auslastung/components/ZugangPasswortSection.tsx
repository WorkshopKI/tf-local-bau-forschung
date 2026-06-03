/**
 * ZugangPasswortSection (v2.11) — PL erzeugt/erneuert das MA-Login-Passwort.
 *
 * Eingebettet im MA-Bearbeiten-Tab (MaInlineDetail). Nur sichtbar wenn
 * `features.maVerwaltungPasswort` (pl + dev). Das echte Kuerzel zu `anonId`
 * kommt seit v2.17 ohne De-Anon-Passwort direkt via `useDeAnonResolver` (der
 * PL-Build ist beim App-Start per Rollen-Passwort gated).
 *
 * „Generieren" erzeugt eine 2-Wort-Passphrase, verschluesselt das Kuerzel und
 * haengt/ersetzt den Eintrag in `_intern/auslastung-zugang.enc`. Das
 * Klartext-Passwort wird der PL EINMALIG im PasswortAnzeigeDialog gezeigt.
 */
import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isMaVerwaltungPasswortEnabled } from '@/config/feature-flags';
import {
  addOrReplaceEintrag,
  loadZugangFile,
} from '@/core/services/infrastructure/zugang-config';
import { generatePassphrase } from '@/core/services/infrastructure/passphrase-woerter';
import { useDeAnonResolver } from './AnonymIdBadge';
import { PasswortAnzeigeDialog, type ZugangPasswortEintrag } from './PasswortAnzeigeDialog';

export function ZugangPasswortSection({ anonId }: { anonId: string }): React.ReactElement | null {
  const storage = useStorage();
  const resolveName = useDeAnonResolver();
  const [hasEntry, setHasEntry] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<ZugangPasswortEintrag[] | null>(null);

  // Existenz des Eintrags pruefen (Label „generieren" vs „neu generieren").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const file = await loadZugangFile(storage.idb);
      if (cancelled) return;
      setHasEntry(!!file?.eintraege.some(e => e.anonId === anonId));
    })();
    return () => { cancelled = true; };
  }, [storage, anonId]);

  const genAction = useAsyncAction(async () => {
    const kuerzel = resolveName(anonId);
    if (!kuerzel) {
      throw new Error('Kein Klartext-Kürzel zu dieser MA-ID auflösbar (Kürzel-Map unvollständig?).');
    }
    const passwort = generatePassphrase();
    await addOrReplaceEintrag(storage.idb, anonId, kuerzel, passwort);
    setHasEntry(true);
    setDialog([{ anonId, kuerzel, passwort }]);
  });

  if (!isMaVerwaltungPasswortEnabled()) return null;

  return (
    <div className="flex flex-col gap-1 md:col-span-2">
      <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] inline-flex items-center gap-1.5">
        <KeyRound size={11} /> Zugangspasswort (MA-Login)
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { void genAction.run(); }}
          disabled={genAction.busy}
          className="h-7 px-3 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text)' }}
        >
          {genAction.busy ? 'Erzeuge…' : hasEntry ? 'Passwort neu generieren' : 'Zugangspasswort generieren'}
        </button>
        {hasEntry && !genAction.busy && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            Eintrag vorhanden — „neu generieren" macht das alte Passwort ungültig.
          </span>
        )}
        {genAction.error && (
          <span className="text-[11.5px] text-[var(--tf-danger-text)]">{genAction.error}</span>
        )}
      </div>
      {dialog && (
        <PasswortAnzeigeDialog eintraege={dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
