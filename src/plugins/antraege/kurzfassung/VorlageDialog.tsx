/**
 * Vorlagen-Dialog (Gutachten-Durchstich). Layout nach `mockup-vorlage-dialog.html`:
 * Vorlagen-Liste (live aus dem Verzeichnis) → Feld-Mapping-Statustabelle (Dry-Run)
 * → Anker-Status → Erstellen. Funktioniert ohne LLM.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { Antrag } from '@/core/services/csv/types';
import {
  getVorlagenHandle, pickVorlagenVerzeichnis, ensureReadPermission, listVorlagen, readVorlage,
  fillTemplate, saveGutachtenDocx,
  type VorlageEintrag, type FillResult, type SaveResult,
  type AbschnittEinfuegung, type AbschnittAnzeige,
} from '@/core/services/gutachten-vorlagen';

interface Props {
  open: boolean;
  antrag: Antrag;
  /** Freigegebene Abschnitte (mit Anker + Text), die eingefügt werden. */
  sections: AbschnittEinfuegung[];
  /**
   * Optionale Voll-Liste A–G für den „Abschnitte"-Block (Gutachten-Workflow).
   * Fehlt sie, zeigt der Dialog die Kurzfassung-Einzelansicht (Back-Compat).
   */
  abschnitte?: AbschnittAnzeige[];
  onClose: () => void;
}

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GHOST = 'px-4 py-2 rounded-[8px] text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]';

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

