/**
 * ZugangVerwaltungDialog (v2.12) — Übersicht + Verwaltung der MA-Zugangspasswörter.
 *
 * Ersetzt die frühere reine „Batch-Erzeugung": die PL sieht hier ALLE aktiven
 * MAs und kann pro MA ein Passwort (neu) erzeugen + per „✉ E-Mail" versenden.
 *
 * WICHTIG (Sicherheits-Modell): bereits gesetzte Passwörter liegen nur
 * verschlüsselt vor und können NICHT im Klartext zurückgeholt werden. Zum
 * erneuten Versenden muss ein NEUES Passwort erzeugt werden („Neu erzeugen" →
 * macht das alte ungültig). Frisch erzeugte Passwörter werden nur in-memory
 * gehalten (verschwinden beim Schließen).
 */
import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Copy, Check, X, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  addOrReplaceEintrag,
  addOrReplaceManyEintraege,
  loadZugangFile,
} from '@/core/services/infrastructure/zugang-config';
import { generatePassphrase } from '@/core/services/infrastructure/passphrase-woerter';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { buildKuerzelMailMap, buildMailtoUrl } from '../services/tib-mail';
import { DEFAULT_ZUGANG_EMAIL_BETREFF, DEFAULT_ZUGANG_EMAIL_VORLAGE } from '../types';

export interface MaZugangItem {
  anonId: string;
  /** Echtes Kuerzel (aus der De-Anon-Session aufgeloest). */
  kuerzel: string;
}

interface Props {
  /** Alle aktiven MAs (mit aufgeloestem Kuerzel). */
  maListe: MaZugangItem[];
  onClose: () => void;
}

