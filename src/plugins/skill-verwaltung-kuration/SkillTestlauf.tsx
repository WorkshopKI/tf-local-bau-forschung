import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { runSkill } from '@/core/services/skills';
import {
  runRegelChecks,
  splitSentences,
  type CheckResult,
  type QualitaetsRegel,
  type SkillRecord,
} from '@/core/services/skill-registry';
import { findVorhabensbeschreibung } from '@/plugins/antraege/kurzfassung/vbDokument';
import { listAllAntraegeListView } from '@/core/services/csv/idb-csv';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AntragListItem } from '@/core/services/csv/types';

const nn = '[Im Antrag nicht genannt]';

function buildStammdaten(item: AntragListItem): string {
  return [
    `- Förderkennzeichen: ${item.aktenzeichen}`,
    `- Akronym: ${item.akronym ?? nn}`,
    `- Titel: ${item.titel ?? nn}`,
    `- Antragsteller: ${item.antragsteller ?? nn}`,
  ].join('\n');
}

/** Scannt `doc:*` EINMAL und sammelt alle Tags VB-getaggter Dokumente. */
async function loadFkzWithVb(idb: IDBStore): Promise<Set<string>> {
  const entries = await idb.entries('doc:');
  const set = new Set<string>();
  for (const [, val] of entries) {
    const tags = (val as { tags?: unknown }).tags;
    const list = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
    if (!list.includes('vorhabensbeschreibung')) continue;
    for (const t of list) set.add(t);
  }
  return set;
}

interface RunResult {
  finalerText: string;
  saetze: number;
  zeichen: number;
  dauerS: number;
  modell: string;
  checks: CheckResult[];
}

interface SkillTestlaufProps {
  skill: SkillRecord;
  regeln: QualitaetsRegel[];
  /** Zusatz hinter dem Titel, z.B. „v3, ungespeicherte Änderungen". */
  hinweis?: string;
  onClose: () => void;
}

export function SkillTestlauf({ skill, regeln, hinweis, onClose }: SkillTestlaufProps): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();

  const [antraege, setAntraege] = useState<AntragListItem[]>([]);
  const [vbSet, setVbSet] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, vb] = await Promise.all([listAllAntraegeListView(storage.idb), loadFkzWithVb(storage.idb)]);
      if (cancelled) return;
      setAntraege(list);
      setVbSet(vb);
      const firstPick = list.find(a => vb.has(a.aktenzeichen));
      if (firstPick) setSelected(firstPick.aktenzeichen);
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (a: AntragListItem): boolean =>
      !q || [a.aktenzeichen, a.akronym, a.titel, a.antragsteller].some(v => (v ?? '').toLowerCase().includes(q));
    return antraege.filter(match).slice(0, 40);
  }, [antraege, query]);

  const run = async (): Promise<void> => {
    const item = antraege.find(a => a.aktenzeichen === selected);
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    try {
      const transport = bridge.getActiveTransport();
      if (!(await transport.ping())) {
        setError('KI nicht erreichbar — Testlauf derzeit nicht möglich.');
        return;
      }
      const vb = await findVorhabensbeschreibung(storage.idb, item.aktenzeichen);
      if (!vb) { setError('Keine Vorhabensbeschreibung gefunden.'); return; }
      const start = Date.now();
      const res = await runSkill(transport, skill, regeln, {
        stammdaten: buildStammdaten(item),
        vbMarkdown: vb.markdown,
      });
      const finalerText = res.parsed.finalerText;
      setResult({
        finalerText,
        saetze: splitSentences(finalerText).length,
        zeichen: finalerText.length,
        dauerS: Math.max(1, Math.round((Date.now() - start) / 1000)),
        modell: transport.name,
        checks: runRegelChecks(finalerText, regeln),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start overflow-auto py-12" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="relative bg-[var(--tf-bg)] rounded-[16px] w-[660px] max-w-[94%] p-6" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-[16px] font-medium m-0">Testlauf: {skill.name}</h2>
          {hinweis && <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">{hinweis}</span>}
        </div>

        {/* Antrag wählen */}
        <SectionHeader>Antrag wählen</SectionHeader>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Antrag suchen (FKZ, Akronym, Firma)…"
          className="w-full text-[13px] px-3 py-2 mb-2.5 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
        />
        <div className="max-h-[180px] overflow-auto -mx-1 px-1">
          {filtered.map(a => {
            const hasVb = vbSet.has(a.aktenzeichen);
            const isSel = selected === a.aktenzeichen;
            return (
              <button
                key={a.aktenzeichen}
                disabled={!hasVb}
                onClick={() => hasVb && setSelected(a.aktenzeichen)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] border-[0.5px] text-left ${isSel ? 'bg-[var(--tf-primary-light)] border-[var(--tf-border)]' : 'border-transparent hover:bg-[var(--tf-hover)]'} ${!hasVb ? 'cursor-not-allowed' : ''}`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 relative ${isSel ? 'border-[var(--tf-primary)]' : 'border-[var(--tf-border-hover)]'}`}>
                  {isSel && <span className="absolute inset-[3px] rounded-full bg-[var(--tf-primary)]" />}
                </span>
                <span className={`font-mono text-[13px] ${hasVb ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'}`}>{a.aktenzeichen}</span>
                <span className={`text-[13px] ${hasVb ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text-tertiary)]'}`}>
                  · {a.akronym ?? '—'}{a.antragsteller ? ` · ${a.antragsteller}` : ''}
                </span>
                <span className="flex-1" />
                {hasVb
                  ? <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-success-bg)] text-[var(--tf-success-text)] whitespace-nowrap">VB vorhanden ✓</span>
                  : <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] whitespace-nowrap">keine VB</span>}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-2">Keine Anträge gefunden.</p>}
        </div>

        {error && (
          <div className="rounded p-2.5 text-[12px] mt-3" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {error}</div>
        )}

        {/* Ergebnis */}
        {result && (
          <div className="mt-5">
            <SectionHeader>Ergebnis</SectionHeader>
            <p className="text-[13.5px] leading-[1.7] text-[var(--tf-text)] m-0 whitespace-pre-wrap">{result.finalerText}</p>
            <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-2.5">
              {result.saetze} Sätze · {result.zeichen.toLocaleString('de-DE')} Zeichen · {result.dauerS} s · {result.modell}
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              {result.checks.map(c => (
                <div key={c.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-3.5 text-center" style={{ color: c.level === 'ok' ? 'var(--tf-success-text)' : c.level === 'fehler' ? 'var(--tf-danger-text)' : 'var(--tf-warning-text)' }}>
                    {c.level === 'ok' ? '✓' : c.level === 'fehler' ? '✕' : '!'}
                  </span>
                  <span className={c.level === 'ok' ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}>
                    {c.label}{c.detail ? ` — ${c.detail}` : ''}
                  </span>
                  <span className="flex-1" />
                  {c.level === 'fehler' && <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]">Fehler</span>}
                  {c.level === 'hinweis' && <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">Hinweis</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fußzeile */}
        <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-2.5">
          <span className="flex-1 text-[11.5px] text-[var(--tf-text-tertiary)]">Testläufe verändern keine Arbeitsstände.</span>
          <button
            disabled={!selected || busy}
            onClick={() => { void run(); }}
            className="text-[13px] px-4 py-2 rounded-[8px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-50"
          >
            {busy ? 'Läuft…' : result ? 'Erneut ausführen' : 'Ausführen'}
          </button>
          <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-[8px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">Schließen</button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">{children}</span>
      <span className="flex-1 h-[0.5px] bg-[var(--tf-border)]" />
    </div>
  );
}