export function VorlageDialog({ open, antrag, sections, abschnitte, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [vorlagen, setVorlagen] = useState<VorlageEintrag[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<FillResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState<(SaveResult & { filename: string }) | null>(null);

  async function loadList(h: FileSystemDirectoryHandle): Promise<void> {
    const granted = await ensureReadPermission(h);
    if (!granted) { setError('Lese-Zugriff auf das Vorlagen-Verzeichnis wurde nicht erteilt.'); return; }
    const list = await listVorlagen(h);
    setVorlagen(list);
    if (list[0]) { setSelected(list[0].name); await runDryRun(h, list[0].name); }
  }

  async function runDryRun(h: FileSystemDirectoryHandle, name: string): Promise<void> {
    setBusy(true); setError(null);
    try {
      const buf = await readVorlage(h, name);
      setDryRun(await fillTemplate(buf, antrag, sections, { dryRun: true }));
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError(null); setErstellt(null); setDryRun(null); setSelected(null); setVorlagen([]); setLoaded(false);
      try {
        const h = await getVorlagenHandle(storage.idb);
        if (cancelled) return;
        setHandle(h);
        if (h) await loadList(h);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, storage.idb]);

  function select(name: string): void {
    setSelected(name);
    if (handle) void runDryRun(handle, name);
  }

  async function pick(): Promise<void> {
    setBusy(true); setError(null);
    try {
      const h = await pickVorlagenVerzeichnis(storage.idb);
      if (!h) return;
      setHandle(h);
      await loadList(h);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function erstellen(): Promise<void> {
    if (!handle || !selected) return;
    setBusy(true); setError(null);
    try {
      const buf = await readVorlage(handle, selected);
      const res = await fillTemplate(buf, antrag, sections, {});
      if (!res.blob) throw new Error('Vorlage konnte nicht erzeugt werden.');
      const saved = await saveGutachtenDocx(storage.idb, res.blob, res.filename);
      setErstellt({ ...saved, filename: res.filename });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  if (!open) return null;

  const footer = erstellt
    ? <button type="button" className={BTN_PRIMARY} onClick={onClose}>Schließen</button>
    : (
      <>
        <button type="button" className={BTN_GHOST} onClick={onClose}>Abbrechen</button>
        <button type="button" className={BTN_PRIMARY} disabled={busy || !selected} onClick={() => { void erstellen(); }}>
          {busy ? 'Erstelle…' : 'Erstellen'}
        </button>
      </>
    );

  return (
    <Dialog open={open} onClose={onClose} title="Gutachten-Vorlage ausfüllen" footer={footer}>
      {error && (
        <div className="mb-3 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">{error}</div>
      )}

      {erstellt ? (
        <div>
          <div className="flex items-center gap-2 text-[13px] text-[var(--tf-text)]">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">✓</span>
            <span className="font-mono text-[12px]">{erstellt.filename}</span>
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
            {erstellt.ort === 'persoenlich'
              ? `Abgelegt im persönlichen Ordner: ${erstellt.pfad}`
              : 'Als Download bereitgestellt (kein persönlicher Ordner verbunden).'}
          </p>
        </div>
      ) : !loaded ? (
        <div className="py-3 flex items-center gap-2 text-[13px] text-[var(--tf-text-tertiary)]"><Loader2 size={14} className="animate-spin" />Laden…</div>
      ) : !handle ? (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Noch kein Vorlagen-Verzeichnis verbunden. Wählen Sie das DMS-Verzeichnis mit den Gutachten-Vorlagen.
          </p>
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => { void pick(); }}>
            Vorlagen-Verzeichnis verbinden
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Vorlagen-Liste */}
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Vorlage</div>
            {vorlagen.length === 0 ? (
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">Keine .docx-Vorlagen im Verzeichnis gefunden.</p>
            ) : (
              <div className="flex flex-col">
                {vorlagen.map(v => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => select(v.name)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left ${selected === v.name ? 'bg-[var(--tf-primary-light)]' : 'hover:bg-[var(--tf-hover)]'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border ${selected === v.name ? 'border-[var(--tf-primary)]' : 'border-[var(--tf-border-hover)]'} relative shrink-0`}>
                      {selected === v.name && <span className="absolute inset-[3px] rounded-full bg-[var(--tf-primary)]" />}
                    </span>
                    <span className="font-mono text-[12px] text-[var(--tf-text)]">{v.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">geändert {formatDate(v.lastModified)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Feld-Mapping-Status */}
          {dryRun && (
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Feld-Zuordnung</div>
              {dryRun.mappedFields.length === 0 ? (
                <p className="text-[12px] text-[var(--tf-text-tertiary)]">Keine Platzhalter in dieser Vorlage gefunden.</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {dryRun.mappedFields.map((f, i) => (
                      <tr key={f.code} className={i > 0 ? 'border-t-[0.5px] border-[var(--tf-border)]' : ''}>
                        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--tf-text-secondary)] whitespace-nowrap align-middle">{f.code}</td>
                        <td className="py-2 pr-3 text-[12.5px] text-[var(--tf-text)] align-middle">
                          {f.befuellbar ? <span className="line-clamp-1">{f.value || '—'}</span> : <span className="text-[var(--tf-text-tertiary)]">—</span>}
                        </td>
                        <td className="py-2 text-right align-middle whitespace-nowrap">
                          {f.befuellbar
                            ? <span className="text-[var(--tf-success-text)] text-[13px]">✓</span>
                            : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">nicht befüllbar</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Anker-Status: Abschnitte-Tabelle (Workflow) ODER Kurzfassung-Einzelansicht */}
          {dryRun && abschnitte ? (
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Abschnitte</div>
              <div className="flex flex-col">
                {abschnitte.map((a, i) => {
                  const st = dryRun.sections.find(s => s.id === a.id);
                  const eingefuegt = a.freigegeben && !!st?.anchorFound;
                  const ankerFehlt = a.freigegeben && !st?.anchorFound;
                  return (
                    <div key={a.id} className={`flex items-start gap-3.5 py-2.5 ${i > 0 ? 'border-t-[0.5px] border-[var(--tf-border)]' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[var(--tf-text)]">{a.id} — {a.label}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-[var(--tf-text-tertiary)]">nach „{a.anker}"</div>
                      </div>
                      <span className="text-[12px] whitespace-nowrap shrink-0 leading-[1.6]">
                        {eingefuegt
                          ? <span className="text-[var(--tf-success-text)]">wird eingefügt ✓</span>
                          : ankerFehlt
                            ? <span className="text-[var(--tf-warning-text)]">Anker nicht gefunden — wird übersprungen</span>
                            : <span className="text-[var(--tf-text-tertiary)]">übersprungen — nicht freigegeben</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3.5 text-[12px] text-[var(--tf-text-secondary)]">
                {dryRun.eingefuegteAnzahl} von {abschnitte.length} Abschnitten werden eingefügt.
              </div>
            </div>
          ) : dryRun && (
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Kurzfassung</div>
              {dryRun.sections[0]?.anchorFound ? (
                <div className="flex items-baseline gap-2 text-[13px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-success-text)]">✓</span>
                  <span>Kurzfassung → wird nach „Kurzfassung der Projektbeschreibung" eingefügt</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 text-[13px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-warning-text)] font-medium">!</span>
                  <span>Anker in Vorlage nicht gefunden — Kurzfassung wird <span className="text-[var(--tf-warning-text)]">NICHT</span> eingefügt. Die Vorlage wird trotzdem erstellt.</span>
                </div>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">Die Datei wird in Ihrem persönlichen Ordner abgelegt.</p>
        </div>
      )}
    </Dialog>
  );
}