export function ZugangVerwaltungDialog({ maListe, onClose }: Props): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const betreff = config.zugangEmailBetreff ?? DEFAULT_ZUGANG_EMAIL_BETREFF;
  const vorlage = config.zugangEmailVorlage ?? DEFAULT_ZUGANG_EMAIL_VORLAGE;
  const cache = useAntraegeCache();
  const mailMap = useMemo(() => buildKuerzelMailMap(cache.antraege), [cache.antraege]);

  // anonIds mit einem (verschluesselt) gespeicherten Zugang. Mount-Read ist
  // bewusst NUR lesend (kein Write) → kein React-StrictMode-Doppel-Write.
  const [entrySet, setEntrySet] = useState<Set<string>>(new Set());
  // Frisch erzeugte Klartext-Passwoerter (nur in-memory, diese Sitzung).
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await loadZugangFile(storage.idb);
        if (cancelled) return;
        setEntrySet(new Set((file?.eintraege ?? []).map(e => e.anonId)));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const copy = (text: string, key: string): void => {
    navigator.clipboard?.writeText(text)
      .then(() => {
        setCopied(key);
        window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
      })
      .catch(() => { /* Clipboard nicht verfuegbar — Wert ist sichtbar. */ });
  };

  const missing = useMemo(
    () => maListe.filter(m => !entrySet.has(m.anonId) && !generated[m.anonId]),
    [maListe, entrySet, generated],
  );

  const genMissing = useAsyncAction(async () => {
    if (missing.length === 0) return;
    const items = missing.map(m => ({ anonId: m.anonId, kuerzel: m.kuerzel, passwort: generatePassphrase() }));
    await addOrReplaceManyEintraege(storage.idb, items);
    setGenerated(prev => {
      const next = { ...prev };
      for (const it of items) next[it.anonId] = it.passwort;
      return next;
    });
    setEntrySet(prev => { const n = new Set(prev); for (const it of items) n.add(it.anonId); return n; });
  });

  const regenOne = useAsyncAction(async (anonId: string, kuerzel: string) => {
    const passwort = generatePassphrase();
    await addOrReplaceEintrag(storage.idb, anonId, kuerzel, passwort);
    setGenerated(prev => ({ ...prev, [anonId]: passwort }));
    setEntrySet(prev => new Set(prev).add(anonId));
  });

  const regenAll = useAsyncAction(async () => {
    const items = maListe.map(m => ({ anonId: m.anonId, kuerzel: m.kuerzel, passwort: generatePassphrase() }));
    await addOrReplaceManyEintraege(storage.idb, items);
    const gen: Record<string, string> = {};
    for (const it of items) gen[it.anonId] = it.passwort;
    setGenerated(gen);
    setEntrySet(new Set(maListe.map(m => m.anonId)));
    setConfirmAll(false);
  });

  const anyBusy = genMissing.busy || regenOne.busy || regenAll.busy;
  const actionError = genMissing.error ?? regenOne.error ?? regenAll.error;
  const generatedCount = Object.keys(generated).length;

  const copyAll = (): void => {
    const lines = maListe.filter(m => generated[m.anonId]).map(m => `${m.kuerzel}\t${generated[m.anonId]}`);
    if (lines.length > 0) copy(lines.join('\n'), '__all__');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4" // allow-raw-modal: legacy — bei nächster Anfassung auf Dialog migrieren
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[90vh] rounded-[16px] flex flex-col bg-[var(--tf-bg)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--tf-primary)]" />
            <h2 className="text-[15px] font-medium text-[var(--tf-text)]">Zugangspasswörter ({maListe.length} aktive MAs)</h2>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]" aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
          <p
            className="text-[12px] leading-relaxed"
            style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)', borderRadius: 8, padding: '8px 10px' }}
          >
            Bereits gesetzte Passwörter sind verschlüsselt gespeichert und können <strong>nicht erneut angezeigt</strong>{' '}
            werden. Zum erneuten Versenden „Neu erzeugen" — das alte Passwort wird dabei ungültig. Frisch erzeugte
            Passwörter bitte sicher notieren bzw. per „✉ E-Mail" versenden.
          </p>

          {/* Aktionen */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => genMissing.run()}
              disabled={anyBusy || missing.length === 0}
              className="h-7 px-3 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50"
              style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text)' }}
            >
              {genMissing.busy ? 'Erzeuge…' : `Fehlende erzeugen (${missing.length})`}
            </button>
            {confirmAll ? (
              <span className="inline-flex items-center gap-2 text-[12px] text-[var(--tf-warning-text)]">
                Alle neu erzeugen — bestehende Passwörter werden ungültig.
                <button type="button" onClick={() => regenAll.run()} disabled={anyBusy} className="px-2 py-0.5 rounded-md text-[12px] font-medium cursor-pointer" style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}>
                  Bestätigen
                </button>
                <button type="button" onClick={() => setConfirmAll(false)} className="text-[12px] cursor-pointer hover:underline">Abbrechen</button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                disabled={anyBusy}
                className="h-7 px-3 rounded-md text-[12px] cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
              >
                <RefreshCw size={12} /> Alle neu erzeugen
              </button>
            )}
          </div>

          {(loadError || actionError) && (
            <div className="text-[12px] text-[var(--tf-danger-text)]">{loadError ?? actionError}</div>
          )}

          {/* Liste */}
          {loading ? (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">Lade…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {maListe.map(m => {
                const pw = generated[m.anonId];
                const email = mailMap.get(m.kuerzel) ?? '';
                return (
                  <div key={m.anonId} className="flex items-center gap-3 rounded-[8px] px-3 py-2" style={{ border: '0.5px solid var(--tf-border)' }}>
                    <span className="font-mono text-[12px] text-[var(--tf-text-secondary)] w-[130px] shrink-0 truncate" title={`${m.anonId} · ${m.kuerzel}`}>
                      {m.kuerzel} <span className="text-[var(--tf-text-tertiary)]">({m.anonId})</span>
                    </span>
                    {pw ? (
                      <>
                        <code className="flex-1 text-[13px] font-medium text-[var(--tf-text)] select-all">{pw}</code>
                        <a
                          href={buildMailtoUrl(email, betreff, vorlage, { kuerzel: m.kuerzel, passwort: pw, anonId: m.anonId })}
                          className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                          title={email ? `E-Mail an ${email}` : 'Keine E-Mail hinterlegt — Empfänger manuell eintragen'}
                        >
                          <Mail size={13} /> E-Mail
                        </a>
                        <button type="button" onClick={() => copy(pw, m.anonId)} className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer" aria-label="Passwort kopieren">
                          {copied === m.anonId ? <><Check size={13} /> Kopiert</> : <><Copy size={13} /> Kopieren</>}
                        </button>
                        <button type="button" onClick={() => regenOne.run(m.anonId, m.kuerzel)} disabled={anyBusy} className="shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-50" title="Neues Passwort erzeugen (altes wird ungültig)">
                          <RefreshCw size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-[12px] text-[var(--tf-text-tertiary)]">
                          {entrySet.has(m.anonId) ? '•••••••• (gesetzt)' : 'kein Passwort'}
                        </span>
                        <button type="button" onClick={() => regenOne.run(m.anonId, m.kuerzel)} disabled={anyBusy} className="shrink-0 h-7 px-2.5 rounded-md text-[11.5px] cursor-pointer disabled:opacity-50" style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}>
                          {entrySet.has(m.anonId) ? 'Neu erzeugen' : 'Erzeugen'}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          {generatedCount > 1 ? (
            <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer">
              {copied === '__all__' ? <><Check size={14} /> Alle kopiert</> : <><Copy size={14} /> Erzeugte kopieren (Kürzel + Passwort)</>}
            </button>
          ) : <span />}
          <Button onClick={onClose}>Fertig</Button>
        </div>
      </div>
    </div>
  );
}
