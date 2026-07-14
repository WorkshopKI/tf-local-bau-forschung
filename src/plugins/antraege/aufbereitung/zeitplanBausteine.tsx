/**
 * Geteilte, präsentationale Bausteine des Zeitplan-Tabs (Kennzahlen-Karte,
 * Befund-Zeile, Stat) — von `ZeitplanTab` (Solo) UND `VerbundZeitplan` (pro TV)
 * genutzt. Eigenes Modul, um einen Import-Zyklus zwischen beiden zu vermeiden.
 */
import { StatusDot } from '@/components/ui/StatusBadge';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { befundKey } from './store';
import { summePm } from './tabellen';
import type { ApZeile, Befund } from './tabellen';

const WARN = '#f59e0b';
const INFO = 'var(--tf-text-secondary)';

export function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[13px] text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

export function KennzahlenKarte({
  zeilen, quelleName, quelleHash,
}: {
  zeilen: ApZeile[];
  quelleName: string;
  quelleHash: string | null;
}): React.ReactElement {
  const gesamtPm = summePm(zeilen);
  const oberCount = zeilen.filter(z => !z.istUnterAp).length;
  const unterCount = zeilen.filter(z => z.istUnterAp).length;
  const maCount = new Set(zeilen.map(z => z.maNr).filter((m): m is string => !!m && m.trim() !== '')).size;
  const hashKurz = quelleHash ? (quelleHash.length > 6 ? `${quelleHash.slice(0, 4)}…${quelleHash.slice(-2)}` : quelleHash) : '–';

  return (
    <div className="shrink-0 w-[210px] rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="text-[13px] font-medium text-[var(--tf-text)] mb-3">Kennzahlen</div>
      <Stat label="Gesamt-PM" value={gesamtPm > 0 ? String(gesamtPm) : '–'} />
      <Stat label="APs" value={`${oberCount}${unterCount > 0 ? ` (+${unterCount} Unter-APs)` : ''}`} />
      <Stat label="Quelle" value={`${quelleName} (Hash ${hashKurz})`} />
      <Stat label="Eingesetzte MA" value={maCount > 0 ? String(maCount) : '–'} />
    </div>
  );
}

export function BefundZeile({
  befund, offen, toggle,
}: {
  befund: Befund;
  offen: boolean;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <StatusDot color={befund.schwere === 'warnung' ? WARN : INFO} size={7} className="mt-1.5"
        title={befund.schwere === 'warnung' ? 'Warnung' : 'Hinweis'} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--tf-text)] leading-snug">{befund.text}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {befund.quellen.map((q, i) => (
            <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}>
              {q.rolle === 'anlage5' ? 'Anl. 5' : q.sektionId ? `§ ${q.sektionId}` : 'Text-Projektplan'}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggle.run(befundKey(befund))}
        disabled={toggle.busy}
        title="wird später an Nachforderungen angebunden"
        className="shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
      >
        {offen ? '✓ Offener Punkt' : 'Als offenen Punkt übernehmen'}
      </button>
    </div>
  );
}
