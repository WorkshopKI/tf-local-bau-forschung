/**
 * Vorlagen-Dialog (Gutachten-Durchstich). Layout nach `mockup-vorlage-dialog.html`:
 * Vorlagen-Liste (live aus dem Verzeichnis) → Feld-Mapping-Statustabelle (Dry-Run)
 * → Anker-Status → Erstellen. Funktioniert ohne LLM.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/ui/Dialog';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { useStorage } from '@/core/hooks/useStorage';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import type { Antrag } from '@/core/services/csv/types';
import {
  getVorlagenHandle, pickVorlagenVerzeichnis, ensureReadPermission, listVorlagen, readVorlage,
  fillTemplate, saveGutachtenDocx,
  type VorlageEintrag, type FillResult, type SaveResult,
  type ArtefaktBlock, type AbschnittAnzeige,
} from '@/core/services/gutachten-vorlagen';

interface Props {
  open: boolean;
  antrag: Antrag;
  /** Freigegebene Blöcke (mit Anker + Text), die eingefügt werden (GA-Abschnitte oder NF). */
  sections: ArtefaktBlock[];
  /**
   * Optionale Voll-Liste A–G für den „Abschnitte"-Block (Gutachten-Workflow).
   * Fehlt sie, zeigt der Dialog die Kurzfassung-Einzelansicht (Back-Compat).
   */
  abschnitte?: AbschnittAnzeige[];
  /**
   * Optionaler Audit-Callback nach erfolgreichem Erstellen (Artefakt-Engine):
   * liefert den Vorlagen-Pfad + Inhalts-Hash, damit der Aufrufer `vorlageRef`
   * stempeln kann. Fehlt er, ist das Verhalten unverändert (Kurzfassung).
   */
  onErstellt?: (info: { pfad: string; hash?: string }) => void;
  /** Dateinamen-Präfix je Artefakt-Typ (Artefakt-Engine). Default `Gutachten_EP`. */
  dateiPrefix?: string;
  onClose: () => void;
}

/**
 * Klartext-Namen der Einzel-Blöcke für die Anzeige. Der Block trägt eine `id`
 * (`KF`, `NF`, `RNE`, `ABL`) — die Einzelansicht des Dialogs nannte bis v4.122
 * stattdessen fest „Kurzfassung", auch beim Nachforderungs-Export.
 */
const BLOCK_NAME: Record<string, string> = {
  KF: 'Kurzfassung',
  NF: 'Nachforderung',
  RNE: 'Tragende Gründe',
  ABL: 'Ablehnung',
};

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

export function VorlageDialog({ open, antrag, sections, abschnitte, onErstellt, dateiPrefix, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [vorlagen, setVorlagen] = useState<VorlageEintrag[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<FillResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erstellt, setErstellt] = useState<(SaveResult & { filename: string }) | null>(null);
  // Name + Anker des EINEN Blocks (Einzelansicht) — aus den Daten, nicht behauptet.
  const einzel = sections[0];
  const einzelName = einzel ? BLOCK_NAME[einzel.id] ?? einzel.id : 'Inhalt';
  const einzelAnker = einzel?.anker ?? '—';
  // Ist ein persoenlicher Ordner verbunden? `null` = noch nicht geprueft.
  const [persOrdnerDa, setPersOrdnerDa] = useState<boolean | null>(null);

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
      setDryRun(await fillTemplate(buf, antrag, sections, { dryRun: true, ...(dateiPrefix ? { dateiPrefix } : {}) }));
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
        const pers = await getPersoenlichHandle(storage.idb).catch(() => null);
        if (!cancelled) setPersOrdnerDa(pers !== null);
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
      const res = await fillTemplate(buf, antrag, sections, { ...(dateiPrefix ? { dateiPrefix } : {}) });
      if (res.fehler) { setError(res.fehler); return; }
      if (!res.blob) throw new Error('Vorlage konnte nicht erzeugt werden.');
      const saved = await saveGutachtenDocx(storage.idb, res.blob, res.filename);
      setErstellt({ ...saved, filename: res.filename });
      onErstellt?.({ pfad: selected, hash: res.hash });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  if (!open) return null;

  const footer = erstellt
    ? <Button variant="primary" onClick={onClose}>Schließen</Button>
    : (
      <>
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button variant="primary" loading={busy} disabled={!selected} onClick={() => { void erstellen(); }}>
          Erstellen
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // Nicht fest „Gutachten": denselben Dialog benutzen NF, RNE und ABL.
      title={abschnitte ? 'Gutachten-Vorlage ausfüllen' : `Vorlage ausfüllen — ${einzelName}`}
      footer={footer}
      size="lg"
    >
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
          <Button variant="primary" disabled={busy} onClick={() => { void pick(); }}>
            Vorlagen-Verzeichnis verbinden
          </Button>
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

          {/* Feld-Mapping-Status — einklappbar (lange DMS-Platzhalter-Liste); Zähler im Kopf */}
          {dryRun && (
            dryRun.mappedFields.length === 0 ? (
              <div>
                <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">Feld-Zuordnung</div>
                <p className="text-[12px] text-[var(--tf-text-tertiary)]">Keine Platzhalter in dieser Vorlage gefunden.</p>
              </div>
            ) : (
              <CollapsibleSection
                label="Feld-Zuordnung"
                subtitle={`${dryRun.mappedFields.filter(f => f.befuellbar).length} von ${dryRun.mappedFields.length} befüllbar`}
                defaultOpen={false}
              >
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
              </CollapsibleSection>
            )
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
              {/* Anker und Bezeichnung kommen aus `sections[0]`, nicht als Literal:
                  in diesen Zweig fallen inzwischen auch NF/RNE/ABL aus der Werkbank,
                  und der Dialog nannte dort „Kurzfassung der Projektbeschreibung",
                  während der Füller nach „Nachforderungen" bzw. „Tragende Gründe"
                  gesucht hatte (v4.124). */}
              <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">{einzelName}</div>
              {dryRun.sections[0]?.anchorFound ? (
                <div className="flex items-baseline gap-2 text-[13px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-success-text)]">✓</span>
                  <span>{einzelName} → wird nach „{einzelAnker}" eingefügt</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 text-[13px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-warning-text)] font-medium">!</span>
                  <span>Anker „{einzelAnker}" in der Vorlage nicht gefunden — {einzelName} wird <span className="text-[var(--tf-warning-text)]">NICHT</span> eingefügt. Die Vorlage wird trotzdem erstellt.</span>
                </div>
              )}
            </div>
          )}

          {/* Der Ort hängt daran, ob ein persönlicher Ordner verbunden ist —
              `saveGutachtenDocx` fällt sonst auf einen Browser-Download zurück.
              Die Ankündigung sagte das bis v4.122 nicht, obwohl der Nach-Zustand
              des Dialogs den Unterschied korrekt benennt. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {persOrdnerDa === null
              ? 'Die Datei wird abgelegt, sobald sie erstellt ist.'
              : persOrdnerDa
                ? 'Die Datei wird in Ihrem persönlichen Ordner abgelegt.'
                : 'Kein persönlicher Ordner verbunden — die Datei wird als Download bereitgestellt.'}
          </p>
        </div>
      )}
    </Dialog>
  );
}
